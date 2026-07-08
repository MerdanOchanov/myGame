-- Scientists World — initial schema.
-- Apply via Supabase Dashboard -> SQL Editor (paste whole file, Run).
--
-- Security model: clients hold only the anon key and are READ-ONLY here.
-- Every state-changing operation goes through the `game-api` Edge Function,
-- which uses the service role (bypasses RLS) and enforces game rules
-- server-side (ARCHITECTURE §2: client is never source of truth).

create extension if not exists postgis;

-- ---------------------------------------------------------------- players
create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- last accepted geo fix, for speed-based anti-cheat checks
  last_lat double precision,
  last_lng double precision,
  last_captured_at timestamptz,
  last_collect_at timestamptz,
  last_free_rat_at timestamptz
);

create table public.player_states (
  player_id uuid primary key references public.players (id) on delete cascade,
  states jsonb not null,
  active_effects jsonb not null default '[]'::jsonb
);

create table public.survival_runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  alive boolean not null default true
);
create index survival_runs_player_idx on public.survival_runs (player_id);
-- at most one alive run per player
create unique index survival_runs_one_alive_idx on public.survival_runs (player_id) where alive;

-- ------------------------------------------------------------------ homes
create table public.homes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players (id) on delete cascade,
  hex_cell_id text not null unique,
  lat double precision not null,
  lng double precision not null,
  location geography (point, 4326) generated always as
    (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  claimed_at timestamptz not null default now(),
  level int not null default 1,
  debug boolean not null default false
);
create index homes_location_idx on public.homes using gist (location);

-- homes within a radius (meters) of a point — used for the nearby-homes map
create or replace function public.nearby_homes(p_lat double precision, p_lng double precision, p_radius_m double precision)
returns setof public.homes
language sql stable as $$
  select * from public.homes
  where st_dwithin(location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_m)
$$;

-- ----------------------------------------------------------------- biomes
create table public.biomes (
  id text primary key,
  type text not null,
  hex_cell_ids text[] not null,
  generated_at timestamptz not null default now(),
  seed text not null
);

create table public.biome_cells (
  hex_cell_id text primary key,
  biome_id text not null references public.biomes (id) on delete cascade
);

-- -------------------------------------------------------------- materials
-- One material per hex cell, generated once and fixed forever (TZ §7);
-- the unique constraint on origin_hex_cell_id is the fixation guarantee.
create table public.materials (
  id text primary key,
  origin_hex_cell_id text not null unique,
  name text not null,
  category text not null check (category in ('plant', 'fruit', 'berry', 'insect')),
  biome_type text not null,
  generation_seed text not null,
  primary_traits jsonb not null,
  secondary_traits jsonb not null,
  discovered_at timestamptz not null default now(),
  discovered_by uuid references public.players (id)
);

-- per-player revealed material traits (KnowledgeProfile aggregate)
create table public.knowledge_profiles (
  player_id uuid not null references public.players (id) on delete cascade,
  material_id text not null references public.materials (id) on delete cascade,
  effect_key text not null,
  primary key (player_id, material_id, effect_key)
);

-- -------------------------------------------------------------- medicines
create table public.medicines (
  id text primary key,
  name text not null,
  creator_player_id uuid not null references public.players (id),
  input_material_ids text[] not null,
  generation_seed text not null,
  known_effects jsonb not null default '[]'::jsonb,
  hidden_effects jsonb not null,
  success_chance double precision not null,
  stability_percent int not null,
  created_at timestamptz not null default now(),
  debug boolean not null default false
);

-- ------------------------------------------------------------------- lab
create table public.rats (
  id text primary key,
  owner_player_id uuid not null references public.players (id) on delete cascade,
  state jsonb not null,
  active_effects jsonb not null default '[]'::jsonb,
  alive boolean not null default true,
  created_at timestamptz not null default now()
);
create index rats_owner_idx on public.rats (owner_player_id);

create table public.experiments (
  id text primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  medicine_id text not null references public.medicines (id),
  rat_id text not null references public.rats (id),
  revealed_effect_key text,
  rat_survived boolean not null,
  tested_at timestamptz not null default now(),
  debug boolean not null default false
);

-- -------------------------------------------------------------- inventory
create table public.inventories (
  player_id uuid not null references public.players (id) on delete cascade,
  item_id text not null,
  item_type text not null check (item_type in ('material', 'medicine')),
  quantity int not null default 0 check (quantity >= 0),
  primary key (player_id, item_id)
);

-- -------------------------------------------------------------------- RLS
-- Clients (anon key + anonymous auth session) may only read. There are NO
-- insert/update/delete policies on purpose: the service role used by the
-- Edge Function bypasses RLS.
alter table public.players enable row level security;
alter table public.player_states enable row level security;
alter table public.survival_runs enable row level security;
alter table public.homes enable row level security;
alter table public.biomes enable row level security;
alter table public.biome_cells enable row level security;
alter table public.materials enable row level security;
alter table public.knowledge_profiles enable row level security;
alter table public.medicines enable row level security;
alter table public.rats enable row level security;
alter table public.experiments enable row level security;
alter table public.inventories enable row level security;

-- personal data: owner-only reads
create policy "players: own row" on public.players
  for select using (auth.uid() = id);
create policy "player_states: own row" on public.player_states
  for select using (auth.uid() = player_id);
create policy "survival_runs: own rows" on public.survival_runs
  for select using (auth.uid() = player_id);
create policy "knowledge_profiles: own rows" on public.knowledge_profiles
  for select using (auth.uid() = player_id);
create policy "rats: own rows" on public.rats
  for select using (auth.uid() = owner_player_id);
create policy "experiments: own rows" on public.experiments
  for select using (auth.uid() = player_id);
create policy "inventories: own rows" on public.inventories
  for select using (auth.uid() = player_id);
create policy "medicines: creator reads" on public.medicines
  for select using (auth.uid() = creator_player_id);

-- world data: readable by any signed-in player
create policy "homes: world-readable" on public.homes
  for select to authenticated using (true);
create policy "biomes: world-readable" on public.biomes
  for select to authenticated using (true);
create policy "biome_cells: world-readable" on public.biome_cells
  for select to authenticated using (true);
create policy "materials: world-readable" on public.materials
  for select to authenticated using (true);
