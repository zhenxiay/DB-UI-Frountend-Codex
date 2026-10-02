import { describe, expect, it } from 'vitest';

import { isAllowedIdentity } from '../src/lib/entra-allowlist';

describe('Entra single-user allowlist', () => {
  it('allows the configured email identity case-insensitively', () => {
    expect(
      isAllowedIdentity(
        { id: 'stable-subject', email: 'Allowed@Example.com' },
        ' allowed@example.com ',
      ),
    ).toBe(true);
  });

  it('allows a configured stable provider subject', () => {
    expect(isAllowedIdentity({ id: 'entra-subject-123' }, 'entra-subject-123')).toBe(true);
  });

  it('does not let a subject bypass an email-configured allowlist', () => {
    expect(
      isAllowedIdentity(
        { id: 'allowed@example.com', email: 'other@example.com' },
        'allowed@example.com',
      ),
    ).toBe(false);
    expect(isAllowedIdentity({ id: 'allowed@example.com' }, 'allowed@example.com')).toBe(false);
  });

  it.each([
    [undefined, 'allowed@example.com'],
    [{ email: null }, 'allowed@example.com'],
    [{ email: 'other@example.com' }, 'allowed@example.com'],
    [{ email: 'allowed@example.com' }, 'allowed@example.com'],
    [{ id: ' ', email: 'allowed@example.com' }, 'allowed@example.com'],
  ])('rejects missing or non-allowed identity %j', (identity, allowed) => {
    expect(isAllowedIdentity(identity, allowed)).toBe(false);
  });
});
