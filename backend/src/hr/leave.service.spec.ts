import { describe, expect, it, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LeaveService, type LeaveActor } from './leave.service';
import type { LeaveRequest } from './leave.entity';

/**
 * End-to-end approval flow over in-memory stand-ins for the TypeORM
 * repositories — enough to exercise routing, permissions and status changes
 * without a database.
 */

const EMP = {
  admin: { id: 'e-admin', user_id: 'u-admin', role: 'admin' },
  manager: { id: 'e-manager', user_id: 'u-manager', role: 'manager' },
  supervisor: { id: 'e-sup', user_id: 'u-sup', role: 'supervisor' },
  employee: { id: 'e-emp', user_id: 'u-emp', role: 'employee' },
};

function makeService() {
  const leaves: LeaveRequest[] = [];
  let seq = 0;

  const employees = Object.values(EMP).map((e) => ({
    id: e.id,
    user_id: e.user_id,
    first_name: 'Test',
    last_name: e.role,
    employment_status: 'active',
    user: { role_id: `r-${e.role}`, role: { code: e.role } },
  }));

  const leaveRepo = {
    create: (v: Partial<LeaveRequest>) => ({ ...v }) as LeaveRequest,
    save: async (v: LeaveRequest) => {
      if (!v.id) {
        v.id = `l-${++seq}`;
        leaves.push(v);
      }
      return v;
    },
    find: async ({ where = {} }: any = {}) =>
      leaves.filter((l) =>
        Object.entries(where).every(([k, val]) => (l as any)[k] === val),
      ),
    findOne: async ({ where }: any) =>
      leaves.find((l) => Object.entries(where).every(([k, v]) => (l as any)[k] === v)) ?? null,
    createQueryBuilder: () => {
      const qb: any = {
        where: () => qb,
        andWhere: () => qb,
        orderBy: () => qb,
        leftJoinAndSelect: () => qb,
        getOne: async () => null,
        getMany: async () => [],
      };
      return qb;
    },
  };

  const empRepo = {
    findOne: async ({ where }: any) =>
      employees.find((e) => Object.entries(where).every(([k, v]) => (e as any)[k] === v)) ?? null,
    createQueryBuilder: () => {
      let id: string | undefined;
      const qb: any = {
        leftJoinAndSelect: () => qb,
        where: (_s: string, p: any) => {
          id = p?.id;
          return qb;
        },
        getOne: async () => employees.find((e) => e.id === id) ?? null,
        getMany: async () => [],
      };
      return qb;
    },
  };

  const policyRepo = {
    find: async () => [{ leave_type: 'annual', entitlement: '21.00', period_unit: 'year' }],
    findOne: async () => null,
  };
  const roleRepo = { find: async () => [] };

  return new LeaveService(
    leaveRepo as any,
    policyRepo as any,
    empRepo as any,
    roleRepo as any,
  );
}

const actor = (key: keyof typeof EMP): LeaveActor => ({
  id: EMP[key].user_id,
  name: `${key} user`,
  role: EMP[key].role as LeaveActor['role'],
});

const request = { leave_type: 'annual' as const, from_date: '2026-03-04', to_date: '2026-03-05', reason: 'Trip' };

describe('leave approval flow', () => {
  let svc: LeaveService;
  beforeEach(() => {
    svc = makeService();
  });

  it('auto-approves an admin request and records the decider', async () => {
    const r = await svc.apply(request, actor('admin'));
    expect(r.status).toBe('approved');
    expect(r.decided_by).toBe('admin user');
    expect(r.decided_by_role).toBe('admin');
    expect(r.decided_at).toBeTruthy();
  });

  it("routes a manager's request to an admin", async () => {
    const r = await svc.apply(request, actor('manager'));
    expect(r.status).toBe('pending_admin');
    const decided = await svc.decide(r.id, { action: 'approve' }, actor('admin'));
    expect(decided.status).toBe('approved');
    expect(decided.decided_by_role).toBe('admin');
  });

  it('lets a supervisor approve an employee request in one step', async () => {
    const r = await svc.apply(request, actor('employee'));
    expect(r.status).toBe('pending_supervisor');
    const decided = await svc.decide(r.id, { action: 'approve' }, actor('supervisor'));
    expect(decided.status).toBe('approved');
    expect(decided.decided_by).toBe('supervisor user');
    expect(decided.decided_by_role).toBe('supervisor');
  });

  it('records a rejection with its reason', async () => {
    const r = await svc.apply(request, actor('employee'));
    const decided = await svc.decide(r.id, { action: 'reject', note: 'Peak season' }, actor('manager'));
    expect(decided.status).toBe('rejected');
    expect(decided.rejection_reason).toBe('Peak season');
  });

  it("blocks a supervisor from deciding a manager's request", async () => {
    const r = await svc.apply(request, actor('manager'));
    await expect(svc.decide(r.id, { action: 'approve' }, actor('supervisor'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blocks self-approval', async () => {
    const r = await svc.apply(request, actor('supervisor'));
    await expect(svc.decide(r.id, { action: 'approve' }, actor('supervisor'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses to re-decide a closed request', async () => {
    const r = await svc.apply(request, actor('employee'));
    await svc.decide(r.id, { action: 'approve' }, actor('supervisor'));
    await expect(svc.decide(r.id, { action: 'reject' }, actor('admin'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a backwards or impossible date range', async () => {
    await expect(
      svc.apply({ ...request, from_date: '2026-03-10', to_date: '2026-03-04' }, actor('employee')),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.apply({ ...request, from_date: '2026-02-30', to_date: '2026-03-04' }, actor('employee')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates the on-leave date', async () => {
    await expect(svc.onLeave('04-03-2026')).rejects.toBeInstanceOf(BadRequestException);
  });
});
