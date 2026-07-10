import { ActiveEffect } from '../player/PlayerState';
import { haversineDistanceMeters } from '../geo/GeoDistance';
import { mulberry32, fnv1aHash } from '../shared/Random';

// Глобальные события-катастрофы: создаются админом, затем хаотично дрейфуют
// по миру. Позиция НЕ хранится — вычисляется детерминированно от seed+время,
// поэтому не нужен cron и все клиенты видят одно и то же (ARCHITECTURE §12).
// Форма — шестигранник; радиус 1..10000 км (диаметр до ~20000 км).
export interface GameEvent {
  id: string;
  basePosition: { lat: number; lng: number };
  radiusKm: number;
  seed: string;
  severity: number; // 1..3
  createdAt: string;
}

export const MIN_EVENT_RADIUS_KM = 1;
export const MAX_EVENT_RADIUS_KM = 10000; // диаметр ~20000 км (~пол-окружности)
export const MIN_EVENT_SEVERITY = 1;
export const MAX_EVENT_SEVERITY = 3;

// Каждый час — новая случайная путевая точка; между ними линейная
// интерполяция. Смещение от базы ограничено, чтобы событие блуждало вокруг.
const DRIFT_BUCKET_MS = 60 * 60 * 1000;
const MAX_DRIFT_DEG = 35; // предел отклонения от базовой точки

export function clampEventRadiusKm(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return MIN_EVENT_RADIUS_KM;
  return Math.max(MIN_EVENT_RADIUS_KM, Math.min(MAX_EVENT_RADIUS_KM, n));
}

export function clampEventSeverity(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return MIN_EVENT_SEVERITY;
  return Math.max(MIN_EVENT_SEVERITY, Math.min(MAX_EVENT_SEVERITY, n));
}

function waypointOffset(seed: string, bucket: number): { dLat: number; dLng: number } {
  const rand = mulberry32(fnv1aHash(`${seed}|${bucket}`));
  return {
    dLat: (rand() * 2 - 1) * MAX_DRIFT_DEG,
    dLng: (rand() * 2 - 1) * MAX_DRIFT_DEG,
  };
}

// Текущий центр события: интерполяция между путевыми точками двух соседних
// часовых бакетов. Широта клампится, долгота заворачивается в [-180,180].
export function eventCenterAt(event: GameEvent, now: Date = new Date()): { lat: number; lng: number } {
  const t = now.getTime();
  const bucket = Math.floor(t / DRIFT_BUCKET_MS);
  const frac = (t % DRIFT_BUCKET_MS) / DRIFT_BUCKET_MS;

  const a = waypointOffset(event.seed, bucket);
  const b = waypointOffset(event.seed, bucket + 1);
  const dLat = a.dLat + (b.dLat - a.dLat) * frac;
  const dLng = a.dLng + (b.dLng - a.dLng) * frac;

  let lat = event.basePosition.lat + dLat;
  let lng = event.basePosition.lng + dLng;
  lat = Math.max(-85, Math.min(85, lat));
  lng = ((((lng + 180) % 360) + 360) % 360) - 180;
  return { lat, lng };
}

// 6 вершин геодезического шестигранника вокруг центра (для Leaflet-полигона).
export function eventHexagon(center: { lat: number; lng: number }, radiusKm: number): [number, number][] {
  const earthKm = 6371;
  const angularDist = radiusKm / earthKm; // радианы
  const latRad = (center.lat * Math.PI) / 180;
  const vertices: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const bearing = (i * 60 * Math.PI) / 180;
    const lat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDist) +
        Math.cos(latRad) * Math.sin(angularDist) * Math.cos(bearing)
    );
    const lng =
      (center.lng * Math.PI) / 180 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDist) * Math.cos(latRad),
        Math.cos(angularDist) - Math.sin(latRad) * Math.sin(lat)
      );
    vertices.push([(lat * 180) / Math.PI, (((lng * 180) / Math.PI + 540) % 360) - 180]);
  }
  return vertices;
}

export type EventProximity = 'inside' | 'approaching' | 'far';

// Внутри: dist ≤ radius. Приближение (предупреждение): в пределах пол-радиуса
// от границы, т.е. radius < dist ≤ radius*1.5.
export function eventProximity(
  playerPos: { lat: number; lng: number },
  center: { lat: number; lng: number },
  radiusKm: number
): EventProximity {
  const distKm = haversineDistanceMeters(playerPos, center) / 1000;
  if (distKm <= radiusKm) return 'inside';
  if (distKm <= radiusKm * 1.5) return 'approaching';
  return 'far';
}

// Базовый набор эффектов события по severity. source='event'. Эффекты
// применяются постепенно (масштабируются по времени внутри зоны сервером),
// поэтому здесь — «сила в секунду»-подобные базовые значения.
export function eventEffects(severity: number): ActiveEffect[] {
  const s = clampEventSeverity(severity);
  return [
    { key: 'toxic', power: 2 * s, durationSec: 60, source: 'event' },
    { key: 'anti_infection', power: -1 * s, durationSec: 60, source: 'event' }, // ослабляет (растит infection)
  ];
}
