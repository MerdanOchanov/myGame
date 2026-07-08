import { ensureStylesInjected } from './styles';

export type ActionId = 'home' | 'collect' | 'inventory' | 'craft' | 'lab';

interface ActionDef {
  id: ActionId;
  icon: string;
  label: string;
}

const ACTIONS: ActionDef[] = [
  { id: 'home', icon: '🏠', label: 'Дом' },
  { id: 'collect', icon: '🧺', label: 'Собрать' },
  { id: 'inventory', icon: '🎒', label: 'Инвентарь' },
  { id: 'craft', icon: '⚗️', label: 'Крафт' },
  { id: 'lab', icon: '🐀', label: 'Лаборатория' },
];

// Нижняя панель с крупными кнопками действий. «Собрать» — прямое действие,
// остальные открывают/закрывают шторку с соответствующей панелью.
export class ActionBar {
  readonly element: HTMLDivElement;
  private readonly buttons = new Map<ActionId, HTMLButtonElement>();

  constructor(onAction: (id: ActionId) => void) {
    ensureStylesInjected();

    this.element = document.createElement('div');
    this.element.className = 'sw-actionbar sw-ui';

    for (const action of ACTIONS) {
      const btn = document.createElement('button');
      btn.className = 'sw-action';
      btn.innerHTML = `<span class="sw-action-icon">${action.icon}</span><span>${action.label}</span>`;
      btn.addEventListener('click', () => onAction(action.id));
      this.buttons.set(action.id, btn);
      this.element.appendChild(btn);
    }
  }

  setActive(id: ActionId | null): void {
    for (const [actionId, btn] of this.buttons) {
      btn.classList.toggle('sw-active', actionId === id);
    }
  }

  /** Обратный отсчёт на кнопке «Собрать»; null — таймер не активен. */
  setCollectCooldown(remainingSec: number | null): void {
    const btn = this.buttons.get('collect');
    if (!btn) return;
    if (remainingSec === null || remainingSec <= 0) {
      btn.disabled = false;
      btn.innerHTML = `<span class="sw-action-icon">🧺</span><span>Собрать</span>`;
    } else {
      btn.disabled = true;
      btn.innerHTML = `<span class="sw-action-icon">⏳</span><span>${formatRemaining(remainingSec)}</span>`;
    }
  }
}

function formatRemaining(totalSec: number): string {
  const sec = Math.ceil(totalSec);
  if (sec < 60) return `${sec} с`;
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  return rest === 0 ? `${min} мин` : `${min}:${String(rest).padStart(2, '0')}`;
}
