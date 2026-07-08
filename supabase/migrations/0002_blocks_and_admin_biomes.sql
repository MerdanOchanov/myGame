-- Scientists World — world redesign: 7-cell blocks (H3 res 11) and
-- admin-generated biomes typed by dominant map color.
-- Apply via Supabase Dashboard -> SQL Editor AFTER 0001_init.sql.
--
-- DESTRUCTIVE for world data: homes, biomes, materials and everything
-- referencing them are wiped. Player accounts, states, runs and rats stay.

-- ------------------------------------------------- drop old world tables
drop function if exists public.nearby_homes(double precision, double precision, double precision);
drop table if exists public.knowledge_profiles;
drop table if exists public.experiments;
drop table if exists public.biome_cells;
drop table if exists public.biomes;
drop table if exists public.materials cascade;
drop table if exists public.homes;
truncate table public.inventories;
delete from public.medicines;

-- ------------------------------------------------------------------ homes
-- A home occupies one whole block: an H3 res-11 cell = exactly 7 res-12
-- game cells (aperture-7 "honeycomb").
create table public.homes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players (id) on delete cascade,
  block_id text not null unique,
  lat double precision not null,
  lng double precision not null,
  location geography (point, 4326) generated always as
    (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  claimed_at timestamptz not null default now(),
  level int not null default 1,
  debug boolean not null default false
);
create index homes_location_idx on public.homes using gist (location);

create or replace function public.nearby_homes(p_lat double precision, p_lng double precision, p_radius_m double precision)
returns setof public.homes
language sql stable as $$
  select * from public.homes
  where st_dwithin(location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_m)
$$;

-- ----------------------------------------------------------------- biomes
-- Created only by the admin tool on a selected map area; typed by the
-- dominant map color of that area. Size: 5..40 blocks.
create table public.biomes (
  id text primary key,
  type text not null check (type in ('water', 'desert', 'steppe', 'forest', 'urban_jungle', 'mountain')),
  block_ids text[] not null,
  dominant_color jsonb not null, -- {r,g,b} sampled by the admin client
  min_lat double precision not null,
  min_lng double precision not null,
  max_lat double precision not null,
  max_lng double precision not null,
  seed text not null,
  created_by uuid references public.players (id),
  created_at timestamptz not null default now(),
  debug boolean not null default false
);
create index biomes_bbox_idx on public.biomes (min_lat, max_lat, min_lng, max_lng);

-- a block belongs to at most one biome
create table public.biome_blocks (
  block_id text primary key,
  biome_id text not null references public.biomes (id) on delete cascade
);
create index biome_blocks_biome_idx on public.biome_blocks (biome_id);

-- -------------------------------------------------------------- materials
-- Each biome gets a fixed pool of 1..10 distinct materials generated with
-- the biome; collecting rolls a random material from the pool.
create table public.materials (
  id text primary key,
  biome_id text not null references public.biomes (id) on delete cascade,
  pool_index int not null,
  name text not null,
  category text not null check (category in ('plant', 'fruit', 'berry', 'insect')),
  biome_type text not null,
  generation_seed text not null,
  primary_traits jsonb not null,
  secondary_traits jsonb not null,
  created_at timestamptz not null default now(),
  unique (biome_id, pool_index)
);

-- per-player revealed material traits (KnowledgeProfile aggregate)
create table public.knowledge_profiles (
  player_id uuid not null references public.players (id) on delete cascade,
  material_id text not null references public.materials (id) on delete cascade,
  effect_key text not null,
  primary key (player_id, material_id, effect_key)
);

-- experiments reference medicines/rats which survived the wipe structure
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

-- -------------------------------------------------------------------- RLS
alter table public.homes enable row level security;
alter table public.biomes enable row level security;
alter table public.biome_blocks enable row level security;
alter table public.materials enable row level security;
alter table public.knowledge_profiles enable row level security;
alter table public.experiments enable row level security;

create policy "homes: world-readable" on public.homes
  for select to authenticated using (true);
create policy "biomes: world-readable" on public.biomes
  for select to authenticated using (true);
create policy "biome_blocks: world-readable" on public.biome_blocks
  for select to authenticated using (true);
create policy "materials: world-readable" on public.materials
  for select to authenticated using (true);
create policy "knowledge_profiles: own rows" on public.knowledge_profiles
  for select using (auth.uid() = player_id);
create policy "experiments: own rows" on public.experiments
  for select using (auth.uid() = player_id);
