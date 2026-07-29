/**
 * A thin seam between the app and Paper Shaders (shaders.com).
 *
 * The library ships the fragment shaders and a mount that owns the canvas,
 * the resize and intersection observers, the pixel ratio and the animation
 * clock. What it does not ship is the sizing uniforms every shader expects —
 * those come from its React wrapper, which we are not using. `mountShader`
 * fills them in, converts colours from CSS strings, and gives back a handle
 * that is safe to call from an effect cleanup.
 */

import {
  ShaderFitOptions,
  ShaderMount,
  defaultObjectSizing,
  defaultPatternSizing,
  getShaderColorFromString,
  type ShaderMountUniforms,
} from "@paper-design/shaders";

type Sizing = typeof defaultObjectSizing;

/** Paper's shaders are GLSL ES 3.00; without WebGL2 there is nothing to mount. */
export function supportsShaders(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sizingUniforms(sizing: Sizing): ShaderMountUniforms {
  return {
    u_fit: ShaderFitOptions[sizing.fit],
    u_scale: sizing.scale,
    u_rotation: sizing.rotation,
    u_offsetX: sizing.offsetX,
    u_offsetY: sizing.offsetY,
    u_originX: sizing.originX,
    u_originY: sizing.originY,
    u_worldWidth: sizing.worldWidth,
    u_worldHeight: sizing.worldHeight,
  };
}

export function colors(list: string[]): [number, number, number, number][] {
  return list.map((color) => getShaderColorFromString(color));
}

export function color(value: string): [number, number, number, number] {
  return getShaderColorFromString(value);
}

export { defaultObjectSizing, defaultPatternSizing };

export interface MountOptions {
  /** The element the canvas is appended to; the shader matches its size. */
  parent: HTMLElement;
  fragmentShader: string;
  uniforms: ShaderMountUniforms;
  sizing?: Partial<Sizing>;
  /** Base sizing preset — patterns tile, objects fit their box. */
  sizingMode?: "object" | "pattern";
  speed?: number;
  frame?: number;
  /** Backgrounds are smooth; rendering them at 2× is a waste of fill. */
  minPixelRatio?: number;
  maxPixelCount?: number;
}

/**
 * Mounts a shader and returns it, or null when WebGL2 is unavailable so the
 * caller can fall back. Motion is dropped to a single frame when the system
 * asks for reduced motion — the mount stops its rAF entirely at speed 0.
 */
export function mountShader({
  parent,
  fragmentShader,
  uniforms,
  sizing,
  sizingMode = "object",
  speed = 1,
  frame = 0,
  minPixelRatio = 1,
  maxPixelCount,
}: MountOptions): ShaderMount | null {
  if (!supportsShaders()) return null;

  const base = sizingMode === "pattern" ? defaultPatternSizing : defaultObjectSizing;
  const resolved: Sizing = { ...base, ...sizing };
  const still = prefersReducedMotion();

  try {
    return new ShaderMount(
      parent,
      fragmentShader,
      { ...sizingUniforms(resolved), ...uniforms },
      undefined,
      still ? 0 : speed,
      // A still frame taken at t=0 is the least interesting one any of these
      // fields produce, so park the paused state further along.
      still ? Math.max(frame, 12_000) : frame,
      minPixelRatio,
      maxPixelCount,
    );
  } catch {
    return null;
  }
}
