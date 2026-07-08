import { ensureStylesInjected } from './styles';

// Шторка над нижней панелью — контейнер для одной активной панели.
export class Drawer {
  readonly element: HTMLDivElement;
  private readonly contentEl: HTMLDivElement;
  private currentKey: string | null = null;

  constructor(onClose: () => void) {
    ensureStylesInjected();

    this.element = document.createElement('div');
    this.element.className = 'sw-drawer sw-ui';
    this.element.style.display = 'none';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'sw-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', onClose);
    this.element.appendChild(closeBtn);

    this.contentEl = document.createElement('div');
    this.element.appendChild(this.contentEl);
  }

  get openKey(): string | null {
    return this.currentKey;
  }

  open(key: string, content: HTMLElement): void {
    this.currentKey = key;
    this.contentEl.replaceChildren(content);
    this.element.style.display = 'block';
  }

  close(): void {
    this.currentKey = null;
    this.element.style.display = 'none';
  }
}
