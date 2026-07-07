import * as L from 'leaflet';
import { hexCellBoundary } from '../core/geo/HexGrid';
import { LaboratoryHome } from '../core/home/LaboratoryHome';

export interface MapViewCallbacks {
  onMapClick?: (lat: number, lng: number) => void;
}

// Leaflet owns all geography — base tiles, hex grid, biome outline, home and
// player markers are all native Leaflet vector layers, which get projection
// on pan/zoom for free (ARCHITECTURE §5 narrowing decision — see plan §4).
export class MapView {
  readonly map: L.Map;
  private readonly hexLayer: L.LayerGroup;
  private readonly homeLayer: L.LayerGroup;
  private playerMarker: L.CircleMarker | null = null;

  constructor(containerId: string, callbacks: MapViewCallbacks = {}) {
    this.map = L.map(containerId, { worldCopyJump: true }).setView([20, 0], 3);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this.hexLayer = L.layerGroup().addTo(this.map);
    this.homeLayer = L.layerGroup().addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      callbacks.onMapClick?.(e.latlng.lat, e.latlng.lng);
    });
  }

  centerOn(lat: number, lng: number, zoom = 18): void {
    this.map.setView([lat, lng], zoom);
  }

  showPlayerPosition(lat: number, lng: number): void {
    if (!this.playerMarker) {
      this.playerMarker = L.circleMarker([lat, lng], {
        radius: 8,
        color: '#00e5ff',
        fillColor: '#00e5ff',
        fillOpacity: 0.9,
      }).addTo(this.map);
    } else {
      this.playerMarker.setLatLng([lat, lng]);
    }
  }

  showHexCluster(hexCellIds: string[], currentHexCellId: string): void {
    this.hexLayer.clearLayers();
    for (const id of hexCellIds) {
      L.polygon(hexCellBoundary(id), {
        color: id === currentHexCellId ? '#ffd700' : '#4caf50',
        weight: 2,
        fillOpacity: id === currentHexCellId ? 0.25 : 0.1,
      }).addTo(this.hexLayer);
    }
  }

  showHomes(homes: LaboratoryHome[], ownPlayerId: string): void {
    this.homeLayer.clearLayers();
    for (const home of homes) {
      L.marker([home.position.lat, home.position.lng], {
        icon: L.divIcon({
          className: 'home-marker',
          html: home.playerId === ownPlayerId ? '🏠' : '🏚️',
          iconSize: [24, 24],
        }),
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
}
