import { GameClient } from '../../client/GameClient';
import { MapView, RectBounds } from '../MapView';
import { GamePhaserLayer } from '../GamePhaserLayer';
import { LaboratoryHome } from '../../core/home/LaboratoryHome';
import { blocksInRectangle, blocksBoundingBox } from '../../core/geo/HexGrid';
import { BIOME_LABELS_RU, BiomeType, MAX_SELECTION_BLOCKS } from '../../core/biome/Biome';
import { scatterBiomes } from '../../core/biome/BiomeScatter';
import { ensureStylesInjected } from './styles';
import { ToastHost } from './Toast';
import { TopBar } from './TopBar';
import { ActionBar, ActionId } from './ActionBar';
import { Drawer } from './Drawer';
import { HomePanel } from './panels/HomePanel';
import { InventoryPanel } from './panels/InventoryPanel';
import { CraftPanel } from './panels/CraftPanel';
import { LabPanel } from './panels/LabPanel';
import { AdminTool } from './AdminTool';

const POLL_INTERVAL_MS = 5000;

// Русские описания кодов ошибок бекенда.
const ERROR_RU: Record<string, string> = {
  accuracy: 'GPS-сигнал слишком неточный',
  stale_timestamp: 'устаревшие координаты',
  implausible_speed: 'слишком быстрое перемещение — координаты отклонены',
  collect_cooldown: 'таймер сбора ещё не истёк — подождите',
  no_biome_here: 'здесь нет биома — собирать нечего',
  unknown_biome: 'биом не найден',
  block_occupied: 'этот блок уже занят',
  player_already_has_home: 'у вас уже есть дом',
  no_existing_home: 'у вас ещё нет дома',
  transfer_cooldown: 'переносить дом можно не чаще раза в сутки',
  no_home: 'сначала займите дом',
  not_in_own_home: 'крафтить можно только в своём доме',
  unknown_material: 'неизвестный материал',
  insufficient_materials: 'не хватает материалов',
  craft_failed: 'крафт не удался — материалы частично потеряны',
  not_owned: 'у вас нет этого предмета',
  not_owned_medicine: 'у вас нет этого лекарства',
  not_owned_rat: 'это не ваша крыса',
  rat_dead: 'эта крыса погибла',
  rat_test_cooldown: 'испытания на паузе — подождите',
  admin_forbidden: 'неверный админ-пароль',
  too_few_blocks: 'слишком маленький участок',
  too_many_blocks: 'слишком большой участок',
  bad_block_ids: 'некорректное выделение',
  blocks_taken: 'часть блоков уже занята другим биомом',
  biome_exists: 'такой биом уже существует',
  no_biomes: 'не удалось разбить участок на биомы',
  unknown_event: 'событие не найдено',
  event_failed: 'не удалось создать событие',
  internal_error: 'внутренняя ошибка сервера',
};

function ru(codeOrError: unknown): string {
  const code = codeOrError instanceof Error ? codeOrError.message : String(codeOrError);
  return ERROR_RU[code] ?? code;
}

// Композиция нового UI: карта + верхняя/нижняя панели + шторка + тосты.
export class HudRoot {
  private readonly client: GameClient;
  private readonly mapView: MapView;
  private readonly phaserLayer: GamePhaserLayer;

  private readonly toasts: ToastHost;
  private readonly topBar: TopBar;
  private readonly actionBar: ActionBar;
  private readonly drawer: Drawer;
  private readonly homePanel: HomePanel;
  private readonly inventoryPanel: InventoryPanel;
  private readonly craftPanel: CraftPanel;
  private readonly labPanel: LabPanel;
  private readonly adminTool: AdminTool;

  private currentHome: LaboratoryHome | null = null;
  private currentBlockId: string | null = null;
  private currentBiomeLabel: string | null = null;
  private hasCenteredOnce = false;
  private lastCenter: { lat: number; lng: number } | null = null;
  private adminBlockIds: string[] = [];
  private adminColor: { r: number; g: number; b: number } | null = null;
  /** Момент, когда снова можно собирать (мс epoch); null — можно сейчас. */
  private nextCollectAtMs: number | null = null;
  /** Момент, когда снова можно испытывать на крысе (мс epoch); null — можно. */
  private nextRatTestAtMs: number | null = null;
  /** id события, о приближении которого уже предупредили (чтобы не спамить). */
  private warnedEventId: string | null = null;
  private insideEventId: string | null = null;

