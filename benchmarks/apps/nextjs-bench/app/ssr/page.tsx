import { getProducts } from '../../lib/data';

export const dynamic = 'force-dynamic';

export default async function SSRPage() {
  const data = await getProducts(1, 20);
  return (
    <div>
      <h1>Server-Side Rendered Products</h1>
      <p>Showing {data.products.length} of {data.total} products</p>
      <ul>
        {data.products.map((product) => (
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
