import { LaboratoryHome } from '../../core/home/LaboratoryHome';
import { ensurePanelStylesInjected } from './panelStyles';

export interface HomeClaimPanelData {
  currentHexCellId: string | null;
  home: LaboratoryHome | null;
  message?: string;
}

export class HomeClaimPanel {
  readonly element: HTMLDivElement;
  private bodyEl: HTMLDivElement;

  constructor(onClaim: () => void, onTransfer: () => void) {
    ensurePanelStylesInjected();

    this.element = document.createElement('div');
    this.element.className = 'sw-panel';
    this.element.style.top = '12px';
    this.element.style.right = '12px';

    const title = document.createElement('h3');
    title.textContent = 'Laboratory home';
    this.element.appendChild(title);

    this.bodyEl = document.createElement('div');
    this.element.appendChild(this.bodyEl);

    const claimBtn = document.createElement('button');
    claimBtn.textContent = 'Claim home here';
    claimBtn.addEventListener('click', onClaim);
    this.element.appendChild(claimBtn);

    const transferBtn = document.createElement('button');
    transferBtn.textContent = 'Transfer home here';
    transferBtn.addEventListener('click', onTransfer);
    this.element.appendChild(transferBtn);
  }

  update(data: HomeClaimPanelData): void {
    const lines: string[] = [];
    lines.push(`<div class="sw-row">Current hex: <span class="sw-muted">${data.currentHexCellId ?? '—'}</span></div>`);
    lines.push(
      data.home
        ? `<div class="sw-row">Home hex: <span class="sw-muted">${data.home.hexCellId}</span> (level ${data.home.level})</div>`
        : `<div class="sw-row sw-muted">No home claimed yet.</div>`
    );
    if (data.message) lines.push(`<div class="sw-row">${data.message}</div>`);
    this.bodyEl.innerHTML = lines.join('');
  }
}
