-- Scientists World — lab depth (rat names/timeout), first-discovery medicine
-- naming needs no schema, and global drifting events.
-- Apply via Supabase Dashboard -> SQL Editor AFTER 0003. Non-destructive.

-- ------------------------------------------------------------------ rats
alter table public.rats add column if not exists name text;

-- ---------------------------------------------------------------- players
alter table public.players add column if not exists last_rat_test_at timestamptz;
alter table public.players add column if not exists last_event_tick_at timestamptz;

-- --------------------------------------------------------- global settings
-- Admin-tunable global values (e.g. rat-test interval). One row per key.
create table if not exists public.game_settings (
  key text primary key,
  value jsonb not null
);
alter table public.game_settings enable row level security;
create policy "game_settings: world-readable" on public.game_settings
  for select to authenticated using (true);

-- ----------------------------------------------------------------- events
-- Admin-created global events. Position is NOT stored — it is computed
-- deterministically from seed + current time (chaotic drift), so no cron is
-- needed and every client agrees. Hexagonal, radius 1..10000 km.
create table if not exists public.events (
  id text primary key,
  base_lat double precision not null,
  base_lng double precision not null,
  radius_km double precision not null check (radius_km between 1 and 10000),
  seed text not null,
  severity int not null default 1 check (severity between 1 and 3),
  created_by uuid references public.players (id),
  created_at timestamptz not null default now(),
  debug boolean not null default false
);
alter table public.events enable row level security;
create policy "events: world-readable" on public.events
  for select to authenticated using (true);
