import {
  RGB, Biome, colorToBiomeType, BIOME_LABELS_RU, MIN_BIOME_BLOCKS, MAX_BIOME_BLOCKS,
  DEFAULT_COLLECT_INTERVAL_SEC, MIN_COLLECT_INTERVAL_SEC, MAX_COLLECT_INTERVAL_SEC, clampCollectInterval,
} from '../../core/biome/Biome';
import { ensureStylesInjected } from './styles';

const PASSWORD_STORAGE_KEY = 'scientists-world:adminPassword';

export interface AdminSelection {
  blockIds: string[];
  dominantColor: RGB | null;
}

export interface AdminToolCallbacks {
  onStartSelection: () => void;
  onCancelSelection: () => void;
  onCreateBiome: (password: string, collectIntervalSec: number) => void;
  onSetCollectInterval: (password: string, biomeId: string, collectIntervalSec: number) => void;
}

// Панель админа: пароль, выделение участка двумя кликами, предпросмотр
// (блоки, доминирующий цвет, будущий тип биома), создание биома.
export class AdminTool {
  readonly element: HTMLDivElement;
  private readonly passwordInput: HTMLInputElement;
  private readonly selectBtn: HTMLButtonElement;
  private readonly createBtn: HTMLButtonElement;
  private readonly previewEl: HTMLDivElement;
  private readonly intervalInput: HTMLInputElement;
  private readonly currentBiomeEl: HTMLDivElement;
  private readonly currentIntervalInput: HTMLInputElement;
  private readonly setIntervalBtn: HTMLButtonElement;
  private selecting = false;
  private selection: AdminSelection | null = null;
  private currentBiome: Biome | null = null;

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

    const intervalRow = document.createElement('div');
    intervalRow.className = 'sw-row';
    intervalRow.append('Интервал сбора, сек: ');
    this.intervalInput = document.createElement('input');
    this.intervalInput.type = 'number';
    this.intervalInput.min = String(MIN_COLLECT_INTERVAL_SEC);
    this.intervalInput.max = String(MAX_COLLECT_INTERVAL_SEC);
    this.intervalInput.step = '1';
    this.intervalInput.value = String(DEFAULT_COLLECT_INTERVAL_SEC);
    this.intervalInput.style.width = '5em';
    intervalRow.appendChild(this.intervalInput);
    this.element.appendChild(intervalRow);

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
    this.createBtn.addEventListener('click', () =>
      this.callbacks.onCreateBiome(this.passwordInput.value, clampCollectInterval(this.intervalInput.value))
    );
    btnRow.appendChild(this.createBtn);

    this.element.appendChild(btnRow);

    this.previewEl = document.createElement('div');
    this.previewEl.className = 'sw-card sw-muted';
    this.previewEl.textContent =
      `Выделите прямоугольник двумя кликами по карте. Биом: от ${MIN_BIOME_BLOCKS} до ${MAX_BIOME_BLOCKS} блоков (по 7 ячеек). ` +
      'Тип определяется по преобладающему цвету карты: вода → водный, пески → пустыня, застройка → каменные джунгли.';
    this.element.appendChild(this.previewEl);

    // ---- управление текущим биомом (интервал сбора) ----
    this.currentBiomeEl = document.createElement('div');
    this.currentBiomeEl.className = 'sw-card sw-muted';
    this.currentBiomeEl.textContent = 'Встаньте в биом, чтобы управлять его интервалом сбора.';
    this.element.appendChild(this.currentBiomeEl);

    const setRow = document.createElement('div');
    setRow.className = 'sw-row';
    setRow.append('Новый интервал, сек: ');
    this.currentIntervalInput = document.createElement('input');
    this.currentIntervalInput.type = 'number';
    this.currentIntervalInput.min = String(MIN_COLLECT_INTERVAL_SEC);
    this.currentIntervalInput.max = String(MAX_COLLECT_INTERVAL_SEC);
    this.currentIntervalInput.step = '1';
    this.currentIntervalInput.style.width = '5em';
    setRow.appendChild(this.currentIntervalInput);

    this.setIntervalBtn = document.createElement('button');
    this.setIntervalBtn.className = 'sw-btn-secondary';
    this.setIntervalBtn.textContent = 'Обновить интервал';
    this.setIntervalBtn.disabled = true;
    this.setIntervalBtn.addEventListener('click', () => {
      if (!this.currentBiome) return;
      this.callbacks.onSetCollectInterval(
        this.passwordInput.value,
        this.currentBiome.id,
        clampCollectInterval(this.currentIntervalInput.value)
      );
    });
    setRow.appendChild(this.setIntervalBtn);
    this.element.appendChild(setRow);
  }

  /** Вызывается HudRoot при каждом обновлении карты. */
  setCurrentBiome(biome: Biome | null): void {
    this.currentBiome = biome;
    this.setIntervalBtn.disabled = !biome;
    if (biome) {
      this.currentBiomeEl.innerHTML =
        `Текущий биом: <b>${BIOME_LABELS_RU[biome.type]}</b> (${biome.blockIds.length} блоков) — ` +
        `интервал сбора <b>${biome.collectIntervalSec} с</b>`;
      if (!this.currentIntervalInput.value) {
        this.currentIntervalInput.value = String(biome.collectIntervalSec);
      }
    } else {
      this.currentBiomeEl.textContent = 'Встаньте в биом, чтобы управлять его интервалом сбора.';
      this.currentIntervalInput.value = '';
    }
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
