import { InventoryView } from '../../../backend/types';
import { ensureStylesInjected } from '../styles';

const CATEGORY_LABELS: Record<string, string> = {
  plant: '🌿 растение',
  fruit: '🍎 фрукт',
  berry: '🫐 ягода',
  insect: '🐞 насекомое',
};

// Панель «Инвентарь»: материалы и лекарства со счётчиками и известными свойствами.
export class InventoryPanel {
  readonly element: HTMLDivElement;
  private readonly listEl: HTMLDivElement;

  constructor() {
    ensureStylesInjected();
    this.element = document.createElement('div');
    this.element.innerHTML = '<h3>🎒 Инвентарь</h3>';
    this.listEl = document.createElement('div');
    this.element.appendChild(this.listEl);
  }

  update(inventory: InventoryView): void {
    const cards: string[] = [];

    for (const { material, quantity } of inventory.materials) {
      const allTraits = [...material.primaryTraits, ...material.secondaryTraits];
      const known = allTraits.filter((t) => t.visibility === 'known');
      const traitLine = known.length > 0
        ? known.map((t) => `${t.effectKey} ${t.percent}%`).join(', ')
        : `свойства неизвестны (0/${allTraits.length})`;
      cards.push(`<div class="sw-card"><b>${material.name}</b> ×${quantity}
        <div class="sw-muted">${CATEGORY_LABELS[material.category] ?? material.category} · ${traitLine}</div></div>`);
    }

    for (const { medicine, quantity } of inventory.medicines) {
      cards.push(`<div class="sw-card"><b>💊 ${medicine.name}</b> ×${quantity}
        <div class="sw-muted">эффекты: ${medicine.knownEffects.length} известно / ${medicine.hiddenEffects.length} скрыто</div></div>`);
    }

    this.listEl.innerHTML = cards.length > 0
      ? cards.join('')
      : '<div class="sw-card sw-muted">Пусто. Найдите биом на карте и соберите материалы.</div>';
  }
}
