import { ScreenObject } from "./ScreenObject";
import { Vector2D } from "../utils/geometry/Vector2D";
import * as config from "../config";
import { IBullet } from "../types/screen-objects/IBullet";
import { IPoint } from "../types/geometry/IPoint";
import { IScreenObject } from "../types/screen-objects/IScreenObject";
import { IWorld } from "../types/IWorld";
import { Point2D } from "../utils/geometry/Point2D";
import { Bullet as BulletMessage } from "../types/socketEvents";
import { ImageManager } from "../utils/ImageManager";

export class Bullet extends ScreenObject implements IBullet {
  private _velocity: Vector2D;
  private _speed: number;
  private _active: boolean = true;
  private _deletedAt: number = 0;
  private _weaponType: config.WeaponType = "blaster";
  // Where and when (server ms) the flight was last reported by the server
  private _origin: Point2D = new Point2D(0, 0);
  private _originTime: number = 0;
  // Reached a wall locally; the server's removal follows shortly
  private _stopped: boolean = false;
  private static _imageRocket: HTMLImageElement | null = null;
  private static _imageRocketBlast: HTMLImageElement | null = null;

  get weaponType(): config.WeaponType {
    return this._weaponType;
  }

  get deletedAt(): number {
    return this._deletedAt;
  }

  get active(): boolean {
    return this._active;
  }

  set active(value: boolean) {
    this._active = value;
  }

  get velocity(): Vector2D {
    return this._velocity;
  }

  constructor(
    private world: IWorld,
    point: IPoint,
    private rotation: number,
    public readonly isEnemy: boolean,
    public readonly enemyType: config.EnemyType,
    public readonly ownerId?: string,
    id?: string,
    public readonly batchId?: string,
  ) {
    super(point, config.BULLET_SIZE, config.BULLET_SIZE, id);
    this._speed = isEnemy
      ? config.ENEMY_BULLET_SPEED
      : config.PLAYER_BULLET_SPEED;
    this._velocity = Vector2D.fromAngle((rotation * Math.PI) / 180).multiply(
      this._speed,
    );

    const imageManager = ImageManager.getInstance();
    // Preload rocket image
    if (!Bullet._imageRocket) {
      void imageManager.loadImage(config.TEXTURES.BULLET_ROCKET).then((img) => {
        Bullet._imageRocket = img;
      });
    }

    if (!Bullet._imageRocketBlast) {
      void imageManager
        .loadImage(config.ANIMATIONS.EXPLOSION.image)
        .then((image) => {
          Bullet._imageRocketBlast = image;
        });
    }
  }

  static fromGameState(world: IWorld, bulletData: BulletMessage): Bullet {
    const bullet = new Bullet(
      world,
      new Point2D(bulletData.position?.x ?? 0, bulletData.position?.y ?? 0),
      bulletData.velocity
        ? Math.atan2(bulletData.velocity.y, bulletData.velocity.x) *
          (180 / Math.PI)
        : 0,
      bulletData.isEnemy,
      bulletData.enemyType as config.EnemyType,
      bulletData.ownerId,
      bulletData.id,
      bulletData.batchId,
    );

    bullet._weaponType = bulletData.weaponType as config.WeaponType;

    if (!bulletData.isActive) {
      bullet._active = false;
    }

    if (bulletData.velocity) {
      bullet._velocity = new Vector2D(
        bulletData.velocity.x,
        bulletData.velocity.y,
      );
    }

    bullet._weaponType = bulletData.weaponType as config.WeaponType;
    bullet._deletedAt = Number(bulletData.deletedAt ?? 0);
    bullet._origin = new Point2D(bullet.x, bullet.y);
    bullet._originTime = world.snapshotTime;

    return bullet;
  }

  // Blaster shots and rockets fly; for hitscan shots (railgun, shotgun) the
  // velocity is the whole beam, drawn in place for a moment
  private get isFlying(): boolean {
    return (
      this._active &&
      !this._stopped &&
      (this._weaponType === "blaster" || this._weaponType === "rocket_launcher")
    );
  }

