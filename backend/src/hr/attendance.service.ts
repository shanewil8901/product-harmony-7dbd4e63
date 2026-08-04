import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Attendance } from './attendance.entity';
import { EmployeeProfile } from './employee-profile.entity';
import { UpsertAttendanceDto } from './dto/upsert-attendance.dto';
import { PunchAttendanceDto } from './dto/punch-attendance.dto';

const NON_WORKING: string[] = ['absent', 'leave', 'sick_leave', 'holiday'];

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance) private readonly repo: Repository<Attendance>,
    @InjectRepository(EmployeeProfile) private readonly empRepo: Repository<EmployeeProfile>,
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
    };
  }

  /** Today's (or a given day's) punch state for one employee — no sensitive data. */
  async dayState(employeeId: string, workDate: string) {
    const row = await this.repo.findOne({
      where: { employee_id: employeeId, work_date: workDate.slice(0, 10) },
    });
    if (!row) return null;
    return {
      id: row.id,
      employee_id: row.employee_id,
      work_date: row.work_date,
      status: row.status,
      check_in: row.check_in,
      check_out: row.check_out,
      worked_hours: row.worked_hours,
    };
  }

  async remove(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Attendance record not found');
    await this.repo.remove(row);
    return { id, deleted: true };
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
