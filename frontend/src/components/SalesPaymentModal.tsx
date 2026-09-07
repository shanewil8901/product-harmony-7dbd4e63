import { useState } from 'react';
import { Modal } from './Dialog';
import { salesService } from '../services/sales.service';
import { toast } from '../lib/toast';
import { formatMoney } from '../types/stock';
import {
  SALES_PAYMENT_METHODS,
  SALES_PAYMENT_METHOD_LABEL,
  type SalesOrder,
  type SalesPaymentInput,
  type SalesPaymentMethod,
} from '../types/sales';

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Records a settlement against an order. Cash and bank transfers book the money
 * immediately; credit is parked as "Pending payment" until a supervisor
 * confirms that the funds actually arrived.
 */
export function SalesPaymentModal({
  order,
  onClose,
  onSaved,
}: {
  order: SalesOrder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [method, setMethod] = useState<SalesPaymentMethod>('cash');
  const [amount, setAmount] = useState(order.outstanding_amount);
  const [proofDocNo, setProofDocNo] = useState('');
  const [proofFile, setProofFile] = useState<{ name: string; data: string } | null>(null);
  const [bankReference, setBankReference] = useState('');
  const [creditReference, setCreditReference] = useState('');
  const [creditDays, setCreditDays] = useState(30);
  const [expectedDate, setExpectedDate] = useState(addDays(30));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const pickFile = (file: File | undefined) => {
    if (!file) return setProofFile(null);
    if (file.size > 4 * 1024 * 1024) {
      toast('error', 'Proof files must be under 4 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProofFile({ name: file.name, data: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    const value = Number(amount);
    if (!(value > 0)) return toast('error', 'Enter an amount greater than zero');
    const payload: SalesPaymentInput = { amount: value, method };
    if (method === 'cash') {
      if (proofDocNo.trim()) payload.proof_doc_no = proofDocNo.trim();
      if (proofFile) {
        payload.proof_file_name = proofFile.name;
        payload.proof_file_data = proofFile.data;
      }
    }
    if (method === 'bank_transfer' && bankReference.trim())
      payload.bank_reference = bankReference.trim();
    if (method === 'credit') {
      if (!creditReference.trim()) return toast('error', 'Enter the credit reference number');
      payload.credit_reference = creditReference.trim();
      payload.credit_days = Number(creditDays);
      payload.expected_date = expectedDate;
    }
    if (note.trim()) payload.note = note.trim();

    setSaving(true);
    try {
      await salesService.recordPayment(order.id, payload);
      toast(
        'success',
        method === 'credit'
          ? 'Credit recorded — awaiting supervisor confirmation'
          : 'Payment recorded',
      );
      onSaved();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Could not record the payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Record payment · ${order.order_no}`}
      subtitle={`Outstanding ${formatMoney(order.outstanding_amount, order.currency_code)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-gold" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Saving…' : 'Record payment'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Payment method</label>
          <div className="flex flex-wrap gap-2">
            {SALES_PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  method === m
                    ? 'border-gold-300 bg-gold-50 text-ink'
                    : 'border-brown-200 text-brown-600 hover:bg-paper-soft'
                }`}
              >
                {SALES_PAYMENT_METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Amount ({order.currency_code ?? 'SAR'})</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {method === 'cash' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Receipt / document number (optional)</label>
              <input
                className="input"
                value={proofDocNo}
                onChange={(e) => setProofDocNo(e.target.value)}
                placeholder="e.g. RCPT-00124"
              />
            </div>
            <div>
              <label className="label">Payment proof (optional)</label>
              <input
                className="input"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              {proofFile && <p className="mt-1 text-xs text-brown-500">{proofFile.name}</p>}
            </div>
          </div>
        )}

        {method === 'bank_transfer' && (
          <div>
            <label className="label">Bank reference number (optional)</label>
            <input
              className="input"
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value)}
              placeholder="e.g. TRF-8891023"
            />
          </div>
        )}

        {method === 'credit' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Credit reference no</label>
              <input
                className="input"
                value={creditReference}
                onChange={(e) => setCreditReference(e.target.value)}
                placeholder="e.g. CR-2026-014"
              />
            </div>
            <div>
              <label className="label">Days to cash arrival</label>
              <input
                className="input"
                type="number"
                min={1}
                value={creditDays}
                onChange={(e) => {
                  const days = Number(e.target.value);
                  setCreditDays(days);
                  if (days > 0) setExpectedDate(addDays(days));
                }}
              />
            </div>
            <div>
              <label className="label">Expected cash date</label>
              <input
                className="input"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
            <p className="text-xs text-brown-500 sm:col-span-3">
              The order stays in “Credit — pending payment” until a supervisor confirms the funds.
            </p>
          </div>
        )}

        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
