'use server';

import {
  createTransaction,
  TransactionValidationError,
  updateTransaction,
  type TransactionInput,
} from './service';

export type TransactionActionState = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function failure(error: unknown): TransactionActionState {
  if (error instanceof TransactionValidationError) {
    return { success: false, message: error.message, fieldErrors: error.fieldErrors };
  }
  return {
    success: false,
    message: error instanceof Error ? error.message : 'Transaction change failed.',
  };
}

export async function saveTransaction(
  input: TransactionInput,
  id?: string,
): Promise<TransactionActionState> {
  try {
    if (id) await updateTransaction(id, input);
    else await createTransaction(input);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}