  private constructor(
    uiRootEl: HTMLElement,
    mapContainerId: string,
    phaserContainerId: string,
    client: GameClient,
    initialHome: LaboratoryHome | undefined
  ) {
    ensureStylesInjected();
    this.client = client;
    this.currentHome = initialHome ?? null;

    this.mapView = new MapView(mapContainerId, {
      onMapClick: (lat, lng) => {
        if (this.client.getMode() === 'debug') {
          this.client.setDebugPosition(lat, lng);
          void this.refresh();
        }
      },
      onViewChanged: () => void this.refreshSilently(),
    });
    this.phaserLayer = new GamePhaserLayer(phaserContainerId);
    this.mapView.onMove(() => this.phaserLayer.syncGlowToPosition(this.mapView, this.lastCenter));

    // Если карта восстановлена из сохранённого вида (после перезагрузки) —
    // не перепрыгиваем на игрока, оставляем прежние позицию и зум.
    this.hasCenteredOnce = this.mapView.hasSavedView();

    this.toasts = new ToastHost();
    this.topBar = new TopBar(client.getMode(), {
      onToggleMode: () => {
        const next = this.client.getMode() === 'debug' ? 'production' : 'debug';
        this.client.setMode(next);
        this.topBar.setMode(next);
        this.toasts.show(next === 'debug' ? 'Режим отладки: кликните по карте, чтобы задать позицию' : 'Режим GPS: используется реальная геопозиция');
        void this.refresh();
      },
      onAdminClick: () => this.toggleDrawer('admin'),
    });
    this.actionBar = new ActionBar((id) => this.handleAction(id));
    this.drawer = new Drawer(() => this.closeDrawer());

    this.homePanel = new HomePanel(
      () => void this.handleClaim(),
      () => void this.handleTransfer()
    );
    this.inventoryPanel = new InventoryPanel();
    this.craftPanel = new CraftPanel((ids, name) => void this.handleCraft(ids, name));
    this.labPanel = new LabPanel(
      (medicineId, ratId) => void this.handleTest(medicineId, ratId),
      (medicineId) => void this.handleApply(medicineId),
      (ratId, name) => void this.handleRenameRat(ratId, name)
    );
    this.adminTool = new AdminTool({
      onStartSelection: () => this.startAdminSelection(),
      onCancelSelection: () => this.mapView.cancelRectangleSelection(),
      onCreateBiome: (password, intervalSec) => void this.handleCreateBiome(password, intervalSec),
      onSetCollectInterval: (password, biomeId, intervalSec) =>
        void this.handleSetCollectInterval(password, biomeId, intervalSec),
      onClearBiomes: (password) => void this.handleClearBiomes(password),
      onSetRatTestInterval: (password, intervalSec) => void this.handleSetRatTestInterval(password, intervalSec),
      onStartEventPlacement: () => this.startEventPlacement(),
      onCreateEvent: (password, radiusKm, severity) => void this.handleCreateEvent(password, radiusKm, severity),
      onListPlayers: (password) => this.client.adminListPlayers(password),
      onListMedicines: (password) => this.client.adminListMedicines(password),
      onListMaterials: (password) => this.client.adminListMaterials(password),
    });

    uiRootEl.append(this.toasts.element, this.topBar.element, this.actionBar.element, this.drawer.element);
  }

  static async mount(uiRootId: string, mapContainerId: string, phaserContainerId: string): Promise<HudRoot> {
    const uiRootEl = document.getElementById(uiRootId);
    if (!uiRootEl) throw new Error(`#${uiRootId} not found`);

    const client = new GameClient();
    const session = await client.init();

    const hud = new HudRoot(uiRootEl, mapContainerId, phaserContainerId, client, session.home);
    hud.topBar.updateState(session.playerState);
    await hud.refreshInventoryAndLab();
    setInterval(() => void hud.refreshSilently(), POLL_INTERVAL_MS);
    setInterval(() => hud.tickCooldowns(), 1000);
    return hud;
  }

