import { meshGradientFragmentShader } from "@paper-design/shaders";

import { rgba, useShader } from "../lib/shader.ts";

/**
 * The Grund — an aurora.
 *
 * Large soft fields of warm light drifting across the paper, the way daylight
 * moves on a wall when there is a curtain in front of the window. It is the
 * only thing in the app that is always moving and the only thing that carries
 * colour across a whole screen, which is exactly why it stays this quiet: at
 * full strength a gradient mesh is a poster, and this has to sit under body
 * text all day.
 *
 * The palette is the design decision, not the shader. Every spot is a
 * near-white pulled a few percent towards sage, mint, straw or peach — no spot
 * is a colour, each one is a cast of light on paper. Swap these six values and
 * the whole app changes temperature; that is also where a night version would
 * begin.
 */
const AURORA = [
  rgba("#f7f4ee"), // warm white — the paper itself
  rgba("#dfe8d9"), // pale sage
  rgba("#f2e2cf"), // pale peach
  rgba("#cfdfd4"), // mint shadow
  rgba("#f6ece0"), // cream
  rgba("#e2dcc9"), // straw
];

export function Ground() {
  const { ref, state } = useShader<HTMLDivElement>(
    meshGradientFragmentShader,
    {
      u_colors: AURORA,
      u_colorsCount: AURORA.length,
      // Enough organic distortion that the fields never read as a lens flare,
      // not so much that they start to look like marble.
      u_distortion: 0.72,
      u_swirl: 0.42,
      u_grainMixer: 0.18,
      // The grain overlay stays off: there is already a paper grain in CSS over
      // the whole ground, and two grains at once is mud.
      u_grainOverlay: 0,

      // Sizing. World dimensions of zero mean "use the canvas", which for a
      // full-viewport ambient is what we want; the scale just zooms the fields
      // up so no single spot is ever fully visible.
      u_fit: 0,
      u_scale: 1.35,
      u_rotation: 0,
      u_originX: 0.5,
      u_originY: 0.5,
      u_offsetX: 0,
      u_offsetY: 0,
      u_worldWidth: 0,
      u_worldHeight: 0,
    },
    {
      // A tenth of the library's normal speed. A full drift takes minutes,
      // which is the difference between weather and animation.
      speed: 0.09,
      // Frame zero of a mesh gradient is its least interesting arrangement, so
      // the reduced-motion still is taken well into the drift.
      stillFrame: 14000,
      // This is a blurred gradient behind a translucent page. Rendering it at
      // 2x buys nothing and costs a lot of fill.
      minPixelRatio: 1,
      maxPixelCount: 1920 * 1080 * 2,
    },
  );

  return (
    <div className="ground" aria-hidden="true">
      {/* The washes are the first paint and the no-WebGL fallback both. They
          stay in the DOM either way — behind a running shader they are simply
          not visible, and keeping them costs one composited layer. */}
      <div className="ground__wash ground__wash--a" />
      <div className="ground__wash ground__wash--b" />
      {state !== "unsupported" && <div className="ground__shader" ref={ref} />}
      <div className="ground__vignette" />
      <div className="ground__grain" />
    </div>
  );
}
