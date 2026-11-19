/**
 * Current size of the game view in CSS pixels.
 *
 * All drawing, layout and input code works in these units. The canvases'
 * backing stores are sized in device pixels and their contexts carry a
 * device-pixel-ratio transform (see Game), so one canvas pixel maps 1:1 to a
 * physical screen pixel while game code keeps using CSS pixels.
 *
 * Do not read `ctx.canvas.width/height` for layout: on HiDPI screens those are
 * device pixels, not the units the contexts draw in.
 */
class Viewport {
  width = 0;
  height = 0;

  get centerX(): number {
    return this.width / 2;
  }

  get centerY(): number {
    return this.height / 2;
  }
}

export const viewport = new Viewport();
