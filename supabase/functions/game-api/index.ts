// game-api — single Edge Function implementing the ARCHITECTURE §15 API
// boundary. All game rules run here (client is never source of truth);
// the client calls it via supabase.functions.invoke('game-api', { body }).
//
// Request body: { action: string, payload?: object }
// Response body: { ok: true, data } | { ok: false, error: string }
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  GeoProof, ActiveEffect,
  resolveHexCellId, hexCellCenter, validateProductionProof,
  generateBiome, generateMaterial, craftMedicineRecipe,
  createInitialStates, applyEffectToStates, isRatDead,
  MIN_CRAFT_MATERIALS, HOME_TRANSFER_COOLDOWN_MS, FREE_RAT_DRIP_INTERVAL_MS,
  COLLECT_COOLDOWN_MS, NEARBY_HOME_RADIUS_METERS,
} from '../_shared/gameRules.ts';

type Mode = 'production' | 'debug';

interface ProofWithMode {
  proof: GeoProof;
  mode: Mode;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function ok(data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function fail(error: string, status = 200): Response {
  // Game-rule rejections ride ok:false with HTTP 200 so functions.invoke
  // doesn't treat them as transport failures.
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function authedPlayerId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data } = await userClient.auth.getUser();
  return data.user?.id ?? null;
}

// ------------------------------------------------------------ geo helpers

type GeoError = 'accuracy' | 'stale_timestamp' | 'implausible_speed';

async function resolveHexFor(
  db: SupabaseClient,
  playerId: string,
  pm: ProofWithMode
): Promise<{ hexCellId: string; center: { lat: number; lng: number } } | GeoError> {
  if (pm.mode === 'production') {
    const { data: player } = await db.from('players')
      .select('last_lat, last_lng, last_captured_at').eq('id', playerId).single();
    const previous = player?.last_lat != null
      ? { lat: player.last_lat, lng: player.last_lng, capturedAt: player.last_captured_at }
      : null;
    const rejection = validateProductionProof(pm.proof, previous, new Date());
    if (rejection) return rejection;
  }

  await db.from('players').update({
    last_lat: pm.proof.lat,
    last_lng: pm.proof.lng,
    last_captured_at: pm.proof.capturedAt,
  }).eq('id', playerId);

  const hexCellId = resolveHexCellId(pm.proof.lat, pm.proof.lng);
  return { hexCellId, center: hexCellCenter(hexCellId) };
}

async function getOrGenerateBiome(db: SupabaseClient, hexCellId: string) {
  const { data: cell } = await db.from('biome_cells').select('biome_id').eq('hex_cell_id', hexCellId).maybeSingle();
  if (cell) {
    const { data: biome } = await db.from('biomes').select('*').eq('id', cell.biome_id).single();
    return biome!;
  }

  const generated = generateBiome(hexCellId);
  // Concurrent generation of the same biome is resolved by ignoring
  // conflicts and re-reading — first write wins, matching "fixed forever".
  await db.from('biomes').upsert(
    { id: generated.id, type: generated.type, hex_cell_ids: generated.hexCellIds, seed: generated.seed },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  await db.from('biome_cells').upsert(
    generated.hexCellIds.map((id) => ({ hex_cell_id: id, biome_id: generated.id })),
    { onConflict: 'hex_cell_id', ignoreDuplicates: true }
  );

  const { data: biome } = await db.from('biomes').select('*').eq('id', generated.id).single();
  return biome!;
}

function biomeToDto(biome: { id: string; type: string; hex_cell_ids: string[]; generated_at: string; seed: string }) {
  return {
    id: biome.id,
    type: biome.type,
    hexCellIds: biome.hex_cell_ids,
    generatedAt: biome.generated_at,
    seed: biome.seed,
  };
}

function homeToDto(home: {
  id: string; player_id: string; hex_cell_id: string; lat: number; lng: number;
  claimed_at: string; level: number;
}) {
  return {
    id: home.id,
    playerId: home.player_id,
    hexCellId: home.hex_cell_id,
    position: { lat: home.lat, lng: home.lng },
    claimedAt: home.claimed_at,
    diameterMeters: 50 as const,
    level: home.level,
  };
}

function medicineToDto(m: {
  id: string; name: string; creator_player_id: string; input_material_ids: string[];
  generation_seed: string; known_effects: ActiveEffect[]; hidden_effects: ActiveEffect[];
  success_chance: number; stability_percent: number; created_at: string;
}) {
  return {
    id: m.id,
    name: m.name,
    creatorPlayerId: m.creator_player_id,
    inputMaterialIds: m.input_material_ids,
    generationSeed: m.generation_seed,
    knownEffects: m.known_effects,
    hiddenEffects: m.hidden_effects,
    successChance: m.success_chance,
    stabilityPercent: m.stability_percent,
    createdAt: m.created_at,
  };
}

function ratToDto(r: {
  id: string; owner_player_id: string; state: unknown; active_effects: unknown;
  alive: boolean; created_at: string;
}) {
  return {
    id: r.id,
    ownerPlayerId: r.owner_player_id,
    state: r.state,
    activeEffects: r.active_effects,
    alive: r.alive,
    createdAt: r.created_at,
  };
}

function materialToDto(m: {
  id: string; name: string; category: string; biome_type: string; origin_hex_cell_id: string;
  generation_seed: string; primary_traits: unknown; secondary_traits: unknown;
  discovered_at: string; discovered_by: string | null;
}, revealedKeys: Set<string>) {
  const withVisibility = (traits: { effectKey: string; percent: number }[]) =>
    traits.map((t) => ({ ...t, visibility: revealedKeys.has(t.effectKey) ? 'known' : 'hidden' }));
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    biomeType: m.biome_type,
    originHexCellId: m.origin_hex_cell_id,
    generationSeed: m.generation_seed,
    primaryTraits: withVisibility(m.primary_traits as { effectKey: string; percent: number }[]),
    secondaryTraits: withVisibility(m.secondary_traits as { effectKey: string; percent: number }[]),
    discoveredAt: m.discovered_at,
    discoveredByPlayerId: m.discovered_by ?? undefined,
  };
}

// ---------------------------------------------------------------- actions

async function handleSession(db: SupabaseClient, playerId: string) {
  await db.from('players').upsert({ id: playerId }, { onConflict: 'id', ignoreDuplicates: true });

  const { data: existingState } = await db.from('player_states').select('*').eq('player_id', playerId).maybeSingle();
  if (!existingState) {
    await db.from('player_states').upsert(
      { player_id: playerId, states: createInitialStates(), active_effects: [] },
      { onConflict: 'player_id', ignoreDuplicates: true }
    );
  }

  const { data: aliveRun } = await db.from('survival_runs')
    .select('*').eq('player_id', playerId).eq('alive', true).maybeSingle();
  if (!aliveRun) {
    await db.from('survival_runs').insert({ player_id: playerId });
  }

  const { count: ratCount } = await db.from('rats')
    .select('id', { count: 'exact', head: true }).eq('owner_player_id', playerId);
  if (!ratCount) {
    await db.from('rats').insert({
      id: `rat_${playerId}_${Date.now()}`,
      owner_player_id: playerId,
      state: createInitialStates(),
    });
    await db.from('players').update({ last_free_rat_at: new Date().toISOString() }).eq('id', playerId);
  }

  const [{ data: state }, { data: run }, { data: home }] = await Promise.all([
    db.from('player_states').select('*').eq('player_id', playerId).single(),
    db.from('survival_runs').select('*').eq('player_id', playerId).eq('alive', true).single(),
    db.from('homes').select('*').eq('player_id', playerId).maybeSingle(),
  ]);

  return {
    playerId,
    playerState: { playerId, states: state!.states, activeEffects: state!.active_effects },
    survivalRun: {
      playerId,
      startedAt: run!.started_at,
      endedAt: run!.ended_at ?? undefined,
      alive: run!.alive,
      survivedRealDays: Math.floor((Date.now() - new Date(run!.started_at).getTime()) / 86400000),
    },
    home: home ? homeToDto(home) : undefined,
  };
}

async function handleResolveHex(db: SupabaseClient, playerId: string, pm: ProofWithMode) {
  const resolved = await resolveHexFor(db, playerId, pm);
  if (typeof resolved === 'string') return resolved;

  const [{ data: home }, { data: cell }] = await Promise.all([
    db.from('homes').select('player_id').eq('hex_cell_id', resolved.hexCellId).maybeSingle(),
    db.from('biome_cells').select('biome_id').eq('hex_cell_id', resolved.hexCellId).maybeSingle(),
  ]);

  return {
    id: resolved.hexCellId,
    center: resolved.center,
    diameterMeters: 50 as const,
    ownerPlayerId: home?.player_id ?? undefined,
    biomeId: cell?.biome_id ?? undefined,
  };
}

async function handleMapLayers(db: SupabaseClient, playerId: string, pm: ProofWithMode) {
  const resolved = await resolveHexFor(db, playerId, pm);
  if (typeof resolved === 'string') return resolved;

  const biome = await getOrGenerateBiome(db, resolved.hexCellId);
  const { data: nearby } = await db.rpc('nearby_homes', {
    p_lat: resolved.center.lat,
    p_lng: resolved.center.lng,
    p_radius_m: NEARBY_HOME_RADIUS_METERS,
  });

  return {
    playerHexCell: {
      id: resolved.hexCellId,
      center: resolved.center,
      diameterMeters: 50 as const,
      biomeId: biome.id,
    },
    biome: biomeToDto(biome),
    nearbyHomes: (nearby ?? []).map(homeToDto),
  };
}

async function handleClaimHome(db: SupabaseClient, playerId: string, pm: ProofWithMode) {
  const resolved = await resolveHexFor(db, playerId, pm);
  if (typeof resolved === 'string') return resolved;

  const { data: inserted, error } = await db.from('homes').insert({
    player_id: playerId,
    hex_cell_id: resolved.hexCellId,
    lat: resolved.center.lat,
    lng: resolved.center.lng,
    debug: pm.mode === 'debug',
  }).select('*').single();

  if (error) {
    if (error.message.includes('homes_hex_cell_id_key')) return 'hex_occupied';
    if (error.message.includes('homes_player_id_key')) return 'player_already_has_home';
    return 'hex_occupied';
  }
  return homeToDto(inserted!);
}

async function handleTransferHome(db: SupabaseClient, playerId: string, pm: ProofWithMode) {
  const resolved = await resolveHexFor(db, playerId, pm);
  if (typeof resolved === 'string') return resolved;

  const { data: current } = await db.from('homes').select('*').eq('player_id', playerId).maybeSingle();
  if (!current) return 'no_existing_home';

  if (Date.now() - new Date(current.claimed_at).getTime() < HOME_TRANSFER_COOLDOWN_MS) return 'transfer_cooldown';

  const { data: updated, error } = await db.from('homes').update({
    hex_cell_id: resolved.hexCellId,
    lat: resolved.center.lat,
    lng: resolved.center.lng,
    claimed_at: new Date().toISOString(),
    debug: pm.mode === 'debug',
  }).eq('player_id', playerId).select('*').single();

  if (error) {
    if (error.message.includes('homes_hex_cell_id_key')) return 'hex_occupied';
    return 'hex_occupied';
  }
  return homeToDto(updated!);
}

async function handleCollectMaterial(db: SupabaseClient, playerId: string, pm: ProofWithMode) {
  if (pm.mode === 'production') {
    const { data: player } = await db.from('players').select('last_collect_at').eq('id', playerId).single();
    if (player?.last_collect_at && Date.now() - new Date(player.last_collect_at).getTime() < COLLECT_COOLDOWN_MS) {
      return 'rate_limited';
    }
  }

  const resolved = await resolveHexFor(db, playerId, pm);
  if (typeof resolved === 'string') return resolved;

  const biome = await getOrGenerateBiome(db, resolved.hexCellId);

  // Fixation: first insert wins forever; conflicts fall through to the read.
  const generated = generateMaterial(resolved.hexCellId, biome.type);
  await db.from('materials').upsert({
    id: generated.id,
    origin_hex_cell_id: generated.originHexCellId,
    name: generated.name,
    category: generated.category,
    biome_type: generated.biomeType,
    generation_seed: generated.generationSeed,
    primary_traits: generated.primaryTraits,
    secondary_traits: generated.secondaryTraits,
    discovered_by: playerId,
  }, { onConflict: 'origin_hex_cell_id', ignoreDuplicates: true });

  const { data: material } = await db.from('materials').select('*').eq('origin_hex_cell_id', resolved.hexCellId).single();

  await db.from('players').update({ last_collect_at: new Date().toISOString() }).eq('id', playerId);

  const { data: stack } = await db.from('inventories')
    .select('quantity').eq('player_id', playerId).eq('item_id', material!.id).maybeSingle();
  const quantity = (stack?.quantity ?? 0) + 1;
  await db.from('inventories').upsert(
    { player_id: playerId, item_id: material!.id, item_type: 'material', quantity },
    { onConflict: 'player_id,item_id' }
  );

  return {
    material: { id: material!.id, name: material!.name, category: material!.category },
    quantity,
  };
}

async function handleGetInventory(db: SupabaseClient, playerId: string) {
  const { data: stacks } = await db.from('inventories').select('*').eq('player_id', playerId).gt('quantity', 0);
  const materialIds = (stacks ?? []).filter((s) => s.item_type === 'material').map((s) => s.item_id);
  const medicineIds = (stacks ?? []).filter((s) => s.item_type === 'medicine').map((s) => s.item_id);

  const [{ data: materials }, { data: medicines }, { data: knowledge }] = await Promise.all([
    materialIds.length ? db.from('materials').select('*').in('id', materialIds) : Promise.resolve({ data: [] }),
    medicineIds.length ? db.from('medicines').select('*').in('id', medicineIds) : Promise.resolve({ data: [] }),
    materialIds.length
      ? db.from('knowledge_profiles').select('material_id, effect_key').eq('player_id', playerId).in('material_id', materialIds)
      : Promise.resolve({ data: [] }),
  ]);

  const revealedByMaterial = new Map<string, Set<string>>();
  for (const row of knowledge ?? []) {
    const set = revealedByMaterial.get(row.material_id) ?? new Set<string>();
    set.add(row.effect_key);
    revealedByMaterial.set(row.material_id, set);
  }

  const quantityOf = (itemId: string) => (stacks ?? []).find((s) => s.item_id === itemId)?.quantity ?? 0;

  return {
    playerId,
    materials: (materials ?? []).map((m) => ({
      material: materialToDto(m, revealedByMaterial.get(m.id) ?? new Set()),
      quantity: quantityOf(m.id),
    })),
    medicines: (medicines ?? []).map((m) => ({ medicine: medicineToDto(m), quantity: quantityOf(m.id) })),
  };
}

async function handleCraftMedicine(
  db: SupabaseClient,
  playerId: string,
  payload: { materialIds: string[]; proofWithMode: ProofWithMode }
) {
  const { materialIds, proofWithMode: pm } = payload;
  if (!Array.isArray(materialIds) || materialIds.length < MIN_CRAFT_MATERIALS) return 'insufficient_materials';

  const resolved = await resolveHexFor(db, playerId, pm);
  if (typeof resolved === 'string') return resolved;

  const { data: home } = await db.from('homes').select('*').eq('player_id', playerId).maybeSingle();
  if (!home) return 'no_home';
  if (home.hex_cell_id !== resolved.hexCellId) return 'not_in_own_home';

  const { data: materials } = await db.from('materials').select('*').in('id', materialIds);
  if (!materials || materials.length !== new Set(materialIds).size) return 'unknown_material';

  // check + decrement inventory
  const counts = new Map<string, number>();
  for (const id of materialIds) counts.set(id, (counts.get(id) ?? 0) + 1);

  const { data: stacks } = await db.from('inventories')
    .select('item_id, quantity').eq('player_id', playerId).in('item_id', [...counts.keys()]);
  for (const [itemId, needed] of counts) {
    const have = (stacks ?? []).find((s) => s.item_id === itemId)?.quantity ?? 0;
    if (have < needed) return 'insufficient_materials';
  }
  for (const [itemId, needed] of counts) {
    const have = (stacks ?? []).find((s) => s.item_id === itemId)!.quantity;
    await db.from('inventories').update({ quantity: have - needed })
      .eq('player_id', playerId).eq('item_id', itemId);
  }

  const recipe = craftMedicineRecipe(
    materials.map((m) => ({ id: m.id, primaryTraits: m.primary_traits, secondaryTraits: m.secondary_traits })),
    home.level
  );

  await db.from('medicines').upsert({
    id: recipe.id,
    name: recipe.name,
    creator_player_id: playerId,
    input_material_ids: recipe.inputMaterialIds,
    generation_seed: recipe.generationSeed,
    hidden_effects: recipe.hiddenEffects,
    success_chance: recipe.successChance,
    stability_percent: recipe.stabilityPercent,
    debug: pm.mode === 'debug',
  }, { onConflict: 'id', ignoreDuplicates: true });

  const { data: stack } = await db.from('inventories')
    .select('quantity').eq('player_id', playerId).eq('item_id', recipe.id).maybeSingle();
  await db.from('inventories').upsert(
    { player_id: playerId, item_id: recipe.id, item_type: 'medicine', quantity: (stack?.quantity ?? 0) + 1 },
    { onConflict: 'player_id,item_id' }
  );

  const { data: medicine } = await db.from('medicines').select('*').eq('id', recipe.id).single();
  return medicineToDto(medicine!);
}

async function handleGetRats(db: SupabaseClient, playerId: string) {
  const { data: player } = await db.from('players').select('last_free_rat_at').eq('id', playerId).single();
  const due = !player?.last_free_rat_at ||
    Date.now() - new Date(player.last_free_rat_at).getTime() >= FREE_RAT_DRIP_INTERVAL_MS;

  if (due) {
    await db.from('rats').insert({
      id: `rat_${playerId}_${Date.now()}`,
      owner_player_id: playerId,
      state: createInitialStates(),
    });
    await db.from('players').update({ last_free_rat_at: new Date().toISOString() }).eq('id', playerId);
  }

  const { data: rats } = await db.from('rats').select('*').eq('owner_player_id', playerId).order('created_at');
  return (rats ?? []).map(ratToDto);
}

async function handleTestRat(
  db: SupabaseClient,
  playerId: string,
  payload: { medicineId: string; ratId: string }
) {
  const { medicineId, ratId } = payload;

  const { data: stack } = await db.from('inventories')
    .select('quantity').eq('player_id', playerId).eq('item_id', medicineId).maybeSingle();
  if (!stack || stack.quantity < 1) return 'not_owned_medicine';

  const { data: medicine } = await db.from('medicines').select('*').eq('id', medicineId).single();
  if (!medicine) return 'not_owned_medicine';

  const { data: rat } = await db.from('rats').select('*').eq('id', ratId).maybeSingle();
  if (!rat || rat.owner_player_id !== playerId) return 'not_owned_rat';

  const hidden: ActiveEffect[] = medicine.hidden_effects ?? [];
  let revealedEffect: ActiveEffect | undefined;
  let ratAlive = rat.alive;
  let updatedRatState = rat.state;

  if (hidden.length > 0 && rat.alive) {
    const idx = Math.floor(Math.random() * hidden.length);
    revealedEffect = hidden[idx];
    const remaining = hidden.filter((_, i) => i !== idx);

    await db.from('medicines').update({
      hidden_effects: remaining,
      known_effects: [...(medicine.known_effects ?? []), revealedEffect],
    }).eq('id', medicineId);

    updatedRatState = applyEffectToStates(rat.state, revealedEffect);
    ratAlive = !isRatDead(updatedRatState);
    await db.from('rats').update({
      state: updatedRatState,
      active_effects: [...(rat.active_effects ?? []), revealedEffect],
      alive: ratAlive,
    }).eq('id', ratId);
  }

  await db.from('experiments').insert({
    id: `exp_${medicineId}_${Date.now()}`,
    player_id: playerId,
    medicine_id: medicineId,
    rat_id: ratId,
    revealed_effect_key: revealedEffect?.key ?? null,
    rat_survived: ratAlive,
  });

  const { data: updatedRat } = await db.from('rats').select('*').eq('id', ratId).single();
  return { revealedEffect, ratAlive, rat: ratToDto(updatedRat!) };
}

async function handleApplyMedicine(db: SupabaseClient, playerId: string, payload: { medicineId: string }) {
  const { medicineId } = payload;

  const { data: stack } = await db.from('inventories')
    .select('quantity').eq('player_id', playerId).eq('item_id', medicineId).maybeSingle();
  if (!stack || stack.quantity < 1) return 'not_owned';

  const { data: medicine } = await db.from('medicines').select('*').eq('id', medicineId).single();
  if (!medicine) return 'not_owned';

  const allEffects: ActiveEffect[] = [...(medicine.known_effects ?? []), ...(medicine.hidden_effects ?? [])];

  const { data: stateRow } = await db.from('player_states').select('*').eq('player_id', playerId).single();
  let states = stateRow!.states;
  for (const effect of allEffects) states = applyEffectToStates(states, effect);

  await db.from('player_states').update({
    states,
    active_effects: [...(stateRow!.active_effects ?? []), ...allEffects],
  }).eq('player_id', playerId);

  await db.from('inventories').update({ quantity: stack.quantity - 1 })
    .eq('player_id', playerId).eq('item_id', medicineId);

  return {
    appliedEffects: allEffects,
    playerState: { playerId, states, activeEffects: [...(stateRow!.active_effects ?? []), ...allEffects] },
  };
}

// ------------------------------------------------------------------ serve

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const playerId = await authedPlayerId(req);
  if (!playerId) return fail('unauthorized', 401);