  /** Ежесекундный тик обратных отсчётов: сбор и испытания на крысах. */
  private tickCooldowns(): void {
    const collectRemaining = this.nextCollectAtMs === null ? null : (this.nextCollectAtMs - Date.now()) / 1000;
    if (collectRemaining !== null && collectRemaining <= 0) this.nextCollectAtMs = null;
    this.actionBar.setCollectCooldown(this.nextCollectAtMs === null ? null : collectRemaining);

    const testRemaining = this.nextRatTestAtMs === null ? null : (this.nextRatTestAtMs - Date.now()) / 1000;
    if (testRemaining !== null && testRemaining <= 0) this.nextRatTestAtMs = null;
    this.labPanel.setTestCooldown(this.nextRatTestAtMs === null ? null : testRemaining);
  }

  private setNextCollectAt(iso: string | undefined): void {
    this.nextCollectAtMs = iso ? new Date(iso).getTime() : null;
    this.tickCooldowns();
  }

  private setNextRatTestAt(iso: string | undefined): void {
    this.nextRatTestAtMs = iso ? new Date(iso).getTime() : null;
    this.tickCooldowns();
  }

  // ------------------------------------------------------------ навигация

  private handleAction(id: ActionId): void {
    if (id === 'collect') {
      void this.handleCollect();
      return;
    }
    this.toggleDrawer(id);
  }

  private toggleDrawer(key: string): void {
    if (this.drawer.openKey === key) {
      this.closeDrawer();
      return;
    }
    const content =
      key === 'home' ? this.homePanel.element :
      key === 'inventory' ? this.inventoryPanel.element :
      key === 'craft' ? this.craftPanel.element :
      key === 'lab' ? this.labPanel.element :
      this.adminTool.element;
    this.drawer.open(key, content);
    this.actionBar.setActive(key === 'admin' ? null : (key as ActionId));
    if (key === 'inventory' || key === 'craft' || key === 'lab') void this.refreshInventoryAndLab();
    if (key === 'home') this.updateHomePanel();
  }

  private closeDrawer(): void {
    this.drawer.close();
    this.actionBar.setActive(null);
  }

  // ------------------------------------------------------------- обновление

  private updateHomePanel(): void {
    this.homePanel.update({
      currentBlockId: this.currentBlockId,
      biomeLabel: this.currentBiomeLabel,
      home: this.currentHome,
    });
  }

  private async refresh(): Promise<void> {
    try {
      await this.doRefresh();
    } catch (err) {
      this.toasts.show(`Позиция недоступна: ${ru(err)}`, 'error');
    }
  }

  /** Фоновое обновление (poll, движение карты) — без тостов об отсутствии позиции. */
  private async refreshSilently(): Promise<void> {
    try {
      await this.doRefresh();
    } catch {
      // позиция ещё не задана — тихо пропускаем
    }
  }

  private async doRefresh(): Promise<void> {
    const layers = await this.client.getMapLayers(this.mapView.getViewBounds());
    if (typeof layers === 'string') {
      this.toasts.show(`Позиция отклонена: ${ru(layers)}`, 'error');
      return;
    }

    this.lastCenter = layers.playerHexCell.center;
    this.currentBlockId = layers.playerHexCell.blockId ?? null;
    this.currentBiomeLabel = layers.biome ? BIOME_LABELS_RU[layers.biome.type] : null;
    this.adminTool.setCurrentBiome(layers.biome ?? null);
    this.setNextCollectAt(layers.nextCollectAt);

    this.mapView.showPlayerPosition(layers.playerHexCell.center.lat, layers.playerHexCell.center.lng);
    if (!this.hasCenteredOnce) {
      this.mapView.centerOn(layers.playerHexCell.center.lat, layers.playerHexCell.center.lng);
      this.hasCenteredOnce = true;
    }
    this.mapView.showBiomes(layers.biomes);
    this.mapView.showEvents(layers.events);
    this.mapView.showCurrentBlock(this.currentBlockId);
    this.mapView.showHomes(layers.nearbyHomes, this.client.currentPlayerId);
    this.phaserLayer.syncGlowToPosition(this.mapView, layers.playerHexCell.center);

    // Предупреждение о приближении события (за пол-радиуса) — один раз на событие.
    if (layers.approachingEventId && this.warnedEventId !== layers.approachingEventId) {
      this.warnedEventId = layers.approachingEventId;
      this.toasts.show('⚠️ Приближается глобальное событие — держитесь подальше!', 'error');
    }
    if (!layers.approachingEventId && !layers.insideEventId) this.warnedEventId = null;

    // Внутри события: постепенный урон. Обновляем здоровье и предупреждаем.
    if (layers.insideEventId) {
      if (this.insideEventId !== layers.insideEventId) {
        this.insideEventId = layers.insideEventId;
        this.toasts.show('☢️ Вы внутри события! Состояние ухудшается — уходите из зоны.', 'error');
      }
      if (layers.playerState) this.topBar.updateState(layers.playerState);
    } else {
      this.insideEventId = null;
    }

    this.updateHomePanel();
  }

