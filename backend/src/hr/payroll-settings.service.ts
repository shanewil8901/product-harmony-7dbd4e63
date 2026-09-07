import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PayrollRunLog,
  PayrollSettings,
  WorkCalendar,
  type CalendarSource,
} from './payroll-settings.entity';
import { UpdatePayrollSettingsDto, UpsertWorkCalendarDto } from './dto/leave.dto';

const SETTINGS_ID = 'default';
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Working days for a month plus the calendar entry they were taken from. */
export interface WorkingDaysResolution {
  working_days: number;
  source: CalendarSource;
  source_period: string | null;
}

@Injectable()
export class PayrollSettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(PayrollSettings) private readonly repo: Repository<PayrollSettings>,
    @InjectRepository(WorkCalendar) private readonly calRepo: Repository<WorkCalendar>,
    @InjectRepository(PayrollRunLog) private readonly logRepo: Repository<PayrollRunLog>,
  ) {}

  async onModuleInit() {
    await this.get();
  }

  async get() {
    const existing = await this.repo.findOne({ where: { id: SETTINGS_ID } });
    if (existing) return existing;
    return this.repo.save(this.repo.create({ id: SETTINGS_ID }));
  }

  async update(dto: UpdatePayrollSettingsDto, actor: string) {
    const s = await this.get();
    if (dto.auto_generate !== undefined) s.auto_generate = dto.auto_generate;
    if (dto.pay_day !== undefined) s.pay_day = dto.pay_day;
    if (dto.period_offset !== undefined) s.period_offset = dto.period_offset;
    if (dto.default_overtime_rate !== undefined)
      s.default_overtime_rate = dto.default_overtime_rate.toFixed(2);
    if (dto.default_gosi_percent !== undefined)
      s.default_gosi_percent = dto.default_gosi_percent.toFixed(2);
    if (dto.default_working_days !== undefined) s.default_working_days = dto.default_working_days;
    s.updated_by = actor;
    return this.repo.save(s);
  }

  async markRun(period: string, summary: string) {
    const s = await this.get();
    s.last_run_period = period;
    s.last_run_at = new Date();
    s.last_run_summary = summary.slice(0, 255);
    await this.repo.save(s);
  }

  // ------------------------------------------------------------- calendar

  calendars() {
    return this.calRepo.find({ order: { period: 'DESC' } });
  }

  async upsertCalendar(dto: UpsertWorkCalendarDto, actor: string) {
    if (!PERIOD_RE.test(dto.period)) throw new NotFoundException('Period must be YYYY-MM');
    const existing = await this.calRepo.findOne({ where: { period: dto.period } });
    const row =
      existing ??
      this.calRepo.create({ period: dto.period, working_days: dto.working_days });
    row.working_days = dto.working_days;
    row.public_holidays = dto.public_holidays ?? row.public_holidays ?? 0;
    row.notes = dto.notes ?? null;
    row.updated_by = actor;
    return this.calRepo.save(row);
  }

  async removeCalendar(id: string) {
    const row = await this.calRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Calendar entry not found');
    await this.calRepo.remove(row);
    return { id, deleted: true };
  }

  /**
   * Working days for the month plus where the figure came from. If nothing was
   * entered for that month we reuse the last entered calendar data (the most
   * recent earlier month, otherwise the newest entry on file), and only fall
   * back to the configured default when the calendar is completely empty.
   */
  async resolveWorkingDays(period: string): Promise<WorkingDaysResolution> {
    const cal = await this.calRepo.findOne({ where: { period } });
    if (cal)
      return { working_days: cal.working_days, source: 'calendar', source_period: cal.period };

    const previous = await this.calRepo
      .createQueryBuilder('c')
      .where('c.period < :period', { period })
      .orderBy('c.period', 'DESC')
      .getOne();
    if (previous)
      return {
        working_days: previous.working_days,
        source: 'previous-calendar',
        source_period: previous.period,
      };

    const latest = await this.calRepo.findOne({ where: {}, order: { period: 'DESC' } });
    if (latest)
      return {
        working_days: latest.working_days,
        source: 'previous-calendar',
        source_period: latest.period,
      };

    const s = await this.get();
    return { working_days: s.default_working_days, source: 'default', source_period: null };
  }

  /** Convenience wrapper for callers that only need the number. */
  async workingDaysFor(period: string) {
    return (await this.resolveWorkingDays(period)).working_days;
  }

  // ------------------------------------------------------------- audit log

  /** Records one payroll generation attempt (scheduled, manual or test). */
  async logRun(entry: {
    request_id: string;
    period: string;
    trigger_type: 'scheduled' | 'manual' | 'test';
    calendar_source: CalendarSource;
    source_period: string | null;
    working_days: number;
    created_count: number;
    skipped_count: number;
    dry_run?: boolean;
    summary?: string;
    actor?: string | null;
  }) {
    return this.logRepo.save(
      this.logRepo.create({
        ...entry,
        dry_run: entry.dry_run ?? false,
        summary: entry.summary?.slice(0, 255) ?? null,
        actor: entry.actor ?? null,
      }),
    );
  }

  /** Newest first — what the payroll settings screen shows. */
  logs(limit = 50) {
    return this.logRepo.find({ order: { created_at: 'DESC' }, take: Math.min(limit, 200) });
  }

  /** The payroll month the scheduler should run on the configured pay day. */
  periodForRun(today = new Date()) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return (offset: number) => {
      d.setUTCMonth(d.getUTCMonth() - offset);
      return d.toISOString().slice(0, 7);
    };
  }
}
