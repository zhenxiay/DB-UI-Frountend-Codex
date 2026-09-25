'use server';

import { AccountValidationError, createAccount, deleteAccount, updateAccount, type AccountInput } from './service';

export type AccountActionState = { success: boolean; message?: string; fieldErrors?: Record<string, string[]> };

function failure(error: unknown): AccountActionState {
  if (error instanceof AccountValidationError) return { success: false, message: error.message, fieldErrors: error.fieldErrors };
  return { success: false, message: error instanceof Error ? error.message : 'Account change failed.' };
}

export async function saveAccount(input: AccountInput, id?: string): Promise<AccountActionState> {
  try {
    if (id) await updateAccount(id, input);
    else await createAccount(input);
    return { success: true };
  } catch (error) { return failure(error); }
}

export async function removeAccount(id: string): Promise<AccountActionState> {
  try { await deleteAccount(id); return { success: true }; }
  catch (error) { return failure(error); }
}
