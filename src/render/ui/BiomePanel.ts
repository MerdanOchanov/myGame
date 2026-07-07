import { Biome } from '../../core/biome/Biome';
import { ensurePanelStylesInjected } from './panelStyles';

export class BiomePanel {
  readonly element: HTMLDivElement;
  private bodyEl: HTMLDivElement;

  constructor() {
    ensurePanelStylesInjected();

    this.element = document.createElement('div');
    this.element.className = 'sw-panel';
    this.element.style.top = '90px';
    this.element.style.right = '12px';

    const title = document.createElement('h3');
    title.textContent = 'Current biome';
    this.element.appendChild(title);

    this.bodyEl = document.createElement('div');
    this.element.appendChild(this.bodyEl);
  }

  update(biome: Biome | null): void {
    if (!biome) {
      this.bodyEl.innerHTML = '<div class="sw-row sw-muted">Resolve your position to reveal a biome.</div>';
      return;
    }
    this.bodyEl.innerHTML = `
      <div class="sw-row">Type: <strong>${biome.type}</strong></div>
      <div class="sw-row sw-muted">${biome.hexCellIds.length} hex cells in cluster</div>
    `;
  }
}
