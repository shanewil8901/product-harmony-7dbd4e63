import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LeaveRequest,
  LEAVE_TYPES,
  SHORT_LEAVE_DAY_FRACTION,
  type LeaveStatus,
  type LeaveType,
} from './leave.entity';
import { DEFAULT_LEAVE_POLICY, RoleLeavePolicy } from './leave-policy.entity';
import { EmployeeProfile } from './employee-profile.entity';
import { Role, type RoleCode } from '../master-data/role.entity';
import { ApplyLeaveDto, DecideLeaveDto, UpdateLeavePolicyDto } from './dto/leave.dto';
import { canDecide, MANAGER_ROLES, routeStatus, SUPERVISOR_ROLES } from './leave.rules';
import { isIsoDate, isSameOrAfter } from '../common/date-range';

const DAY_MS = 86_400_000;

export interface LeaveActor {
  id: string;
  name: string;
  role: RoleCode | null;
}

function dayCount(from: string, to: string) {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS) + 1;
}

function overlapDays(from: string, to: string, periodFrom: string, periodTo: string) {
  const start = Math.max(Date.parse(`${from}T00:00:00Z`), Date.parse(`${periodFrom}T00:00:00Z`));
  const end = Math.min(Date.parse(`${to}T00:00:00Z`), Date.parse(`${periodTo}T00:00:00Z`));
  if (end < start) return 0;
  return Math.round((end - start) / DAY_MS) + 1;
}

@Injectable()
export class LeaveService implements OnModuleInit {
  constructor(
    @InjectRepository(LeaveRequest) private readonly repo: Repository<LeaveRequest>,
    @InjectRepository(RoleLeavePolicy) private readonly policyRepo: Repository<RoleLeavePolicy>,
    @InjectRepository(EmployeeProfile) private readonly empRepo: Repository<EmployeeProfile>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
  ) {}

  /** Every role starts from the company default entitlement table. */
  async onModuleInit() {
    const roles = await this.roleRepo.find();
    for (const role of roles) {
      for (const d of DEFAULT_LEAVE_POLICY) {
        const existing = await this.policyRepo.findOne({
          where: { role_id: role.id, leave_type: d.leave_type },
        });
        if (!existing)
          await this.policyRepo.save(
            this.policyRepo.create({
              role_id: role.id,
              leave_type: d.leave_type,
              entitlement: d.entitlement.toFixed(2),
              period_unit: d.period_unit,
            }),
          );
      }
    }
  }

  // ---------------------------------------------------------------- policies

  listPolicies() {
    return this.policyRepo.find({ order: { role_id: 'ASC', leave_type: 'ASC' } });
  }

