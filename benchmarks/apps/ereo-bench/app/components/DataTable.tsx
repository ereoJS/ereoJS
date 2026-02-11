import { useState, useMemo } from 'react';
import type { Product } from '../data';

type SortKey = 'name' | 'price' | 'rating' | 'stock' | 'category';
type SortDir = 'asc' | 'desc';

export default function DataTable({ products }: { products: Product[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const sorted = useMemo(() => {
    return [...products].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [products, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / perPage);
  const pageData = sorted.slice((page - 1) * perPage, page * perPage);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const thStyle = { cursor: 'pointer', padding: '8px', borderBottom: '2px solid #333' };
  const tdStyle = { padding: '8px', borderBottom: '1px solid #ddd' };

  return (
    <div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {(['name', 'category', 'price', 'rating', 'stock'] as SortKey[]).map((key) => (
              <th key={key} onClick={() => toggleSort(key)} style={thStyle}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
                {sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageData.map((product) => (
            <tr key={product.id}>
              <td style={tdStyle}>{product.name}</td>
              <td style={tdStyle}>{product.category}</td>
              <td style={tdStyle}>${product.price.toFixed(2)}</td>
              <td style={tdStyle}>{product.rating}/5</td>
              <td style={tdStyle}>{product.stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}
