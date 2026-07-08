import { LabRat } from '../../../core/lab/LabRat';
import { InventoryView } from '../../../backend/types';
import { ensureStylesInjected } from '../styles';

// Панель «Лаборатория»: выбор крысы, тест лекарства (раскрывает 1 свойство),
// применение лекарства к себе.
export class LabPanel {
  readonly element: HTMLDivElement;
  private readonly ratSelect: HTMLSelectElement;
  private readonly medicineListEl: HTMLDivElement;

  constructor(
    private readonly onTest: (medicineId: string, ratId: string) => void,
    private readonly onApply: (medicineId: string) => void
  ) {
    ensureStylesInjected();

    this.element = document.createElement('div');
    this.element.innerHTML = '<h3>🐀 Лаборатория</h3>';

    const ratRow = document.createElement('div');
    ratRow.className = 'sw-row';
    ratRow.append('Крыса для тестов: ');
    this.ratSelect = document.createElement('select');
    ratRow.appendChild(this.ratSelect);
    this.element.appendChild(ratRow);

    this.medicineListEl = document.createElement('div');
    this.element.appendChild(this.medicineListEl);

    const hint = document.createElement('div');
    hint.className = 'sw-muted';
    hint.textContent = 'Один тест раскрывает одно скрытое свойство лекарства. Крыса может погибнуть. Новая крыса выдаётся раз в сутки.';
    this.element.appendChild(hint);
  }

  update(rats: LabRat[], inventory: InventoryView): void {
    const previous = this.ratSelect.value;
    this.ratSelect.innerHTML = rats
      .map((r) => `<option value="${r.id}" ${r.alive ? '' : 'disabled'}>🐀 ${r.id.slice(-6)}${r.alive ? '' : ' (погибла)'}</option>`)
      .join('');
    if (rats.some((r) => r.id === previous)) this.ratSelect.value = previous;

    this.medicineListEl.innerHTML = '';
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
      testBtn.disabled = medicine.hiddenEffects.length === 0;
      testBtn.addEventListener('click', () => {
        if (this.ratSelect.value) this.onTest(medicine.id, this.ratSelect.value);
      });
      row.appendChild(testBtn);

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
  }
}
