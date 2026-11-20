import { RAY_TYPES, RayType } from "../config";
import { IWorld } from "../types/IWorld";
import { IRay } from "../types/screen-objects/IRay";
import { ScreenObject } from "./ScreenObject";
import { Ray as RayMessage, RayUpdate } from "../types/socketEvents";
import { Point2D } from "../utils/geometry/Point2D";
import { IPose, PoseBuffer } from "../utils/PoseBuffer";

export class Ray extends ScreenObject implements IRay {
  private _end: Point2D;
  private _type: RayType;
  private _startPoses: PoseBuffer;
  private _endPoses: PoseBuffer;
  private _pose: IPose = { x: 0, y: 0, rotation: 0 };

  get end(): Point2D {
    return this._end;
  }

  get type(): RayType {
    return this._type;
  }

  constructor(
    private _world: IWorld,
    rayData: RayMessage,
  ) {
    const point = new Point2D(rayData.position!.x, rayData.position!.y);
    super(point, 0, 0, rayData.id);
    this._end = new Point2D(rayData.endPosition!.x, rayData.endPosition!.y);
    this._type = rayData.type as RayType;
    // Both ends are blended like the sniper and target they connect
    const time = _world.snapshotTime;
    this._startPoses = new PoseBuffer(time, point.x, point.y, 0);
    this._endPoses = new PoseBuffer(time, this._end.x, this._end.y, 0);
  }

  update(_dt: number): void {
    const renderTime = this._world.renderTime;
    const start = this._startPoses.sample(renderTime, this._pose);
    this._point.setTo(start.x, start.y);
    const end = this._endPoses.sample(renderTime, this._pose);
    this._end.setTo(end.x, end.y);
  }

  draw(ctx: CanvasRenderingContext2D, _uiCtx: CanvasRenderingContext2D): void {
    if (this._type === RAY_TYPES.LASER) {
      const start = this._world.worldToScreenCoordinates(this._point);
      const end = this._world.worldToScreenCoordinates(this._end);
      ctx.save();
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  applyFromGameStateDelta(updateData: RayUpdate): void {
    const time = this._world.snapshotTime;
    if (updateData.position) {
      this._startPoses.push(
        time,
        updateData.position.x,
        updateData.position.y,
        0,
      );
    }
    if (updateData.endPosition) {
      this._endPoses.push(
        time,
        updateData.endPosition.x,
        updateData.endPosition.y,
        0,
      );
    }
  }
}
