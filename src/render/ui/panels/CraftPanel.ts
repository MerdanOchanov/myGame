import { InventoryView } from '../../../backend/types';
import { MIN_CRAFT_MATERIALS, MAX_MEDICINE_NAME_LENGTH } from '../../../core/medicine/MedicineCraftingService';
import { ensureStylesInjected } from '../styles';

// Панель «Крафт»: выбор количества каждого материала (+/-), крафт из 3+,
// необязательное имя (закрепится, если рецепт открывается впервые).
export class CraftPanel {
  readonly element: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly craftBtn: HTMLButtonElement;
  private readonly totalEl: HTMLSpanElement;
  private readonly nameInput: HTMLInputElement;
  private selectedCounts = new Map<string, number>();

  constructor(onCraft: (materialIds: string[], desiredName: string) => void) {
    ensureStylesInjected();

    this.element = document.createElement('div');
    this.element.innerHTML = '<h3>⚗️ Крафт лекарства</h3>';

    const hint = document.createElement('div');
    hint.className = 'sw-muted';
    hint.textContent = `Выберите минимум ${MIN_CRAFT_MATERIALS} материала. Крафтить можно только в своём доме.`;
    this.element.appendChild(hint);

    this.listEl = document.createElement('div');
    this.element.appendChild(this.listEl);

    const nameRow = document.createElement('div');
    nameRow.className = 'sw-row';
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.maxLength = MAX_MEDICINE_NAME_LENGTH;
    this.nameInput.placeholder = 'Название (если открываете первым)';
    this.nameInput.style.flex = '1';
    nameRow.appendChild(this.nameInput);
    this.element.appendChild(nameRow);

    const row = document.createElement('div');
    row.className = 'sw-row';
    this.craftBtn = document.createElement('button');
    this.craftBtn.className = 'sw-btn';
    this.craftBtn.textContent = 'Создать лекарство';
    this.craftBtn.disabled = true;
    this.craftBtn.addEventListener('click', () => {
      const ids: string[] = [];
      for (const [id, count] of this.selectedCounts) {
        for (let i = 0; i < count; i++) ids.push(id);
      }
      onCraft(ids, this.nameInput.value.trim());
    });
    row.appendChild(this.craftBtn);

    this.totalEl = document.createElement('span');
    this.totalEl.className = 'sw-muted';
    row.appendChild(this.totalEl);
    this.element.appendChild(row);
  }

  private totalSelected(): number {
    let total = 0;
    for (const count of this.selectedCounts.values()) total += count;
    return total;
  }

  private refreshFooter(): void {
    const total = this.totalSelected();
    this.craftBtn.disabled = total < MIN_CRAFT_MATERIALS;
    this.totalEl.textContent = `выбрано: ${total}`;
  }

  update(inventory: InventoryView): void {
    this.selectedCounts.clear();
    this.listEl.innerHTML = '';

    for (const { material, quantity } of inventory.materials) {
      const card = document.createElement('div');
      card.className = 'sw-card sw-row';

      const label = document.createElement('span');
      label.style.flex = '1';
      label.innerHTML = `<b>${material.name}</b> <span class="sw-muted">×${quantity}</span>`;
      card.appendChild(label);

      const minus = document.createElement('button');
      minus.className = 'sw-qty-btn';
      minus.textContent = '−';
      const countEl = document.createElement('span');
      countEl.textContent = '0';
      countEl.style.minWidth = '1.6em';
      countEl.style.textAlign = 'center';
      const plus = document.createElement('button');
      plus.className = 'sw-qty-btn';
      plus.textContent = '+';

      const setCount = (next: number) => {
        const clamped = Math.max(0, Math.min(quantity, next));
        if (clamped > 0) this.selectedCounts.set(material.id, clamped);
        else this.selectedCounts.delete(material.id);
        countEl.textContent = String(clamped);
        this.refreshFooter();
      };
      minus.addEventListener('click', () => setCount((this.selectedCounts.get(material.id) ?? 0) - 1));
      plus.addEventListener('click', () => setCount((this.selectedCounts.get(material.id) ?? 0) + 1));

      card.append(minus, countEl, plus);
      this.listEl.appendChild(card);
    }

    if (inventory.materials.length === 0) {
      this.listEl.innerHTML = '<div class="sw-card sw-muted">Нет материалов — сначала соберите их в биоме.</div>';
    }
    this.refreshFooter();
  }
}
