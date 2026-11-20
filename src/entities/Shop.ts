import { IWorld } from "../types/IWorld";
import { IShop } from "../types/screen-objects/IShop";
import {
  Shop as ShopMessage,
  ShopItem,
  ShopUpdate,
} from "../types/socketEvents";
import { Point2D } from "../utils/geometry/Point2D";
import { ScreenObject } from "./ScreenObject";
import * as config from "../config";
import { viewport } from "../utils/Viewport";
import { AudioManager } from "../utils/AudioManager";
import { ImageManager } from "../utils/ImageManager";

export class Shop extends ScreenObject implements IShop {
  private _image: HTMLImageElement | null = null;
  private _layoutImage: HTMLImageElement | null = null;
  private _inventory: Record<number, ShopItem> = {};
  private _isEnteredByPlayer: boolean = false;
  private _modalOpen: boolean = false;
  private _name: string = "";

  constructor(
    private world: IWorld,
    shopData: ShopMessage,
  ) {
    const point = new Point2D(shopData.position!.x, shopData.position!.y);
    super(point, config.SHOP_SIZE, config.SHOP_SIZE, shopData.id);

    this._inventory = shopData.inventory || {};
    this._name = shopData.name;

    // Load player sprite
    const imageManager = ImageManager.getInstance();
    void imageManager.loadImage(config.TEXTURES.SHOP).then((img) => {
      this._image = img;
    });

    void imageManager.loadImage(config.TEXTURES.SHOP_LAYOUT).then((img) => {
      this._layoutImage = img;
    });
  }

  handlePlayerEnter(): void {
    if (this._isEnteredByPlayer) {
      return;
    }

    this._isEnteredByPlayer = true;
    AudioManager.getInstance().playSound(config.SOUNDS.ENTER_SHOP);
  }

  handlePlayerExit(): void {
    this._isEnteredByPlayer = false;
    this._modalOpen = false;
  }

  hasPlayer(): boolean {
    return this._isEnteredByPlayer;
  }

  openModal(): void {
    this._modalOpen = !this._modalOpen;
  }

  closeModal(): void {
    this._modalOpen = false;
  }

  get inventory(): Record<number, ShopItem> {
    return this._inventory;
  }

  get isModalOpen(): boolean {
    return this._modalOpen;
  }

  draw(ctx: CanvasRenderingContext2D, uiCtx: CanvasRenderingContext2D): void {
    if (!this._image || !this.world.player || this.world.gameOver) {
      return;
    }

    const player = this.world.player;
    const distance = this.getPosition().distanceTo(player.getPosition());
    let shouldDraw =
      (distance <= this.world.torchRadius + this.width ||
        player.hasNightVision()) &&
      !this.world.gameOver;

    for (const otherPlayer of this.world.otherPlayers) {
      if (otherPlayer.hasNightVision()) {
        continue;
      }

      const distToOther = this.getPosition().distanceTo(
        otherPlayer.getPosition(),
      );
      if (distToOther <= this.world.torchRadius + this.width) {
        shouldDraw = true;
        break;
      }
    }

    if (!shouldDraw) {
      return;
    }

    const screenPoint = this.world.worldToScreenCoordinates(this.getPosition());

    ctx.save();
    ctx.translate(screenPoint.x, screenPoint.y);

    ctx.drawImage(
      this._image,
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
    );

    // Set font first to measure text
    ctx.font = `14px ${config.FONT_NAME}`;
    const textMetrics = ctx.measureText(this._name);

    // Draw background
    const padding = 3;
    const bgWidth = textMetrics.width + padding * 2;
    const bgHeight = textMetrics.actualBoundingBoxAscent + padding * 2; // Font size + padding

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(-bgWidth / 2, this.height / 2 + 30, bgWidth, bgHeight);

    // Write nickname
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(
      this._name,
      0,
      this.height / 2 + 30 + textMetrics.actualBoundingBoxAscent + padding,
    );

    ctx.restore();

    if (this.world.debug) {
      uiCtx.save();
      uiCtx.translate(screenPoint.x, screenPoint.y);
      uiCtx.strokeStyle = "turquoise";
      uiCtx.strokeRect(
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height,
      );
      uiCtx.restore();
    }
  }

