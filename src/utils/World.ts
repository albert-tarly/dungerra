import * as config from "../config";
import { viewport } from "./Viewport";
import { IEnemy, IEnemyFactory } from "../types/screen-objects/IEnemy";
import { IPlayerFactory } from "../types/screen-objects/IPlayer";
import { IPlayer } from "../types/screen-objects/IPlayer";
import { IBonusFactory } from "../types/screen-objects/IBonus";
import { IBonus } from "../types/screen-objects/IBonus";
import { IWallFactory } from "../types/screen-objects/IWall";
import { IWall } from "../types/screen-objects/IWall";
import { IChunk } from "../types/screen-objects/IChunk";
import { IPoint } from "../types/geometry/IPoint";
import { IWorld } from "../types/IWorld";
import { Point2D } from "./geometry/Point2D";
import { AudioManager } from "./AudioManager";
import { SessionManager } from "../api/SessionManager";
import { Player as PlayerMessage } from "../types/socketEvents";
import {
  IOtherPlayer,
  IOtherPlayerFactory,
} from "../types/screen-objects/IOtherPlayer";
import { InputMessage, GameStateDeltaMessage } from "../types/socketEvents";
import {
  IBulletManager,
  IBulletManagerFactory,
} from "../types/screen-objects/IBulletManager";
import { IShop, IShopFactory } from "../types/screen-objects/IShop";
import { ImageManager } from "./ImageManager";
import { IRay, IRayFactory } from "../types/screen-objects/IRay";
import { angleDifference } from "./angleDifference";
import { EntityCollection } from "./EntityCollection";
import { serverClock } from "./ServerClock";
import { IScreenObject } from "../types/screen-objects/IScreenObject";

// Compares two pressed-key maps without serialising them every frame
function sameKeySet(
  a: Record<number, boolean>,
  b: Record<number, boolean>,
): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) {
    return false;
  }
  for (const key of aKeys) {
    if (a[Number(key)] !== b[Number(key)]) {
      return false;
    }
  }
  return true;
}

export class World implements IWorld {
  private readonly CHUNK_SIZE = 2000; // Same as screen width for now
  private _player: IPlayer | null = null;
  private _otherPlayers: Record<string, IOtherPlayer> = {};
  private _otherPlayerCoordinates: Record<string, IPoint> = {};

  // Indexed by ID: deltas look entities up by ID many times per update
  private _enemies = new EntityCollection<IEnemy>();
  private _walls = new EntityCollection<IWall>();
  private _bonuses = new EntityCollection<IBonus>();
  private _shops = new EntityCollection<IShop>();
  private _rays = new EntityCollection<IRay>();

  // Server time (ms) of the delta being applied, and the server time the
  // world is currently drawn at; see INTERPOLATION_DELAY_MS
  private _snapshotTime: number = serverClock.now();
  private _renderTime: number = serverClock.now();
  // Torch points of the players whose light reveals things, per frame
  private _torchPoints: IPoint[] = [];

  private _gameOver: boolean = false;

  private floorTexture: HTMLImageElement | null = null;

  private chunks = new Map<string, IChunk>();
  private _cameraPoint: IPoint = new Point2D(0, 0);
  private _torchRadius: number = config.TORCH_RADIUS;
  private _debug = false;

  private _sessionManager = SessionManager.getInstance();
  private _bulletManager: IBulletManager;
  private _lastChangesetTimestamp: number = 0;
  private _bonusPickupCache = new Set<string>();

