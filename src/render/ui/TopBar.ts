import { PositionMode } from '../../core/geo/GeoPosition';
import { PlayerState } from '../../core/player/PlayerState';
import { ensureStylesInjected } from './styles';

export interface TopBarCallbacks {
  onToggleMode: () => void;
  onAdminClick: () => void;
}

// Верхняя панель: название, чипы состояния игрока, бейдж режима позиции,
// кнопка админ-инструмента.
export class TopBar {
  readonly element: HTMLDivElement;
  private readonly healthChip: HTMLSpanElement;
  private readonly poisonChip: HTMLSpanElement;
  private readonly modeBadge: HTMLButtonElement;

  constructor(initialMode: PositionMode, callbacks: TopBarCallbacks) {
    ensureStylesInjected();

    this.element = document.createElement('div');
    this.element.className = 'sw-topbar sw-ui';

    const title = document.createElement('div');
    title.className = 'sw-title';
    title.textContent = '🧪 Scientists World';
    this.element.appendChild(title);

    this.healthChip = this.makeChip('❤️');
    this.poisonChip = this.makeChip('☠️');

    const spacer = document.createElement('div');
    spacer.className = 'sw-spacer';
    this.element.appendChild(spacer);

    this.modeBadge = document.createElement('button');
    this.modeBadge.addEventListener('click', callbacks.onToggleMode);
    this.element.appendChild(this.modeBadge);
    this.setMode(initialMode);

    const adminBtn = document.createElement('button');
    adminBtn.className = 'sw-admin-btn';
    adminBtn.textContent = '🛠️';
    adminBtn.title = 'Инструменты админа';
    adminBtn.addEventListener('click', callbacks.onAdminClick);
    this.element.appendChild(adminBtn);
  }

  private makeChip(icon: string): HTMLSpanElement {
    const chip = document.createElement('span');
    chip.className = 'sw-chip';
    const value = document.createElement('span');
    value.className = 'sw-chip-val';
    value.textContent = '—';
    chip.append(icon, value);
    this.element.appendChild(chip);
    return chip.querySelector('.sw-chip-val')!;
  }

  setMode(mode: PositionMode): void {
    this.modeBadge.className = `sw-mode-badge ${mode === 'debug' ? 'sw-mode-debug' : 'sw-mode-gps'}`;
    this.modeBadge.textContent = mode === 'debug' ? '🐞 ДЕБАГ' : '📡 GPS';
    this.modeBadge.title = mode === 'debug'
      ? 'Режим отладки: позиция задаётся кликом по карте. Нажмите для переключения на GPS.'
      : 'Режим GPS: позиция берётся из браузера. Нажмите для переключения на дебаг.';
  }

  updateState(state: PlayerState): void {
    const value = (key: string) => state.states.find((s) => s.key === key)?.value;
    this.healthChip.textContent = String(Math.round(value('health') ?? 0));
    this.poisonChip.textContent = String(Math.round(value('poison') ?? 0));
  }
}
