import { getProduct, getRelated } from '../../../lib/data';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(parseInt(id, 10));
  if (!product) notFound();
  const related = await getRelated(product.category, product.id);

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <div>
        <span>Price: ${product.price.toFixed(2)}</span>
        <span> | Category: {product.category}</span>
        <span> | Rating: {product.rating}/5</span>
        <span> | In Stock: {product.stock}</span>
      </div>
      <h2>Related Products</h2>
      <ul>
        {related.map((r) => (
          <li key={r.id}>
            <a href={`/products/${r.id}`}>{r.name}</a> - ${r.price.toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  );
}
