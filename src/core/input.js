// Maps pointer events to a canvas's logical coordinate system (the fixed
// width x height games draw in), independent of CSS scaling and DPR.
export function pointerPos(canvas, e, width, height) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: ((e.clientX - rect.left) / rect.width) * width,
        y: ((e.clientY - rect.top) / rect.height) * height,
    };
}
/** Attach pointer handlers in logical coords; returns a detach function. */
export function onPointer(canvas, width, height, handlers) {
    const down = (e) => handlers.down?.(pointerPos(canvas, e, width, height), e);
    const move = (e) => handlers.move?.(pointerPos(canvas, e, width, height), e);
    const up = (e) => handlers.up?.(pointerPos(canvas, e, width, height), e);
    if (handlers.down)
        canvas.addEventListener("pointerdown", down);
    if (handlers.move)
        canvas.addEventListener("pointermove", move);
    if (handlers.up)
        window.addEventListener("pointerup", up);
    canvas.style.touchAction = "none";
    return () => {
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
    };
}
