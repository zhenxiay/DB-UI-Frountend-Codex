import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const createdTimestamp = () => integer('created_at', { mode: 'timestamp_ms' }).notNull();

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    typeLabel: text('type_label').notNull(),
    openingBalanceMinor: integer('opening_balance_minor').notNull(),
    createdAt: createdTimestamp(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check('accounts_name_not_empty', sql`length(trim(${table.name})) > 0`),
    check('accounts_type_label_not_empty', sql`length(trim(${table.typeLabel})) > 0`),
  ],
);

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
  },
  (table) => [
    uniqueIndex('categories_name_unique').on(table.name),
    check('categories_name_not_empty', sql`length(trim(${table.name})) > 0`),
    check('categories_kind_check', sql`${table.kind} in ('income', 'expense', 'both')`),
  ],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    type: text('type').notNull(),
    amountMinor: integer('amount_minor').notNull(),
    transactionDate: text('transaction_date').notNull(),
    entryDate: text('entry_date').notNull(),
    payee: text('payee'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('transactions_account_idx').on(table.accountId),
    index('transactions_category_idx').on(table.categoryId),
    index('transactions_date_idx').on(table.transactionDate),
    check('transactions_type_check', sql`${table.type} in ('income', 'expense')`),
    check('transactions_amount_positive', sql`${table.amountMinor} > 0`),
    check(
      'transactions_date_format',
      sql`${table.transactionDate} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
    check(
      'transactions_entry_date_format',
      sql`${table.entryDate} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
  ],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    actorIdentity: text('actor_identity').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    beforeSnapshot: text('before_snapshot'),
    afterSnapshot: text('after_snapshot'),
  },
  (table) => [index('audit_events_entity_idx').on(table.entityType, table.entityId)],
);

export const schema = { accounts, transactions, categories, auditEvents };
