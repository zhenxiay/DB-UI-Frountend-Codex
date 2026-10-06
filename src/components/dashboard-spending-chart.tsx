'use client';

import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { DashboardCategorySpending } from '../server/dashboard/query';

type DashboardSpendingChartProps = Readonly<{
  month: string;
  spending: DashboardCategorySpending[];
  selector?: ReactNode;
}>;

const integerFormatter = new Intl.NumberFormat('de-DE', { useGrouping: true });

function euro(minor: number): string {
  const absolute = BigInt(minor < 0 ? -minor : minor);
  const euros = integerFormatter.format(absolute / BigInt(100));
  const cents = String(absolute % BigInt(100)).padStart(2, '0');
  return `${minor < 0 ? '−' : ''}${euros},${cents} €`;
}

export function DashboardSpendingChart({ month, spending, selector }: DashboardSpendingChartProps) {
  const chartName = `Ausgaben nach Kategorie für ${month}`;

  return (
    <section
      aria-labelledby="dashboard-spending-heading"
      className="dashboard-panel dashboard-spending"
    >
      <div className="dashboard-panel-header"><h2 id="dashboard-spending-heading">Ausgaben nach Kategorie</h2>{selector}</div>
      {spending.length === 0 ? (
        <div aria-label={chartName} className="dashboard-spending-empty" role="img">
          Keine Ausgaben in diesem Monat.
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
                <CartesianGrid horizontal={false} stroke="#e5ebe3" />
                <XAxis
                  allowDecimals={false}
                  tickFormatter={(value: number) => euro(Math.round(value))}
                  type="number"
                />
                <YAxis
                  dataKey="categoryName"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(name: string) => name.length > 23 ? `${name.slice(0, 22)}…` : name}
                  type="category"
                  width={170}
                />
                <Tooltip formatter={(value) => (typeof value === 'number' ? euro(value) : '')} />
                <Bar dataKey="amountMinor" fill="#1e6b47" name="Ausgaben" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="dashboard-spending-table">
            <caption>Kategorieausgaben für {month}</caption>
            <thead>
              <tr>
                <th scope="col">Kategorie</th>
                <th scope="col">Ausgaben</th>
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