  private async refreshInventoryAndLab(): Promise<void> {
    const [inventory, ratsView] = await Promise.all([this.client.getInventory(), this.client.getRats()]);
    this.inventoryPanel.update(inventory);
    this.craftPanel.update(inventory);
    this.labPanel.update(ratsView.rats, inventory);
    this.setNextRatTestAt(ratsView.nextTestAt);
  }

  // -------------------------------------------------------------- действия

  private async handleClaim(): Promise<void> {
    try {
      const result = await this.client.claimHome();
      if (typeof result === 'string') {
        this.toasts.show(`Не удалось занять блок: ${ru(result)}`, 'error');
        return;
      }
      this.currentHome = result;
      this.toasts.show('🏠 Дом основан! Сота из 7 ячеек теперь ваша.', 'success');
      await this.refresh();
    } catch (err) {
      this.toasts.show(`Не удалось занять блок: ${ru(err)}`, 'error');
    }
  }

  private async handleTransfer(): Promise<void> {
    try {
      const result = await this.client.transferHome();
      if (typeof result === 'string') {
        this.toasts.show(`Перенос не удался: ${ru(result)}`, 'error');
        return;
      }
      this.currentHome = result;
      this.toasts.show('🏠 Дом перенесён.', 'success');
      await this.refresh();
    } catch (err) {
      this.toasts.show(`Перенос не удался: ${ru(err)}`, 'error');
    }
  }

  private async handleCollect(): Promise<void> {
    try {
      const result = await this.client.collectMaterial();
      if (typeof result === 'string') {
        this.toasts.show(`Сбор не удался: ${ru(result)}`, 'error');
        return;
      }
      if (this.lastCenter) this.phaserLayer.playCollectBurst(this.mapView, this.lastCenter.lat, this.lastCenter.lng);
      this.toasts.show(`🧺 Собрано: ${result.material.name} ×${result.quantity} (в биоме ${result.poolSize} видов)`, 'success');
      this.setNextCollectAt(result.nextCollectAt);
      await this.refreshInventoryAndLab();
    } catch (err) {
      this.toasts.show(`Сбор не удался: ${ru(err)}`, 'error');
    }
  }

  private async handleCraft(materialIds: string[], desiredName: string): Promise<void> {
    try {
      const result = await this.client.craftMedicine(materialIds, desiredName);
      if (typeof result === 'string') {
        this.toasts.show(`Крафт не удался: ${ru(result)}`, 'error');
        await this.refreshInventoryAndLab();
        return;
      }
      const mine = result.creatorPlayerId === this.client.currentPlayerId;
      this.toasts.show(
        `⚗️ Создано: ${result.name} (шанс был ${Math.round(result.successChance * 100)}%)` +
        (mine ? ' — вы первооткрыватель!' : ' — рецепт уже был открыт ранее'),
        'success'
      );
      await this.refreshInventoryAndLab();
    } catch (err) {
      this.toasts.show(`Крафт не удался: ${ru(err)}`, 'error');
    }
  }

