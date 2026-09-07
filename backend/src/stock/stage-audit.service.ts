import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { StockStageAudit, StageAuditResult } from './stage-audit.entity';
import { DOC_TYPE_LABEL } from './lifecycle';
import type { StockDocType } from './stock-document.entity';
import type { StockStatus } from './stock.entity';
import type { RoleCode } from '../master-data/role.entity';

export interface StageAuditInput {
  stock_id: string;
  doc_type: StockDocType;
  result: StageAuditResult;
  actor_email: string | null;
  actor_role: RoleCode | null;
  document_id?: string | null;
  doc_number?: string | null;
  status_from?: StockStatus | null;
  status_to?: StockStatus | null;
  reason?: string | null;
  payload?: Record<string, unknown> | null;
  total_amount?: string | null;
  currency_code?: string | null;
}

@Injectable()
export class StageAuditService {
  constructor(
    @InjectRepository(StockStageAudit) private readonly repo: Repository<StockStageAudit>,
  ) {}

  /** Audit writes must never break the operation they are recording. */
  async log(input: StageAuditInput, mgr?: EntityManager) {
    const row = {
      stock_id: input.stock_id,
      document_id: input.document_id ?? null,
      doc_type: input.doc_type,
      doc_number: input.doc_number ?? null,
      stage_label: DOC_TYPE_LABEL[input.doc_type] ?? input.doc_type,
      status_from: input.status_from ?? null,
      status_to: input.status_to ?? null,
      result: input.result,
      reason: input.reason ?? null,
      payload: input.payload ?? null,
      total_amount: input.total_amount ?? null,
      currency_code: input.currency_code ?? null,
      actor_email: input.actor_email,
      actor_role: input.actor_role,
    };
    try {
      if (mgr) {
        await mgr.save(mgr.create(StockStageAudit, row));
        return;
      }
      await this.repo.save(this.repo.create(row));
    } catch {
      // Swallow — an audit failure must not roll back a legitimate stage.
    }
  }

  listForStock(stockId: string) {
    return this.repo.find({ where: { stock_id: stockId }, order: { created_at: 'DESC' } });
  }

  recent(limit = 100) {
    return this.repo.find({ order: { created_at: 'DESC' }, take: Math.min(limit, 500) });
  }
}
