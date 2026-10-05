'use client';

type DashboardMonthSelectorProps = Readonly<{ month: string }>;

export function DashboardMonthSelector({ month }: DashboardMonthSelectorProps) {
  return (
    <form action="/dashboard" className="dashboard-month-selector" method="get">
      <label htmlFor="dashboard-month">Spending month</label>
      <input
        id="dashboard-month"
        key={month}
        max="9999-12"
        min="0001-01"
        name="month"
        onChange={(event) => {
          if (event.currentTarget.validity.valid) event.currentTarget.form?.requestSubmit();
        }}
        required
        type="month"
        defaultValue={month}
      />
      <button type="submit">Show month</button>
    </form>
  );
}
