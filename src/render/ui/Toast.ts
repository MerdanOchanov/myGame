import { ensureStylesInjected } from './styles';

export type ToastKind = 'info' | 'success' | 'error';

// Всплывающие уведомления о результатах действий — вместо строк-сообщений
// внутри панелей.
export class ToastHost {
  readonly element: HTMLDivElement;

  constructor() {
    ensureStylesInjected();
    this.element = document.createElement('div');
    this.element.className = 'sw-toasts sw-ui';
  }

  show(text: string, kind: ToastKind = 'info', durationMs = 3500): void {
    const toast = document.createElement('div');
    toast.className = `sw-toast sw-${kind}`;
    toast.textContent = text;
    this.element.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, durationMs);
  }
}
