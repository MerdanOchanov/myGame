import * as L from 'leaflet';
import { hexCellBoundary, blockCells } from '../core/geo/HexGrid';
import { LaboratoryHome } from '../core/home/LaboratoryHome';
import { Biome, RGB, BIOME_COLORS, BIOME_LABELS_RU } from '../core/biome/Biome';
import { EventView } from '../backend/types';

export interface MapViewCallbacks {
  onMapClick?: (lat: number, lng: number) => void;
  onViewChanged?: () => void;
}

export interface RectBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

const VIEW_STORAGE_KEY = 'scientists-world:mapView';

interface SavedView {
  lat: number;
  lng: number;
  zoom: number;
}

function loadSavedView(): SavedView | null {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v.lat === 'number' && typeof v.lng === 'number' && typeof v.zoom === 'number') return v;
  } catch {
    // повреждённое значение — игнорируем
  }
  return null;
}

// Leaflet владеет всей географией: тайлы, биомы (заливка блоков цветом
// типа), дома-соты из 7 ячеек, маркер игрока, рамка админ-выделения.
export class MapView {
  readonly map: L.Map;
  private readonly biomeLayer: L.LayerGroup;
  private readonly blockLayer: L.LayerGroup;
  private readonly homeLayer: L.LayerGroup;
  private readonly eventLayer: L.LayerGroup;
  private playerMarker: L.CircleMarker | null = null;

  // admin rectangle selection state
  private selectionActive = false;
  private selectionFirstCorner: L.LatLng | null = null;
  private selectionRect: L.Rectangle | null = null;
  private onSelectionComplete: ((bounds: RectBounds) => void) | null = null;

  // admin single-point selection (центр события)
  private pointSelectActive = false;
  private onPointSelect: ((lat: number, lng: number) => void) | null = null;

  private readonly restoredView: boolean;

