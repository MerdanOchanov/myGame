import { LabRat } from '../../core/lab/LabRat';
import { InventoryView } from '../../backend/types';
import { ensurePanelStylesInjected } from './panelStyles';

export class LabPanel {
  readonly element: HTMLDivElement;
  private ratSelect: HTMLSelectElement;
  private medicineListEl: HTMLDivElement;
  private messageEl: HTMLDivElement;

  constructor(
    private readonly onTest: (medicineId: string, ratId: string) => void,
    private readonly onApply: (medicineId: string) => void
  ) {
    ensurePanelStylesInjected();

    this.element = document.createElement('div');
    this.element.className = 'sw-panel';
    this.element.style.bottom = '12px';
    this.element.style.left = '588px';

    const title = document.createElement('h3');
    title.textContent = 'Laboratory';
    this.element.appendChild(title);

    const ratRow = document.createElement('div');
    ratRow.className = 'sw-row';
    ratRow.append('Rat: ');
    this.ratSelect = document.createElement('select');
    ratRow.appendChild(this.ratSelect);
    this.element.appendChild(ratRow);

    this.medicineListEl = document.createElement('div');
    this.medicineListEl.className = 'sw-item-list';
    this.element.appendChild(this.medicineListEl);

    this.messageEl = document.createElement('div');
    this.messageEl.className = 'sw-row sw-muted';
    this.element.appendChild(this.messageEl);
  }

  update(rats: LabRat[], inventory: InventoryView): void {
    const previousSelection = this.ratSelect.value;
    this.ratSelect.innerHTML = rats
      .map((r) => `<option value="${r.id}" ${r.alive ? '' : 'disabled'}>${r.id.slice(-6)} ${r.alive ? '' : '(dead)'}</option>`)
      .join('');
    if (rats.some((r) => r.id === previousSelection)) this.ratSelect.value = previousSelection;

    this.medicineListEl.innerHTML = '';
    for (const { medicine, quantity } of inventory.medicines) {
      const row = document.createElement('div');
      row.className = 'sw-row';
      row.textContent = `${medicine.name} ×${quantity} (${medicine.knownEffects.length} known / ${medicine.hiddenEffects.length} hidden) `;

      const testBtn = document.createElement('button');
      testBtn.textContent = 'Test on rat';
      testBtn.addEventListener('click', () => {
        if (this.ratSelect.value) this.onTest(medicine.id, this.ratSelect.value);
      });
      row.appendChild(testBtn);

      const applyBtn = document.createElement('button');
      applyBtn.textContent = 'Apply to self';
      applyBtn.addEventListener('click', () => this.onApply(medicine.id));
      row.appendChild(applyBtn);

      this.medicineListEl.appendChild(row);
    }

    if (inventory.medicines.length === 0) {
      this.medicineListEl.innerHTML = '<div class="sw-row sw-muted">Craft a medicine first.</div>';
    }
  }

  setMessage(text: string): void {
    this.messageEl.textContent = text;
  }
}