  let body: { action?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 400);
  }

  const db = admin();
  const payload = body.payload ?? {};

  try {
    switch (body.action) {
      case 'session':
        return ok(await handleSession(db, playerId));
      case 'resolveHex': {
        const result = await handleResolveHex(db, playerId, payload as unknown as ProofWithMode);
        return typeof result === 'string' ? fail(result) : ok(result);
      }
      case 'mapLayers': {
        const result = await handleMapLayers(db, playerId, payload as unknown as ProofWithMode);
        return typeof result === 'string' ? fail(result) : ok(result);
      }
      case 'claimHome': {
        const result = await handleClaimHome(db, playerId, payload as unknown as ProofWithMode);
        return typeof result === 'string' ? fail(result) : ok(result);
      }
      case 'transferHome': {
        const result = await handleTransferHome(db, playerId, payload as unknown as ProofWithMode);
        return typeof result === 'string' ? fail(result) : ok(result);
      }
      case 'collectMaterial': {
        const result = await handleCollectMaterial(db, playerId, payload as unknown as ProofWithMode);
        return typeof result === 'string' ? fail(result) : ok(result);
      }
      case 'getInventory':
        return ok(await handleGetInventory(db, playerId));
      case 'craftMedicine': {
        const result = await handleCraftMedicine(
          db, playerId, payload as unknown as { materialIds: string[]; proofWithMode: ProofWithMode }
        );
        return typeof result === 'string' ? fail(result) : ok(result);
      }
      case 'getRats':
        return ok(await handleGetRats(db, playerId));
      case 'testRat': {
        const result = await handleTestRat(db, playerId, payload as unknown as { medicineId: string; ratId: string });
        return typeof result === 'string' ? fail(result) : ok(result);
      }
      case 'applyMedicine': {
        const result = await handleApplyMedicine(db, playerId, payload as unknown as { medicineId: string });
        return typeof result === 'string' ? fail(result) : ok(result);
      }
      default:
        return fail('unknown_action', 400);
    }
  } catch (err) {
    console.error('game-api error:', err);
    return fail('internal_error', 500);
  }
});
