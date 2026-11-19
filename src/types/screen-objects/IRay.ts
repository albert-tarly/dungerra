import { RayType } from "../../config";
import { IDrawable } from "./IDrawable";
import { IScreenObject } from "./IScreenObject";
import { IUpdatable } from "./IUpdatable";
import { Ray as RayMessage, RayUpdate } from "../socketEvents";
import { IWorld } from "../IWorld";
import { IPoint } from "../geometry/IPoint";

export interface IRay extends IScreenObject, IDrawable, IUpdatable {
  applyFromGameStateDelta(update: RayUpdate): void;
  end: IPoint;
  type: RayType;
}

export interface IRayFactory {
  new (world: IWorld, rayData: RayMessage): IRay;
}
