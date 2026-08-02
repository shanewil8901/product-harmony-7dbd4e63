import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payslip, PayslipStatus } from './payslip.entity';
import { EmployeeProfile } from './employee-profile.entity';
import { AttendanceService } from './attendance.service';
import { GeneratePayslipDto } from './dto/payslip.dto';

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(Payslip) private readonly repo: Repository<Payslip>,
    @InjectRepository(EmployeeProfile) private readonly empRepo: Repository<EmployeeProfile>,
    private readonly attendance: AttendanceService,
  ) {}

  private enrich(p: Payslip) {
    return {
      ...p,
      employee_code: p.employee?.employee_code ?? null,
      employee_name: p.employee
        ? `${p.employee.first_name} ${p.employee.last_name}`.trim()
        : null,
      job_title: p.employee?.job_title ?? null,
      currency_code: p.currency?.code ?? null,
      currency_symbol: p.currency?.symbol ?? null,
      gross_pay: (
        Number(p.basic_salary) +
        Number(p.housing_allowance) +
        Number(p.transport_allowance) +
        Number(p.other_allowance) +
        Number(p.overtime_amount) +
        Number(p.bonus)
      ).toFixed(2),
      total_deductions: (
        Number(p.gosi_deduction) +
        Number(p.unpaid_leave_deduction) +
        Number(p.other_deduction)
      ).toFixed(2),
    };
  }

  async list(params: { period?: string; employee_id?: string; status?: string }) {
    const where: Record<string, unknown> = {};
    if (params.period) where.period = params.period;
    if (params.employee_id) where.employee_id = params.employee_id;
    if (params.status) where.status = params.status;
    const rows = await this.repo.find({ where, order: { period: 'DESC', created_at: 'DESC' } });
    const items = rows.map((r) => this.enrich(r));

    // Totals are grouped per currency — payroll must never mix currencies.
    const byCurrency = new Map<string, { currency_code: string; net_total: number; count: number }>();
    for (const i of items) {
      const code = i.currency_code ?? '—';
      const e = byCurrency.get(code) ?? { currency_code: code, net_total: 0, count: 0 };
      e.net_total += Number(i.net_pay);
      e.count += 1;
      byCurrency.set(code, e);
    }
    return {
      items,
      summary: [...byCurrency.values()].map((e) => ({
        currency_code: e.currency_code,
        net_total: e.net_total.toFixed(2),
        payslips: e.count,
      })),
    };
  }

  async findOne(id: string) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Payslip not found');
    return this.enrich(p);
  }

  async generate(dto: GeneratePayslipDto, actor: string) {
    const employee = await this.empRepo.findOne({ where: { id: dto.employee_id } });
    if (!employee) throw new BadRequestException('Unknown employee — pick one from the list');
    if (!employee.salary_currency_id)
      throw new BadRequestException('This employee has no salary currency configured');
    if (employee.employment_status === 'terminated')
      throw new BadRequestException('Cannot run payroll for a terminated employee');

    const existing = await this.repo.findOne({
      where: { employee_id: dto.employee_id, period: dto.period },
    });
    if (existing)
      throw new ConflictException(
        `A payslip for ${dto.period} already exists for this employee (${existing.status}).`,
      );

    const att = await this.attendance.periodSummary(dto.employee_id, dto.period);
    const overtimeAmount = (dto.overtime_rate ?? 0) * att.overtime_hours;

    // Unpaid absences are deducted at the daily rate of the gross monthly pay.
    const gross =
      Number(employee.basic_salary) +
      Number(employee.housing_allowance) +
      Number(employee.transport_allowance) +
      Number(employee.other_allowance);
    const daysInMonth = new Date(
      Number(dto.period.slice(0, 4)),
      Number(dto.period.slice(5, 7)),
      0,
    ).getDate();
    const unpaid = (gross / daysInMonth) * att.absent_days;

    const net =
      gross +
      overtimeAmount +
      (dto.bonus ?? 0) -
      unpaid -
      (dto.gosi_deduction ?? 0) -
      (dto.other_deduction ?? 0);
    if (net < 0) throw new BadRequestException('Deductions exceed the gross pay for this period');

    const saved = await this.repo.save(
      this.repo.create({
        employee_id: employee.id,
        period: dto.period,
        basic_salary: employee.basic_salary,
        housing_allowance: employee.housing_allowance,
        transport_allowance: employee.transport_allowance,
        other_allowance: employee.other_allowance,
        overtime_amount: overtimeAmount.toFixed(2),
        bonus: (dto.bonus ?? 0).toFixed(2),
        gosi_deduction: (dto.gosi_deduction ?? 0).toFixed(2),
        unpaid_leave_deduction: unpaid.toFixed(2),
        other_deduction: (dto.other_deduction ?? 0).toFixed(2),
        net_pay: net.toFixed(2),
        currency_id: employee.salary_currency_id,
        worked_days: att.worked_days,
        absent_days: att.absent_days,
        overtime_hours: att.overtime_hours.toFixed(2),
        status: 'draft',
        notes: dto.notes ?? null,
        created_by: actor,
        updated_by: actor,
      }),
    );
    return this.findOne(saved.id);
  }

  /** draft → approved → paid, with cancellation allowed before payment. */
  async setStatus(id: string, status: PayslipStatus, actor: string) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Payslip not found');
    const allowed: Record<PayslipStatus, PayslipStatus[]> = {
      draft: ['approved', 'cancelled'],
      approved: ['paid', 'cancelled'],
      paid: [],
      cancelled: [],
    };
    if (!allowed[p.status].includes(status))
      throw new BadRequestException(`A ${p.status} payslip cannot be moved to ${status}`);
    p.status = status;
    p.paid_at = status === 'paid' ? new Date() : p.paid_at;
    p.updated_by = actor;
    await this.repo.save(p);
    return this.findOne(id);
  }

  async remove(id: string) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Payslip not found');
    if (p.status === 'paid') throw new BadRequestException('A paid payslip cannot be deleted');
    await this.repo.remove(p);
    return { id, deleted: true };
  }
}