  private async handleRenameRat(ratId: string, name: string): Promise<void> {
    try {
      const result = await this.client.renameRat(ratId, name);
      if (typeof result === 'string') {
        this.toasts.show(`Не удалось переименовать: ${ru(result)}`, 'error');
        return;
      }
      this.toasts.show(`🐀 Крыса переименована: ${result.name}`, 'success');
      await this.refreshInventoryAndLab();
    } catch (err) {
      this.toasts.show(`Не удалось переименовать: ${ru(err)}`, 'error');
    }
  }

  private async handleTest(medicineId: string, ratId: string): Promise<void> {
    const result = await this.client.testMedicineOnRat(medicineId, ratId);
    if (typeof result === 'string') {
      this.toasts.show(`Тест не удался: ${ru(result)}`, 'error');
      return;
    }
    if (result.revealedEffect) {
      this.toasts.show(
        `🧪 Открыт эффект: ${result.revealedEffect.key} (сила ${result.revealedEffect.power}). ` +
        `Крыса ${result.ratAlive ? 'выжила' : 'погибла 💀'}`,
        result.ratAlive ? 'success' : 'error'
      );
    } else {
      this.toasts.show('Все эффекты уже раскрыты.', 'info');
    }
    if (result.medicineConsumed) this.toasts.show('🧫 Лекарство израсходовано в ходе испытания.', 'info');
    this.setNextRatTestAt(result.nextTestAt);
    await this.refreshInventoryAndLab();
  }

  private async handleApply(medicineId: string): Promise<void> {
    const result = await this.client.applyMedicine(medicineId);
    if (typeof result === 'string') {
      this.toasts.show(`Не удалось применить: ${ru(result)}`, 'error');
      return;
    }
    this.topBar.updateState(result.playerState);
    this.toasts.show(`💊 Применено эффектов: ${result.appliedEffects.length}`, 'success');
    await this.refreshInventoryAndLab();
  }

  // ------------------------------------------------------------------ админ

  private startAdminSelection(): void {
    this.toasts.show('Кликните по карте два раза — углы прямоугольника.', 'info');
    this.mapView.startRectangleSelection((bounds: RectBounds) => {
      let blockIds = blocksInRectangle(bounds);
      if (blockIds.length > MAX_SELECTION_BLOCKS) {
        // предохранитель от зависания браузера на гигантском выделении
        this.toasts.show(
          `Очень большой участок (${blockIds.length} блоков) — обработаны первые ${MAX_SELECTION_BLOCKS}.`,
          'info'
        );
        blockIds = blockIds.slice(0, MAX_SELECTION_BLOCKS);
      }
      this.adminBlockIds = blockIds;
      this.adminColor = this.mapView.sampleDominantColor(bounds);
      this.adminTool.showSelection({ blockIds, dominantColor: this.adminColor });
    });
  }

  private async handleCreateBiome(password: string, collectIntervalSec: number): Promise<void> {
    if (!password) {
      this.toasts.show('Введите админ-пароль.', 'error');
      return;
    }
    if (this.adminBlockIds.length === 0) {
      this.toasts.show('Сначала выделите участок.', 'error');
      return;
    }

    // Разбрасываем биомы по выделению; цвет (тип) каждого семплируем по его
    // собственному участку карты. Цвет всего выделения — запасной вариант.
    const fallbackColor = this.adminColor ?? { r: 154, g: 205, b: 90 };
    const groups = scatterBiomes(this.adminBlockIds);
    if (groups.length === 0) {
      this.toasts.show('Не удалось разбить участок на биомы.', 'error');
      return;
    }

    const biomes = groups.map((blockIds) => {
      const bbox = blocksBoundingBox(blockIds);
      const color = (bbox && this.mapView.sampleDominantColor(bbox)) || fallbackColor;
      return { blockIds, dominantColor: color };
    });

    try {
      const result = await this.client.adminGenerateBiomes(biomes, collectIntervalSec, password);
      if (typeof result === 'string') {
        this.toasts.show(`Биомы не созданы: ${ru(result)}`, 'error');
        return;
      }
      const typesSummary = Object.entries(result.typeCounts)
        .map(([type, count]) => `${BIOME_LABELS_RU[type as BiomeType] ?? type}×${count}`)
        .join(', ');
      this.toasts.show(
        `🌍 Создано биомов: ${result.biomesCreated} (${typesSummary}). ` +
        `Покрыто ${result.blocksCovered} блоков, ${result.materialsTotal} видов материалов, ` +
        `сбор раз в ${collectIntervalSec} с`,
        'success'
      );
      // Подгоняем карту под созданные биомы, чтобы они сразу были видны.
      const createdBlocks = biomes.flatMap((b) => b.blockIds);
      const bbox = blocksBoundingBox(createdBlocks);
      if (bbox) this.mapView.fitBounds(bbox);

      this.adminTool.clearSelection();
      this.mapView.clearSelectionRect();
      this.adminBlockIds = [];
      this.adminColor = null;
      await this.refreshSilently();
    } catch (err) {
      this.toasts.show(`Биомы не созданы: ${ru(err)}`, 'error');
    }
  }