  advance(renderTime: number, walls: IScreenObject[]): void {
    if (!this.isFlying) {
      return;
    }

    // Velocity is in units per second; the server moves bullets in a straight line
    const seconds = Math.max(0, renderTime - this._originTime) / 1000;
    const x = this._origin.x + this._velocity.x * seconds;
    const y = this._origin.y + this._velocity.y * seconds;

    for (const wall of walls) {
      // A wall's rectangle lies within width + height of its anchor point;
      // skip far walls before building the rectangle
      const reach = wall.width + wall.height;
      if (Math.abs(x - wall.x) > reach || Math.abs(y - wall.y) > reach) {
        continue;
      }
      const rect = wall.getCollisionRect();
      if (
        x >= rect.left &&
        x <= rect.left + rect.width &&
        y >= rect.top &&
        y <= rect.top + rect.height
      ) {
        // Hold at the last position outside the wall until the server's removal arrives
        this._stopped = true;
        return;
      }
    }

    this._point.setTo(x, y);
  }

  rebase(x: number, y: number, time: number): void {
    this._point.setTo(x, y);
    this._origin.setTo(x, y);
    this._originTime = time;
    this._stopped = false;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    _: CanvasRenderingContext2D,
    millisecondsPassed?: number,
  ): void {
    if (
      this.world.gameOver ||
      (!this._active &&
        !["railgun", "rocket_launcher"].includes(this._weaponType))
    ) {
      return;
    }

    if (this.weaponType === "shotgun") {
      // Shotgun bullets are not drawn individually
      return;
    }

    const screenPoint = this.world.worldToScreenCoordinates(this.getPosition());

    ctx.save();
    ctx.translate(screenPoint.x, screenPoint.y);

    if (this._weaponType === "railgun") {
      // Draw railgun bullet as a line
      const bulletColor = this.isEnemy
        ? (config.BULLET_COLOR_BY_ENEMY_TYPE[this.enemyType] ??
          config.ENEMY_BULLET_COLOR)
        : config.PLAYER_BULLET_COLOR;
      ctx.strokeStyle = bulletColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const endX = this.velocity.x;
      const endY = this.velocity.y;
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Add a glow effect
      const glowSize = 20;
      const gradient = ctx.createRadialGradient(
        endX,
        endY,
        0,
        endX,
        endY,
        glowSize,
      );
      gradient.addColorStop(0, bulletColor);
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(endX, endY, glowSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    if (this._weaponType === "rocket_launcher" && Bullet._imageRocket) {
      if (!this._active && Bullet._imageRocketBlast && millisecondsPassed) {
        // Draw explosion animation

        const frameWidth =
          Bullet._imageRocketBlast.width /
          config.ANIMATIONS.EXPLOSION.frameCount;
        const frameHeight = Bullet._imageRocketBlast.height;
        const totalDuration = config.ANIMATIONS.EXPLOSION.duration;
        const currentFrame = Math.floor(
          (millisecondsPassed / totalDuration) *
            config.ANIMATIONS.EXPLOSION.frameCount,
        );

        if (currentFrame >= config.ANIMATIONS.EXPLOSION.frameCount) {
          ctx.restore();
          return; // Animation finished
        }

        ctx.drawImage(
          Bullet._imageRocketBlast,
          currentFrame * frameWidth,
          0,
          frameWidth,
          frameHeight,
          -frameWidth / 2,
          -frameHeight / 2,
          frameWidth,
          frameHeight,
        );

        ctx.restore();
        return;
      }

      // Rotate rocket texture to match velocity direction
      const angle = Math.atan2(this.velocity.y, this.velocity.x) + Math.PI / 2;
      ctx.rotate(angle);
      // Draw rocket texture
      const textureWidth = Bullet._imageRocket.width;
      const textureHeight = Bullet._imageRocket.height;
      ctx.drawImage(
        Bullet._imageRocket,
        -textureWidth / 2,
        -textureHeight / 2,
        textureWidth,
        textureHeight,
      );
      ctx.restore();
      return;
    }

    ctx.rotate((this.rotation * Math.PI) / 180);

    // Draw bullet
    ctx.fillStyle = this.isEnemy
      ? (config.BULLET_COLOR_BY_ENEMY_TYPE[this.enemyType] ??
        config.ENEMY_BULLET_COLOR)
      : config.PLAYER_BULLET_COLOR;
    ctx.beginPath();
    ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
