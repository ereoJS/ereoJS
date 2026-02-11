import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getProducts } from "../data";
import type { Product } from "../data";
import SearchBar from "../components/SearchBar";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const data = await getProducts(page, 50);
  return data;
}

export default function ProductsPage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div>
      <h1>Products</h1>
      <p>Total: {data.total} products | Page {data.page} of {data.totalPages}</p>
      <SearchBar products={data.products as Product[]} />
    </div>
  );
}
