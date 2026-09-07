import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resignation, type ResignationStatus } from './resignation.entity';
import { EmployeeProfile } from './employee-profile.entity';
import type { RoleCode } from '../master-data/role.entity';
import { CreateResignationDto, DecideResignationDto } from './dto/resignation.dto';
import { calculateBenefit, canDecide, REVIEW_ROLES, routeStatus } from './resignation.rules';

export interface ResignationActor {
  id: string;
  role: RoleCode | null;
}

const ON_BEHALF_ROLES: RoleCode[] = ['admin', 'manager'];

@Injectable()
export class ResignationService {
  constructor(
    @InjectRepository(Resignation) private readonly repo: Repository<Resignation>,
    @InjectRepository(EmployeeProfile) private readonly empRepo: Repository<EmployeeProfile>,
  ) {}

  async resolveEmployeeForUser(userId: string) {
    const emp = await this.empRepo.findOne({ where: { user_id: userId } });
    if (!emp)
      throw new BadRequestException(
        'Your login has no HR profile yet — ask HR to create your employee record.',
      );
    return emp;
  }

  private enrich(row: Resignation) {
    const emp = row.employee;
    return {
      ...row,
      employee: undefined,
      employee_code: emp?.employee_code ?? null,
      employee_name: emp ? `${emp.first_name} ${emp.last_name}`.trim() : null,
      job_title: emp?.job_title ?? null,
      join_date: emp?.join_date ?? null,
    };
  }

  /** Live benefit figure for a prospective last working day. */
  async preview(employeeId: string, lastWorkingDate: string) {
    const emp = await this.empRepo.findOne({ where: { id: employeeId } });
    if (!emp) throw new NotFoundException('Employee not found');
    return {
      employee_id: emp.id,
      join_date: emp.join_date,
      last_working_date: lastWorkingDate,
      ...calculateBenefit(emp.join_date, lastWorkingDate, Number(emp.basic_salary ?? 0)),
    };
  }

  async list(
    params: { status?: string; employee_id?: string; mine?: boolean },
    actor: ResignationActor,
  ) {
    const privileged = REVIEW_ROLES.includes(actor.role ?? 'employee');
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status as ResignationStatus;

    if (params.mine || !privileged) {
      const emp = await this.resolveEmployeeForUser(actor.id);
      where.employee_id = emp.id;
    } else if (params.employee_id) {
      where.employee_id = params.employee_id;
    }

    const rows = await this.repo.find({ where, order: { created_at: 'DESC' } });
    return rows.map((r) => this.enrich(r));
  }

  async create(dto: CreateResignationDto, actor: ResignationActor) {
    const onBehalf = dto.employee_id && ON_BEHALF_ROLES.includes(actor.role ?? 'employee');
    const employee = onBehalf
      ? await this.empRepo.findOne({ where: { id: dto.employee_id } })
      : await this.resolveEmployeeForUser(actor.id);
    if (!employee) throw new NotFoundException('Employee not found');

    if (dto.last_working_date < employee.join_date)
      throw new BadRequestException('The last working day cannot be before the joining date');

    const open = await this.repo.findOne({
      where: { employee_id: employee.id },
      order: { created_at: 'DESC' },
    });
    if (open && (open.status.startsWith('pending') || open.status === 'approved'))
      throw new BadRequestException('This employee already has an active resignation on file');

    const benefit = calculateBenefit(
      employee.join_date,
      dto.last_working_date,
      Number(employee.basic_salary ?? 0),
    );

    const row = this.repo.create({
      employee_id: employee.id,
      resignation_date: dto.resignation_date,
      last_working_date: dto.last_working_date,
      notice_period_days: dto.notice_period_days ?? 30,
      reason_type: dto.reason_type,
      reason: dto.reason,
      handover_notes: dto.handover_notes ?? null,
      handover_to: dto.handover_to ?? null,
      contact_email: dto.contact_email ?? null,
      contact_mobile: dto.contact_mobile ?? null,
      status: onBehalf ? 'pending_supervisor' : routeStatus(actor.role),
      benefit_basic_salary: benefit.basic_salary.toFixed(2),
      service_months: benefit.service_months,
      service_years: benefit.service_years.toFixed(2),
      benefit_amount: benefit.benefit_amount.toFixed(2),
      created_by: actor.id,
      updated_by: actor.id,
    });

    if (row.status === 'approved') {
      row.decided_by = actor.id;
      row.decided_by_role = actor.role;
      row.decided_at = new Date();
      row.admin_by = actor.id;
      row.admin_at = new Date();
    }

    const saved = await this.repo.save(row);
    if (saved.status === 'approved') await this.applyApproval(saved);
    return this.enrich(saved);
  }

  async decide(id: string, dto: DecideResignationDto, actor: ResignationActor) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Resignation not found');

    const own = row.employee?.user_id === actor.id;
    const check = canDecide(row.status, actor.role, own);
    if (!check.ok) {
      if (check.kind === 'forbidden') throw new ForbiddenException(check.reason);
      throw new BadRequestException(check.reason);
    }

    const now = new Date();
    if (check.step === 'supervisor') {
      row.supervisor_by = actor.id;
      row.supervisor_at = now;
    } else if (check.step === 'manager') {
      row.manager_by = actor.id;
      row.manager_at = now;
    } else {
      row.admin_by = actor.id;
      row.admin_at = now;
    }

    if (dto.action === 'reject') {
      row.status = 'rejected';
      row.rejection_reason = dto.note ?? null;
    } else {
      row.status = check.next;
      // Refresh the benefit against the current basic salary at each step.
      const emp = row.employee ?? (await this.empRepo.findOne({ where: { id: row.employee_id } }));
      if (emp) {
        const benefit = calculateBenefit(
          emp.join_date,
          row.last_working_date,
          Number(emp.basic_salary ?? 0),
        );
        row.benefit_basic_salary = benefit.basic_salary.toFixed(2);
        row.service_months = benefit.service_months;
        row.service_years = benefit.service_years.toFixed(2);
        row.benefit_amount = benefit.benefit_amount.toFixed(2);
      }
    }

    if (row.status === 'approved' || row.status === 'rejected') {
      row.decided_by = actor.id;
      row.decided_by_role = actor.role;
      row.decided_at = now;
    }
    row.updated_by = actor.id;

    const saved = await this.repo.save(row);
    if (saved.status === 'approved') await this.applyApproval(saved);
    return this.enrich(saved);
  }

  /** Once the last working day has passed, the profile becomes terminated. */
  private async applyApproval(row: Resignation) {
    const today = new Date().toISOString().slice(0, 10);
    if (row.last_working_date > today) return;
    await this.empRepo.update({ id: row.employee_id }, { employment_status: 'terminated' });
  }

  async withdraw(id: string, actor: ResignationActor) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Resignation not found');
    const own = row.employee?.user_id === actor.id;
    if (!own && !ON_BEHALF_ROLES.includes(actor.role ?? 'employee'))
      throw new ForbiddenException('You can only withdraw your own resignation');
    if (!row.status.startsWith('pending'))
      throw new BadRequestException(`A ${row.status} resignation cannot be withdrawn`);
    row.status = 'withdrawn';
    row.updated_by = actor.id;
    return this.enrich(await this.repo.save(row));
  }
}
