import * as config from "../config";
import { Bonus } from "../entities/Bonus";
import { Enemy } from "../entities/Enemy";
import { Player } from "../entities/Player";
import { Wall } from "../entities/Wall";
import { AudioManager } from "./AudioManager";
import { World } from "./World";
import { SessionManager } from "../api/SessionManager";
import { AuthManager } from "../api/AuthManager";
import { Shop } from "../entities/Shop";
import { ISession } from "../types/session";
import { OtherPlayer } from "../entities/OtherPlayer";
import { BulletManager } from "./BulletManager";
import { ImageManager } from "./ImageManager";
import { Ray } from "../entities/Ray";
import { viewport } from "./Viewport";

export class Game {
  private _ctx: CanvasRenderingContext2D;
  private _lightCtx: CanvasRenderingContext2D;
  private _uiCtx: CanvasRenderingContext2D;
  private _lastTime: number = 0;
  private _world: World | null = null;
  private _activeKeys = new Set<string>();
  private _authManager: AuthManager;
  private _sessionManager: SessionManager;
  private _started: boolean = false;
  private _resizeObserver: ResizeObserver | null = null;
  private _listenersAbort = new AbortController();
  private _menuOpen: boolean = false;

  // Called when the in-game menu opens or closes. GameScreen renders the menu.
  public onMenuToggle: ((open: boolean) => void) | null = null;

  public get world(): World | null {
    return this._world;
  }

  public get menuOpen(): boolean {
    return this._menuOpen;
  }

  // The world keeps running while the menu is open (it lives on the server
  // and is shared), so the menu only releases the player's controls.
  public setMenuOpen(open: boolean): void {
    if (open === this._menuOpen) {
      return;
    }
    this._menuOpen = open;
    if (open) {
      // Held keys and the mouse button would otherwise keep the player
      // moving or firing until released
      this._activeKeys.clear();
    }
    this.onMenuToggle?.(open);
  }

  constructor(
    private _canvas: HTMLCanvasElement,
    private _lightCanvas: HTMLCanvasElement,
    private _uiCanvas: HTMLCanvasElement,
  ) {
    this._ctx = this._canvas.getContext("2d")!;
    this._lightCtx = this._lightCanvas.getContext("2d")!;
    this._uiCtx = this._uiCanvas.getContext("2d")!;

    this._authManager = AuthManager.getInstance();
    this._sessionManager = SessionManager.getInstance();

    this.setupResizeHandling();
    this.setupEventListeners();
  }

