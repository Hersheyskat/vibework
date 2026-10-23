-- VibeWork Try MVP tables + RLS (M0)
-- Apply with: npm run db:push  OR  psql "$DATABASE_URL" -f drizzle/0000_init.sql

create extension if not exists "pgcrypto";

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  input_text text not null,
  level text not null,
  status text not null default 'guarding',
  current_step text,
  screen_json jsonb,
  created_at timestamptz not null default now()
);
create index if not exists runs_user_id_idx on runs (user_id);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  attempt integer not null default 1,
  mode text not null,
  bundle_json jsonb not null,
  checks_json jsonb,
  audit_json jsonb,
  passed boolean not null default false,
  prompt_version text,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists plans_run_id_idx on plans (run_id);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  run_id uuid not null references runs (id) on delete cascade,
  plan_id uuid not null references plans (id) on delete restrict,
  state_json jsonb not null default '{}'::jsonb,
  status text not null default 'playing',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists games_user_id_idx on games (user_id);
create index if not exists games_run_id_idx on games (run_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  thread text not null,
  sender text not null,
  text text not null,
  image_paths jsonb default '[]'::jsonb,
  returned_data boolean,
  created_at timestamptz not null default now()
);
create index if not exists messages_game_id_idx on messages (game_id);

create table if not exists scores (
  game_id uuid primary key references games (id) on delete cascade,
  feedback_json jsonb not null,
  total integer not null,
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);

create table if not exists llm_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs (id) on delete set null,
  game_id uuid references games (id) on delete set null,
  purpose text not null,
  provider text,
  model text not null,
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  latency_ms integer,
  cost_usd double precision,
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists llm_calls_run_id_idx on llm_calls (run_id);
create index if not exists llm_calls_game_id_idx on llm_calls (game_id);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  props_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_name_idx on events (name);

create table if not exists ready_days (
  id uuid primary key default gen_random_uuid(),
  role_key text not null,
  level text not null,
  plan_id uuid references plans (id) on delete set null,
  variant integer not null default 1,
  served_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ready_days_role_level_idx on ready_days (role_key, level);

-- Row-level security: learners read/write only their own rows.
-- Service role (server) bypasses RLS for generation jobs.
alter table runs enable row level security;
alter table plans enable row level security;
alter table games enable row level security;
alter table messages enable row level security;
alter table scores enable row level security;
alter table llm_calls enable row level security;
alter table events enable row level security;
alter table ready_days enable row level security;

drop policy if exists runs_own on runs;
create policy runs_own on runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists plans_via_run on plans;
create policy plans_via_run on plans
  for select using (
    exists (select 1 from runs r where r.id = plans.run_id and r.user_id = auth.uid())
  );

drop policy if exists games_own on games;
create policy games_own on games
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists messages_via_game on messages;
create policy messages_via_game on messages
  for all using (
    exists (select 1 from games g where g.id = messages.game_id and g.user_id = auth.uid())
  ) with check (
    exists (select 1 from games g where g.id = messages.game_id and g.user_id = auth.uid())
  );

drop policy if exists scores_via_game on scores;
create policy scores_via_game on scores
  for select using (
    exists (select 1 from games g where g.id = scores.game_id and g.user_id = auth.uid())
  );

-- llm_calls: no client access (service role only)
drop policy if exists llm_calls_deny on llm_calls;
create policy llm_calls_deny on llm_calls for all using (false);

drop policy if exists events_own on events;
create policy events_own on events
  for insert with check (auth.uid() = user_id or user_id is null);

-- ready_days: readable by signed-in users; writes via service role
drop policy if exists ready_days_read on ready_days;
create policy ready_days_read on ready_days for select to authenticated using (true);
