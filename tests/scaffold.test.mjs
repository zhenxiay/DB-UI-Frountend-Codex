import assert from 'node:assert/strict';
import test from 'node:test';

test('the scaffold test runner executes deterministically', () => {
  assert.equal('personal-finance-app'.startsWith('personal-finance'), true);
});
