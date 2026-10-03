import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SCHEMA = `
create table if not exists org (
  id integer primary key check (id = 1),
  name text not null,
  billing_email text,
  pledge_rate real not null default 0.01,
  basis text not null default 'auto',
  stripe_customer_id text,
  created_at text not null
);
create table if not exists connection (
  id integer primary key,
  kind text not null,            -- plaid | anthropic | openai
  label text not null,
  secret text not null,          -- sealed access token or admin key
  hint text,
  cursor text,                   -- Plaid transactions/sync cursor
  status text not null default 'ok',
  error text,
  synced_at text,
  created_at text not null
);
create table if not exists card_txn (
  id text primary key,           -- Plaid transaction_id
  connection_id integer not null references connection(id) on delete cascade,
  date text not null,
  description text not null,
  merchant text,
  amount_cents integer not null, -- positive means money out
  vendor text                    -- AI vendor name, null if not AI
);
create table if not exists provider_cost (
  connection_id integer not null references connection(id) on delete cascade,
  date text not null,
  amount_cents integer not null,
  primary key (connection_id, date)
);
create table if not exists invoice (
  id integer primary key,
  number text not null unique,
  period_start text not null,
  period_end text not null,
  basis text not null,
  basis_cents integer not null,
  rate real not null,
  amount_cents integer not null,
  charity text not null,
  status text not null,          -- issued | paid
  stripe_invoice_id text,
  stripe_url text,
  created_at text not null
);
`;

export function openDb(dataDir) {
  let path = ":memory:";
  if (dataDir !== ":memory:") {
    mkdirSync(dataDir, { recursive: true });
    path = join(dataDir, "tributary.db");
  }
  const db = new DatabaseSync(path);
  db.exec("pragma foreign_keys = on;");
  db.exec(SCHEMA);
  return db;
}

export function now() {
  return new Date().toISOString();
}
