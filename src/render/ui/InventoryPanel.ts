import { InventoryView } from '../../backend/types';
import { ensurePanelStylesInjected } from './panelStyles';

export class InventoryPanel {
  readonly element: HTMLDivElement;
  private bodyEl: HTMLDivElement;

  constructor(onCollect: () => void) {
    ensurePanelStylesInjected();

    this.element = document.createElement('div');
    this.element.className = 'sw-panel';
    this.element.style.bottom = '12px';
    this.element.style.left = '12px';

    const title = document.createElement('h3');
    title.textContent = 'Inventory';
    this.element.appendChild(title);

    const collectBtn = document.createElement('button');
    collectBtn.textContent = 'Collect material here';
    collectBtn.addEventListener('click', onCollect);
    this.element.appendChild(collectBtn);

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'sw-item-list';
    this.element.appendChild(this.bodyEl);
  }

  update(inventory: InventoryView): void {
    const materialLines = inventory.materials.map(({ material, quantity }) => {
      const revealedCount = [...material.primaryTraits, ...material.secondaryTraits].filter((t) => t.visibility === 'known').length;
      const totalTraits = material.primaryTraits.length + material.secondaryTraits.length;
      return `<div class="sw-row">${material.name} (${material.category}) ×${quantity} — ${revealedCount}/${totalTraits} traits known</div>`;
    });

    const medicineLines = inventory.medicines.map(({ medicine, quantity }) => {
      return `<div class="sw-row">${medicine.name} ×${quantity} — ${medicine.knownEffects.length} known / ${medicine.hiddenEffects.length} hidden effects</div>`;
    });

    this.bodyEl.innerHTML = `
      <div class="sw-row sw-muted">Materials</div>
      ${materialLines.join('') || '<div class="sw-row sw-muted">— none —</div>'}
      <div class="sw-row sw-muted" style="margin-top:6px">Medicines</div>
      ${medicineLines.join('') || '<div class="sw-row sw-muted">— none —</div>'}
    `;
  }
}
