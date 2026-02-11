import type { LoaderArgs } from '@ereo/core';
import { createIsland } from '@ereo/client';
import { getProducts, type Product, type PaginatedResult } from '../../data';
import SearchBar from '../../components/SearchBar';

const SearchBarIsland = createIsland(SearchBar, 'SearchBar');

export async function loader({ request }: LoaderArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const data = await getProducts(page, 50);
  return data;
}

export default function ProductsPage({ loaderData }: { loaderData: PaginatedResult }) {
  return (
    <div>
      <h1>Products</h1>
      <p>Total: {loaderData.total} products | Page {loaderData.page} of {loaderData.totalPages}</p>
      <SearchBarIsland client:load products={loaderData.products} />
    </div>
  );
}
