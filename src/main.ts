import 'leaflet/dist/leaflet.css';
import { HudRoot } from './render/ui/HudRoot';

HudRoot.mount('ui-root', 'map', 'phaser-overlay').catch((err) => {
  console.error('Failed to bootstrap Scientists World:', err);
});