  constructor(containerId: string, callbacks: MapViewCallbacks = {}) {
    const saved = loadSavedView();
    this.restoredView = saved !== null;
    this.map = L.map(containerId, { worldCopyJump: true, zoomControl: false })
      .setView(saved ? [saved.lat, saved.lng] : [20, 0], saved ? saved.zoom : 3);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Запоминаем позицию/зум карты, чтобы восстановить их после перезагрузки.
    this.map.on('moveend zoomend', () => {
      const c = this.map.getCenter();
      try {
        localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ lat: c.lat, lng: c.lng, zoom: this.map.getZoom() }));
      } catch {
        // localStorage недоступен — не критично
      }
    });

    // crossOrigin нужен, чтобы канвас с тайлами не был "tainted" и админ мог
    // семплировать преобладающий цвет выделенного участка.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      crossOrigin: 'anonymous',
    }).addTo(this.map);

    this.biomeLayer = L.layerGroup().addTo(this.map);
    this.eventLayer = L.layerGroup().addTo(this.map);
    this.blockLayer = L.layerGroup().addTo(this.map);
    this.homeLayer = L.layerGroup().addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (this.pointSelectActive) {
        this.pointSelectActive = false;
        this.map.getContainer().style.cursor = '';
        const cb = this.onPointSelect;
        this.onPointSelect = null;
        cb?.(e.latlng.lat, e.latlng.lng);
        return;
      }
      if (this.selectionActive) {
        this.handleSelectionClick(e.latlng);
        return;
      }
      callbacks.onMapClick?.(e.latlng.lat, e.latlng.lng);
    });
    this.map.on('moveend zoomend', () => callbacks.onViewChanged?.());
  }

  centerOn(lat: number, lng: number, zoom = 17): void {
    this.map.setView([lat, lng], zoom);
  }

  /** true, если карта восстановлена из сохранённого вида (после перезагрузки). */
  hasSavedView(): boolean {
    return this.restoredView;
  }

  /** Подогнать карту под прямоугольник (например, только что созданные биомы). */
  fitBounds(rect: RectBounds): void {
    this.map.fitBounds(
      L.latLngBounds([rect.minLat, rect.minLng], [rect.maxLat, rect.maxLng]),
      { maxZoom: 17, padding: [40, 40] }
    );
  }

  getViewBounds(): RectBounds {
    const b = this.map.getBounds();
    return {
      minLat: b.getSouth(),
      minLng: b.getWest(),
      maxLat: b.getNorth(),
      maxLng: b.getEast(),
    };
  }

  showPlayerPosition(lat: number, lng: number): void {
    if (!this.playerMarker) {
      this.playerMarker = L.circleMarker([lat, lng], {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: '#00b0ff',
        fillOpacity: 0.95,
      }).addTo(this.map);
    } else {
      this.playerMarker.setLatLng([lat, lng]);
    }
  }

  /** Биомы: каждый блок — hex-полигон res 11, залитый цветом типа биома. */
  showBiomes(biomes: Biome[]): void {
    this.biomeLayer.clearLayers();
    for (const biome of biomes) {
      const color = BIOME_COLORS[biome.type] ?? '#888888';
      for (const blockId of biome.blockIds) {
        L.polygon(hexCellBoundary(blockId), {
          color,
          weight: 1,
          fillColor: color,
          fillOpacity: 0.35,
        })
          .bindTooltip(`${BIOME_LABELS_RU[biome.type] ?? biome.type}`, { sticky: true })
          .addTo(this.biomeLayer);
      }
    }
  }

  /** События: красные шестигранники (позиция уже сдвинута дрейфом). */
  showEvents(events: EventView[]): void {
    this.eventLayer.clearLayers();
    for (const { event, hexagon } of events) {
      L.polygon(hexagon, {
        color: '#e53935',
        weight: 2,
        fillColor: '#e53935',
        fillOpacity: 0.18,
        dashArray: '6 4',
      })
        .bindTooltip(`☢️ Событие (ур. ${event.severity}, R≈${Math.round(event.radiusKm)} км)`, { sticky: true })
        .addTo(this.eventLayer);
    }
  }

  /** Подсветка текущего блока игрока: контур блока + тонкая сетка его 7 ячеек. */
  showCurrentBlock(blockId: string | null): void {
    this.blockLayer.clearLayers();
    if (!blockId) return;

    L.polygon(hexCellBoundary(blockId), {
      color: '#00b0ff',
      weight: 2,
      fill: false,
      dashArray: '6 4',
    }).addTo(this.blockLayer);

    for (const cellId of blockCells(blockId)) {
      L.polygon(hexCellBoundary(cellId), {
        color: '#00b0ff',
        weight: 0.5,
        fill: false,
        opacity: 0.5,
      }).addTo(this.blockLayer);
    }
  }

  /** Дома: золотая сота из 7 ячеек (свой) / серая (чужие) + эмодзи-маркер. */
  showHomes(homes: LaboratoryHome[], ownPlayerId: string): void {
    this.homeLayer.clearLayers();
    for (const home of homes) {
      const own = home.playerId === ownPlayerId;
      const color = own ? '#ffc94d' : '#9aa7bd';
      for (const cellId of blockCells(home.blockId)) {
        L.polygon(hexCellBoundary(cellId), {
          color,
          weight: 1.5,
          fillColor: color,
          fillOpacity: own ? 0.35 : 0.2,
        }).addTo(this.homeLayer);
      }
      L.marker([home.position.lat, home.position.lng], {
        icon: L.divIcon({ className: 'sw-home-marker', html: own ? '🏠' : '🏚️', iconSize: [24, 24] }),
      }).addTo(this.homeLayer);
    }
  }

  containerPointFor(lat: number, lng: number): { x: number; y: number } {
    const point = this.map.latLngToContainerPoint([lat, lng]);
    return { x: point.x, y: point.y };
  }

  onMove(handler: () => void): void {
    this.map.on('move zoom moveend zoomend', handler);
  }

  // ------------------------------------------------ admin: выделение рамкой

  /** Один клик по карте → точка; колбэк получает координаты (центр события). */
  startPointSelection(onPick: (lat: number, lng: number) => void): void {
    this.cancelRectangleSelection();
    this.pointSelectActive = true;
    this.onPointSelect = onPick;
    this.map.getContainer().style.cursor = 'crosshair';
  }

  /** Два клика по карте → прямоугольник; колбэк получает его границы. */
  startRectangleSelection(onComplete: (bounds: RectBounds) => void): void {
    this.cancelRectangleSelection();
    this.selectionActive = true;
    this.onSelectionComplete = onComplete;
    this.map.getContainer().style.cursor = 'crosshair';
  }

  cancelRectangleSelection(): void {
    this.selectionActive = false;
    this.selectionFirstCorner = null;
    this.onSelectionComplete = null;
    this.map.getContainer().style.cursor = '';
  }

  clearSelectionRect(): void {
    this.selectionRect?.remove();
    this.selectionRect = null;
  }

  private handleSelectionClick(latlng: L.LatLng): void {
    if (!this.selectionFirstCorner) {
      this.selectionFirstCorner = latlng;
      this.clearSelectionRect();
      this.selectionRect = L.rectangle(L.latLngBounds(latlng, latlng), {
        color: '#ff9800',
        weight: 2,
        dashArray: '8 5',
        fillOpacity: 0.08,
      }).addTo(this.map);
      return;
    }

    const bounds = L.latLngBounds(this.selectionFirstCorner, latlng);
    this.selectionRect?.setBounds(bounds);
    const result: RectBounds = {
      minLat: bounds.getSouth(),
      minLng: bounds.getWest(),
      maxLat: bounds.getNorth(),
      maxLng: bounds.getEast(),
    };
    const complete = this.onSelectionComplete;
    this.cancelRectangleSelection();
    complete?.(result);
  }

  // ------------------------------------- admin: преобладающий цвет участка

  /**
   * Средний цвет OSM-тайлов внутри прямоугольника (в пределах видимой
   * области). null, если канвас "tainted" или участок вне экрана.
   */
  sampleDominantColor(rect: RectBounds): RGB | null {
    const container = this.map.getContainer();
    const size = this.map.getSize();
    const canvas = document.createElement('canvas');
    canvas.width = size.x;
    canvas.height = size.y;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const containerRect = container.getBoundingClientRect();
    const tileImgs = container.querySelectorAll<HTMLImageElement>('.leaflet-tile-pane img');
    for (const img of tileImgs) {
      const r = img.getBoundingClientRect();
      try {
        ctx.drawImage(img, r.left - containerRect.left, r.top - containerRect.top, r.width, r.height);
      } catch {
        // отдельный битый тайл пропускаем
      }
    }

    const nw = this.map.latLngToContainerPoint([rect.maxLat, rect.minLng]);
    const se = this.map.latLngToContainerPoint([rect.minLat, rect.maxLng]);
    const x = Math.max(0, Math.min(nw.x, se.x));
    const y = Math.max(0, Math.min(nw.y, se.y));
    const w = Math.min(size.x, Math.max(nw.x, se.x)) - x;
    const h = Math.min(size.y, Math.max(nw.y, se.y)) - y;
    if (w < 2 || h < 2) return null;

    let data: ImageData;
    try {
      data = ctx.getImageData(x, y, w, h);
    } catch {
      return null; // canvas tainted (CORS)
    }

    let r = 0, g = 0, b = 0, n = 0;
    const totalPixels = w * h;
    const step = Math.max(1, Math.floor(totalPixels / 20000));
    for (let i = 0; i < data.data.length; i += 4 * step) {
      if (data.data[i + 3] === 0) continue; // прозрачные (недогруженные тайлы)
      r += data.data[i];
      g += data.data[i + 1];
      b += data.data[i + 2];
      n++;
    }
    if (n === 0) return null;
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  }
}
