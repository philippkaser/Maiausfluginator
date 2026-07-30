/**
 * The specular highlight on every glass panel.
 *
 * Each `.card` / `.glass` element carries a radial gradient in its ::after,
 * positioned by the custom properties `--gx` / `--gy` and faded in by `--gl`.
 * All this does is write those three values for whichever panel the pointer is
 * over — one delegated listener rather than a React handler per surface, and
 * one write per frame rather than one per event.
 *
 * Coarse pointers get nothing: there is no hover on a touchscreen, and a
 * highlight that only appears mid-tap is worse than none.
 */

const PANEL = ".card, .glass";

export function installGlassPointer(): () => void {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  let current: HTMLElement | null = null;
  let pending: { el: HTMLElement; x: number; y: number } | null = null;
  let frame = 0;

  const clear = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.setProperty("--gl", "0");
  };

  const flush = () => {
    frame = 0;
    if (!pending) return;
    const { el, x, y } = pending;
    pending = null;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    el.style.setProperty("--gx", `${((x - box.left) / box.width) * 100}%`);
    el.style.setProperty("--gy", `${((y - box.top) / box.height) * 100}%`);
    el.style.setProperty("--gl", "1");
  };

  const onMove = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(PANEL) : null;

    if (target !== current) {
      clear(current);
      current = target;
    }
    if (!target) return;

    pending = { el: target, x: event.clientX, y: event.clientY };
    if (frame === 0) frame = requestAnimationFrame(flush);
  };

  const onLeave = () => {
    clear(current);
    current = null;
  };

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  window.addEventListener("blur", onLeave);

  return () => {
    if (frame !== 0) cancelAnimationFrame(frame);
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("blur", onLeave);
    clear(current);
  };
}
