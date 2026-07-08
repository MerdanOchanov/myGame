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
}
