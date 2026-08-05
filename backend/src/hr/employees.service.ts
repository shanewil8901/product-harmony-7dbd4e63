import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { EmployeeProfile } from './employee-profile.entity';
import { EmployeeDocument, EmployeeDocType } from './employee-document.entity';
import { Attendance } from './attendance.entity';
import { Payslip } from './payslip.entity';
import { User } from '../users/user.entity';
import { Role } from '../master-data/role.entity';
import { Department } from '../master-data/department.entity';
import { Currency } from '../master-data/currency.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

/** HR always pays in Saudi Riyal — the currency is fixed, never user-selectable. */
export const HR_CURRENCY_CODE = 'SAR';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(EmployeeProfile) private readonly repo: Repository<EmployeeProfile>,
    @InjectRepository(EmployeeDocument) private readonly docRepo: Repository<EmployeeDocument>,
    @InjectRepository(Attendance) private readonly attRepo: Repository<Attendance>,
    @InjectRepository(Payslip) private readonly payslipRepo: Repository<Payslip>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Department) private readonly deptRepo: Repository<Department>,
    @InjectRepository(Currency) private readonly currencyRepo: Repository<Currency>,
    private readonly dataSource: DataSource,
  ) {}


  /** Flatten master-data relations so the API never leaks bare ids. */
  private enrich(e: EmployeeProfile) {
    const gross =
      Number(e.basic_salary) +
      Number(e.housing_allowance) +
      Number(e.transport_allowance) +
      Number(e.other_allowance);
    return {
      ...e,
      full_name: `${e.first_name} ${e.last_name}`.trim(),
      email: e.user?.email ?? null,
      role: e.user?.role
        ? { id: e.user.role.id, code: e.user.role.code, name: e.user.role.name }
        : null,
      department_code: e.department?.code ?? null,
      department_name: e.department?.name ?? null,
      salary_currency_code: e.salary_currency?.code ?? null,
      salary_currency_symbol: e.salary_currency?.symbol ?? null,
      gross_salary: gross.toFixed(2),
    };
  }

  private async requireDepartment(id: string | undefined | null) {
    if (!id) return null;
    const dep = await this.deptRepo.findOne({ where: { id } });
    if (!dep) throw new BadRequestException('Unknown department — pick one from the list');
    return dep;
  }

  /**
   * HR salaries are always in SAR. Any currency sent by a client is ignored so
   * existing rows can never be switched to another currency by mistake.
   */
  private async payrollCurrency() {
    const existing = await this.currencyRepo.findOne({ where: { code: HR_CURRENCY_CODE } });
    if (existing) return existing;
    // Additive only — never touches existing master data.
    return this.currencyRepo.save(
      this.currencyRepo.create({ code: HR_CURRENCY_CODE, name: 'Saudi Riyal', symbol: 'SR' }),
    );
  }

  /** Non-destructive lookup used by the employee form before submitting. */
  async checkEmail(email: string) {
    const value = (email ?? '').trim().toLowerCase();
    if (!value) throw new BadRequestException('Enter an email address to check');
    const user = await this.userRepo.findOne({ where: { email: value } });
    if (!user) return { email: value, exists: false, has_employee_profile: false };
    const profile = await this.repo.findOne({ where: { user_id: user.id } });
    return {
      email: value,
      exists: true,
      has_employee_profile: !!profile,
      employee_code: profile?.employee_code ?? null,
    };
  }


  private async nextEmployeeCode() {
    const last = await this.repo
      .createQueryBuilder('e')
      .select('e.employee_code', 'code')
      .orderBy('e.employee_code', 'DESC')
      .limit(1)
      .getRawOne<{ code: string }>();
    const seq = last?.code ? Number(last.code.replace(/\D/g, '')) + 1 : 1;
    return `EMP-${String(seq).padStart(5, '0')}`;
  }

  async list(params: { search?: string; status?: string } = {}) {
    const qb = this.repo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('e.department', 'department')
      .leftJoinAndSelect('e.salary_currency', 'salary_currency')
      .orderBy('e.employee_code', 'ASC');

    if (params.status) qb.andWhere('e.employment_status = :st', { st: params.status });
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      qb.andWhere(
        '(e.first_name LIKE :term OR e.last_name LIKE :term OR e.employee_code LIKE :term OR e.iqama_number LIKE :term OR user.email LIKE :term)',
        { term },
      );
    }
    const rows = await qb.getMany();
    return rows.map((r) => this.enrich(r));
  }

  async findOne(id: string) {
    const e = await this.repo.findOne({
      where: { id },
      relations: ['user', 'user.role', 'department', 'salary_currency'],
    });
    if (!e) throw new NotFoundException('Employee not found');
    return this.enrich(e);
  }

  async create(dto: CreateEmployeeDto, actor: string) {
    const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingUser) throw new ConflictException('That email is already registered');
    const dupIqama = await this.repo.findOne({ where: { iqama_number: dto.iqama_number } });
    if (dupIqama) throw new ConflictException('That Iqama / National ID is already registered');

    const role = await this.roleRepo.findOne({ where: { code: dto.role } });
    if (!role) throw new BadRequestException('Unknown role — pick one from the list');
    const department = await this.requireDepartment(dto.department_id);
    const currency = await this.payrollCurrency();

    return this.dataSource.transaction(async (mgr) => {
      const user = await mgr.save(
        mgr.create(User, {
          email: dto.email,
          name: `${dto.first_name} ${dto.last_name}`.trim(),
          password: await bcrypt.hash(dto.password, 10),
          role_id: role.id,
        }),
      );

      const profile = await mgr.save(
        mgr.create(EmployeeProfile, {
          user_id: user.id,
          employee_code: await this.nextEmployeeCode(),
          first_name: dto.first_name.trim(),
          last_name: dto.last_name.trim(),
          iqama_number: dto.iqama_number,
          iqama_expiry: dto.iqama_expiry ?? null,
          nationality: dto.nationality ?? null,
          date_of_birth: dto.date_of_birth ?? null,
          mobile: dto.mobile,
          emergency_contact_name: dto.emergency_contact_name ?? null,
          emergency_contact_phone: dto.emergency_contact_phone ?? null,
          address_line1: dto.address_line1.trim(),
          address_city: dto.address_city.trim(),
          address_postal_code: dto.address_postal_code ?? null,
          bank_name: dto.bank_name.trim(),
          bank_account_name: dto.bank_account_name ?? null,
          iban: dto.iban.toUpperCase(),
          job_title: dto.job_title.trim(),
          department_id: department?.id ?? null,
          join_date: dto.join_date,
          contract_type: dto.contract_type ?? 'full_time',
          employment_status: dto.employment_status ?? 'active',
          basic_salary: dto.basic_salary.toFixed(2),
          housing_allowance: (dto.housing_allowance ?? 0).toFixed(2),
          transport_allowance: (dto.transport_allowance ?? 0).toFixed(2),
          other_allowance: (dto.other_allowance ?? 0).toFixed(2),
          salary_currency_id: currency.id,
          notes: dto.notes ?? null,
          created_by: actor,
          updated_by: actor,
        }),
      );
      return profile.id;
    }).then((id) => this.findOne(id));
  }

  async update(id: string, dto: UpdateEmployeeDto, actor: string) {
    const profile = await this.repo.findOne({ where: { id }, relations: ['user'] });
    if (!profile) throw new NotFoundException('Employee not found');

    if (dto.iqama_number && dto.iqama_number !== profile.iqama_number) {
      const dup = await this.repo.findOne({ where: { iqama_number: dto.iqama_number } });
      if (dup) throw new ConflictException('That Iqama / National ID is already registered');
    }
    if (dto.department_id !== undefined) await this.requireDepartment(dto.department_id);

    const { password, role, salary_currency_id: _ignoredCurrency, ...rest } = dto;
    Object.assign(profile, rest, { updated_by: actor });
    // Salary currency is fixed to SAR for every HR record.
    profile.salary_currency_id = (await this.payrollCurrency()).id;

    if (dto.basic_salary !== undefined) profile.basic_salary = dto.basic_salary.toFixed(2);
    if (dto.housing_allowance !== undefined)
      profile.housing_allowance = dto.housing_allowance.toFixed(2);
    if (dto.transport_allowance !== undefined)
      profile.transport_allowance = dto.transport_allowance.toFixed(2);
    if (dto.other_allowance !== undefined)
      profile.other_allowance = dto.other_allowance.toFixed(2);
    if (dto.iban) profile.iban = dto.iban.toUpperCase();
    await this.repo.save(profile);

    // Credentials / role live on the linked user account.
    const user = await this.userRepo.findOne({ where: { id: profile.user_id } });
    if (user) {
      if (password) user.password = await bcrypt.hash(password, 10);
      if (role) {
        const roleRow = await this.roleRepo.findOne({ where: { code: role } });
        if (!roleRow) throw new BadRequestException('Unknown role — pick one from the list');
        user.role_id = roleRow.id;
      }
      user.name = `${profile.first_name} ${profile.last_name}`.trim();
      await this.userRepo.save(user);
    }
    return this.findOne(id);
  }

  // --- Documents (Iqama copy, contract, …) ---
  listDocuments(employeeId: string) {
    return this.docRepo.find({ where: { employee_id: employeeId }, order: { uploaded_at: 'DESC' } });
  }

  async addDocument(
    employeeId: string,
    docType: EmployeeDocType,
    file: Express.Multer.File,
    actor: string,
  ) {
    await this.findOne(employeeId);
    return this.docRepo.save(
      this.docRepo.create({
        employee_id: employeeId,
        doc_type: docType,
        file_name: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
        storage_path: file.path,
        uploaded_by: actor,
      }),
    );
  }

  async findDocument(employeeId: string, docId: string) {
    const doc = await this.docRepo.findOne({ where: { id: docId, employee_id: employeeId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async removeDocument(employeeId: string, docId: string) {
    const doc = await this.findDocument(employeeId, docId);
    await this.docRepo.remove(doc);
    return { id: docId, deleted: true };
  }

  /**
   * Self-service profile dashboard: general data, payroll history, attendance
   * stats and document list for the signed-in user. Read-only.
   */
  async selfOverview(userId: string) {
    const profile = await this.repo.findOne({
      where: { user_id: userId },
      relations: ['user', 'user.role', 'department', 'salary_currency'],
    });
    if (!profile)
      throw new NotFoundException(
        'No employee profile is linked to your account — ask HR to create one.',
      );

    const NON_WORKING = ['absent', 'leave', 'sick_leave', 'holiday'];
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const monthStart = iso(new Date(today.getFullYear(), today.getMonth(), 1));
    const yearStart = iso(new Date(today.getFullYear(), 0, 1));

    const [monthRows, yearRows, payslips, documents] = await Promise.all([
      this.attRepo.find({
        where: { employee_id: profile.id, work_date: Between(monthStart, iso(today)) },
        order: { work_date: 'DESC' },
      }),
      this.attRepo.find({
        where: { employee_id: profile.id, work_date: Between(yearStart, iso(today)) },
      }),
      this.payslipRepo.find({
        where: { employee_id: profile.id },
        order: { period: 'DESC' },
        take: 12,
      }),
      this.docRepo.find({ where: { employee_id: profile.id }, order: { uploaded_at: 'DESC' } }),
    ]);

    const summarise = (rows: typeof monthRows) => ({
      records: rows.length,
      present_days: rows.filter((r) => !NON_WORKING.includes(r.status)).length,
      absent_days: rows.filter((r) => r.status === 'absent').length,
      leave_days: rows.filter((r) => r.status === 'leave' || r.status === 'sick_leave').length,
      late_days: rows.filter((r) => r.status === 'late').length,
      total_hours: rows.reduce((s, r) => s + Number(r.worked_hours), 0).toFixed(2),
      total_overtime: rows.reduce((s, r) => s + Number(r.overtime_hours), 0).toFixed(2),
    });

    // Six-month attendance trend for the profile chart.
    const trend: { period: string; present_days: number; absent_days: number; hours: string }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const rows = yearRows.filter((r) => String(r.work_date).slice(0, 7) === key);
      trend.push({
        period: key,
        present_days: rows.filter((r) => !NON_WORKING.includes(r.status)).length,
        absent_days: rows.filter((r) => r.status === 'absent').length,
        hours: rows.reduce((s, r) => s + Number(r.worked_hours), 0).toFixed(2),
      });
    }

    const paid = payslips.filter((p) => p.status === 'paid');
    const ytdNet = paid
      .filter((p) => p.period.startsWith(String(today.getFullYear())))
      .reduce((s, p) => s + Number(p.net_pay), 0);

    const days = (from: string | null) =>
      from ? Math.round((new Date(from).getTime() - today.getTime()) / 86_400_000) : null;

    const employee = this.enrich(profile);
    return {
      employee: {
        id: employee.id,
        employee_code: employee.employee_code,
        full_name: employee.full_name,
        email: employee.email,
        role: employee.role,
        job_title: employee.job_title,
        department_name: employee.department_name,
        join_date: employee.join_date,
        contract_type: employee.contract_type,
        employment_status: employee.employment_status,
        mobile: employee.mobile,
        nationality: employee.nationality,
        iqama_number: employee.iqama_number,
        iqama_expiry: employee.iqama_expiry,
        iqama_days_left: days(employee.iqama_expiry as string | null),
        address_line1: employee.address_line1,
        address_city: employee.address_city,
        emergency_contact_name: employee.emergency_contact_name,
        emergency_contact_phone: employee.emergency_contact_phone,
        bank_name: employee.bank_name,
        iban: employee.iban,
        basic_salary: employee.basic_salary,
        housing_allowance: employee.housing_allowance,
        transport_allowance: employee.transport_allowance,
        other_allowance: employee.other_allowance,
        gross_salary: employee.gross_salary,
        salary_currency_code: employee.salary_currency_code ?? HR_CURRENCY_CODE,
        tenure_months: Math.max(
          0,
          Math.round(
            (today.getTime() - new Date(employee.join_date).getTime()) / (30.44 * 86_400_000),
          ),
        ),
      },
      attendance: {
        this_month: summarise(monthRows),
        year_to_date: summarise(yearRows),
        recent: monthRows.slice(0, 10).map((r) => ({
          id: r.id,
          work_date: r.work_date,
          status: r.status,
          check_in: r.check_in,
          check_out: r.check_out,
          worked_hours: r.worked_hours,
          overtime_hours: r.overtime_hours,
        })),
        trend,
      },
      payroll: {
        currency_code: employee.salary_currency_code ?? HR_CURRENCY_CODE,
        ytd_net_paid: ytdNet.toFixed(2),
        last_paid_period: paid[0]?.period ?? null,
        payslips: payslips.map((p) => ({
          id: p.id,
          period: p.period,
          status: p.status,
          net_pay: p.net_pay,
          bonus: p.bonus,
          overtime_amount: p.overtime_amount,
          gosi_deduction: p.gosi_deduction,
          unpaid_leave_deduction: p.unpaid_leave_deduction,
          other_deduction: p.other_deduction,
          paid_at: p.paid_at,
        })),
      },
      documents: documents.map((d) => ({
        id: d.id,
        doc_type: d.doc_type,
        file_name: d.file_name,
        uploaded_at: d.uploaded_at,
      })),
    };
  }
}

