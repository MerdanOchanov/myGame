import 'leaflet/dist/leaflet.css';
import { HudRoot } from './render/ui/HudRoot';

HudRoot.mount('ui-root', 'map', 'phaser-overlay').catch((err) => {
  console.error('Failed to bootstrap Scientists World:', err);
  const uiRoot = document.getElementById('ui-root');
  if (uiRoot) {
    const panel = document.createElement('div');
    panel.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:auto;' +
      'background:rgba(60,10,10,0.92);color:#ffdddd;font-family:ui-monospace,Consolas,monospace;' +
      'font-size:14px;border:1px solid #ff5555;border-radius:6px;padding:16px 20px;max-width:480px;';
    panel.textContent = `Bootstrap failed: ${err instanceof Error ? err.message : String(err)}`;
    uiRoot.appendChild(panel);
  }
});
