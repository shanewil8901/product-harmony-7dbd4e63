import { useCallback, useEffect, useState } from 'react';
import { productsService } from '../services/products.service';
import type { Paginated, Product, ProductInput } from '../types/product';

export function useProducts(initialSearch = '') {
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [data, setData] = useState<Paginated<Product> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productsService.list({ search: search || undefined, page, limit });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search, page, limit]);

  useEffect(() => {
    const id = setTimeout(refresh, 250);
    return () => clearTimeout(id);
  }, [refresh]);

  const create = async (input: ProductInput) => {
    await productsService.create(input);
    await refresh();
  };
  const update = async (id: string, input: Partial<ProductInput>) => {
    await productsService.update(id, input);
    await refresh();
  };
  const remove = async (id: string) => {
    await productsService.remove(id);
    await refresh();
  };

  return {
    data,
    loading,
    error,
    search,
    setSearch,
    page,
    setPage,
    refresh,
    create,
    update,
    remove,
  };
}
