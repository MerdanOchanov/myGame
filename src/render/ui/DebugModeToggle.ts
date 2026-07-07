import { PositionMode } from '../../core/geo/GeoPosition';
import { ensurePanelStylesInjected } from './panelStyles';

export class DebugModeToggle {
  readonly element: HTMLDivElement;
  private statusEl: HTMLDivElement;

  constructor(mode: PositionMode, onToggle: (mode: PositionMode) => void) {
    ensurePanelStylesInjected();

    this.element = document.createElement('div');
    this.element.className = 'sw-panel';
    this.element.style.top = '12px';
    this.element.style.left = '12px';

    const title = document.createElement('h3');
    title.textContent = 'Position mode';
    this.element.appendChild(title);

    const button = document.createElement('button');
    button.className = 'sw-debug-badge';
    this.element.appendChild(button);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'sw-row sw-muted';
    this.element.appendChild(this.statusEl);

    let currentMode = mode;
    const render = () => {
      button.textContent = currentMode === 'debug' ? 'DEBUG — click map to set position' : 'PRODUCTION — using real GPS';
      button.classList.toggle('sw-debug-badge', currentMode === 'debug');
      this.statusEl.textContent =
        currentMode === 'debug'
          ? 'Debug actions are excluded from rating/economy.'
          : 'Using navigator.geolocation for real position.';
    };
    render();

    button.addEventListener('click', () => {
      currentMode = currentMode === 'debug' ? 'production' : 'debug';
      render();
      onToggle(currentMode);
    });
  }

  setStatus(text: string): void {
    this.statusEl.textContent = text;
  }
}