  // All three canvases are stacked with identical CSS boxes, so observing one
  // is enough. The observer fires on window resize, browser zoom and (where
  // device-pixel-content-box is supported) on moving to a screen with a
  // different pixel ratio.
  private setupResizeHandling(): void {
    // Size synchronously so the first frame is already correct
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = this._canvas;
    this.resize(
      clientWidth,
      clientHeight,
      Math.round(clientWidth * dpr),
      Math.round(clientHeight * dpr),
    );

    this._resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const cssWidth = entry.contentRect.width;
      const cssHeight = entry.contentRect.height;
      // Exact device pixel size when available; avoids rounding blur
      const devicePixelSize = entry.devicePixelContentBoxSize?.[0];
      const ratio = window.devicePixelRatio || 1;
      this.resize(
        cssWidth,
        cssHeight,
        devicePixelSize?.inlineSize ?? Math.round(cssWidth * ratio),
        devicePixelSize?.blockSize ?? Math.round(cssHeight * ratio),
      );
    });

    try {
      this._resizeObserver.observe(this._canvas, {
        box: "device-pixel-content-box",
      });
    } catch {
      // Safari does not support device-pixel-content-box
      this._resizeObserver.observe(this._canvas);
    }
  }

  private resize(
    cssWidth: number,
    cssHeight: number,
    pixelWidth: number,
    pixelHeight: number,
  ): void {
    if (
      cssWidth <= 0 ||
      cssHeight <= 0 ||
      pixelWidth <= 0 ||
      pixelHeight <= 0
    ) {
      return;
    }

    viewport.width = cssWidth;
    viewport.height = cssHeight;

    const contexts = [this._ctx, this._lightCtx, this._uiCtx];
    for (const ctx of contexts) {
      const canvas = ctx.canvas;
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        // Assigning the size clears the canvas and resets context state
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      // Game code draws in CSS pixels; map them onto device pixels
      ctx.setTransform(
        pixelWidth / cssWidth,
        0,
        0,
        pixelHeight / cssHeight,
        0,
        0,
      );
    }

    // Resizing cleared the canvases; redraw now to avoid a blank frame
    if (this._started) {
      this.draw();
    }
  }

  public static async loadResources(): Promise<void> {
    const audioManager = AudioManager.getInstance();
    const imageManager = ImageManager.getInstance();

    await Promise.all([
      imageManager.loadImage(config.TEXTURES.FLOOR),
      imageManager.loadPlayerTextures(),
      imageManager.loadImage(config.TEXTURES.ENEMY),
      imageManager.loadImage(config.TEXTURES.WALL),
      imageManager.loadImage(config.ANIMATIONS.TORCH_FIRE.image),
      audioManager.loadSound(config.SOUNDS.PLAYER_HURT),
      audioManager.loadSound(config.SOUNDS.PLAYER_DEAD),
      audioManager.loadSound(config.SOUNDS.ENEMY_HURT),
      audioManager.loadSound(config.SOUNDS.TOWER_HIT),
      audioManager.loadSound(config.SOUNDS.TORCH),
    ]);

    // Load non-critical resources in the background
    const backgroundSounds = [
      config.SOUNDS.PLAYER_BULLET_RECHARGE,
      config.SOUNDS.BONUS_PICKUP,
      config.SOUNDS.GAME_OVER,
      config.SOUNDS.BULLET,
      config.SOUNDS.SHOTGUN,
      config.SOUNDS.RAILGUN,
      config.SOUNDS.ROCKET_LAUNCHER,
      config.SOUNDS.ROCKET_BLAST,
      config.SOUNDS.SPAWN,
      config.SOUNDS.ENTER_SHOP,
      config.SOUNDS.MONEY_SPENT,
      config.SOUNDS.MISTAKE,
      config.SOUNDS.TOWER_CRASH,
    ];
    const backgroundImages = [
      config.TEXTURES.BLOOD,
      config.TEXTURES.AID_KIT,
      config.TEXTURES.GOGGLES,
      config.TEXTURES.CHEST,
      config.TEXTURES.SHOP,
    ];
    backgroundSounds.forEach((sound) => void audioManager.loadSound(sound));
    backgroundImages.forEach((image) => void imageManager.loadImage(image));
    void imageManager.loadInventoryTextures();
  }

  private setupEventListeners(): void {
    // stop() aborts this, removing every window listener at once. Otherwise a
    // stopped game keeps reacting to keys (e.g. R sends a respawn request).
    const { signal } = this._listenersAbort;

    window.addEventListener(
      "keydown",
      (e) => {
        if (this._menuOpen) {
          // Only Escape (close) reaches the game; Enter and Space go to the
          // focused menu button
          if (e.code === "Escape" && !e.repeat) {
            this.setMenuOpen(false);
          }
          return;
        }
        this._activeKeys.add(e.code);
        this.handleKeyDown(e);
      },
      { signal },
    );

    window.addEventListener(
      "keyup",
      (e) => {
        this._activeKeys.delete(e.code);
      },
      { signal },
    );

    window.addEventListener("mousemove", (e) => this.handleMouseMove(e), {
      signal,
    });
    window.addEventListener("mousedown", (e) => this.handleMouseDown(e), {
      signal,
    });
    // Listen on window so releasing outside the canvas still stops firing
    window.addEventListener(
      "mouseup",
      (e) => {
        if (e.button === 0) {
          this._activeKeys.delete(config.MOUSE_SHOOT_KEY);
        }
      },
      { signal },
    );
    // A button held while the window loses focus never gets its mouseup
    window.addEventListener(
      "blur",
      () => {
        this._activeKeys.delete(config.MOUSE_SHOOT_KEY);
      },
      { signal },
    );

    this._sessionManager.onGameStateDelta((changeset) => {
      if (this._world) {
        const userData = this._authManager.getUserData();
        this._world.applyGameStateDelta(changeset, userData!.id);
      }
    });

    // Join messages are broadcast to the whole session, wherever the new
    // player is, so they don't create anything: the player appears when a
    // delta adds them, i.e. once they are actually visible.

    this._sessionManager.onPlayerLeft(({ playerId }) => {
      if (this._world) {
        this._world.removeOtherPlayer(playerId);
      }
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "F3") {
      this._world?.toggleDebug();
    }
    if (e.code === "KeyR" && this._world?.gameOver) {
      this._world?.restart();
    }
    if (e.code === "KeyE" || e.code === "Backquote") {
      this._world?.toggleInventory();
    }
    if (e.code === "Enter") {
      this._world?.openShopModal();
    }
    // Escape closes the shop first, and opens the game menu otherwise.
    // Ignoring auto-repeat stops a held key from flickering the menu.
    if (e.code === "Escape" && !e.repeat) {
      if (this._world?.isPlayerInShop()) {
        this._world.closeShopModal();
      } else {
        this.setMenuOpen(true);
      }
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    // Game coordinates are CSS pixels relative to the canvas
    const rect = this._canvas.getBoundingClientRect();
    this._world?.setAimScreenPoint(e.clientX - rect.left, e.clientY - rect.top);
  }

  private handleMouseDown(e: MouseEvent): void {
    // Only clicks on the game itself shoot, not on overlays like the volume control
    if (e.button !== 0 || !(e.target instanceof HTMLCanvasElement)) {
      return;
    }
    // Aim at the click point even if the mouse has not moved yet
    this.handleMouseMove(e);
    // Held like a key: fires as fast as the weapon allows until released
    this._activeKeys.add(config.MOUSE_SHOOT_KEY);
  }

  public start(session: ISession): void {
    if (session) {
      const userData = this._authManager.getUserData();
      const multiplayerMode =
        session.host.id === userData?.id ? "host" : "guest";
      this._world = new World(
        Player,
        Enemy,
        Wall,
        Bonus,
        OtherPlayer,
        Shop,
        Ray,
        BulletManager,
        multiplayerMode,
      );

      this._started = true;
      // Only now: the handlers (registered in the constructor) and the world
      // must both exist when the server's initial full snapshot arrives.
      this._sessionManager.connect();
      requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
    }
  }

  private gameLoop(timestamp: number): void {
    if (!this._started) {
      return;
    }

    // The first frame has no previous one; don't count the time since page load
    const dt = this._lastTime ? (timestamp - this._lastTime) / 1000 : 0;
    this._lastTime = timestamp;

    this._world?.handleInput(this._activeKeys, dt);
    this._world?.update(dt);
    this.draw();

    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }

  public stop(): void {
    this._started = false;
    this._listenersAbort.abort();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    AudioManager.getInstance().stopAllSounds();
  }

  private draw(): void {
    // Clear the canvas
    [this._ctx, this._uiCtx, this._lightCtx].forEach((ctx) => {
      ctx.clearRect(0, 0, viewport.width, viewport.height);
    });

    // Draw the world
    this._world?.draw(this._ctx, this._lightCtx, this._uiCtx);
  }
}
