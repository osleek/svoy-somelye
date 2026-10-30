import { Pool } from 'pg';

const url = process.env.DATABASE_URL;

let pool: Pool | null = null;

export function hasDb(): boolean {
  return Boolean(url);
}

export function db(): Pool {
  if (!url) throw new Error('DATABASE_URL не задан');
  if (!pool) {
    const isLocal = /(localhost|127\.0\.0\.1)/.test(url);
    pool = new Pool({
      connectionString: url,
      max: 1,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

const SCHEMA = `
create table if not exists users (
  id uuid primary key,
  email text unique not null,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists favorites (
  user_id uuid not null references users(id) on delete cascade,
  slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, slug)
);

create table if not exists history (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  slug text not null,
  query text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key,
  user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id bigserial primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  slugs text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists feedback (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  slug text not null,
  value int not null check (value in (1,-1)),
  query text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists taste_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  acidity numeric not null default 3,
  tannin numeric not null default 3,
  body numeric not null default 3,
  sweetness numeric not null default 2,
  aroma numeric not null default 3,
  updated_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on messages (conversation_id, id);
create index if not exists feedback_user_idx on feedback (user_id, created_at desc);
create index if not exists history_user_idx on history (user_id, created_at desc);
`;

export async function initDb(): Promise<void> {
  if (!hasDb()) return;
  await db().query(SCHEMA);
}
