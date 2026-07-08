import { LaboratoryHome } from '../../../core/home/LaboratoryHome';
import { ensureStylesInjected } from '../styles';

export interface HomePanelData {
  currentBlockId: string | null;
  biomeLabel: string | null;
  home: LaboratoryHome | null;
}

// Панель «Дом»: статус текущего блока, клейм и перенос дома-соты.
export class HomePanel {
  readonly element: HTMLDivElement;
  private readonly statusEl: HTMLDivElement;
  private readonly claimBtn: HTMLButtonElement;
  private readonly transferBtn: HTMLButtonElement;

  constructor(onClaim: () => void, onTransfer: () => void) {
    ensureStylesInjected();

    this.element = document.createElement('div');
    this.element.innerHTML = '<h3>🏠 Дом-лаборатория</h3>';

    this.statusEl = document.createElement('div');
    this.element.appendChild(this.statusEl);

    const row = document.createElement('div');
    row.className = 'sw-row';

    this.claimBtn = document.createElement('button');
    this.claimBtn.className = 'sw-btn';
    this.claimBtn.textContent = 'Занять этот блок';
    this.claimBtn.addEventListener('click', onClaim);
    row.appendChild(this.claimBtn);

    this.transferBtn = document.createElement('button');
    this.transferBtn.className = 'sw-btn-secondary';
    this.transferBtn.textContent = 'Перенести дом сюда';
    this.transferBtn.addEventListener('click', onTransfer);
    row.appendChild(this.transferBtn);

    this.element.appendChild(row);

    const hint = document.createElement('div');
    hint.className = 'sw-muted';
    hint.textContent = 'Дом занимает целый блок — соту из 7 ячеек. Перенос бесплатный, но не чаще раза в сутки.';
    this.element.appendChild(hint);
  }

  update(data: HomePanelData): void {
    const rows: string[] = [];
    rows.push(`<div class="sw-card">📍 Текущий блок: <b>${data.currentBlockId ?? 'позиция не определена'}</b>`
      + (data.biomeLabel ? `<div class="sw-muted">Биом: ${data.biomeLabel}</div>` : '<div class="sw-muted">Вне биома</div>')
      + '</div>');

    if (data.home) {
      const isHere = data.home.blockId === data.currentBlockId;
      rows.push(`<div class="sw-card">🏡 Ваш дом: <b>${data.home.blockId}</b> (уровень ${data.home.level})`
        + (isHere ? '<div class="sw-muted">Вы сейчас дома — крафт доступен</div>' : '<div class="sw-muted">Вы не дома</div>')
        + '</div>');
    } else {
      rows.push('<div class="sw-card sw-muted">У вас пока нет дома. Встаньте на свободный блок и займите его.</div>');
    }
    this.statusEl.innerHTML = rows.join('');

    this.claimBtn.disabled = !!data.home || !data.currentBlockId;
    this.transferBtn.disabled = !data.home || !data.currentBlockId || data.home.blockId === data.currentBlockId;
  }
}
