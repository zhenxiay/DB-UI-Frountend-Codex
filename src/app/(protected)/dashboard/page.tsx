import { DashboardOverview } from '../../../components/dashboard-overview';
import { getDashboardForUser } from '../../../server/dashboard/query';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const dashboard = await getDashboardForUser();
  return <DashboardOverview dashboard={dashboard} />;
}
