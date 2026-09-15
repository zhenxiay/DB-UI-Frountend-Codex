import { render, screen } from '@testing-library/react';

import HomePage from '../src/app/page';

describe('homepage', () => {
  it('identifies the local personal-finance application', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: 'Personal Finance' })).toBeVisible();
    expect(screen.getByText('This is your local personal-finance application.')).toBeVisible();
  });
});
