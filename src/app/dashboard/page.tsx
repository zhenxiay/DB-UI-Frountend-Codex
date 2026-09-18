import { SignOutButton } from '../../components/sign-out-button';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <p>Your finance dashboard will appear here.</p>
      <SignOutButton />
    </main>
  );
}