  drawUI(uiCtx: CanvasRenderingContext2D): void {
    if (!this._isEnteredByPlayer) {
      return;
    }

    if (!this._modalOpen) {
      uiCtx.save();

      // Draw hint to open shop modal on Enter key
      uiCtx.fillStyle = "white";
      uiCtx.textAlign = "center";
      uiCtx.font = `14px ${config.FONT_NAME}`;
      uiCtx.fillText(
        "Press Enter to visit the Shop",
        viewport.width / 2,
        viewport.height - config.MESSAGE_PADDING_BOTTOM,
      );
      uiCtx.restore();
    } else if (this._layoutImage) {
      this.drawModal(uiCtx, this._layoutImage);
    }
  }

  // The window and its legend form one block, drawn in unscaled block
  // coordinates and scaled down (never up) to fit the free space: below a
  // padding at the top and above the inventory panel when it is shown.
  private drawModal(
    uiCtx: CanvasRenderingContext2D,
    layoutImage: HTMLImageElement,
  ): void {
    const modalWidth = layoutImage.width;
    const modalHeight = layoutImage.height;
    const legendTop = modalHeight + config.SHOP_MODAL_LEGEND_GAP;
    const legendHeight =
      config.SHOP_MODAL_LEGEND_LINE_HEIGHT * 3 +
      config.SHOP_MODAL_LEGEND_PADDING * 2;
    const blockWidth = Math.max(modalWidth, config.SHOP_MODAL_LEGEND_WIDTH);
    const blockHeight = legendTop + legendHeight;

    const padding = config.SHOP_MODAL_SCREEN_PADDING;
    const freeBottom = this.world.player?.inventoryPanelTop ?? viewport.height;
    const freeWidth = viewport.width - padding * 2;
    const freeHeight = freeBottom - padding * 2;
    if (freeWidth <= 0 || freeHeight <= 0) {
      return;
    }
    const scale = Math.min(1, freeWidth / blockWidth, freeHeight / blockHeight);

    uiCtx.save();
    // Centred in the free space
    uiCtx.translate(
      (viewport.width - blockWidth * scale) / 2,
      padding + (freeHeight - blockHeight * scale) / 2,
    );
    uiCtx.scale(scale, scale);

    const modalX = (blockWidth - modalWidth) / 2;
    const modalY = 0;
    uiCtx.drawImage(layoutImage, modalX, modalY, modalWidth, modalHeight);

    // Draw instructions background
    uiCtx.fillStyle = "rgba(0, 0, 0, 0.5)";
    uiCtx.fillRect(
      (blockWidth - config.SHOP_MODAL_LEGEND_WIDTH) / 2,
      legendTop,
      config.SHOP_MODAL_LEGEND_WIDTH,
      legendHeight,
    );

    const purchaseKeyCount = Object.values(this._inventory).filter(
      (item) => item.quantity > 0,
    ).length;

    const hint =
      purchaseKeyCount > 9
        ? `Press buttons from 1 through 9 and 0 to make a purchase.`
        : purchaseKeyCount === 0
          ? "No items available for purchase."
          : purchaseKeyCount === 1
            ? "Press button 1 to make a purchase."
            : `Press button from 1 through ${purchaseKeyCount} to make a purchase.`;

    // Draw instructions text, one per legend row (baselines a little above
    // each row's bottom)
    const legendCenterX = blockWidth / 2;
    const firstBaseline =
      legendTop +
      config.SHOP_MODAL_LEGEND_PADDING +
      config.SHOP_MODAL_LEGEND_LINE_HEIGHT -
      6;
    uiCtx.fillStyle = "white";
    uiCtx.textAlign = "center";
    uiCtx.font = `14px ${config.FONT_NAME}`;
    uiCtx.fillText(
      "🟨 - available, 🟥 - not enough money, 🟩 - already owned",
      legendCenterX,
      firstBaseline,
    );
    uiCtx.fillText(
      hint,
      legendCenterX,
      firstBaseline + config.SHOP_MODAL_LEGEND_LINE_HEIGHT,
    );
    uiCtx.fillText(
      "Press Escape to close the Shop.",
      legendCenterX,
      firstBaseline + config.SHOP_MODAL_LEGEND_LINE_HEIGHT * 2,
    );

    // Draw inventory items
    const startX = modalX + 148;
    const startY = modalY + 72;
    const itemSpacingY = 53;
    let index = 0;

    uiCtx.save();
    uiCtx.fillStyle = "#f7e78cff";
    uiCtx.font = `20px ${config.FONT_NAME}`;

    uiCtx.textAlign = "center";
    // Add text shadow for better visibility
    uiCtx.shadowColor = "black";
    uiCtx.shadowOffsetX = 2;
    uiCtx.shadowOffsetY = 2;
    uiCtx.shadowBlur = 4;

    uiCtx.fillText("Item", startX + 28, startY - 20);
    uiCtx.fillText("Pack Size", startX + 140, startY - 20);
    uiCtx.fillText("Price", startX + 290, startY - 20);
    uiCtx.fillText("Stock", startX + 400, startY - 20);

    uiCtx.restore();

    for (const [type, item] of Object.entries(this._inventory)) {
      if (item.quantity <= 0) {
        continue;
      }

      const itemX = startX;
      const itemY = startY + index * itemSpacingY;

      // Draw item icon
      const imageManager = ImageManager.getInstance();
      const icon = imageManager.getInventoryTexture(
        Number(type) as config.InventoryItemID,
      );
      if (icon) {
        uiCtx.drawImage(
          icon,
          itemX - icon.width / 2 + itemSpacingY / 2,
          itemY - icon.height / 2 + itemSpacingY / 2,
          icon.width,
          icon.height,
        );
      }

      uiCtx.save();
      uiCtx.fillStyle = "#f7e78c";

      const player = this.world.player;
      const itemId = Number(type) as config.InventoryItemID;
      const isWeapon = Object.values(
        config.WEAPON_INVENTORY_ID_BY_WEAPON_TYPE,
      ).includes(itemId);

      if (player && player.money < item.price * item.packSize) {
        uiCtx.fillStyle = "#ff4d4d";
      }

      if (isWeapon && player?.hasInventoryItem(itemId)) {
        uiCtx.fillStyle = "#4dff4d";
      }

      uiCtx.font = `20px ${config.FONT_NAME}`;

      uiCtx.textAlign = "right";
      // Add text shadow for better visibility
      uiCtx.shadowColor = "black";
      uiCtx.shadowOffsetX = 2;
      uiCtx.shadowOffsetY = 2;
      uiCtx.shadowBlur = 4;

      // Draw pack size
      uiCtx.fillText(
        `${item.packSize}`,
        itemX + 174,
        itemY + itemSpacingY / 2 + 5,
      );

      // Draw item price
      uiCtx.fillText(
        `$${item.price * item.packSize}`,
        itemX + 328,
        itemY + itemSpacingY / 2 + 5,
      );

      // Draw item stock
      uiCtx.fillText(
        `${item.quantity}`,
        itemX + 418,
        itemY + itemSpacingY / 2 + 5,
      );

      // Draw purchase button hint
      uiCtx.fillText(
        `${(index + 1) % 10}`,
        itemX - 10,
        itemY + itemSpacingY / 2 + 5,
      );

      uiCtx.restore();

      index++;
    }

    // Undo the block's translate and scale
    uiCtx.restore();
  }

  applyFromGameStateDelta(shopData: ShopUpdate): void {
    this._inventory = shopData.inventory || {};
  }
}
