let injected = false;

// Единая дизайн-система нового UI: тёмная игровая тема, крупные кнопки,
// mobile-first. Инжектится один раз.
export function ensureStylesInjected(): void {
  if (injected) return;
  injected = true;

  const style = document.createElement('style');
  style.textContent = `
    :root {
      --sw-bg: rgba(16, 20, 28, 0.94);
      --sw-bg-soft: rgba(24, 30, 42, 0.92);
      --sw-fg: #eef4ff;
      --sw-muted: rgba(238, 244, 255, 0.6);
      --sw-accent: #ffc94d;
      --sw-green: #6fd06f;
      --sw-red: #ff6b6b;
      --sw-blue: #58b7ff;
      --sw-radius: 14px;
      --sw-font: 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif;
    }
    .sw-ui * { box-sizing: border-box; }

    /* --- верхняя панель --- */
    .sw-topbar {
      position: absolute; top: 0; left: 0; right: 0;
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; pointer-events: none;
      font-family: var(--sw-font); color: var(--sw-fg);
    }
    .sw-topbar > * { pointer-events: auto; }
    .sw-title {
      font-weight: 700; font-size: 15px; letter-spacing: 0.02em;
      background: var(--sw-bg); padding: 8px 14px; border-radius: var(--sw-radius);
      box-shadow: 0 2px 10px rgba(0,0,0,0.35);
    }
    .sw-chip {
      display: inline-flex; align-items: center; gap: 5px;
      background: var(--sw-bg); border-radius: var(--sw-radius);
      padding: 8px 12px; font-size: 13px; font-weight: 600;
      box-shadow: 0 2px 10px rgba(0,0,0,0.35);
    }
    .sw-chip .sw-chip-val { font-variant-numeric: tabular-nums; }
    .sw-mode-badge {
      cursor: pointer; user-select: none; border: none; font-family: var(--sw-font);
      font-weight: 700; font-size: 12px; letter-spacing: 0.04em;
      padding: 9px 14px; border-radius: var(--sw-radius); color: #fff;
      box-shadow: 0 2px 10px rgba(0,0,0,0.35);
    }
    .sw-mode-debug { background: #a83232; }
    .sw-mode-gps { background: #2e7d32; }
    .sw-admin-btn {
      cursor: pointer; border: none; font-size: 16px; line-height: 1;
      padding: 9px 12px; border-radius: var(--sw-radius);
      background: var(--sw-bg); color: var(--sw-fg);
      box-shadow: 0 2px 10px rgba(0,0,0,0.35);
    }
    .sw-spacer { flex: 1; pointer-events: none !important; }

    /* --- нижняя панель действий --- */
    .sw-actionbar {
      position: absolute; bottom: 0; left: 0; right: 0;
      display: flex; justify-content: center; gap: 6px;
      padding: 10px 8px calc(10px + env(safe-area-inset-bottom));
      pointer-events: none; font-family: var(--sw-font);
    }
    .sw-action {
      pointer-events: auto; cursor: pointer; border: none;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      min-width: 64px; padding: 9px 10px; border-radius: var(--sw-radius);
      background: var(--sw-bg); color: var(--sw-fg);
      font-family: var(--sw-font); font-size: 11px; font-weight: 600;
      box-shadow: 0 2px 12px rgba(0,0,0,0.4);
      transition: transform 0.08s ease, background 0.15s ease;
    }
    .sw-action:active { transform: scale(0.94); }
    .sw-action.sw-active { background: #3a4a63; outline: 2px solid var(--sw-blue); }
    .sw-action .sw-action-icon { font-size: 22px; line-height: 1; }

    /* --- шторка --- */
    .sw-drawer {
      position: absolute; left: 50%; transform: translateX(-50%);
      bottom: 86px; width: min(440px, calc(100vw - 16px));
      max-height: min(52vh, 420px); overflow-y: auto;
      background: var(--sw-bg); color: var(--sw-fg);
      border-radius: var(--sw-radius); padding: 14px 16px;
      pointer-events: auto; font-family: var(--sw-font); font-size: 14px;
      box-shadow: 0 6px 28px rgba(0,0,0,0.5);
    }
    .sw-drawer h3 { margin: 0 0 10px; font-size: 15px; }
    .sw-drawer .sw-close {
      position: absolute; top: 8px; right: 10px; cursor: pointer; border: none;
      background: transparent; color: var(--sw-muted); font-size: 18px;
    }
    .sw-card {
      background: var(--sw-bg-soft); border-radius: 10px;
      padding: 10px 12px; margin: 8px 0;
    }
    .sw-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; flex-wrap: wrap; }
    .sw-muted { color: var(--sw-muted); font-size: 12.5px; }
    .sw-drawer button.sw-btn, .sw-drawer button.sw-btn-secondary {
      cursor: pointer; border: none; border-radius: 10px;
      font-family: var(--sw-font); font-size: 14px; font-weight: 600;
      padding: 10px 16px;
    }
    .sw-btn { background: var(--sw-accent); color: #201500; }
    .sw-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .sw-btn-secondary { background: #33415c; color: var(--sw-fg); }
    .sw-btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }
    .sw-drawer input[type=number], .sw-drawer input[type=password], .sw-drawer select {
      background: #202a3c; color: var(--sw-fg); border: 1px solid #3c4a63;
      border-radius: 8px; padding: 8px 10px; font-family: var(--sw-font); font-size: 14px;
    }
    .sw-drawer input[type=number] { width: 4.2em; }
    .sw-qty-btn {
      cursor: pointer; border: none; border-radius: 8px; width: 32px; height: 32px;
      background: #33415c; color: var(--sw-fg); font-size: 16px; font-weight: 700;
    }
    .sw-color-swatch {
      display: inline-block; width: 18px; height: 18px; border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.3); vertical-align: middle;
    }

    /* --- тосты --- */
    .sw-toasts {
      position: absolute; top: 64px; left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; gap: 8px; align-items: center;
      pointer-events: none; z-index: 30; font-family: var(--sw-font);
    }
    .sw-toast {
      background: var(--sw-bg); color: var(--sw-fg);
      border-left: 4px solid var(--sw-blue);
      border-radius: 10px; padding: 10px 16px; font-size: 13.5px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.45);
      animation: sw-toast-in 0.25s ease;
      max-width: min(420px, calc(100vw - 32px));
    }
    .sw-toast.sw-success { border-left-color: var(--sw-green); }
    .sw-toast.sw-error { border-left-color: var(--sw-red); }
    @keyframes sw-toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }

    .sw-home-marker { font-size: 20px; text-shadow: 0 1px 4px rgba(0,0,0,0.6); }
  `;
  document.head.appendChild(style);
}
