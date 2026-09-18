'use client';

import { signIn } from 'next-auth/react';

type SignInButtonProps = {
  callbackUrl?: string;
};

export function SignInButton({ callbackUrl = '/dashboard' }: SignInButtonProps) {
  return (
    <button type="button" onClick={() => void signIn('microsoft-entra-id', { callbackUrl })}>
      Sign in with Microsoft
    </button>
  );
}