  /** Employees holding a role, resolved through their login account. */
  private employeesForRole(roleId: string) {
    return this.empRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'user')
      .where('user.role_id = :roleId', { roleId })
      .getMany();
  }

  /**
   * How much of each entitlement is already committed. Lowering a policy below
   * the highest committed figure is allowed but converts the excess to unpaid
   * leave, so the UI can warn before saving.
   */
  async policyUsage() {
    const policies = await this.listPolicies();
    const out: {
      role_id: string;
      leave_type: LeaveType;
      max_used: number;
      employees_affected_at: number;
      employees: { employee_id: string; employee_name: string; used: number }[];
    }[] = [];

    for (const p of policies) {
      const employees = await this.employeesForRole(p.role_id);
      const rows: { employee_id: string; employee_name: string; used: number }[] = [];
      for (const emp of employees) {
        const balance = (await this.balances(emp.id)).find((b) => b.leave_type === p.leave_type);
        const used = Number(balance?.used ?? 0);
        if (used > 0)
          rows.push({
            employee_id: emp.id,
            employee_name: `${emp.first_name} ${emp.last_name}`.trim(),
            used,
          });
      }
      rows.sort((a, b) => b.used - a.used);
      out.push({
        role_id: p.role_id,
        leave_type: p.leave_type,
        max_used: rows[0]?.used ?? 0,
        employees_affected_at: rows.length,
        employees: rows.slice(0, 10),
      });
    }
    return out;
  }

  async updatePolicy(dto: UpdateLeavePolicyDto, actor: string) {
    const policy = await this.policyRepo.findOne({
      where: { role_id: dto.role_id, leave_type: dto.leave_type },
    });
    if (!policy) throw new NotFoundException('No policy for that role and leave type');
    policy.entitlement = dto.entitlement.toFixed(2);
    if (dto.period_unit) policy.period_unit = dto.period_unit;
    policy.updated_by = actor;
    const saved = await this.policyRepo.save(policy);

    // Already-taken leave is never revoked. Instead the days that no longer fit
    // inside the (possibly lower) entitlement are re-marked as unpaid, and days
    // that now fit again become paid.
    const adjusted = await this.reconcile(dto.role_id, dto.leave_type, actor);
    return { ...saved, adjusted_requests: adjusted };
  }

  /** Re-splits paid / unpaid days for every live request under a role policy. */
  private async reconcile(roleId: string, leaveType: LeaveType, actor: string) {
    const employees = await this.employeesForRole(roleId);
    let adjusted = 0;

    for (const emp of employees) {
      const requests = (
        await this.repo.find({
          where: { employee_id: emp.id, leave_type: leaveType },
          order: { from_date: 'ASC', created_at: 'ASC' },
        })
      ).filter((r) => r.status === 'approved' || r.status.startsWith('pending'));

      const policy = await this.policyRepo.findOne({
        where: { role_id: roleId, leave_type: leaveType },
      });
      const entitlement = Number(policy?.entitlement ?? 0);
      const unit = policy?.period_unit ?? 'year';

      // Consume the entitlement chronologically inside each quota window.
      const consumed = new Map<string, number>();
      for (const r of requests) {
        const key = unit === 'month' ? r.from_date.slice(0, 7) : r.from_date.slice(0, 4);
        const already = consumed.get(key) ?? 0;
        const units = Number(r.units);
        const remaining = Math.max(0, entitlement - already);
        const unpaidUnits = Math.max(0, units - remaining);
        const unpaidDays =
          leaveType === 'short' ? unpaidUnits * SHORT_LEAVE_DAY_FRACTION : unpaidUnits;
        consumed.set(key, already + units);
        if (Number(r.unpaid_days).toFixed(2) !== unpaidDays.toFixed(2)) {
          r.unpaid_days = unpaidDays.toFixed(2);
          r.updated_by = actor;
          await this.repo.save(r);
          adjusted += 1;
        }
      }
    }
    return adjusted;
  }

  // ---------------------------------------------------------------- balances

  private async employeeWithRole(employeeId: string) {
    const emp = await this.empRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'user')
      .leftJoinAndSelect('user.role', 'role')
      .where('e.id = :id', { id: employeeId })
      .getOne();
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  async resolveEmployeeForUser(userId: string) {
    const emp = await this.empRepo.findOne({ where: { user_id: userId } });
    if (!emp)
      throw new BadRequestException(
        'Your login has no HR profile yet — ask HR to create your employee record.',
      );
    return emp;
  }

  /**
   * Entitlement minus everything already approved or awaiting approval in the
   * matching window (calendar month for monthly quotas, year for annual ones).
   */
  async balances(employeeId: string, refDate = new Date().toISOString().slice(0, 10)) {
    const emp = await this.employeeWithRole(employeeId);
    const roleId = emp.user?.role_id ?? null;
    const policies = roleId ? await this.policyRepo.find({ where: { role_id: roleId } }) : [];
    const rows = await this.repo.find({ where: { employee_id: employeeId } });
    const live = rows.filter(
      (r) => r.status === 'approved' || r.status.startsWith('pending'),
    );
    const year = refDate.slice(0, 4);
    const month = refDate.slice(0, 7);

    return LEAVE_TYPES.map((type) => {
      const policy = policies.find((p) => p.leave_type === type);
      const unit = policy?.period_unit ?? 'year';
      const entitlement = Number(policy?.entitlement ?? 0);
      const used = live
        .filter((r) => r.leave_type === type)
        .filter((r) => (unit === 'month' ? r.from_date.startsWith(month) : r.from_date.startsWith(year)))
        .reduce((s, r) => s + Number(r.units), 0);
      return {
        leave_type: type,
        period_unit: unit,
        entitlement: entitlement.toFixed(2),
        used: used.toFixed(2),
        remaining: Math.max(0, entitlement - used).toFixed(2),
      };
    });
  }

  // ---------------------------------------------------------------- requests

  private enrich(r: LeaveRequest) {
    return {
      ...r,
      employee_code: r.employee?.employee_code ?? null,
      employee_name: r.employee
        ? `${r.employee.first_name} ${r.employee.last_name}`.trim()
        : null,
      job_title: r.employee?.job_title ?? null,
      department_name: r.employee?.department?.name ?? null,
    };
  }

  async list(
    params: { employee_id?: string; status?: string; mine?: boolean },
    actor: LeaveActor,
  ) {
    const canSeeAll = actor.role ? SUPERVISOR_ROLES.includes(actor.role) : false;
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status as LeaveStatus;

    if (!canSeeAll || params.mine) {
      const emp = await this.resolveEmployeeForUser(actor.id);
      where.employee_id = emp.id;
    } else if (params.employee_id) {
      where.employee_id = params.employee_id;
    }

    const rows = await this.repo.find({ where, order: { created_at: 'DESC' } });
    return rows.map((r) => this.enrich(r));
  }

  async apply(dto: ApplyLeaveDto, actor: LeaveActor) {
    const onBehalf = dto.employee_id && MANAGER_ROLES.includes(actor.role ?? 'employee');
    const employee = onBehalf
      ? await this.employeeWithRole(dto.employee_id!)
      : await this.resolveEmployeeForUser(actor.id);

    if (employee.employment_status === 'terminated')
      throw new BadRequestException('Leave cannot be filed for a terminated employee');
    if (!isIsoDate(dto.from_date) || !isIsoDate(dto.to_date))
      throw new BadRequestException('Dates must be real calendar dates in YYYY-MM-DD format');
    if (!isSameOrAfter(dto.to_date, dto.from_date))
      throw new BadRequestException('The end date cannot be before the start date');

    const rawDays = dayCount(dto.from_date, dto.to_date);
    if (rawDays > 60) throw new BadRequestException('A single request cannot exceed 60 days');
    if (dto.leave_type === 'short' && rawDays !== 1)
      throw new BadRequestException('A short leave applies to a single day');

    // Overlapping requests would double-count the balance.
    const clash = await this.repo
      .createQueryBuilder('l')
      .where('l.employee_id = :id', { id: employee.id })
      .andWhere('l.status IN (:...alive)', {
        alive: ['pending_supervisor', 'pending_manager', 'pending_admin', 'approved'],
      })
      .andWhere('l.from_date <= :to AND l.to_date >= :from', {
        to: dto.to_date,
        from: dto.from_date,
      })
      .getOne();
    if (clash)
      throw new BadRequestException('You already have a leave request covering those dates');

    const days = dto.leave_type === 'short' ? SHORT_LEAVE_DAY_FRACTION : rawDays;
    const units = dto.leave_type === 'short' ? 1 : rawDays;

    const balance = (await this.balances(employee.id, dto.from_date)).find(
      (b) => b.leave_type === dto.leave_type,
    );
    const remaining = Number(balance?.remaining ?? 0);
    // Excess beyond the entitlement is still allowed but goes unpaid.
    const unpaidUnits = Math.max(0, units - remaining);
    const unpaidDays = dto.leave_type === 'short' ? unpaidUnits * SHORT_LEAVE_DAY_FRACTION : unpaidUnits;

    // Approval routing depends on who the leave is for:
    //  - admin        -> no approval needed, auto approved
    //  - manager      -> needs an admin sign-off
    //  - everyone else-> a single supervisor-or-above sign-off
    const applicantRole = (
      onBehalf ? (await this.employeeWithRole(employee.id)).user?.role?.code : actor.role
    ) as RoleCode | null ?? 'employee';
    const status: LeaveStatus = routeStatus(applicantRole);

    const saved = await this.repo.save(
      this.repo.create({
        employee_id: employee.id,
        leave_type: dto.leave_type,
        from_date: dto.from_date,
        to_date: dto.to_date,
        days: days.toFixed(2),
        units: units.toFixed(2),
        unpaid_days: unpaidDays.toFixed(2),
        reason: dto.reason.trim(),
        status,
        decided_by: status === 'approved' ? actor.name : null,
        decided_by_role: status === 'approved' ? applicantRole : null,
        decided_at: status === 'approved' ? new Date() : null,
        created_by: actor.name,
        updated_by: actor.name,
      }),
    );
    return this.findOne(saved.id);
  }

  async findOne(id: string) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Leave request not found');
    return this.enrich(r);
  }

  /**
   * A single sign-off decides the request. Supervisors and above can clear a
   * normal request outright; a manager's own leave waits for an admin. The
   * deciding user and their role are both recorded.
   */
  async decide(id: string, dto: DecideLeaveDto, actor: LeaveActor) {
    const req = await this.repo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    const role = actor.role ?? 'employee';
    const note = dto.note?.trim() || null;

    // Nobody signs off their own leave, whatever their role.
    const ownProfile = await this.empRepo.findOne({ where: { user_id: actor.id } });
    const check = canDecide(req.status, role, ownProfile?.id === req.employee_id);
    if (!check.ok) {
      if (check.kind === 'forbidden') throw new ForbiddenException(check.reason);
      throw new BadRequestException(check.reason);
    }

    if (check.step === 'admin') {
      req.manager_by = actor.name;
      req.manager_at = new Date();
      req.manager_note = note;
    } else {
      req.supervisor_by = actor.name;
      req.supervisor_at = new Date();
      req.supervisor_note = note;
    }

    req.status = dto.action === 'approve' ? 'approved' : 'rejected';
    req.decided_by = actor.name;
    req.decided_by_role = role;
    req.decided_at = new Date();
    if (dto.action === 'reject') req.rejection_reason = note || 'No reason given';
    req.updated_by = actor.name;
    await this.repo.save(req);
    return this.findOne(id);
  }

  /** Everyone whose approved leave covers a given day. */
  async onLeave(date = new Date().toISOString().slice(0, 10)) {
    if (!isIsoDate(date)) throw new BadRequestException('Date must be in YYYY-MM-DD format');
    const rows = await this.repo
      .createQueryBuilder('l')
      .where('l.status = :status', { status: 'approved' })
      .andWhere('l.from_date <= :date AND l.to_date >= :date', { date })
      .orderBy('l.from_date', 'ASC')
      .getMany();
    return rows.map((r) => this.enrich(r));
  }

  /** An employee may withdraw their own request while it is still pending. */
  async cancel(id: string, actor: LeaveActor) {
    const req = await this.repo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    const isPrivileged = MANAGER_ROLES.includes(actor.role ?? 'employee');
    if (!isPrivileged) {
      const emp = await this.resolveEmployeeForUser(actor.id);
      if (emp.id !== req.employee_id)
        throw new ForbiddenException('You can only cancel your own leave requests');
    }
    if (!req.status.startsWith('pending'))
      throw new BadRequestException(`A ${req.status} request cannot be cancelled`);
    req.status = 'cancelled';
    req.updated_by = actor.name;
    await this.repo.save(req);
    return this.findOne(id);
  }

  // ----------------------------------------------------------------- payroll

  /**
   * Approved leave that falls inside a payroll month, split into paid and
   * unpaid days so the payslip can deduct only what is genuinely unpaid.
   */
  async periodLeave(employeeId: string, period: string) {
    const from = `${period}-01`;
    const end = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0);
    const to = end.toISOString().slice(0, 10);
    const rows = await this.repo.find({
      where: { employee_id: employeeId, status: 'approved' },
    });

    let paid = 0;
    let unpaid = 0;
    const byType: Record<string, number> = {};

    for (const r of rows) {
      const total = dayCount(r.from_date, r.to_date);
      const inside = overlapDays(r.from_date, r.to_date, from, to);
      if (inside <= 0) continue;
      const share = inside / total;
      const days = Number(r.days) * share;
      const unpaidPart = Number(r.unpaid_days) * share;
      paid += days - unpaidPart;
      unpaid += unpaidPart;
      byType[r.leave_type] = (byType[r.leave_type] ?? 0) + days;
    }

    return {
      period,
      paid_leave_days: Number(paid.toFixed(2)),
      unpaid_leave_days: Number(unpaid.toFixed(2)),
      by_type: Object.fromEntries(
        Object.entries(byType).map(([k, v]) => [k, Number(v.toFixed(2))]),
      ) as Record<LeaveType, number>,
    };
  }
}
