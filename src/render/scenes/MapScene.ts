// Обновлённый MapScene с поддержкой дома
export class MapScene extends Phaser.Scene {
  private leafletMap: any;
  private playerMarker: any;
  private homeMarker: any;

  create() {
    // Leaflet интеграция + Phaser overlay
    this.add.text(10, 10, 'Карта Туркменистана - Система дома', { fontSize: '20px' });

    // Пример claim
    const homeBtn = this.add.text(10, 50, 'Claim Home (100м)', { fontSize: '18px', backgroundColor: '#fff' })
      .setInteractive()
      .on('pointerdown', () => {
        // Вызов claim
        console.log('Claiming home at current position');
      });
  }
}
