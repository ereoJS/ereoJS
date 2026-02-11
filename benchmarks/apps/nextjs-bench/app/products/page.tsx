import { getProducts } from '../../lib/data';
import SearchBar from '../../components/SearchBar';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = parseInt(params.page ?? '1', 10);
  const data = await getProducts(page, 50);

  return (
    <div>
      <h1>Products</h1>
      <p>Total: {data.total} products | Page {data.page} of {data.totalPages}</p>
      <SearchBar products={data.products} />
    </div>
  );
}
