import { InventoryView } from '../../backend/types';
import { MIN_CRAFT_MATERIALS } from '../../core/medicine/MedicineCraftingService';
import { ensurePanelStylesInjected } from './panelStyles';

export class CraftingPanel {
  readonly element: HTMLDivElement;
  private listEl: HTMLDivElement;
  private craftBtn: HTMLButtonElement;
  private messageEl: HTMLDivElement;
  private selectedCounts = new Map<string, number>();

  constructor(onCraft: (materialIds: string[]) => void) {
    ensurePanelStylesInjected();

    this.element = document.createElement('div');
    this.element.className = 'sw-panel';
    this.element.style.bottom = '12px';
    this.element.style.left = '300px';

    const title = document.createElement('h3');
    title.textContent = `Craft medicine (≥${MIN_CRAFT_MATERIALS} materials, in your own home)`;
    this.element.appendChild(title);

    this.listEl = document.createElement('div');
    this.listEl.className = 'sw-item-list';
    this.element.appendChild(this.listEl);

    this.craftBtn = document.createElement('button');
    this.craftBtn.textContent = 'Craft';
    this.craftBtn.disabled = true;
    this.craftBtn.addEventListener('click', () => {
      const materialIds: string[] = [];
      for (const [id, count] of this.selectedCounts) {
        for (let i = 0; i < count; i++) materialIds.push(id);
      }
      onCraft(materialIds);
    });
    this.element.appendChild(this.craftBtn);

    this.messageEl = document.createElement('div');
    this.messageEl.className = 'sw-row sw-muted';
    this.element.appendChild(this.messageEl);
  }

  private totalSelected(): number {
    let total = 0;
    for (const count of this.selectedCounts.values()) total += count;
    return total;
  }

  update(inventory: InventoryView): void {
    this.selectedCounts.clear();
    this.listEl.innerHTML = '';

    for (const { material, quantity } of inventory.materials) {
      const row = document.createElement('label');
      row.className = 'sw-row';

      const amount = document.createElement('input');
      amount.type = 'number';
      amount.min = '0';
      amount.max = String(quantity);
      amount.value = '0';
      amount.step = '1';
      amount.style.width = '3.5em';
      amount.addEventListener('change', () => {
        const parsed = Math.max(0, Math.min(quantity, Math.floor(Number(amount.value) || 0)));
        amount.value = String(parsed);
        if (parsed > 0) this.selectedCounts.set(material.id, parsed);
        else this.selectedCounts.delete(material.id);
        this.craftBtn.disabled = this.totalSelected() < MIN_CRAFT_MATERIALS;
      });

      row.appendChild(amount);
      row.append(` ${material.name} (${material.category}) ×${quantity}`);
      this.listEl.appendChild(row);
    }

    if (inventory.materials.length === 0) {
      this.listEl.innerHTML = '<div class="sw-row sw-muted">Collect materials first.</div>';
    }
    this.craftBtn.disabled = true;
  }

  setMessage(text: string): void {
    this.messageEl.textContent = text;
  }
}