  private _previousInputState: InputMessage = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    shoot: false,
    itemKey: {},
    purchaseItemKey: {},
  };
  private _inputStateSubmitTimestamp: number = 0;
  // Cursor position in canvas pixels; null until the mouse first moves
  private _aimScreenPoint: { x: number; y: number } | null = null;
  // Last aim angle in degrees, kept when the cursor enters the dead zone
  private _aimRotation: number | undefined = undefined;

  get debug(): boolean {
    return this._debug;
  }

  toggleDebug(): void {
    this._debug = !this._debug;
  }

  get gameOver(): boolean {
    return this._gameOver;
  }

  get player(): IPlayer | null {
    return this._player;
  }

  get otherPlayers(): IOtherPlayer[] {
    return Object.values(this._otherPlayers);
  }

  getOtherPlayerById(id: string): IOtherPlayer | null {
    return this._otherPlayers[id] || null;
  }

  get walls(): IWall[] {
    return this._walls.list;
  }

  get enemies(): IEnemy[] {
    return this._enemies.list;
  }

  get bonuses(): IBonus[] {
    return this._bonuses.list;
  }

  get shops(): IShop[] {
    return this._shops.list;
  }

  get rays(): IRay[] {
    return this._rays.list;
  }

  get snapshotTime(): number {
    return this._snapshotTime;
  }

  get renderTime(): number {
    return this._renderTime;
  }

  isLitByTorch(point: IPoint, padding: number): boolean {
    const maxDistance = this._torchRadius + padding;
    for (const torchPoint of this._torchPoints) {
      if (point.distanceTo(torchPoint) <= maxDistance) {
        return true;
      }
    }
    return false;
  }

  // Same lights as the old per-enemy check: the current player's torch, plus
  // living other players without night vision
  private updateTorchPoints(): void {
    this._torchPoints = [];
    if (!this._player) {
      return;
    }
    this._torchPoints.push(this._player.getTorchPoint());
    for (const otherPlayer of Object.values(this._otherPlayers)) {
      if (otherPlayer.isAlive() && !otherPlayer.hasNightVision()) {
        this._torchPoints.push(otherPlayer.getTorchPoint());
      }
    }
  }

  // Whether an object is in or near the view; far objects are not drawn
  private isNearView(object: IScreenObject): boolean {
    const halfWidth = viewport.width / 2 + config.DRAW_CULL_MARGIN;
    const halfHeight = viewport.height / 2 + config.DRAW_CULL_MARGIN;
    // Cheap reject on the anchor point before building the collision rect
    const reach = object.width + object.height;
    if (
      Math.abs(object.x - this._cameraPoint.x) > halfWidth + reach ||
      Math.abs(object.y - this._cameraPoint.y) > halfHeight + reach
    ) {
      return false;
    }
    const rect = object.getCollisionRect();
    return (
      rect.left <= this._cameraPoint.x + halfWidth &&
      rect.left + rect.width >= this._cameraPoint.x - halfWidth &&
      rect.top <= this._cameraPoint.y + halfHeight &&
      rect.top + rect.height >= this._cameraPoint.y - halfHeight
    );
  }

  get cameraPoint(): IPoint {
    return this._cameraPoint;
  }

  get torchRadius(): number {
    return this._torchRadius;
  }

  get multiplayerMode(): "host" | "guest" {
    return this._multiplayerMode;
  }

  constructor(
    private _Player: IPlayerFactory,
    private _Enemy: IEnemyFactory,
    private _Wall: IWallFactory,
    private _Bonus: IBonusFactory,
    private _OtherPlayer: IOtherPlayerFactory,
    private _Shop: IShopFactory,
    private _Ray: IRayFactory,
    private _BulletManager: IBulletManagerFactory,
    private _multiplayerMode: "host" | "guest",
  ) {
    // Load sounds
    const audioManager = AudioManager.getInstance();
    void audioManager.loadSound(config.SOUNDS.TORCH).then(() => {
      // Start playing torch sound in a loop
      audioManager.playSound(config.SOUNDS.TORCH, { volume: 1, loop: true });
    });

    // Load floor texture
    const imageManager = ImageManager.getInstance();
    void imageManager.loadImage(config.TEXTURES.FLOOR).then((img) => {
      this.floorTexture = img;
    });

    this._bulletManager = new this._BulletManager(this);
  }

  addOtherPlayer(player: PlayerMessage): void {
    const otherPlayer = new this._OtherPlayer(this, player);

    this._otherPlayers[player.id] = otherPlayer;
  }

  removeOtherPlayer(playerId: string): void {
    delete this._otherPlayers[playerId];
  }

  private getChunkLeftTop(worldPoint: IPoint): IPoint {
    return new Point2D(
      Math.floor(worldPoint.x / this.CHUNK_SIZE),
      Math.floor(worldPoint.y / this.CHUNK_SIZE),
    );
  }

  update(dt: number): void {
    if (this.gameOver) return;

    // Everything is drawn slightly in the past so there is usually a newer
    // server update to blend toward
    this._renderTime = serverClock.now() - config.INTERPOLATION_DELAY_MS;

    // Update player
    if (this._player) {
      this._player.update(dt);

      // Update camera position
      this._cameraPoint.setToPointCoordinates(this._player.getPosition());
    }

    for (const otherPlayer of Object.values(this._otherPlayers)) {
      otherPlayer.update(dt);
    }

    for (const enemy of this._enemies.list) {
      enemy.update(dt);
    }

    for (const ray of this._rays.list) {
      ray.update(dt);
    }

    this._bulletManager.update(dt);
  }

  endGame(): void {
    if (!this._gameOver) {
      this._gameOver = true;
      AudioManager.getInstance().playSound(config.SOUNDS.GAME_OVER, {
        when: 1.5,
      });
    }
  }

  drawFloor(ctx: CanvasRenderingContext2D): void {
    // Draw floor texture
    if (this.floorTexture) {
      const resultingFloorWidth = this.floorTexture.width / 2;
      const resultingFloorHeight = this.floorTexture.height / 2;

      const textureX =
        (this.cameraPoint.x % resultingFloorWidth) - resultingFloorWidth;
      const textureY =
        (this.cameraPoint.y % resultingFloorHeight) - resultingFloorHeight;

      for (
        let y = -viewport.height / resultingFloorHeight - 1;
        y < viewport.height / resultingFloorHeight + 2;
        y++
      ) {
        for (
          let x = -viewport.width / resultingFloorWidth - 1;
          x < viewport.width / resultingFloorWidth + 2;
          x++
        ) {
          ctx.drawImage(
            this.floorTexture,
            -textureX - x * resultingFloorWidth,
            -textureY - y * resultingFloorHeight,
            resultingFloorWidth,
            resultingFloorHeight,
          );
        }
      }
    }

    // Draw neighboring chunk boundaries for debugging
    if (this.debug) {
      const chunkLeftTop = this.getChunkLeftTop(this.cameraPoint);

      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 1;

      for (let y = -1; y <= 1; y++) {
        for (let x = -1; x <= 1; x++) {
          const chunkX = (chunkLeftTop.x + x) * this.CHUNK_SIZE;
          const chunkY = (chunkLeftTop.y + y) * this.CHUNK_SIZE;

          const screenPoint = this.worldToScreenCoordinates(
            new Point2D(chunkX, chunkY),
          );

          ctx.strokeRect(
            screenPoint.x,
            screenPoint.y,
            this.CHUNK_SIZE,
            this.CHUNK_SIZE,
          );

          // Draw diagonals
          ctx.beginPath();
          ctx.moveTo(screenPoint.x, screenPoint.y);
          ctx.lineTo(
            screenPoint.x + this.CHUNK_SIZE,
            screenPoint.y + this.CHUNK_SIZE,
          );
          ctx.moveTo(screenPoint.x + this.CHUNK_SIZE, screenPoint.y);
          ctx.lineTo(screenPoint.x, screenPoint.y + this.CHUNK_SIZE);
          ctx.closePath();
          ctx.stroke();
        }
      }
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    lightCtx: CanvasRenderingContext2D,
    uiCtx: CanvasRenderingContext2D,
  ): void {
    // Game.draw has already cleared all canvases

    this.updateTorchPoints();

    this.drawFloor(ctx);

    // The client keeps 3×3 chunks of objects but the view shows about one
    // chunk, so most walls, enemies and shops are skipped here

    // Draw shops
    for (const shop of this._shops.list) {
      if (this.isNearView(shop)) {
        shop.draw(ctx, uiCtx);
      }
    }

    // Draw walls
    for (const wall of this._walls.list) {
      if (this.isNearView(wall)) {
        wall.draw(ctx, uiCtx);
      }
    }

    // Draw enemies
    for (const enemy of this._enemies.list) {
      if (this.isNearView(enemy)) {
        enemy.draw(ctx, uiCtx);
      }
    }

    Object.values(this._otherPlayers).forEach((otherPlayer) => {
      otherPlayer.draw(ctx, uiCtx);
    });

    // Draw bonuses
    for (const bonus of this._bonuses.list) {
      if (this.isNearView(bonus)) {
        bonus.draw(ctx, uiCtx);
      }
    }

    // Draw player
    if (this._player) {
      this._player.draw(ctx, uiCtx);
    }

    // Draw rays (lines may cross the view from far away, so not culled)
    this._rays.list.forEach((ray) => ray.draw(ctx, uiCtx));

    // Draw bullets
    this._bulletManager.draw(ctx, uiCtx);

    // Draw darkness overlay
    this.drawDarknessOverlay(lightCtx);

    // Draw UI
    this.drawUI(uiCtx);
  }

  private drawArrowToPoint(
    ctx: CanvasRenderingContext2D,
    point: IPoint,
    padding: number,
    color: string,
    fadeWhenOnScreen: boolean = false,
  ): void {
    const screenPoint = this.worldToScreenCoordinates(point);
    const isOnScreen =
      screenPoint.x >= 0 &&
      screenPoint.x <= viewport.width &&
      screenPoint.y >= 0 &&
      screenPoint.y <= viewport.height;

    if (isOnScreen && fadeWhenOnScreen) {
      return;
    }

    const centerScreenPoint = new Point2D(
      viewport.width / 2,
      viewport.height / 2,
    );
    const direction = screenPoint.subtracted(centerScreenPoint);
    const arrowLength = 10;

    const bonusRadius = padding;

    const distance = Math.sqrt(
      direction.x * direction.x + direction.y * direction.y,
    );
    const normalizedDirection = new Point2D(
      direction.x / distance,
      direction.y / distance,
    );
    const arrowEndPoint = new Point2D(
      centerScreenPoint.x +
        normalizedDirection.x *
          Math.min(distance - bonusRadius, viewport.width / 2 - arrowLength),
      centerScreenPoint.y +
        normalizedDirection.y *
          Math.min(distance - bonusRadius, viewport.height / 2 - arrowLength),
    );

    // Add a light bouncing animation to the arrow
    const time = Date.now() / 200;
    const bounceOffset = Math.sin(time) * 3;
    arrowEndPoint.moveBy(
      normalizedDirection.x * bounceOffset,
      normalizedDirection.y * bounceOffset,
    );

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    // Draw a triangle arrowhead
    ctx.beginPath();
    ctx.moveTo(arrowEndPoint.x, arrowEndPoint.y);
    ctx.lineTo(
      arrowEndPoint.x -
        normalizedDirection.x * arrowLength +
        normalizedDirection.y * (arrowLength / 3),
      arrowEndPoint.y -
        normalizedDirection.y * arrowLength -
        normalizedDirection.x * (arrowLength / 3),
    );
    ctx.lineTo(
      arrowEndPoint.x -
        normalizedDirection.x * arrowLength -
        normalizedDirection.y * (arrowLength / 3),
      arrowEndPoint.y -
        normalizedDirection.y * arrowLength +
        normalizedDirection.x * (arrowLength / 3),
    );
    ctx.lineTo(arrowEndPoint.x, arrowEndPoint.y);
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
  }

  private drawUI(ctx: CanvasRenderingContext2D): void {
    if (!this._player) {
      return;
    }

    if (!this.gameOver) {
      const playersBonuses = this._bonuses.list.filter(
        (bonus) => bonus.belongsToPlayer,
      );

      for (const bonus of playersBonuses) {
        // Draw a green arrow pointing to the bonus
        // If a bonus is off-screen, draw the arrow at the edge of the screen
        this.drawArrowToPoint(
          ctx,
          bonus.getPosition(),
          (bonus.width * Math.SQRT2) / 2 + 10,
          "lime",
        );
      }

      for (const position of Object.values(this._otherPlayerCoordinates)) {
        this.drawArrowToPoint(
          ctx,
          position,
          (config.PLAYER_SIZE * Math.SQRT2) / 2 + 10,
          "yellow",
          true,
        );
      }
    }

    ctx.textAlign = "left";

    if (this.gameOver) {
      ctx.fillStyle = "white";
      ctx.font = `48px ${config.HEADER_FONT_NAME}`;
      ctx.textAlign = "center";
      ctx.fillText("Game Over", viewport.width / 2, viewport.height / 2);
      ctx.font = `24px ${config.FONT_NAME}`;
      ctx.fillStyle = "yellow";
      ctx.fillText(
        `Your Posthumous Score: ${this._player.score.toFixed(0)}`,
        viewport.width / 2,
        viewport.height / 2 + 40,
      );
      ctx.fillStyle = "magenta";
      ctx.fillText(
        "Press R to Restart",
        viewport.width / 2,
        viewport.height / 2 + 80,
      );
    } else {
      ctx.fillStyle = "white";
      ctx.font = `16px ${config.FONT_NAME}`;
      ctx.fillText(
        `Lives: ${Array(Math.ceil(this._player.lives)).fill("❤️").join(" ")}`,
        10,
        25,
      );
      ctx.fillStyle = "yellow";
      ctx.fillText(`Money: ${this._player.money.toFixed(0)}$`, 10, 50);
      ctx.fillStyle = "white";
      ctx.fillText(`Score: ${this._player.score.toFixed(0)}`, 10, 75);
      ctx.fillStyle = "cyan";

      const symbol = config.BULLET_SYMBOL[this._player.selectedGunType];
      const bulletsLeft = this._player.bulletsLeft;
      const bulletsDisplay =
        bulletsLeft === 0
          ? "-"
          : bulletsLeft < 6
            ? Array(bulletsLeft).fill(symbol).join("")
            : `${symbol} x ${bulletsLeft}`;
      ctx.fillText(`Bullets: ${bulletsDisplay}`, 10, 100);
      if (this._player.hasNightVision()) {
        ctx.fillStyle = "#90ff90";
        ctx.fillText(
          `Night Vision: ${this._player.nightVisionTimer.toFixed(0)}`,
          10,
          125,
        );
      }
    }

    this._player.drawUI(ctx);

    this._shops.list.forEach((shop) => shop.drawUI(ctx));

    if (this.debug) {
      const worldObjectsCount =
        this._enemies.list.length +
        this._walls.list.length +
        this._bonuses.list.length +
        this._shops.list.length +
        this._rays.list.length +
        Object.values(this._otherPlayers).length +
        (this._player ? 1 : 0);

      ctx.fillStyle = "white";
      ctx.font = `12px ${config.FONT_NAME}`;
      ctx.fillText(
        `Chunk: ${this.getChunkLeftTop(this.cameraPoint)}`,
        10,
        viewport.height - 52,
      );
      ctx.fillText(
        `Number of world objects: ${worldObjectsCount}`,
        10,
        viewport.height - 66,
      );
      ctx.fillText(
        `Camera position: ${this.cameraPoint}`,
        10,
        viewport.height - 80,
      );
      ctx.fillText(
        `Number of chunks: ${this.chunks.size}`,
        10,
        viewport.height - 94,
      );
      ctx.fillText(
        `Host: ${this._sessionManager.getCurrentSession()?.host.username}`,
        10,
        viewport.height - 108,
      );
      ctx.fillText(
        `Session ID: ${this._sessionManager.getCurrentSession()?.id}`,
        10,
        viewport.height - 122,
      );
      ctx.fillText(
        `Session: ${this._sessionManager.getCurrentSession()?.name}`,
        10,
        viewport.height - 136,
      );
    }
  }

  private drawDarknessOverlay(ctx: CanvasRenderingContext2D): void {
    if (!this._player?.isAlive()) {
      ctx.fillStyle = config.COLOR_DARK;
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      return;
    }

    if (this._player.hasNightVision()) {
      ctx.fillStyle = this._player.isNightVisionFading()
        ? config.COLOR_NIGHT_VISION_FADING
        : config.COLOR_NIGHT_VISION;
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      return;
    }

    const torchRadius =
      this._torchRadius * 0.97 + Math.random() * this._torchRadius * 0.06;

    ctx.fillStyle = config.COLOR_DARK;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.globalCompositeOperation = "destination-out";

    // Same lights as isLitByTorch: this player (alive here) and living
    // others without night vision
    this._torchPoints.forEach((worldTorchPoint) => {
      const torchPoint = this.worldToScreenCoordinates(worldTorchPoint);

      const gradient = ctx.createRadialGradient(
        torchPoint.x,
        torchPoint.y,
        0,
        torchPoint.x,
        torchPoint.y,
        torchRadius,
      );
      gradient.addColorStop(0, config.COLOR_LIGHT);
      gradient.addColorStop(1, config.COLOR_TRANSPARENT);

      // The gradient is fully transparent beyond torchRadius, so filling just
      // its bounding square looks the same as filling the whole screen at a
      // fraction of the pixels. Filled twice on purpose: the light is the
      // result of two passes.
      ctx.fillStyle = gradient;
      const left = torchPoint.x - torchRadius;
      const top = torchPoint.y - torchRadius;
      const size = torchRadius * 2;
      ctx.fillRect(left, top, size, size);
      ctx.fillRect(left, top, size, size);
    });
    ctx.globalCompositeOperation = "source-over";
  }

  public worldToScreenCoordinates(point: IPoint): IPoint {
    return point.movedBy(
      viewport.width / 2 - this._cameraPoint.x,
      viewport.height / 2 - this._cameraPoint.y,
    );
  }

  setAimScreenPoint(x: number, y: number): void {
    this._aimScreenPoint = { x, y };
  }

  // Desired facing in degrees from the player toward the cursor, using the
  // server convention (0 = +Y, atan2(-dx, dy)). The camera keeps the player at
  // the screen centre and the world is never rotated, so screen offsets equal
  // world offsets.
  private computeAimRotation(): number | undefined {
    if (!this._aimScreenPoint) {
      return this._aimRotation;
    }
    const dx = this._aimScreenPoint.x - viewport.width / 2;
    const dy = this._aimScreenPoint.y - viewport.height / 2;
    if (Math.hypot(dx, dy) < config.AIM_DEAD_ZONE_PX) {
      return this._aimRotation;
    }
    const degrees = (Math.atan2(-dx, dy) * 180) / Math.PI;
    return (degrees + 360) % 360;
  }

  handleInput(keys: Set<string>, _dt: number): void {
    if (!this._player) {
      return;
    }

    const forward = keys.has("KeyW") || keys.has("ArrowUp");
    const backward = keys.has("KeyS") || keys.has("ArrowDown");
    const left = keys.has("KeyA") || keys.has("ArrowLeft");
    const right = keys.has("KeyD") || keys.has("ArrowRight");
    const shoot = keys.has("Space") || keys.has(config.MOUSE_SHOOT_KEY);
    const now = Date.now();

    const itemKey: Record<number, boolean> = {};
    const purchaseItemKey: Record<number, boolean> = {};
    for (let i = 0; i <= 9; i++) {
      if (keys.has(`Digit${i}`)) {
        const playerShop = this.shops.find(
          (shop) => shop.hasPlayer() && shop.isModalOpen,
        );

        if (playerShop) {
          const inventory = playerShop.inventory;
          // Digits 1..9 then 0 pick the 1st..10th item in stock
          const itemId = Object.keys(inventory).filter(
            (key) => inventory[Number(key)].quantity > 0,
          )[i === 0 ? 9 : i - 1];

          // A digit past the last item in stock buys nothing (this used to
          // send a NaN purchase key)
          if (itemId !== undefined) {
            purchaseItemKey[Number(itemId)] = true;
          }
        } else {
          itemKey[i] = true;
        }
      }
    }

    if (this._previousInputState) {
      for (const key of Object.keys(this._previousInputState.purchaseItemKey)) {
        if (!purchaseItemKey[Number(key)]) {
          this.handleShoppingAttempt(Number(key) as config.InventoryItemID);
        }
      }
    }

    const aimRotation = this.computeAimRotation();
    this._aimRotation = aimRotation;

    const keysChanged =
      forward !== this._previousInputState.forward ||
      backward !== this._previousInputState.backward ||
      left !== this._previousInputState.left ||
      right !== this._previousInputState.right ||
      shoot !== this._previousInputState.shoot ||
      !sameKeySet(itemKey, this._previousInputState.itemKey) ||
      !sameKeySet(purchaseItemKey, this._previousInputState.purchaseItemKey);

    // The mouse moves constantly, so aim-only updates are throttled
    const previousAim = this._previousInputState.aimRotation;
    const aimChanged =
      aimRotation !== undefined &&
      (previousAim === undefined ||
        angleDifference(aimRotation, previousAim) >=
          config.AIM_SEND_MIN_DELTA_DEG);
    const aimDue =
      aimChanged &&
      now - this._inputStateSubmitTimestamp >= config.AIM_SEND_INTERVAL_MS;

    if (keysChanged || aimDue || now - this._inputStateSubmitTimestamp > 1000) {
      const input: InputMessage = {
        forward,
        backward,
        left,
        right,
        shoot,
        itemKey,
        purchaseItemKey,
        aimRotation,
      };
      this._sessionManager.notifyInput(input);
      this._previousInputState = input;
      this._inputStateSubmitTimestamp = now;
    }
  }

  handleShoppingAttempt(itemId: config.InventoryItemID): void {
    const isWeapon = Object.values(
      config.WEAPON_INVENTORY_ID_BY_WEAPON_TYPE,
    ).includes(itemId);

    if (isWeapon && this._player?.hasInventoryItem(itemId)) {
      AudioManager.getInstance().playSound(config.SOUNDS.MISTAKE);
      return;
    }

    const playerShop = this.shops.find(
      (shop) => shop.hasPlayer() && shop.isModalOpen,
    );

    if (playerShop?.inventory[itemId]) {
      const item = playerShop.inventory[itemId];
      const totalPrice = item.price * item.packSize;

      if (this._player && this._player.money <= totalPrice) {
        AudioManager.getInstance().playSound(config.SOUNDS.MISTAKE);
      }
    }
  }

  restart(): void {
    this._sessionManager.notifyRespawn();
  }

  applyGameStateDelta(
    changeset: GameStateDeltaMessage,
    currentPlayerId: string,
  ): void {
    if (changeset.timestamp <= this._lastChangesetTimestamp) {
      console.log(
        `Ignoring out-of-order changeset. Last: ${this._lastChangesetTimestamp}, Received: ${changeset.timestamp}`,
        changeset,
      );
      return;
    }

    this._lastChangesetTimestamp = Number(changeset.timestamp);
    // Entities timestamp the poses and bullets in this delta with it
    this._snapshotTime = this._lastChangesetTimestamp;
    serverClock.observe(this._snapshotTime);
    const hadNoBullets = this._player ? this._player.bulletsLeft === 0 : false;

    for (const addedPlayer of Object.values(changeset.addedPlayers)) {
      if (addedPlayer.id === currentPlayerId) {
        this._player = this._Player.fromGameState(this, addedPlayer);
        continue;
      }

      if (!this._otherPlayers[addedPlayer.id]) {
        this.addOtherPlayer(addedPlayer);
      }
    }

    for (const [updatedPlayerId, updatedPlayer] of Object.entries(
      changeset.updatedPlayers,
    )) {
      if (updatedPlayerId === currentPlayerId) {
        if (updatedPlayer.lives?.isAlive && !this._player?.isAlive()) {
          const audioManager = AudioManager.getInstance();
          audioManager.playSound(config.SOUNDS.SPAWN);
          audioManager.stopSound(config.SOUNDS.GAME_OVER);
          this._gameOver = false;
        }

        this._player?.applyFromGameStateDelta(updatedPlayer);
        continue;
      }

      const otherPlayer = this._otherPlayers[updatedPlayerId];
      if (otherPlayer) {
        otherPlayer.applyFromGameStateDelta(updatedPlayer);
      }
    }

    for (const removedPlayerId of changeset.removedPlayers) {
      this.removeOtherPlayer(removedPlayerId);
    }

    for (const addedWall of Object.values(changeset.addedWalls)) {
      if (!this._walls.has(addedWall.id)) {
        this._walls.set(
          new this._Wall(
            this,
            new Point2D(addedWall.position!.x, addedWall.position!.y),
            addedWall.width,
            addedWall.height,
            addedWall.orientation as "horizontal" | "vertical",
            addedWall.id,
          ),
        );
      }
    }

    for (const removedWallId of changeset.removedWalls) {
      this._walls.delete(removedWallId);
    }

    for (const addedEnemy of Object.values(changeset.addedEnemies)) {
      const wall = addedEnemy.wallId
        ? this._walls.get(addedEnemy.wallId)
        : undefined;

      // Replaces an existing enemy with the same ID
      this._enemies.set(new this._Enemy(this, addedEnemy, wall));
    }

    for (const [updatedEnemyId, updatedEnemy] of Object.entries(
      changeset.updatedEnemies,
    )) {
      this._enemies.get(updatedEnemyId)?.applyFromGameStateDelta(updatedEnemy);
    }

    for (const removedEnemyId of changeset.removedEnemies) {
      this._enemies.delete(removedEnemyId);
    }

    for (const addedBonus of Object.values(changeset.addedBonuses)) {
      if (addedBonus.pickedUpBy) {
        continue;
      }

      if (!this._bonuses.has(addedBonus.id)) {
        this._bonuses.set(new this._Bonus(this, addedBonus));
      }
    }

    for (const [updatedBonusId, updatedBonus] of Object.entries(
      changeset.updatedBonuses,
    )) {
      if (updatedBonus.pickedUpBy) {
        this._bonuses.delete(updatedBonusId);
        if (
          updatedBonus.pickedUpBy === this._player?.id &&
          !this._bonusPickupCache.has(updatedBonusId)
        ) {
          AudioManager.getInstance().playSound(config.SOUNDS.BONUS_PICKUP);
          this._bonusPickupCache.add(updatedBonusId);
        }
      }
    }

    for (const removedBonusId of changeset.removedBonuses) {
      this._bonuses.delete(removedBonusId);
    }

    for (const addedBullet of Object.values(changeset.addedBullets)) {
      if (
        addedBullet.ownerId === this._player?.id &&
        hadNoBullets &&
        addedBullet.isJustSpawned &&
        this._player.bulletsLeft === 0 &&
        !this._bulletManager.hasSoundPlayedForBullet(addedBullet) &&
        !config.WEAPON_TYPES_LOADED_DIRECTLY_FROM_INVENTORY.includes(
          addedBullet.weaponType as config.WeaponType,
        )
      ) {
        // Player has just recharged their bullets
        AudioManager.getInstance().playSound(
          config.SOUNDS.PLAYER_BULLET_RECHARGE,
          { volume: 0.5 },
        );
      }

      this._bulletManager.applyFromGameState(addedBullet);
    }

    // Current servers leave this empty and bullets fly locally; older ones
    // still stream positions, which restart the local flight
    for (const [bulletId, bulletData] of Object.entries(
      changeset.updatedBullets,
    )) {
      this._bulletManager
        .getBulletById(bulletId)
        ?.rebase(bulletData.x, bulletData.y, this._snapshotTime);
    }

    for (const bulletData of Object.values(changeset.removedBullets)) {
      const bullet = this._bulletManager.getBulletById(bulletData.id);
      if (!bullet) {
        if (
          bulletData.ownerId === this._player?.id &&
          hadNoBullets &&
          this._player.bulletsLeft === 0 &&
          !this._bulletManager.hasSoundPlayedForBullet(bulletData) &&
          !config.WEAPON_TYPES_LOADED_DIRECTLY_FROM_INVENTORY.includes(
            bulletData.weaponType as config.WeaponType,
          )
        ) {
          // Player has just recharged their bullets
          AudioManager.getInstance().playSound(
            config.SOUNDS.PLAYER_BULLET_RECHARGE,
            { volume: 0.5 },
          );
        }
      }

      this._bulletManager.applyFromGameState(bulletData, true);
    }

    for (const addedShopData of Object.values(changeset.addedShops)) {
      if (!this._shops.has(addedShopData.id)) {
        this._shops.set(new this._Shop(this, addedShopData));
      }
    }

    for (const [updatedShopId, updatedShop] of Object.entries(
      changeset.updatedShops,
    )) {
      this._shops.get(updatedShopId)?.applyFromGameStateDelta(updatedShop);
    }

    for (const removedShopId of changeset.removedShops) {
      this._shops.delete(removedShopId);
    }

    for (const addedPlayerShopId of changeset.addedPlayersShops) {
      this._shops.get(addedPlayerShopId)?.handlePlayerEnter();
    }

    for (const removedPlayerShopId of changeset.removedPlayersShops) {
      this._shops.get(removedPlayerShopId)?.handlePlayerExit();
    }

    for (const [id, coordinates] of Object.entries(
      changeset.updatedOtherPlayerPositions,
    )) {
      this._otherPlayerCoordinates[id] = new Point2D(
        coordinates.x,
        coordinates.y,
      );
    }

    for (const id of changeset.removedOtherPlayerPositions) {
      delete this._otherPlayerCoordinates[id];
    }

    for (const addedRayData of Object.values(changeset.addedRays)) {
      if (!this._rays.has(addedRayData.id)) {
        this._rays.set(new this._Ray(this, addedRayData));
      }
    }

    for (const [updatedRayId, updatedRay] of Object.entries(
      changeset.updatedRays,
    )) {
      this._rays.get(updatedRayId)?.applyFromGameStateDelta(updatedRay);
    }

    for (const removedRayId of changeset.removedRays) {
      this._rays.delete(removedRayId);
    }
  }

  toggleInventory(): void {
    this._player?.toggleInventory();
  }

  openShopModal(): void {
    this._shops.list.forEach((shop) => {
      if (shop.hasPlayer() && !shop.isModalOpen) {
        shop.openModal();
      }
    });
  }

  closeShopModal(): void {
    this._shops.list.forEach((shop) => {
      if (shop.hasPlayer() && shop.isModalOpen) {
        shop.closeModal();
      }
    });
  }

  isPlayerInShop(): boolean {
    return this._shops.list.some(
      (shop) => shop.hasPlayer() && shop.isModalOpen,
    );
  }
}
