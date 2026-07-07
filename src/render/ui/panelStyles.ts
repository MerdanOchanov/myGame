let injected = false;

// Shared minimal styling for all DOM UI panels — injected once.
export function ensurePanelStylesInjected(): void {
  if (injected) return;
  injected = true;

  const style = document.createElement('style');
  style.textContent = `
    .sw-panel {
      position: absolute;
      pointer-events: auto;
      background: rgba(10, 14, 20, 0.85);
      color: #e6f1ff;
      font-family: ui-monospace, Consolas, monospace;
      font-size: 13px;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px;
      padding: 10px 12px;
      max-width: 280px;
    }
    .sw-panel h3 { margin: 0 0 6px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8; }
    .sw-panel button {
      background: #1c2733; color: #e6f1ff; border: 1px solid rgba(255,255,255,0.2);
      border-radius: 4px; padding: 4px 8px; cursor: pointer; font-family: inherit; font-size: 12px;
      margin: 2px 4px 2px 0;
    }
    .sw-panel button:hover { background: #2a3a4a; }
    .sw-panel button:disabled { opacity: 0.4; cursor: not-allowed; }
    .sw-panel .sw-row { margin: 3px 0; }
    .sw-panel .sw-muted { opacity: 0.65; }
    .sw-debug-badge {
      background: #7a1f1f; border-color: #ff5555;
    }
    .sw-item-list { max-height: 140px; overflow-y: auto; }
  `;
  document.head.appendChild(style);
}
