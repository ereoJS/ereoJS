import type { LoaderArgs } from '@ereo/core';
import { getProduct, getRelated, type Product } from '../../data';

export async function loader({ params }: LoaderArgs<{ id: string }>) {
  const product = await getProduct(parseInt(params.id, 10));
  if (!product) {
    throw new Response('Not Found', { status: 404 });
  }
  const related = await getRelated(product.category, product.id);
  return { product, related };
}

export default function ProductDetailPage({ loaderData }: { loaderData: { product: Product; related: Product[] } }) {
  const { product, related } = loaderData;
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
