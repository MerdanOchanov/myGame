import { RGB, colorToBiomeType, BIOME_LABELS_RU, MIN_BIOME_BLOCKS, MAX_BIOME_BLOCKS } from '../../core/biome/Biome';
import { ensureStylesInjected } from './styles';

const PASSWORD_STORAGE_KEY = 'scientists-world:adminPassword';

export interface AdminSelection {
  blockIds: string[];
  dominantColor: RGB | null;
}

export interface AdminToolCallbacks {
  onStartSelection: () => void;
  onCancelSelection: () => void;
  onCreateBiome: (password: string) => void;
}

// Панель админа: пароль, выделение участка двумя кликами, предпросмотр
// (блоки, доминирующий цвет, будущий тип биома), создание биома.
export class AdminTool {
  readonly element: HTMLDivElement;
  private readonly passwordInput: HTMLInputElement;
  private readonly selectBtn: HTMLButtonElement;
  private readonly createBtn: HTMLButtonElement;
  private readonly previewEl: HTMLDivElement;
  private selecting = false;
  private selection: AdminSelection | null = null;

  constructor(private readonly callbacks: AdminToolCallbacks) {
    ensureStylesInjected();

    this.element = document.createElement('div');
    this.element.innerHTML = '<h3>🛠️ Генерация биома (админ)</h3>';

    const passRow = document.createElement('div');
    passRow.className = 'sw-row';
    passRow.append('Пароль: ');
    this.passwordInput = document.createElement('input');
    this.passwordInput.type = 'password';
    this.passwordInput.placeholder = 'админ-пароль';
    this.passwordInput.value = localStorage.getItem(PASSWORD_STORAGE_KEY) ?? '';
    this.passwordInput.addEventListener('change', () => {
      localStorage.setItem(PASSWORD_STORAGE_KEY, this.passwordInput.value);
    });
    passRow.appendChild(this.passwordInput);
    this.element.appendChild(passRow);

    const btnRow = document.createElement('div');
    btnRow.className = 'sw-row';

    this.selectBtn = document.createElement('button');
    this.selectBtn.className = 'sw-btn-secondary';
    this.selectBtn.textContent = '⬚ Выделить участок';
    this.selectBtn.addEventListener('click', () => {
      if (this.selecting) {
        this.setSelecting(false);
        this.callbacks.onCancelSelection();
      } else {
        this.setSelecting(true);
        this.callbacks.onStartSelection();
      }
    });
    btnRow.appendChild(this.selectBtn);

    this.createBtn = document.createElement('button');
    this.createBtn.className = 'sw-btn';
    this.createBtn.textContent = 'Создать биом';
    this.createBtn.disabled = true;
    this.createBtn.addEventListener('click', () => this.callbacks.onCreateBiome(this.passwordInput.value));
    btnRow.appendChild(this.createBtn);

    this.element.appendChild(btnRow);

    this.previewEl = document.createElement('div');
    this.previewEl.className = 'sw-card sw-muted';
    this.previewEl.textContent =
      `Выделите прямоугольник двумя кликами по карте. Биом: от ${MIN_BIOME_BLOCKS} до ${MAX_BIOME_BLOCKS} блоков (по 7 ячеек). ` +
      'Тип определяется по преобладающему цвету карты: вода → водный, пески → пустыня, застройка → каменные джунгли.';
    this.element.appendChild(this.previewEl);
  }

  setSelecting(selecting: boolean): void {
    this.selecting = selecting;
    this.selectBtn.textContent = selecting ? '✕ Отменить выделение' : '⬚ Выделить участок';
  }

  showSelection(selection: AdminSelection): void {
    this.selection = selection;
    this.setSelecting(false);

    const count = selection.blockIds.length;
    const okCount = count >= MIN_BIOME_BLOCKS && count <= MAX_BIOME_BLOCKS;
    const parts: string[] = [`Блоков в выделении: <b>${count}</b> (нужно ${MIN_BIOME_BLOCKS}–${MAX_BIOME_BLOCKS})`];

    if (selection.dominantColor) {
      const { r, g, b } = selection.dominantColor;
      const type = colorToBiomeType(selection.dominantColor);
      parts.push(`Преобладающий цвет: <span class="sw-color-swatch" style="background: rgb(${r},${g},${b})"></span> rgb(${r},${g},${b})`);
      parts.push(`Тип биома: <b>${BIOME_LABELS_RU[type]}</b>`);
    } else {
      parts.push('⚠️ Не удалось прочитать цвет карты — тип определит сервер по fallback-правилу.');
    }
    if (!okCount) {
      parts.push(count < MIN_BIOME_BLOCKS ? '⚠️ Слишком маленький участок.' : '⚠️ Слишком большой участок.');
    }

    this.previewEl.innerHTML = parts.join('<br>');
    this.createBtn.disabled = !okCount;
  }

  getSelection(): AdminSelection | null {
    return this.selection;
  }

  clearSelection(): void {
    this.selection = null;
    this.createBtn.disabled = true;
  }
}
