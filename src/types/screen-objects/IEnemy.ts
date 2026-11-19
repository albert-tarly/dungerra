import { IDrawable } from "./IDrawable";
import { IWorld } from "../IWorld";
import { IScreenObject } from "./IScreenObject";
import { IWall } from "./IWall";
import { IUpdatable } from "./IUpdatable";
import { EnemyUpdate, Enemy as EnemyMessage } from "../../types/socketEvents";

export interface IEnemy extends IScreenObject, IDrawable, IUpdatable {
  applyFromGameStateDelta(enemy: EnemyUpdate): void;
  rotation: number;
  wall?: IWall;
}

export interface IEnemyFactory {
  new (world: IWorld, enemyData: EnemyMessage, wall?: IWall): IEnemy;
}
