import { WeaponType, InventoryItemID } from "../../config";
import { IPoint } from "../geometry/IPoint";
import { IWorld } from "../IWorld";
import {
  InventoryItem as InventoryItemMessage,
  Player as PlayerMessage,
  PlayerUpdate,
} from "../socketEvents";
import { IDrawable } from "./IDrawable";
import { IScreenObject } from "./IScreenObject";
import { IUpdatable } from "./IUpdatable";
import { IVisor } from "./IVisor";

export interface IPlayer extends IScreenObject, IDrawable, IUpdatable, IVisor {
  isAlive(): boolean;
  lives: number;
  recordKill(reward: number): void;
  drawUI(ctx: CanvasRenderingContext2D): void;
  rotation: number;
  money: number;
  score: number;
  kills: number;
  bulletsLeft: number;
  selectedGunType: WeaponType;
  inventory: InventoryItemMessage[];
  hasInventoryItem(itemType: InventoryItemID): boolean;
  toggleInventory(): void;
  // Screen y (CSS px) of the inventory panel's top edge, or null when the
  // panel is hidden. Overlays use it to stay clear of the panel.
  inventoryPanelTop: number | null;
  applyFromGameStateDelta(changeset: PlayerUpdate): void;
}

export interface IPlayerFactory {
  new (world: IWorld, point: IPoint, rotation: number, id: string): IPlayer;
  fromGameState(world: IWorld, player: PlayerMessage): IPlayer;
}
