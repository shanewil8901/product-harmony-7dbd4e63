import { useState } from 'react';
import { useProducts } from '../hooks/useProducts';
import { ProductTable } from '../components/ProductTable';
import { ProductModal } from '../components/ProductModal';
import type { Product } from '../types/product';

export function ProductsPage() {
  const {
    data,
    loading,
    error,
    search,
    setSearch,
    page,
    setPage,
    create,
    update,
    remove,
  } = useProducts();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setModalOpen(true);
  };

  const total = data?.total ?? 0;
  const limit = data?.limit ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl text-ink">Products</h1>
          <p className="text-sm text-brown-500 mt-1">
            {total} {total === 1 ? 'item' : 'items'} in your catalog
          </p>
        </div>
        <button className="btn-gold" onClick={openCreate}>
          + New product
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="label">Search by product code or barcode</label>
            <input
              className="input"
              placeholder="e.g. SKU-000123 or 0123456789012"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-brown-200 bg-brown-50 px-4 py-3 text-sm text-brown-600">
          {error}
        </div>
      )}

      <ProductTable
        products={data?.items ?? []}
        loading={loading}
        onEdit={openEdit}
        onDelete={remove}
      />

      <div className="flex items-center justify-between">
        <div className="text-xs text-brown-500">
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <button
            className="btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {modalOpen && (
        <ProductModal
          product={editing}
          onClose={() => setModalOpen(false)}
          onSubmit={async (input) => {
            if (editing) await update(editing.id, input);
            else await create(input);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
