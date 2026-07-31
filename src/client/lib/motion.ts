/**
 * Motion.
 *
 * Slow and weightless: nothing travels more than fourteen pixels and
 * everything takes its time getting there. The transitions themselves live in
 * `styles.css` — this file only decides *when* they start.
 *
 * Reduced motion is honoured by arriving, not by hurrying. Every hook here
 * either resolves straight to its end state or never runs at all.
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { prefersReducedMotion } from "./shader.ts";

/**
 * Reveal on scroll.
 *
 * One observer per page rather than one per element. Sections opt in by
 * carrying `data-reveal`; the attribute doubles as the state, so the CSS needs
 * no extra class. Order comes from the DOM, not from a prop — a section that
 * appears second in the markup gets the second beat, and nobody has to keep a
 * list of delays in sync.
 */
export function useReveal(deps: unknown[] = []) {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = root.current;
    if (!container) return;

    // Only elements that have not arrived yet. This effect re-runs whenever the
    // page's data changes, and re-hiding a section that is already on screen
    // would flash it — a sort change adds no new content and should not animate.
    const targets = Array.from(container.querySelectorAll<HTMLElement>("[data-reveal]")).filter(
      (target) => target.dataset.reveal !== "shown",
    );
    if (targets.length === 0) return;

    if (prefersReducedMotion()) {
      for (const target of targets) target.dataset.reveal = "shown";
      return;
    }

    // Anything already on screen at first paint is staggered; anything further
    // down arrives on its own and gets no delay, because by then the stagger
    // would just be a wait.
    const viewportHeight = window.innerHeight;
    targets.forEach((target, index) => {
      target.dataset.reveal = "pending";
      const onScreen = target.getBoundingClientRect().top < viewportHeight;
      target.style.setProperty("--reveal-delay", onScreen ? `${index * 90}ms` : "0ms");
    });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target as HTMLElement;
          target.dataset.reveal = "shown";
          // Once shown, stay shown. Re-animating on the way back up reads as a
          // glitch, not as craft.
          observer.unobserve(target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.02 },
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, deps);

  return root;
}

/**
 * How far the page has been read, 0..1, as a CSS variable on the rail.
 *
 * Written straight to the element rather than held in state: this fires on
 * every scroll frame, and React has no business being involved.
 */
export function useScrollProgress(target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const element = target.current;
      if (!element) return;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable <= 0 ? 0 : Math.min(1, window.scrollY / scrollable);
      element.style.setProperty("--progress", String(progress));
      element.classList.toggle("rail--dense", window.scrollY > 12);
    };

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [target]);
}

/**
 * Count a number up, once.
 *
 * The score is the one number on the page worth animating, and only the first
 * time it is drawn: re-counting on every slider move would turn the weight
 * tuner into a slot machine. `key` is what makes "once" precise — a new trip is
 * a new number and counts again, a re-weighted score just changes.
 */
export function useCountUp(value: number | null, key: string): number | null {
  // What animates is a 0..1 progress, not the number. That is the whole trick:
  // once progress has reached 1 it stays there, so a re-weighted score simply
  // reads out at full strength while the first draw still counts up.
  const [progress, setProgress] = useState(0);
  const counted = useRef<string | null>(null);
  const hasValue = value !== null;

  useEffect(() => {
    if (!hasValue) return;

    if (counted.current === key || prefersReducedMotion()) {
      counted.current = key;
      setProgress(1);
      return;
    }

    counted.current = key;
    setProgress(0);

    const duration = 1100;
    const start = performance.now();
    let frame = requestAnimationFrame(step);

    function step(now: number) {
      const t = Math.min(1, (now - start) / duration);
      // The same shape as the CSS curve: quick away, soft arrival.
      setProgress(1 - Math.pow(1 - t, 3.2));
      if (t < 1) frame = requestAnimationFrame(step);
    }

    return () => cancelAnimationFrame(frame);
  }, [key, hasValue]);

  return value === null ? null : value * progress;
}

/**
 * The pointer highlight on a pane.
 *
 * Attach to any element that should carry a moving sheen. The position lands as
 * `--mx`/`--my` on the element and CSS draws it, so moving a mouse never causes
 * a React render.
 */
export function usePointerSheen<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // A sheen that follows a finger is a sheen nobody sees.
    if (!window.matchMedia("(hover: hover)").matches) return;

    const onMove = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      element.style.setProperty("--mx", `${event.clientX - box.left}px`);
      element.style.setProperty("--my", `${event.clientY - box.top}px`);
    };

    element.addEventListener("pointermove", onMove);
    return () => element.removeEventListener("pointermove", onMove);
  }, []);

  return ref;
}
