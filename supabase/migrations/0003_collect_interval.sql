-- Per-biome collect timer, controlled by the admin (seconds..minutes).
-- Apply via Supabase Dashboard -> SQL Editor AFTER 0002.
alter table public.biomes
  add column if not exists collect_interval_sec integer not null default 10
  check (collect_interval_sec between 1 and 3600);
