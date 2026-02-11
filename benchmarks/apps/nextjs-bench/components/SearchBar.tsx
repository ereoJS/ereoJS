'use client';

import { useState } from 'react';
import type { Product } from '../lib/data';

export default function SearchBar({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('');

  const filtered = query
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase())
      )
    : products;

  return (
    <div>
      <input
        type="text"
        placeholder="Search products..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ padding: '8px', width: '300px', marginBottom: '16px' }}
      />
      <p>{filtered.length} products found</p>
      <ul>
        {filtered.map((product) => (
          <li key={product.id}>
            <a href={`/products/${product.id}`}>
              <strong>{product.name}</strong> - ${product.price.toFixed(2)} ({product.category})
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
