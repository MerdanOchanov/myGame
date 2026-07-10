import {
  RGB, Biome, BIOME_LABELS_RU, MIN_BIOME_CELLS, MAX_BIOME_CELLS, CELLS_PER_BLOCK, MIN_AREA_COVERAGE,
  DEFAULT_COLLECT_INTERVAL_SEC, MIN_COLLECT_INTERVAL_SEC, MAX_COLLECT_INTERVAL_SEC, clampCollectInterval,
} from '../../core/biome/Biome';
import { MIN_EVENT_RADIUS_KM, MAX_EVENT_RADIUS_KM } from '../../core/events/GameEvent';
import { AdminPlayerSummary, AdminMedicineSummary, AdminMaterialSummary } from '../../backend/types';
import { AdminError } from '../../backend/admin';
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
  onClearBiomes: (password: string) => void;
  onSetRatTestInterval: (password: string, intervalSec: number) => void;
  onStartEventPlacement: () => void;
  onCreateEvent: (password: string, radiusKm: number, severity: number) => void;
  onListPlayers: (password: string) => Promise<AdminPlayerSummary[] | AdminError>;
  onListMedicines: (password: string) => Promise<AdminMedicineSummary[] | AdminError>;
  onListMaterials: (password: string) => Promise<AdminMaterialSummary[] | AdminError>;
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

  private readonly eventRadiusInput: HTMLInputElement;
  private readonly eventSeverityInput: HTMLInputElement;
  private readonly eventCenterEl: HTMLDivElement;
  private readonly ratTestInput: HTMLInputElement;
  private readonly listEl: HTMLDivElement;
  private eventCenter: { lat: number; lng: number } | null = null;

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
      'Выделите прямоугольник двумя кликами по карте (размер не ограничен). ' +
      `В нём разбросается несколько биомов (${MIN_BIOME_CELLS}–${MAX_BIOME_CELLS} ячеек каждый), ` +
      `покрывая около ${Math.round(MIN_AREA_COVERAGE * 100)}% площади. Тип каждого биома — по ` +
      'преобладающему цвету карты в его месте: вода → водный, пески → пустыня, застройка → каменные джунгли.';
    this.element.appendChild(this.previewEl);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'sw-btn-secondary';
    clearBtn.textContent = '🗑️ Удалить все биомы';
    clearBtn.addEventListener('click', () => {
      if (confirm('Удалить ВСЕ биомы и их материалы? Это действие необратимо.')) {
        this.callbacks.onClearBiomes(this.passwordInput.value);
      }
    });
    this.element.appendChild(clearBtn);

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

    // ================= Испытания на крысах (таймаут) =================
    this.element.appendChild(sectionTitle('🐀 Таймаут испытаний на крысах'));
    const ratRow = document.createElement('div');
    ratRow.className = 'sw-row';
    ratRow.append('Пауза между тестами, сек: ');
    this.ratTestInput = document.createElement('input');
    this.ratTestInput.type = 'number';
    this.ratTestInput.min = '1';
    this.ratTestInput.max = '3600';
    this.ratTestInput.step = '1';
    this.ratTestInput.value = '30';
    this.ratTestInput.style.width = '5em';
    ratRow.appendChild(this.ratTestInput);
    const ratBtn = document.createElement('button');
    ratBtn.className = 'sw-btn-secondary';
    ratBtn.textContent = 'Применить';
    ratBtn.addEventListener('click', () =>
      this.callbacks.onSetRatTestInterval(this.passwordInput.value, Math.floor(Number(this.ratTestInput.value) || 30))
    );
    ratRow.appendChild(ratBtn);
    this.element.appendChild(ratRow);

    // ================= Глобальные события =================
    this.element.appendChild(sectionTitle('☢️ Глобальное событие'));
    const evBtnRow = document.createElement('div');
    evBtnRow.className = 'sw-row';
    const pickBtn = document.createElement('button');
    pickBtn.className = 'sw-btn-secondary';
    pickBtn.textContent = '📍 Центр (клик по карте)';
    pickBtn.addEventListener('click', () => this.callbacks.onStartEventPlacement());
    evBtnRow.appendChild(pickBtn);
    this.element.appendChild(evBtnRow);

    const evParamsRow = document.createElement('div');
    evParamsRow.className = 'sw-row';
    evParamsRow.append('R, км: ');
    this.eventRadiusInput = document.createElement('input');
    this.eventRadiusInput.type = 'number';
    this.eventRadiusInput.min = String(MIN_EVENT_RADIUS_KM);
    this.eventRadiusInput.max = String(MAX_EVENT_RADIUS_KM);
    this.eventRadiusInput.step = '1';
    this.eventRadiusInput.value = '500';
    this.eventRadiusInput.style.width = '6em';
    evParamsRow.appendChild(this.eventRadiusInput);
    evParamsRow.append(' Сила (1–3): ');
    this.eventSeverityInput = document.createElement('input');
    this.eventSeverityInput.type = 'number';
    this.eventSeverityInput.min = '1';
    this.eventSeverityInput.max = '3';
    this.eventSeverityInput.step = '1';
    this.eventSeverityInput.value = '1';
    this.eventSeverityInput.style.width = '4em';
    evParamsRow.appendChild(this.eventSeverityInput);
    this.element.appendChild(evParamsRow);

    this.eventCenterEl = document.createElement('div');
    this.eventCenterEl.className = 'sw-card sw-muted';
    this.eventCenterEl.textContent = 'Центр не выбран. Событие будет хаотично дрейфовать по миру.';
    this.element.appendChild(this.eventCenterEl);

    const createEvBtn = document.createElement('button');
    createEvBtn.className = 'sw-btn';
    createEvBtn.textContent = 'Создать событие';
    createEvBtn.addEventListener('click', () =>
      this.callbacks.onCreateEvent(
        this.passwordInput.value,
        Number(this.eventRadiusInput.value) || 500,
        Math.floor(Number(this.eventSeverityInput.value) || 1)
      )
    );
    this.element.appendChild(createEvBtn);

    // ================= Просмотр (списки) =================
    this.element.appendChild(sectionTitle('📋 Просмотр'));
    const listBtnRow = document.createElement('div');
    listBtnRow.className = 'sw-row';
    listBtnRow.appendChild(this.makeListButton('Игроки', () => this.callbacks.onListPlayers(this.passwordInput.value), renderPlayers));
    listBtnRow.appendChild(this.makeListButton('Лекарства', () => this.callbacks.onListMedicines(this.passwordInput.value), renderMedicines));
    listBtnRow.appendChild(this.makeListButton('Материалы', () => this.callbacks.onListMaterials(this.passwordInput.value), renderMaterials));
    this.element.appendChild(listBtnRow);

    this.listEl = document.createElement('div');
    this.listEl.className = 'sw-card sw-muted';
    this.listEl.textContent = 'Выберите список.';
    this.element.appendChild(this.listEl);
  }

  private makeListButton<T>(
    label: string,
    fetch: () => Promise<T[] | AdminError>,
    render: (rows: T[]) => string
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'sw-btn-secondary';
    btn.textContent = label;
    btn.addEventListener('click', async () => {
      this.listEl.textContent = 'Загрузка…';
      try {
        const rows = await fetch();
        if (typeof rows === 'string') {
          this.listEl.textContent = rows === 'admin_forbidden' ? 'Неверный админ-пароль.' : String(rows);
          return;
        }
        this.listEl.innerHTML = rows.length ? render(rows) : 'Пусто.';
      } catch (err) {
        this.listEl.textContent = `Ошибка: ${err instanceof Error ? err.message : String(err)}`;
      }
    });
    return btn;
  }

  setEventCenter(lat: number, lng: number): void {
    this.eventCenter = { lat, lng };
    this.eventCenterEl.textContent = `Центр: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  getEventCenter(): { lat: number; lng: number } | null {
    return this.eventCenter;
  }

  clearEventCenter(): void {
    this.eventCenter = null;
    this.eventCenterEl.textContent = 'Центр не выбран. Событие будет хаотично дрейфовать по миру.';
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

    const blocks = selection.blockIds.length;
    const cells = blocks * CELLS_PER_BLOCK;
    const okCount = blocks >= 1;
    const parts: string[] = [
      `В выделении: <b>${blocks}</b> блоков (${cells} ячеек)`,
      `Будет создано несколько биомов, покрывающих ≥${Math.round(MIN_AREA_COVERAGE * 100)}% участка.`,
    ];

    if (selection.dominantColor) {
      const { r, g, b } = selection.dominantColor;
      parts.push(`Средний цвет участка: <span class="sw-color-swatch" style="background: rgb(${r},${g},${b})"></span> rgb(${r},${g},${b}) (каждый биом типизируется отдельно)`);
    } else {
      parts.push('⚠️ Не удалось прочитать цвет карты — тип определит сервер по fallback-правилу.');
    }
    if (!okCount) parts.push('⚠️ Пустое выделение.');

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

function sectionTitle(text: string): HTMLElement {
  const el = document.createElement('h4');
  el.textContent = text;
  el.style.margin = '14px 0 6px';
  return el;
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}

function renderPlayers(rows: AdminPlayerSummary[]): string {
  return rows
    .map((p) => `<div>${p.alive ? '🟢' : '💀'} <b>${esc(p.playerId.slice(-8))}</b> — ${p.survivedDays} дн., ❤️${p.health}${p.hasHome ? ', 🏠' : ''}</div>`)
    .join('');
}

function renderMedicines(rows: AdminMedicineSummary[]): string {
  return rows
    .map((m) => `<div>💊 <b>${esc(m.name)}</b> <span class="sw-muted">(${m.knownEffects}/${m.knownEffects + m.hiddenEffects} эфф., автор ${esc(m.creatorPlayerId.slice(-6))})</span></div>`)
    .join('');
}

function renderMaterials(rows: AdminMaterialSummary[]): string {
  return rows
    .map((m) => `<div>🧪 <b>${esc(m.name)}</b> <span class="sw-muted">(${esc(m.category)}, ${esc(m.biomeType)})</span></div>`)
    .join('');
}
