'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { DashboardCategorySpending } from '../server/dashboard/query';

type DashboardSpendingChartProps = Readonly<{
  month: string;
  spending: DashboardCategorySpending[];
}>;

const integerFormatter = new Intl.NumberFormat('de-DE', { useGrouping: true });

function euro(minor: number): string {
  const absolute = BigInt(minor < 0 ? -minor : minor);
  const euros = integerFormatter.format(absolute / BigInt(100));
  const cents = String(absolute % BigInt(100)).padStart(2, '0');
  return `${minor < 0 ? '−' : ''}${euros},${cents} €`;
}

export function DashboardSpendingChart({ month, spending }: DashboardSpendingChartProps) {
  const chartName = `Spending by category for ${month}`;

  return (
    <section
      aria-labelledby="dashboard-spending-heading"
      className="dashboard-panel dashboard-spending"
    >
      <h2 id="dashboard-spending-heading">{chartName}</h2>
      {spending.length === 0 ? (
        <div aria-label={chartName} className="dashboard-spending-empty" role="img">
          No expenses for this month.
        </div>
      ) : (
        <>
          <div
            aria-label={chartName}
            className="dashboard-spending-plot"
            role="img"
            style={{ height: Math.max(240, spending.length * 48) }}
          >
            <ResponsiveContainer height="100%" width="100%">
              <BarChart
                accessibilityLayer={false}
                data={spending}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
              >
                <CartesianGrid horizontal={false} stroke="#d8e0eb" />
                <XAxis
                  allowDecimals={false}
                  tickFormatter={(value: number) => euro(Math.round(value))}
                  type="number"
                />
                <YAxis dataKey="categoryName" type="category" width={160} />
                <Tooltip formatter={(value) => (typeof value === 'number' ? euro(value) : '')} />
                <Bar dataKey="amountMinor" fill="#2563a6" name="Expenses" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="dashboard-spending-table">
            <caption>Category spending for {month}</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Expenses</th>
              </tr>
            </thead>
            <tbody>
              {spending.map((category) => (
                <tr key={category.categoryId}>
                  <th scope="row">{category.categoryName}</th>
                  <td>{euro(category.amountMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
