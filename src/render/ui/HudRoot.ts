import { GameClient } from '../../client/GameClient';
import { MapView } from '../MapView';
import { GamePhaserLayer } from '../GamePhaserLayer';
import { LaboratoryHome } from '../../core/home/LaboratoryHome';
import { DebugModeToggle } from './DebugModeToggle';
import { HomeClaimPanel } from './HomeClaimPanel';
import { BiomePanel } from './BiomePanel';
import { InventoryPanel } from './InventoryPanel';
import { CraftingPanel } from './CraftingPanel';
import { LabPanel } from './LabPanel';

const POLL_INTERVAL_MS = 5000;

// Composition root: wires GameClient (state-changing calls) + MapView
// (Leaflet geography) + GamePhaserLayer (decorative overlay) + the DOM
// panels into the full MVP loop from TZ.md §16.
export class HudRoot {
  private readonly client: GameClient;
  private readonly mapView: MapView;
  private readonly phaserLayer: GamePhaserLayer;

  private readonly debugToggle: DebugModeToggle;
  private readonly homePanel: HomeClaimPanel;
  private readonly biomePanel: BiomePanel;
  private readonly inventoryPanel: InventoryPanel;
  private readonly craftingPanel: CraftingPanel;
  private readonly labPanel: LabPanel;

  private currentHome: LaboratoryHome | null = null;
  private hasCenteredOnce = false;
  private lastCenter: { lat: number; lng: number } | null = null;

  private constructor(uiRootEl: HTMLElement, mapContainerId: string, phaserContainerId: string, client: GameClient, initialHome: LaboratoryHome | undefined) {
    this.client = client;
    this.currentHome = initialHome ?? null;

    this.mapView = new MapView(mapContainerId, {
      onMapClick: (lat, lng) => {
        if (this.client.getMode() === 'debug') {
          this.client.setDebugPosition(lat, lng);
          void this.refresh();
        }
      },
    });
    this.phaserLayer = new GamePhaserLayer(phaserContainerId);
    this.mapView.onMove(() => this.phaserLayer.syncGlowToPosition(this.mapView, this.lastCenter));

    this.debugToggle = new DebugModeToggle(client.getMode(), () => void this.refresh());
    this.homePanel = new HomeClaimPanel(
      () => void this.handleClaim(),
      () => void this.handleTransfer()
    );
    this.biomePanel = new BiomePanel();
    this.inventoryPanel = new InventoryPanel(() => void this.handleCollect());
    this.craftingPanel = new CraftingPanel((materialIds) => void this.handleCraft(materialIds));
    this.labPanel = new LabPanel(
      (medicineId, ratId) => void this.handleTest(medicineId, ratId),
      (medicineId) => void this.handleApply(medicineId)
    );

    for (const panel of [this.debugToggle, this.homePanel, this.biomePanel, this.inventoryPanel, this.craftingPanel, this.labPanel]) {
      uiRootEl.appendChild(panel.element);
    }
  }

  static async mount(uiRootId: string, mapContainerId: string, phaserContainerId: string): Promise<HudRoot> {
    const uiRootEl = document.getElementById(uiRootId);
    if (!uiRootEl) throw new Error(`#${uiRootId} not found`);

    const client = new GameClient();
    const session = await client.init();

    const hud = new HudRoot(uiRootEl, mapContainerId, phaserContainerId, client, session.home);
    await hud.refreshInventoryAndLab();
    setInterval(() => void hud.refresh(), POLL_INTERVAL_MS);
    return hud;
  }

  private async refresh(): Promise<void> {
    let layers: Awaited<ReturnType<GameClient['getMapLayers']>>;
    try {
      layers = await this.client.getMapLayers();
    } catch (err) {
      this.debugToggle.setStatus(`Position unavailable: ${HudRoot.describeError(err)}`);
      return;
    }
    if (typeof layers === 'string') {
      this.debugToggle.setStatus(`Position unavailable: ${layers}`);
      return;
    }

    this.lastCenter = layers.playerHexCell.center;
    this.mapView.showPlayerPosition(layers.playerHexCell.center.lat, layers.playerHexCell.center.lng);
    if (!this.hasCenteredOnce) {
      this.mapView.centerOn(layers.playerHexCell.center.lat, layers.playerHexCell.center.lng);
      this.hasCenteredOnce = true;
    }
    this.mapView.showHexCluster(layers.biome.hexCellIds, layers.playerHexCell.id);
    this.mapView.showHomes(layers.nearbyHomes, this.client.currentPlayerId);
    this.phaserLayer.syncGlowToPosition(this.mapView, layers.playerHexCell.center);

    this.biomePanel.update(layers.biome);
    this.homePanel.update({ currentHexCellId: layers.playerHexCell.id, home: this.currentHome });
  }