  private async handleSetCollectInterval(
    password: string,
    biomeId: string,
    collectIntervalSec: number
  ): Promise<void> {
    if (!password) {
      this.toasts.show('Введите админ-пароль.', 'error');
      return;
    }
    try {
      const result = await this.client.adminSetCollectInterval(biomeId, collectIntervalSec, password);
      if (typeof result === 'string') {
        this.toasts.show(`Интервал не обновлён: ${ru(result)}`, 'error');
        return;
      }
      this.adminTool.setCurrentBiome(result);
      this.toasts.show(`⏱️ Интервал сбора в биоме: ${result.collectIntervalSec} с`, 'success');
      await this.refreshSilently();
    } catch (err) {
      this.toasts.show(`Интервал не обновлён: ${ru(err)}`, 'error');
    }
  }

  private async handleClearBiomes(password: string): Promise<void> {
    if (!password) {
      this.toasts.show('Введите админ-пароль.', 'error');
      return;
    }
    try {
      const result = await this.client.adminClearBiomes(password);
      if (typeof result === 'string') {
        this.toasts.show(`Не удалось очистить: ${ru(result)}`, 'error');
        return;
      }
      this.toasts.show(`🗑️ Удалено биомов: ${result.deletedBiomes}`, 'success');
      await this.refreshSilently();
    } catch (err) {
      this.toasts.show(`Не удалось очистить: ${ru(err)}`, 'error');
    }
  }

  private async handleSetRatTestInterval(password: string, intervalSec: number): Promise<void> {
    if (!password) {
      this.toasts.show('Введите админ-пароль.', 'error');
      return;
    }
    try {
      const result = await this.client.adminSetRatTestInterval(intervalSec, password);
      if (typeof result === 'string') {
        this.toasts.show(`Таймаут не обновлён: ${ru(result)}`, 'error');
        return;
      }
      this.toasts.show(`⏱️ Пауза между испытаниями: ${result.ratTestIntervalSec} с`, 'success');
    } catch (err) {
      this.toasts.show(`Таймаут не обновлён: ${ru(err)}`, 'error');
    }
  }

  private startEventPlacement(): void {
    this.toasts.show('Кликните по карте — центр события.', 'info');
    this.mapView.startPointSelection((lat, lng) => this.adminTool.setEventCenter(lat, lng));
  }

  private async handleCreateEvent(password: string, radiusKm: number, severity: number): Promise<void> {
    if (!password) {
      this.toasts.show('Введите админ-пароль.', 'error');
      return;
    }
    const center = this.adminTool.getEventCenter();
    if (!center) {
      this.toasts.show('Сначала укажите центр события кликом по карте.', 'error');
      return;
    }
    try {
      const result = await this.client.adminCreateEvent(center.lat, center.lng, radiusKm, severity, password);
      if (typeof result === 'string') {
        this.toasts.show(`Событие не создано: ${ru(result)}`, 'error');
        return;
      }
      this.toasts.show(`☢️ Событие создано (ур. ${result.severity}, R≈${Math.round(result.radiusKm)} км).`, 'success');
      this.adminTool.clearEventCenter();
      await this.refreshSilently();
    } catch (err) {
      this.toasts.show(`Событие не создано: ${ru(err)}`, 'error');
    }
  }
}
