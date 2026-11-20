import { IScreenObject } from "./IScreenObject";
import { IPoint } from "../geometry/IPoint";
import { IWorld } from "../IWorld";
import { IDrawable } from "./IDrawable";
import { Vector2D } from "../../utils/geometry/Vector2D";
import { Bullet as BulletMessage } from "../socketEvents";
import * as config from "../../config";
export interface IBullet extends IScreenObject, IDrawable {
  active: boolean;
  deletedAt: number;
  velocity: Vector2D;
  isEnemy: boolean;
  ownerId?: string;
  weaponType: config.WeaponType;
  batchId?: string;
  /** Moves the bullet to where it is at `renderTime` (server ms), stopping at walls. */
  advance(renderTime: number, walls: IScreenObject[]): void;
  /** Restarts the flight from a server-reported position (servers before 1.2 sent these). */
  rebase(x: number, y: number, time: number): void;
}

export interface IBulletFactory {
  new (
    world: IWorld,
    point: IPoint,
    rotation: number,
    isEnemy: boolean,
    enemyType: config.EnemyType,
    ownerId?: string,
    id?: string,
    batchId?: string,
  ): IBullet;

  fromGameState(world: IWorld, bulletData: BulletMessage): IBullet;
}
