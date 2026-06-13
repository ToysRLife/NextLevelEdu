// Maps pointer events to a canvas's logical coordinate system (the fixed
// width x height games draw in), independent of CSS scaling and DPR.

export interface Point {
  x: number;
  y: number;
}

export function pointerPos(canvas: HTMLCanvasElement, e: PointerEvent | MouseEvent, width: number, height: number): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * width,
    y: ((e.clientY - rect.top) / rect.height) * height,
  };
}

/** Attach pointer handlers in logical coords; returns a detach function. */
export function onPointer(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  handlers: {
    down?: (p: Point, e: PointerEvent) => void;
    move?: (p: Point, e: PointerEvent) => void;
    up?: (p: Point, e: PointerEvent) => void;
  },
): () => void {
  const down = (e: PointerEvent) => handlers.down?.(pointerPos(canvas, e, width, height), e);
  const move = (e: PointerEvent) => handlers.move?.(pointerPos(canvas, e, width, height), e);
  const up = (e: PointerEvent) => handlers.up?.(pointerPos(canvas, e, width, height), e);
  if (handlers.down) canvas.addEventListener("pointerdown", down);
  if (handlers.move) canvas.addEventListener("pointermove", move);
  if (handlers.up) window.addEventListener("pointerup", up);
  canvas.style.touchAction = "none";
  return () => {
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
}
