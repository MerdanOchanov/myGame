import { InventoryView } from '../../backend/types';
import { MIN_CRAFT_MATERIALS } from '../../core/medicine/MedicineCraftingService';
import { ensurePanelStylesInjected } from './panelStyles';

export class CraftingPanel {
  readonly element: HTMLDivElement;
  private listEl: HTMLDivElement;
  private craftBtn: HTMLButtonElement;
  private messageEl: HTMLDivElement;
  private selected = new Set<string>();

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
    this.craftBtn.addEventListener('click', () => onCraft([...this.selected]));
    this.element.appendChild(this.craftBtn);

    this.messageEl = document.createElement('div');
    this.messageEl.className = 'sw-row sw-muted';
    this.element.appendChild(this.messageEl);
  }

  update(inventory: InventoryView): void {
    this.selected.clear();
    this.listEl.innerHTML = '';

    for (const { material, quantity } of inventory.materials) {
      const row = document.createElement('label');
      row.className = 'sw-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) this.selected.add(material.id);
        else this.selected.delete(material.id);
        this.craftBtn.disabled = this.selected.size < MIN_CRAFT_MATERIALS;
      });
      row.appendChild(checkbox);
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
