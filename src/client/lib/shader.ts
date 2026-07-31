/**
 * The seam to Paper Shaders (`@paper-design/shaders`, Apache-2.0).
 *
 * The library ships fragment shaders and a mount that already owns the hard
 * parts: it creates the canvas, watches the element for resizes, watches the
 * viewport with an IntersectionObserver, tracks device pixel ratio and page
 * zoom, and stops its animation frame entirely when the tab is hidden or the
 * element scrolls away. None of that needs reimplementing here.
 *
 * What is left for us is the three things it does not decide:
 *
 *   - React lifecycle: mount on first paint, dispose on unmount.
 *   - No WebGL2: the mount throws in its constructor, and every caller has a
 *     CSS fallback that has to render instead.
 *   - Reduced motion: not a slower animation, a single still frame.
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { ShaderMount, type ShaderMountUniforms } from "@paper-design/shaders";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface ShaderOptions {
  /** Animation speed. 1 is the library's own idea of normal; ours are slower. */
  speed?: number;
  /**
   * Where to stop when motion is reduced. Frames are milliseconds from zero,
   * so this picks which moment of the animation becomes the still image —
   * frame 0 is often the least interesting one.
   */
  stillFrame?: number;
  /**
   * Rendering at 2x even on a 1x screen buys antialiasing. Worth it for an
   * edge, wasted on a blurred gradient.
   */
  minPixelRatio?: number;
  maxPixelCount?: number;
  /** Hold off mounting — used while a texture is still loading. */
  enabled?: boolean;
}

/** "pending" until the first successful mount, then one of the other two. */
export type ShaderState = "pending" | "running" | "unsupported";

export function useShader<T extends HTMLElement>(
  fragmentShader: string,
  uniforms: ShaderMountUniforms,
  options: ShaderOptions = {},
): { ref: RefObject<T | null>; state: ShaderState } {
  const ref = useRef<T | null>(null);
  const [state, setState] = useState<ShaderState>("pending");

  const {
    speed = 1,
    stillFrame = 0,
    minPixelRatio,
    maxPixelCount,
    enabled = true,
  } = options;

  // Uniforms are read once, at mount. Everything this app draws has a fixed
  // palette, and pretending otherwise would mean diffing uniform objects on
  // every render for no one's benefit.
  const initialUniforms = useRef(uniforms);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    const reduced = prefersReducedMotion();
    let mount: ShaderMount;

    try {
      mount = new ShaderMount(
        element,
        fragmentShader,
        initialUniforms.current,
        // Premultiplied alpha off: these shaders are composited by CSS opacity
        // over a light ground, and the default would darken their edges.
        { antialias: true, premultipliedAlpha: false },
        reduced ? 0 : speed,
        stillFrame,
        minPixelRatio,
        maxPixelCount,
      );
    } catch {
      // No WebGL2, or a context the browser refused to give us. The caller's
      // fallback is already in the DOM; just leave it there.
      setState("unsupported");
      return;
    }

    // At speed 0 the mount never schedules a frame, so a still image has to be
    // asked for explicitly.
    if (reduced) mount.setFrame(stillFrame);

    setState("running");

    return () => {
      mount.dispose();
      // dispose() removes the canvas but leaves its own marker attribute.
      element.removeAttribute("data-paper-shader");
    };
  }, [fragmentShader, speed, stillFrame, minPixelRatio, maxPixelCount, enabled]);

  return { ref, state };
}

/** #rrggbb -> the rgba vec4 the shaders want. */
export function rgba(hex: string, alpha = 1): [number, number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const int = Number.parseInt(full, 16);
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255, alpha];
}
