import { sqliteTable, text, integer, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), customerId: text('customer_id'), createdAt: integer('created_at').notNull(),
});
export const sessions = sqliteTable('auth_sessions', {
  hash: text('token_hash').primaryKey(), userId: text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at').notNull(),
});
export const quotes = sqliteTable('quotes', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id),
  purchaseKey: text('purchase_key').notNull(), provider: text('provider').notNull(), source: text('source').notNull(),
  usdCents: integer('usd_cents'), cadCents: integer('cad_cents').notNull(), giftCents: integer('gift_cents').notNull(),
  fxLabel: text('fx_label').notNull(), fxDate: text('fx_date'), createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, t => [uniqueIndex('quote_purchase_once').on(t.userId,t.purchaseKey),
  check('quote_money', sql`${t.cadCents} > 0 AND ${t.cadCents} <= 100000000 AND (${t.giftCents} = 0 OR ${t.giftCents} BETWEEN 15 AND 114)`),
  check('quote_source',sql`${t.source} IN ('estimated','entered','observed')`)]);
export const checkouts = sqliteTable('checkouts', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id),
  amountCents: integer('amount_cents').notNull(), status: text('status').notNull(),
  stripeSessionId: text('stripe_session_id'), stripeUrl: text('stripe_url'),
  createdAt: integer('created_at').notNull(), paidAt: integer('paid_at'),
},t => [uniqueIndex('one_active_checkout').on(t.userId).where(sql`${t.status} IN ('creating','open')`),
  uniqueIndex('one_stripe_session').on(t.stripeSessionId),check('checkout_minimum',sql`${t.amountCents} >= 500`),
  check('checkout_status',sql`${t.status} IN ('creating','open','paid','expired')`)]);
export const pledges = sqliteTable('pledges', {
  id: text('id').primaryKey(), quoteId: text('quote_id').notNull().references(() => quotes.id),
  userId: text('user_id').notNull().references(() => users.id), giftCents: integer('gift_cents').notNull(),
  checkoutId: text('checkout_id').references(() => checkouts.id), paidAt: integer('paid_at'),
  createdAt: integer('created_at').notNull(),
},t => [uniqueIndex('pledge_quote_once').on(t.quoteId),index('pledge_owner').on(t.userId,t.paidAt),
  check('pledge_positive',sql`${t.giftCents} BETWEEN 15 AND 114`)]);
export const paymentEvents = sqliteTable('payment_events', {
  id: text('id').primaryKey(), checkoutId: text('checkout_id').notNull().references(() => checkouts.id),
  createdAt: integer('created_at').notNull(),
});
export const pairCodes = sqliteTable('pair_codes', {
  hash: text('code_hash').primaryKey(),userId:text('user_id').notNull().references(() => users.id),
  expiresAt:integer('expires_at').notNull(),usedAt:integer('used_at'),
});
export const devices = sqliteTable('devices', {
  hash:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(() => users.id),
  expiresAt:integer('expires_at').notNull(),
});
