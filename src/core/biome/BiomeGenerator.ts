export interface Biome {
  type: string;
  flora: string[];
  fauna: string[];
  resources: any[];
}

export class BiomeGenerator {
  generateBiomes(centerLat: number, centerLng: number, radius: number) {
    // TODO: Real generation based on Turkmenistan map
    return [
      { type: 'desert', flora: ['date palm'], fauna: ['camel spider'] },
      { type: 'steppe', flora: ['sagebrush'], fauna: ['saiga'] }
    ];
  }
}