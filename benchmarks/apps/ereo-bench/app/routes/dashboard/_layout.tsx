import type { RouteComponentProps } from '@ereo/core';

export default function DashboardLayout({ children }: RouteComponentProps) {
  return (
    <div style={{ display: 'flex' }}>
      <aside style={{ width: '200px', padding: '16px', borderRight: '1px solid #ddd' }}>
        <h2>Dashboard</h2>
        <nav>
          <ul>
            <li><a href="/dashboard">Overview</a></li>
            <li><a href="/products">Products</a></li>
          </ul>
        </nav>
      </aside>
      <div style={{ flex: 1, padding: '16px' }}>{children}</div>
    </div>
  );
}
