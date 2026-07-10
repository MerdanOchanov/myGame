import { applyEffectToState } from '../core/player/PlayerState';
import {
  GameEvent, eventCenterAt, eventHexagon, eventEffects, eventProximity,
} from '../core/events/GameEvent';
import { db } from './db';
import { EventView, MapLayers, ViewBounds } from './types';

// Урон накапливается постепенно: сила эффекта × секунды в зоне / делитель,
// с потолком на тик — чтобы длинная пауза не убивала мгновенно.
const DAMAGE_DIVISOR = 10;
const MAX_TICK_SEC = 60;

function centerInView(center: { lat: number; lng: number }, vb: ViewBounds): boolean {
  return center.lat >= vb.minLat && center.lat <= vb.maxLat && center.lng >= vb.minLng && center.lng <= vb.maxLng;
}

// Вычисляет слои событий для игрока: список видимых событий (с текущей
// позицией), близость и постепенный урон, если игрок внутри события.
export function computeEventLayer(
  playerId: string,
  playerPos: { lat: number; lng: number },
  viewBounds: ViewBounds | undefined,
  now: Date
): Pick<MapLayers, 'events' | 'insideEventId' | 'approachingEventId' | 'playerState'> {
  const events: EventView[] = [];
  let insideEventId: string | undefined;
  let approachingEventId: string | undefined;

  for (const event of db.eventsById.values()) {
    const center = eventCenterAt(event, now);
    if (!viewBounds || centerInView(center, viewBounds) || withinDegrees(center, playerPos, event.radiusKm)) {
      events.push({ event, center, hexagon: eventHexagon(center, event.radiusKm) });
    }
    const proximity = eventProximity(playerPos, center, event.radiusKm);
    if (proximity === 'inside') insideEventId = event.id;
    else if (proximity === 'approaching' && !approachingEventId) approachingEventId = event.id;
  }

  let playerState: MapLayers['playerState'];
  if (insideEventId) {
    const event = db.eventsById.get(insideEventId)!;
    playerState = applyGradualDamage(playerId, event, now);
  } else {
    // не в зоне — сбрасываем точку отсчёта тика
    db.lastEventTickAtByPlayerId.delete(playerId);
  }

  return { events, insideEventId, approachingEventId, playerState };
}

function withinDegrees(a: { lat: number; lng: number }, b: { lat: number; lng: number }, radiusKm: number): boolean {
  const deg = radiusKm / 111 + 1;
  return Math.abs(a.lat - b.lat) <= deg && Math.abs(a.lng - b.lng) <= deg;
}

function applyGradualDamage(playerId: string, event: GameEvent, now: Date): MapLayers['playerState'] {
  const last = db.lastEventTickAtByPlayerId.get(playerId);
  db.lastEventTickAtByPlayerId.set(playerId, now.getTime());
  if (last === undefined) return undefined; // первый вход — запоминаем момент, урон со следующего тика

  const elapsedSec = Math.min(MAX_TICK_SEC, (now.getTime() - last) / 1000);
  if (elapsedSec <= 0) return undefined;

  const scale = elapsedSec / DAMAGE_DIVISOR;
  let ps = db.playerStates.get(playerId);
  if (!ps) return undefined;

  const baseline = ps;
  for (const effect of eventEffects(event.severity)) {
    ps = applyEffectToState(ps, { ...effect, power: effect.power * scale });
  }
  // не копим event-эффекты в activeEffects (тик каждые ~5с) — храним только состояния
  ps = { ...ps, activeEffects: baseline.activeEffects };
  db.playerStates.set(playerId, ps);
  return ps;
}
