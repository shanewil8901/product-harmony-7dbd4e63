import { useEffect, useState } from 'react';
import { masterDataService } from '../services/masterData.service';
import type { Currency, Department, Uom } from '../types/product';

export function useMasterData() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, u, c] = await Promise.all([
          masterDataService.departments(),
          masterDataService.uoms(),
          masterDataService.currencies(),
        ]);
        if (cancelled) return;
        setDepartments(d);
        setUoms(u);
        setCurrencies(c);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load master data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const baseUoms = uoms.filter((u) => u.kind === 'base' || u.kind === 'both');
  const weightUoms = uoms.filter((u) => u.kind === 'weight' || u.kind === 'both');

  return { departments, uoms, baseUoms, weightUoms, currencies, loading, error };
}
