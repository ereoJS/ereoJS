import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getProducts } from "../data";
import type { Product } from "../data";

export async function loader({ request }: LoaderFunctionArgs) {
  const data = await getProducts(1, 20);
  return { products: data.products, total: data.total };
}

export default function SSRPage() {
  const { products, total } = useLoaderData<typeof loader>();
  return (
    <div>
      <h1>Server-Side Rendered Products</h1>
      <p>Showing {products.length} of {total} products</p>
      <ul>
        {products.map((product: Product) => (
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
