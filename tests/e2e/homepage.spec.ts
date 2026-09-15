import { expect, test } from '@playwright/test';

test('homepage loads with its local personal-finance message', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Personal Finance' })).toBeVisible();
  await expect(page.getByText('This is your local personal-finance application.')).toBeVisible();
});
