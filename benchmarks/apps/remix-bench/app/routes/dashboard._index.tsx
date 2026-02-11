import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getProducts } from "../data";
import type { Product } from "../data";
import DataTable from "../components/DataTable";

export async function loader({ request }: LoaderFunctionArgs) {
  const data = await getProducts(1, 100);
  return { products: data.products };
}

export default function DashboardPage() {
  const { products } = useLoaderData<typeof loader>();
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Interactive data table with sorting and pagination</p>
      <DataTable products={products as Product[]} />
    </div>
  );
}
