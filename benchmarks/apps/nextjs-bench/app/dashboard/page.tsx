import { getProducts } from '../../lib/data';
import DataTable from '../../components/DataTable';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const data = await getProducts(1, 100);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Interactive data table with sorting and pagination</p>
      <DataTable products={data.products} />
    </div>
  );
}
