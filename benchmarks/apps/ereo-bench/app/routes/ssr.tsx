import type { LoaderArgs } from '@ereo/core';
import { getProducts, type Product } from '../data';

export async function loader({ request }: LoaderArgs) {
  const data = await getProducts(1, 20);
  return { products: data.products, total: data.total };
}

export default function SSRPage({ loaderData }: { loaderData: { products: Product[]; total: number } }) {
  return (
    <div>
      <h1>Server-Side Rendered Products</h1>
      <p>Showing {loaderData.products.length} of {loaderData.total} products</p>
      <ul>
        {loaderData.products.map((product) => (
          <li key={product.id}>
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <span>${product.price.toFixed(2)}</span>
            <span> | Rating: {product.rating}/5</span>
            <span> | Stock: {product.stock}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
