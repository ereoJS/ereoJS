import type { LoaderArgs } from '@ereo/core';
import { createIsland } from '@ereo/client';
import { getProducts, type Product } from '../../data';
import DataTable from '../../components/DataTable';

const DataTableIsland = createIsland(DataTable, 'DataTable');

export async function loader({ request }: LoaderArgs) {
  const data = await getProducts(1, 100);
  return { products: data.products };
}

export default function DashboardPage({ loaderData }: { loaderData: { products: Product[] } }) {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Interactive data table with sorting and pagination</p>
      <DataTableIsland client:load products={loaderData.products} />
    </div>
  );
}
