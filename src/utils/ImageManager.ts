import * as config from "../config";

export class ImageManager {
  private static instance: ImageManager;
  private images: Map<string, HTMLImageElement>;
  private loadingPromises: Map<string, Promise<void>>;
  private inventoryItemTextures: Partial<
    Record<config.InventoryItemID, HTMLImageElement>
  > = {};
  private playerTextures: Record<config.WeaponType, HTMLImageElement | null> = {
    blaster: null,
    shotgun: null,
    railgun: null,
    rocket_launcher: null,
  };

  private constructor() {
    this.images = new Map();
    this.loadingPromises = new Map();
  }

  static getInstance(): ImageManager {
    if (!ImageManager.instance) {
      ImageManager.instance = new ImageManager();
    }
    return ImageManager.instance;
  }

  async loadImage(imagePath: string): Promise<HTMLImageElement> {
    if (this.images.has(imagePath)) {
      return this.images.get(imagePath)!;
    }

    if (this.loadingPromises.has(imagePath)) {
      await this.loadingPromises.get(imagePath);
      return this.images.get(imagePath)!;
    }

    const loadingPromise = new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = imagePath;
      img.onload = () => {
        this.images.set(imagePath, img);
        resolve();
      };
      img.onerror = () => {
        reject(new Error(`Failed to load image: ${imagePath}`));
      };
    });

    this.loadingPromises.set(imagePath, loadingPromise);
    await loadingPromise;
    this.loadingPromises.delete(imagePath);
    return this.images.get(imagePath)!;
  }

  getImage(imagePath: string): HTMLImageElement | undefined {
    return this.images.get(imagePath);
  }

  async loadPlayerTextures(): Promise<void> {
    await Promise.all(
      Object.entries(config.PLAYER_TEXTURE_BY_WEAPON_TYPE).map(
        async ([weaponType, texturePath]) => {
          this.playerTextures[weaponType as config.WeaponType] =
            await this.loadImage(texturePath);
        },
      ),
    );
  }

  getPlayerTexture(type: config.WeaponType): HTMLImageElement | null {
    return this.playerTextures[type] ?? null;
  }

  async loadInventoryTextures(): Promise<void> {
    await Promise.all(
      Object.entries(config.INVENTORY_ITEM_TEXTURES).map(
        async ([key, texturePath]) => {
          this.inventoryItemTextures[Number(key) as config.InventoryItemID] =
            await this.loadImage(texturePath);
        },
      ),
    );
  }

  getInventoryTexture(type: config.InventoryItemID): HTMLImageElement | null {
    return this.inventoryItemTextures[type] ?? null;
  }
}
