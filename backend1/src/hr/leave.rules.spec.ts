import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { canDecide, routeStatus } from './leave.rules';
import { ApplyLeaveDto } from './dto/leave.dto';
import { isIsoDate, isSameOrAfter } from '../common/date-range';

describe('routeStatus', () => {
  it('auto-approves admin leave', () => {
    expect(routeStatus('admin')).toBe('approved');
  });
  it('sends manager leave to an admin', () => {
    expect(routeStatus('manager')).toBe('pending_admin');
  });
  it.each(['supervisor', 'warehouse', 'sales', 'employee', null, undefined] as const)(
    'routes %s to a single supervisor sign-off',
    (role) => {
      expect(routeStatus(role)).toBe('pending_supervisor');
    },
  );
});

describe('canDecide', () => {
  it('lets a supervisor clear a normal request in one step', () => {
    expect(canDecide('pending_supervisor', 'supervisor')).toEqual({ ok: true, step: 'supervisor' });
    expect(canDecide('pending_supervisor', 'manager').ok).toBe(true);
    expect(canDecide('pending_supervisor', 'admin').ok).toBe(true);
  });

  it.each(['employee', 'sales', 'warehouse', null] as const)('blocks %s', (role) => {
    const r = canDecide('pending_supervisor', role);
    expect(r).toMatchObject({ ok: false, kind: 'forbidden' });
  });

  it("only an admin decides a manager's request", () => {
    expect(canDecide('pending_admin', 'admin')).toEqual({ ok: true, step: 'admin' });
    expect(canDecide('pending_admin', 'manager')).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(canDecide('pending_admin', 'supervisor').ok).toBe(false);
  });

  it('honours legacy pending_manager rows', () => {
    expect(canDecide('pending_manager', 'supervisor')).toEqual({ ok: true, step: 'supervisor' });
  });

  it('never lets anyone decide their own request', () => {
    expect(canDecide('pending_supervisor', 'supervisor', true)).toMatchObject({
      ok: false,
      kind: 'forbidden',
    });
    expect(canDecide('pending_admin', 'admin', true).ok).toBe(false);
  });

  it.each(['approved', 'rejected', 'cancelled'] as const)('closes %s requests', (status) => {
    expect(canDecide(status, 'admin')).toMatchObject({ ok: false, kind: 'closed' });
  });
});

describe('date range validation', () => {
  it('recognises real ISO dates only', () => {
    expect(isIsoDate('2026-03-04')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('04-03-2026')).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it('requires to >= from', () => {
    expect(isSameOrAfter('2026-03-05', '2026-03-04')).toBe(true);
    expect(isSameOrAfter('2026-03-04', '2026-03-04')).toBe(true);
    expect(isSameOrAfter('2026-03-03', '2026-03-04')).toBe(false);
  });

  const dto = (from: string, to: string) =>
    plainToInstance(ApplyLeaveDto, {
      leave_type: 'annual',
      from_date: from,
      to_date: to,
      reason: 'Family trip',
    });

  it('rejects a backwards range server-side', async () => {
    const errors = await validate(dto('2026-03-10', '2026-03-04'));
    expect(errors.some((e) => e.property === 'to_date')).toBe(true);
  });

  it('accepts a valid range', async () => {
    expect(await validate(dto('2026-03-04', '2026-03-10'))).toHaveLength(0);
  });
});
