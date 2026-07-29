import { useEffect, useRef, useState } from "react";
import { meshGradientFragmentShader } from "@paper-design/shaders";

import { colors, mountShader } from "../lib/shader.ts";
import { useTheme, type Theme } from "../lib/theme.tsx";

/**
 * The ground: Paper's mesh gradient (shaders.com), in an undertone palette.
 *
 * "Undertone" is the point of the palettes below — every stop sits within a
 * few percent of the others in lightness, so what moves across the screen is
 * hue, not brightness. Dark mode is six near-blacks that lean cool and faintly
 * green; light mode is six near-whites over warm paper. Nothing in either set
 * competes with the type or the glass in front of it.
 *
 * The mount owns its canvas, resize and intersection observers, the pixel
 * ratio and the clock: it pauses off-screen and in hidden tabs, and
 * `mountShader` parks it on a single still frame under prefers-reduced-motion.
 * Without WebGL2 it returns null and a static CSS gradient stands in.
 */

interface Undertone {
  colors: string[];
  distortion: number;
  swirl: number;
  grainMixer: number;
  grainOverlay: number;
  speed: number;
  scale: number;
}

const UNDERTONES: Record<Theme, Undertone> = {
  dark: {
    colors: ["#05070a", "#0a1218", "#122026", "#1a2c30", "#0c161b", "#24393b"],
    distortion: 0.85,
    swirl: 0.12,
    grainMixer: 0.35,
    grainOverlay: 0.06,
    speed: 0.16,
    scale: 1.15,
  },
  light: {
    colors: ["#fbfaf8", "#efece6", "#e4eae5", "#dbe9e4", "#f4ebe1", "#e1e7ef"],
    distortion: 0.8,
    swirl: 0.1,
    grainMixer: 0.3,
    grainOverlay: 0.05,
    speed: 0.14,
    scale: 1.2,
  },
};

export function Backdrop() {
  const { theme } = useTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const preset = UNDERTONES[theme];
    const mount = mountShader({
      parent: host,
      fragmentShader: meshGradientFragmentShader,
      uniforms: {
        u_colors: colors(preset.colors),
        u_colorsCount: preset.colors.length,
        u_distortion: preset.distortion,
        u_swirl: preset.swirl,
        u_grainMixer: preset.grainMixer,
        u_grainOverlay: preset.grainOverlay,
      },
      sizing: { fit: "cover", scale: preset.scale },
      speed: preset.speed,
      // The field is smooth by construction — 1× is indistinguishable from 2×
      // across a whole viewport and costs a quarter of the fill.
      minPixelRatio: 1,
      maxPixelCount: 1920 * 1080,
    });

    if (!mount) {
      setFailed(true);
      return;
    }
    setFailed(false);
    return () => mount.dispose();
  }, [theme]);

  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__shader" ref={hostRef} />
      {failed && <div className="backdrop__fallback" />}
      <div className="backdrop__vignette" />
      <div className="backdrop__grain" />
    </div>
  );
}
