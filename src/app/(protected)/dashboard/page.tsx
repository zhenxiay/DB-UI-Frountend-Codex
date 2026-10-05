import { DashboardOverview } from '../../../components/dashboard-overview';
import { getDashboardForUser } from '../../../server/dashboard/query';

export const dynamic = 'force-dynamic';

type DashboardPageProps = {
  searchParams?: Promise<{ month?: string | string[] }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const month = (await searchParams)?.month;
  const dashboard =
    month === undefined ? await getDashboardForUser() : await getDashboardForUser(month);
  return <DashboardOverview dashboard={dashboard} />;
}
