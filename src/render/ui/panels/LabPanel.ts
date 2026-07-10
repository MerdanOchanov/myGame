import { LabRat, MAX_RAT_NAME_LENGTH } from '../../../core/lab/LabRat';
import { InventoryView } from '../../../backend/types';
import { ensureStylesInjected } from '../styles';

// Панель «Лаборатория»: крысы с именами (редактируемыми), тест лекарства
// (раскрывает 1 свойство, иногда расходует лекарство, по таймауту), приём.
export class LabPanel {
  readonly element: HTMLDivElement;
  private readonly ratSelect: HTMLSelectElement;
  private readonly ratNameInput: HTMLInputElement;
  private readonly renameBtn: HTMLButtonElement;
  private readonly medicineListEl: HTMLDivElement;
  private readonly cooldownEl: HTMLDivElement;
  private testButtons: HTMLButtonElement[] = [];
  private cooldownRemaining: number | null = null;

  constructor(
    private readonly onTest: (medicineId: string, ratId: string) => void,
    private readonly onApply: (medicineId: string) => void,
    private readonly onRename: (ratId: string, name: string) => void
  ) {
    ensureStylesInjected();

    this.element = document.createElement('div');
    this.element.innerHTML = '<h3>🐀 Лаборатория</h3>';

    const ratRow = document.createElement('div');
    ratRow.className = 'sw-row';
    ratRow.append('Крыса: ');
    this.ratSelect = document.createElement('select');
    this.ratSelect.addEventListener('change', () => this.syncNameInput());
    ratRow.appendChild(this.ratSelect);
    this.element.appendChild(ratRow);

    const nameRow = document.createElement('div');
    nameRow.className = 'sw-row';
    this.ratNameInput = document.createElement('input');
    this.ratNameInput.type = 'text';
    this.ratNameInput.maxLength = MAX_RAT_NAME_LENGTH;
    this.ratNameInput.placeholder = 'имя крысы';
    this.ratNameInput.style.flex = '1';
    nameRow.appendChild(this.ratNameInput);
    this.renameBtn = document.createElement('button');
    this.renameBtn.className = 'sw-btn-secondary';
    this.renameBtn.textContent = 'Переименовать';
    this.renameBtn.addEventListener('click', () => {
      if (this.ratSelect.value && this.ratNameInput.value.trim()) {
        this.onRename(this.ratSelect.value, this.ratNameInput.value.trim());
      }
    });
    nameRow.appendChild(this.renameBtn);
    this.element.appendChild(nameRow);

    this.cooldownEl = document.createElement('div');
    this.cooldownEl.className = 'sw-muted';
    this.element.appendChild(this.cooldownEl);

    this.medicineListEl = document.createElement('div');
    this.element.appendChild(this.medicineListEl);

    const hint = document.createElement('div');
    hint.className = 'sw-muted';
    hint.textContent =
      'Один тест раскрывает одно скрытое свойство. Крыса может погибнуть, а лекарство с шансом 30% расходуется. ' +
      'Между тестами — пауза (её задаёт админ). Крыс всегда минимум 3.';
    this.element.appendChild(hint);
  }

  private rats: LabRat[] = [];

  private syncNameInput(): void {
    const rat = this.rats.find((r) => r.id === this.ratSelect.value);
    this.ratNameInput.value = rat?.name ?? '';
  }

  update(rats: LabRat[], inventory: InventoryView): void {
    this.rats = rats;
    const previous = this.ratSelect.value;
    this.ratSelect.innerHTML = rats
      .map((r) => `<option value="${r.id}" ${r.alive ? '' : 'disabled'}>${r.alive ? '🐀' : '💀'} ${r.name}${r.alive ? '' : ' (погибла)'}</option>`)
      .join('');
    if (rats.some((r) => r.id === previous)) this.ratSelect.value = previous;
    this.syncNameInput();

    this.medicineListEl.innerHTML = '';
    this.testButtons = [];
    for (const { medicine, quantity } of inventory.medicines) {
      const card = document.createElement('div');
      card.className = 'sw-card';

      const title = document.createElement('div');
      title.innerHTML = `<b>💊 ${medicine.name}</b> ×${quantity}
        <span class="sw-muted">(${medicine.knownEffects.length} известно / ${medicine.hiddenEffects.length} скрыто)</span>`;
      card.appendChild(title);

      if (medicine.knownEffects.length > 0) {
        const effects = document.createElement('div');
        effects.className = 'sw-muted';
        effects.textContent = medicine.knownEffects.map((e) => `${e.key} (${e.power})`).join(', ');
        card.appendChild(effects);
      }

      const row = document.createElement('div');
      row.className = 'sw-row';

      const testBtn = document.createElement('button');
      testBtn.className = 'sw-btn-secondary';
      testBtn.textContent = '🧪 Тест на крысе';
      testBtn.dataset.noHidden = medicine.hiddenEffects.length === 0 ? '1' : '';
      testBtn.addEventListener('click', () => {
        if (this.ratSelect.value) this.onTest(medicine.id, this.ratSelect.value);
      });
      row.appendChild(testBtn);
      this.testButtons.push(testBtn);

      const applyBtn = document.createElement('button');
      applyBtn.className = 'sw-btn';
      applyBtn.textContent = 'Принять самому';
      applyBtn.addEventListener('click', () => this.onApply(medicine.id));
      row.appendChild(applyBtn);

      card.appendChild(row);
      this.medicineListEl.appendChild(card);
    }

    if (inventory.medicines.length === 0) {
      this.medicineListEl.innerHTML = '<div class="sw-card sw-muted">Нет лекарств — сначала создайте их в крафте.</div>';
    }
    this.applyCooldownToButtons();
  }

  /** Обратный отсчёт паузы между тестами; null — тесты доступны. */
  setTestCooldown(remainingSec: number | null): void {
    this.cooldownRemaining = remainingSec !== null && remainingSec > 0 ? remainingSec : null;
    this.cooldownEl.textContent = this.cooldownRemaining
      ? `⏳ Следующее испытание через ${Math.ceil(this.cooldownRemaining)} с`
      : '';
    this.applyCooldownToButtons();
  }

  private applyCooldownToButtons(): void {
    for (const btn of this.testButtons) {
      const noHidden = btn.dataset.noHidden === '1';
      btn.disabled = noHidden || this.cooldownRemaining !== null;
    }
  }
}
