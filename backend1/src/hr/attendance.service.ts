import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Attendance, type AttendanceStatus } from './attendance.entity';
import { AttendanceRequest } from './attendance-request.entity';
import { EmployeeProfile } from './employee-profile.entity';
import { UpsertAttendanceDto } from './dto/upsert-attendance.dto';
import { PunchAttendanceDto } from './dto/punch-attendance.dto';

const NON_WORKING: string[] = ['absent', 'leave', 'sick_leave', 'holiday'];

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance) private readonly repo: Repository<Attendance>,
    @InjectRepository(EmployeeProfile) private readonly empRepo: Repository<EmployeeProfile>,
    @InjectRepository(AttendanceRequest)
    private readonly reqRepo: Repository<AttendanceRequest>,
  ) {}

  private enrich(a: Attendance) {
    return {
      ...a,
      employee_code: a.employee?.employee_code ?? null,
      employee_name: a.employee
        ? `${a.employee.first_name} ${a.employee.last_name}`.trim()
        : null,
    };
  }

  private hoursBetween(checkIn: string | null, checkOut: string | null) {
    if (!checkIn || !checkOut) return 0;
    const [inH, inM] = checkIn.split(':').map(Number);
    const [outH, outM] = checkOut.split(':').map(Number);
    const mins = outH * 60 + outM - (inH * 60 + inM);
    return mins > 0 ? mins / 60 : 0;
  }

  async list(params: { employee_id?: string; from?: string; to?: string }) {
    const from = params.from ?? new Date().toISOString().slice(0, 8) + '01';
    const to = params.to ?? new Date().toISOString().slice(0, 10);
    if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)))
      throw new BadRequestException('Invalid date range');

    const where: Record<string, unknown> = { work_date: Between(from, to) };
    if (params.employee_id) where.employee_id = params.employee_id;

    const rows = await this.repo.find({
      where,
      order: { work_date: 'DESC' },
    });
    const items = rows.map((r) => this.enrich(r));

    const summary = {
      from,
      to,
      total_records: items.length,
      present_days: items.filter((i) => !NON_WORKING.includes(i.status)).length,
      absent_days: items.filter((i) => i.status === 'absent').length,
      leave_days: items.filter((i) => i.status === 'leave' || i.status === 'sick_leave').length,
      total_hours: items.reduce((s, i) => s + Number(i.worked_hours), 0).toFixed(2),
      total_overtime: items.reduce((s, i) => s + Number(i.overtime_hours), 0).toFixed(2),
    };
    return { items, summary };
  }

  /** Create or overwrite the single row for that employee/day. */
  async upsert(dto: UpsertAttendanceDto, actor: string) {
    const employee = await this.empRepo.findOne({ where: { id: dto.employee_id } });
    if (!employee) throw new BadRequestException('Unknown employee — pick one from the list');
    if (employee.employment_status === 'terminated')
      throw new BadRequestException('Cannot record attendance for a terminated employee');

    const workDate = dto.work_date.slice(0, 10);
    if (new Date(workDate) > new Date(new Date().toISOString().slice(0, 10)))
      throw new BadRequestException('Attendance cannot be recorded for a future date');
    if (new Date(workDate) < new Date(employee.join_date))
      throw new BadRequestException('Attendance date is before the employee joined');

    const working = !NON_WORKING.includes(dto.status);
    if (working && (!dto.check_in || !dto.check_out))
      throw new BadRequestException('Check-in and check-out are required for a worked day');
    if (dto.check_in && dto.check_out && this.hoursBetween(dto.check_in, dto.check_out) <= 0)
      throw new BadRequestException('Check-out must be later than check-in');

    const existing = await this.repo.findOne({
      where: { employee_id: dto.employee_id, work_date: workDate },
    });
    const entity =
      existing ??
      this.repo.create({
        employee_id: dto.employee_id,
        work_date: workDate,
        created_by: actor,
      });

    entity.status = dto.status;
    entity.check_in = working ? (dto.check_in ?? null) : null;
    entity.check_out = working ? (dto.check_out ?? null) : null;
    entity.worked_hours = (working ? this.hoursBetween(entity.check_in, entity.check_out) : 0)
      .toFixed(2);
    entity.overtime_hours = (dto.overtime_hours ?? 0).toFixed(2);
    entity.notes = dto.notes ?? null;
    entity.updated_by = actor;

    const saved = await this.repo.save(entity);
    return this.enrich(saved);
  }

  /**
   * Non-sensitive employee directory used by the self-service check-in screen.
   * Deliberately excludes salary, bank, Iqama, address and contact data.
   */
  async directory() {
    const rows = await this.empRepo.find({
      relations: { department: true },
      order: { employee_code: 'ASC' },
    });
    return rows
      .filter((e) => e.employment_status !== 'terminated')
      .map((e) => ({
        id: e.id,
        employee_code: e.employee_code,
        full_name: `${e.first_name} ${e.last_name}`.trim(),
        job_title: e.job_title,
        department_name: e.department?.name ?? null,
        employment_status: e.employment_status,
        join_date: e.join_date,
      }));
  }

  /** Self-service check-in / check-out for a single employee-day. */
  async punch(dto: PunchAttendanceDto, actor: string) {
    const employee = await this.empRepo.findOne({ where: { id: dto.employee_id } });
    if (!employee) throw new BadRequestException('Unknown employee — pick one from the list');
    if (employee.employment_status === 'terminated')
      throw new BadRequestException('Cannot record attendance for a terminated employee');

    const workDate = (dto.work_date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    if (new Date(workDate) > new Date(new Date().toISOString().slice(0, 10)))
      throw new BadRequestException('Attendance cannot be recorded for a future date');
    if (new Date(workDate) < new Date(employee.join_date))
      throw new BadRequestException('Attendance date is before the employee joined');

    const existing = await this.repo.findOne({
      where: { employee_id: dto.employee_id, work_date: workDate },
    });
    const entity =
      existing ??
      this.repo.create({
        employee_id: dto.employee_id,
        work_date: workDate,
        status: 'present',
        created_by: actor,
      });

    // Re-entry: the punch already holds a value for that day, so the change
    // is parked as a request instead of overwriting the stored record.
    const overwrites =
      existing && (dto.kind === 'in' ? !!existing.check_in : !!existing.check_out);
    if (overwrites) {
      const pending = await this.reqRepo.findOne({
        where: {
          employee_id: dto.employee_id,
          work_date: workDate,
          kind: dto.kind,
          status: 'pending',
        },
      });
      const req = pending ?? this.reqRepo.create({
        employee_id: dto.employee_id,
        work_date: workDate,
        kind: dto.kind,
        status: 'pending',
      });
      req.requested_time = dto.time;
      req.current_time_value = dto.kind === 'in' ? existing!.check_in : existing!.check_out;
      req.requested_by = actor;
      await this.reqRepo.save(req);
      return {
        id: existing!.id,
        employee_id: existing!.employee_id,
        work_date: existing!.work_date,
        status: existing!.status,
        check_in: existing!.check_in,
        check_out: existing!.check_out,
        worked_hours: existing!.worked_hours,
        pending_approval: true,
        pending_kind: dto.kind,
        pending_time: dto.time,
      };
    }

    if (dto.kind === 'in') {
      entity.status = NON_WORKING.includes(entity.status) ? 'present' : entity.status;
      entity.check_in = dto.time;
      if (entity.check_out && this.hoursBetween(dto.time, entity.check_out) <= 0)
        throw new BadRequestException('Check-in must be earlier than the recorded check-out');
    } else {
      if (!entity.check_in)
        throw new BadRequestException('Check in first before recording a check-out');
      if (this.hoursBetween(entity.check_in, dto.time) <= 0)
        throw new BadRequestException('Check-out must be later than the check-in time');
      entity.check_out = dto.time;
    }

    entity.worked_hours = this.hoursBetween(entity.check_in, entity.check_out).toFixed(2);
    entity.updated_by = actor;

    const saved = await this.repo.save(entity);
    return {
      id: saved.id,
      employee_id: saved.employee_id,
      work_date: saved.work_date,
      status: saved.status,
      check_in: saved.check_in,
      check_out: saved.check_out,
      worked_hours: saved.worked_hours,
      pending_approval: false,
    };
  }

  /** Today's (or a given day's) punch state for one employee — no sensitive data. */
  async dayState(employeeId: string, workDate: string) {
    const row = await this.repo.findOne({
      where: { employee_id: employeeId, work_date: workDate.slice(0, 10) },
    });
    if (!row) return null;
    const pending = await this.reqRepo.find({
      where: { employee_id: employeeId, work_date: workDate.slice(0, 10), status: 'pending' },
    });
    return {
      pending_approval: pending.length > 0,
      pending_requests: pending.map((p) => ({ kind: p.kind, time: p.requested_time })),
      id: row.id,
      employee_id: row.employee_id,
      work_date: row.work_date,
      status: row.status,
      check_in: row.check_in,
      check_out: row.check_out,
      worked_hours: row.worked_hours,
    };
  }

  /**
   * Aggregated attendance report for a date span — one row per employee.
   * Read-only; available to admin, manager and supervisor.
   */
  async report(params: { from?: string; to?: string; employee_id?: string; department_id?: string }) {
    const from = params.from ?? new Date().toISOString().slice(0, 8) + '01';
    const to = params.to ?? new Date().toISOString().slice(0, 10);
    if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)))
      throw new BadRequestException('Invalid date range');
    if (to < from) throw new BadRequestException('"To" date cannot be earlier than "From" date');

    const employees = await this.empRepo.find({
      relations: { department: true },
      order: { employee_code: 'ASC' },
    });
    const scoped = employees.filter(
      (e) =>
        (!params.employee_id || e.id === params.employee_id) &&
        (!params.department_id || e.department_id === params.department_id),
    );

    const where: Record<string, unknown> = { work_date: Between(from, to) };
    if (params.employee_id) where.employee_id = params.employee_id;
    const rows = await this.repo.find({ where });

    const byEmployee = new Map<string, Attendance[]>();
    for (const r of rows) {
      const list = byEmployee.get(r.employee_id) ?? [];
      list.push(r);
      byEmployee.set(r.employee_id, list);
    }

    // Saudi working week: Sunday–Thursday. Weekends are not expected days.
    const scheduledDays = (joinDate: string) => {
      const start = new Date(`${(joinDate > from ? joinDate : from).slice(0, 10)}T00:00:00Z`);
      const end = new Date(`${to}T00:00:00Z`);
      let n = 0;
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = d.getUTCDay();
        if (day !== 5 && day !== 6) n += 1;
      }
      return n;
    };

    const items = scoped.map((e) => {
      const recs = byEmployee.get(e.id) ?? [];
      const count = (s: AttendanceStatus) => recs.filter((r) => r.status === s).length;
      const present = count('present');
      const late = count('late');
      const halfDay = count('half_day');
      const absent = count('absent');
      const leave = count('leave');
      const sick = count('sick_leave');
      const holiday = count('holiday');
      const workedDays = present + late + halfDay;
      const totalHours = recs.reduce((s, r) => s + Number(r.worked_hours), 0);
      const overtime = recs.reduce((s, r) => s + Number(r.overtime_hours), 0);
      const scheduled = scheduledDays(e.join_date);
      const expected = Math.max(scheduled - holiday, 0);
      const dates = recs.map((r) => r.work_date).sort();

      return {
        employee_id: e.id,
        employee_code: e.employee_code,
        employee_name: `${e.first_name} ${e.last_name}`.trim(),
        job_title: e.job_title,
        department_name: e.department?.name ?? null,
        employment_status: e.employment_status,
        join_date: e.join_date,
        scheduled_days: expected,
        records: recs.length,
        days_worked: workedDays,
        present_days: present,
        late_days: late,
        half_days: halfDay,
        absent_days: absent,
        leave_days: leave + sick,
        paid_leave_days: leave,
        sick_leave_days: sick,
        holiday_days: holiday,
        total_hours: totalHours.toFixed(2),
        overtime_hours: overtime.toFixed(2),
        avg_hours_per_day: (workedDays ? totalHours / workedDays : 0).toFixed(2),
        attendance_rate: expected ? Number(((workedDays / expected) * 100).toFixed(1)) : 0,
        punctuality_rate: workedDays
          ? Number((((workedDays - late) / workedDays) * 100).toFixed(1))
          : 0,
        first_record: dates[0] ?? null,
        last_record: dates[dates.length - 1] ?? null,
      };
    });

    const sum = (pick: (i: (typeof items)[number]) => number) =>
      items.reduce((s, i) => s + pick(i), 0);
    const totalWorked = sum((i) => i.days_worked);
    const totalHours = sum((i) => Number(i.total_hours));

    return {
      from,
      to,
      items,
      summary: {
        from,
        to,
        employees: items.length,
        days_worked: totalWorked,
        absent_days: sum((i) => i.absent_days),
        leave_days: sum((i) => i.leave_days),
        total_hours: totalHours.toFixed(2),
        overtime_hours: sum((i) => Number(i.overtime_hours)).toFixed(2),
        avg_hours_per_day: (totalWorked ? totalHours / totalWorked : 0).toFixed(2),
        attendance_rate: items.length
          ? Number((sum((i) => i.attendance_rate) / items.length).toFixed(1))
          : 0,
      },
    };
  }

  async remove(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Attendance record not found');
    await this.repo.remove(row);
    return { id, deleted: true };
  }

  /** Re-entry requests awaiting (or already given) a manager decision. */
  async listRequests(status = 'pending') {
    const rows = await this.reqRepo.find({
      where: status === 'all' ? {} : { status: status as 'pending' },
      order: { created_at: 'DESC' },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      employee_id: r.employee_id,
      employee_code: r.employee?.employee_code ?? null,
      employee_name: r.employee
        ? `${r.employee.first_name} ${r.employee.last_name}`.trim()
        : null,
      work_date: r.work_date,
      kind: r.kind,
      requested_time: r.requested_time,
      current_time_value: r.current_time_value,
      status: r.status,
      requested_by: r.requested_by,
      decided_by: r.decided_by,
      decided_role: r.decided_role,
      decided_at: r.decided_at,
      decision_note: r.decision_note,
      created_at: r.created_at,
    }));
  }

  /** Approving writes the re-entered time into the main attendance table. */
  async decideRequest(
    id: string,
    action: 'approve' | 'reject',
    actor: string,
    role: string | null,
    note?: string,
  ) {
    const req = await this.reqRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Attendance request not found');
    if (req.status !== 'pending')
      throw new BadRequestException(`This request was already ${req.status}`);

    if (action === 'approve') {
      const row = await this.repo.findOne({
        where: { employee_id: req.employee_id, work_date: req.work_date },
      });
      if (!row) throw new BadRequestException('The attendance record no longer exists');
      if (req.kind === 'in') {
        if (row.check_out && this.hoursBetween(req.requested_time, row.check_out) <= 0)
          throw new BadRequestException('That check-in is not earlier than the recorded check-out');
        row.check_in = req.requested_time;
      } else {
        if (!row.check_in)
          throw new BadRequestException('There is no check-in recorded for that day');
        if (this.hoursBetween(row.check_in, req.requested_time) <= 0)
          throw new BadRequestException('That check-out is not later than the check-in');
        row.check_out = req.requested_time;
      }
      row.worked_hours = this.hoursBetween(row.check_in, row.check_out).toFixed(2);
      row.updated_by = actor;
      await this.repo.save(row);
    }

    req.status = action === 'approve' ? 'approved' : 'rejected';
    req.decided_by = actor;
    req.decided_role = role;
    req.decided_at = new Date();
    req.decision_note = note?.trim() || null;
    await this.reqRepo.save(req);
    return { id: req.id, status: req.status };
  }

  /** Aggregated attendance for one employee within a payroll period (YYYY-MM). */
  async periodSummary(employeeId: string, period: string) {
    const from = `${period}-01`;
    const end = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0);
    const to = end.toISOString().slice(0, 10);
    const rows = await this.repo.find({
      where: { employee_id: employeeId, work_date: Between(from, to) },
    });
    return {
      from,
      to,
      worked_days: rows.filter((r) => !NON_WORKING.includes(r.status)).length,
      absent_days: rows.filter((r) => r.status === 'absent').length,
      overtime_hours: rows.reduce((s, r) => s + Number(r.overtime_hours), 0),
    };
  }
}
