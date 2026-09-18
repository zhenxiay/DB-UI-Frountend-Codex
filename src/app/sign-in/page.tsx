import { SignInButton } from '../../components/sign-in-button';

type SignInPageProps = {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { callbackUrl } = await searchParams;
  const safeCallbackUrl =
    typeof callbackUrl === 'string' && callbackUrl.startsWith('/') ? callbackUrl : '/dashboard';

  return (
    <main>
      <h1>Sign in</h1>
      <p>Sign in with your work or school Microsoft account to open your local finance data.</p>
      <SignInButton callbackUrl={safeCallbackUrl} />
    </main>
  );
}