  private async refreshInventoryAndLab(): Promise<void> {
    const [inventory, rats] = await Promise.all([this.client.getInventory(), this.client.getRats()]);
    this.inventoryPanel.update(inventory);
    this.craftingPanel.update(inventory);
    this.labPanel.update(rats, inventory);
  }

  private static describeError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private async handleClaim(): Promise<void> {
    try {
      const result = await this.client.claimHome();
      if (typeof result === 'string') {
        this.homePanel.update({ currentHexCellId: null, home: this.currentHome, message: `Claim failed: ${result}` });
        return;
      }
      this.currentHome = result;
      await this.refresh();
    } catch (err) {
      this.homePanel.update({ currentHexCellId: null, home: this.currentHome, message: `Claim failed: ${HudRoot.describeError(err)}` });
    }
  }

  private async handleTransfer(): Promise<void> {
    try {
      const result = await this.client.transferHome();
      if (typeof result === 'string') {
        this.homePanel.update({ currentHexCellId: null, home: this.currentHome, message: `Transfer failed: ${result}` });
        return;
      }
      this.currentHome = result;
      await this.refresh();
    } catch (err) {
      this.homePanel.update({ currentHexCellId: null, home: this.currentHome, message: `Transfer failed: ${HudRoot.describeError(err)}` });
    }
  }

  private async handleCollect(): Promise<void> {
    try {
      const result = await this.client.collectMaterial();
      if (typeof result === 'string') {
        this.craftingPanel.setMessage(`Collect failed: ${result}`);
        return;
      }
      if (this.lastCenter) this.phaserLayer.playCollectBurst(this.mapView, this.lastCenter.lat, this.lastCenter.lng);
      await this.refreshInventoryAndLab();
    } catch (err) {
      this.craftingPanel.setMessage(`Collect failed: ${HudRoot.describeError(err)}`);
    }
  }

  private async handleCraft(materialIds: string[]): Promise<void> {
    try {
      const result = await this.client.craftMedicine(materialIds);
      if (typeof result === 'string') {
        this.craftingPanel.setMessage(`Craft failed: ${result}`);
        return;
      }
      this.craftingPanel.setMessage(`Crafted ${result.name} (success chance was ${Math.round(result.successChance * 100)}%).`);
      await this.refreshInventoryAndLab();
    } catch (err) {
      this.craftingPanel.setMessage(`Craft failed: ${HudRoot.describeError(err)}`);
    }
  }

  private async handleTest(medicineId: string, ratId: string): Promise<void> {
    const result = await this.client.testMedicineOnRat(medicineId, ratId);
    if (typeof result === 'string') {
      this.labPanel.setMessage(`Test failed: ${result}`);
      return;
    }
    this.labPanel.setMessage(
      result.revealedEffect
        ? `Revealed effect: ${result.revealedEffect.key} (power ${result.revealedEffect.power}). Rat ${result.ratAlive ? 'survived' : 'died'}.`
        : 'No new effects left to reveal.'
    );
    await this.refreshInventoryAndLab();
  }

  private async handleApply(medicineId: string): Promise<void> {
    const result = await this.client.applyMedicine(medicineId);
    if (typeof result === 'string') {
      this.labPanel.setMessage(`Apply failed: ${result}`);
      return;
    }
    const stateSummary = result.playerState.states.map((s) => `${s.key}=${Math.round(s.value)}`).join(', ');
    this.labPanel.setMessage(`Applied ${result.appliedEffects.length} effects. State: ${stateSummary}`);
    await this.refreshInventoryAndLab();
  }
}
