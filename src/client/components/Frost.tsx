import { useEffect, useState, type ReactNode } from "react";
import { flutedGlassFragmentShader } from "@paper-design/shaders";

import { rgba, useShader } from "../lib/shader.ts";

/**
 * Real frosted glass, for the two or three surfaces that carry a whole screen.
 *
 * Everywhere else in this app "frosted" means `backdrop-filter`, which can
 * blur what is behind a pane but cannot bend it. This can: it sends an image
 * through a ribbed prism, so light splits along the flutes and colour separates
 * at every edge. That difference is the reason the front door and the top of
 * the Rangliste feel like glass and a list row merely feels like paper.
 *
 * What gets refracted is *not* the page. Reading the DOM into a texture would
 * mean coupling a shader to layout and repainting it on every scroll. Instead a
 * small plate of soft warm colour fields is generated once as an SVG data URI
 * and refracted forever — a texture upload, nothing more. The result is a
 * surface, not a window, which is what a real fluted pane is anyway.
 */

/** The plate. Five blurred fields in the alpine palette on warm paper. */
function buildPlate(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <defs>
    <filter id="soft" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="95" />
    </filter>
  </defs>
  <rect width="1200" height="800" fill="#f7f3ec" />
  <g filter="url(#soft)">
    <ellipse cx="215" cy="175" rx="360" ry="285" fill="#cbdccf" />
    <ellipse cx="985" cy="235" rx="385" ry="300" fill="#f2dbc0" />
    <ellipse cx="560" cy="645" rx="425" ry="300" fill="#d9e5d8" />
    <ellipse cx="1085" cy="705" rx="300" ry="255" fill="#e6d0b6" />
    <ellipse cx="115" cy="625" rx="285" ry="240" fill="#f6ece0" />
  </g>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * One image for the whole app, decoded once. Every Frost mounts the same
 * texture, and a second instance costs a GPU upload rather than a decode.
 */
let platePromise: Promise<HTMLImageElement> | null = null;

function loadPlate(): Promise<HTMLImageElement> {
  platePromise ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = buildPlate();
  });
  return platePromise;
}

export function Frost({
  children,
  className,
  /** Flute direction in degrees. Near-vertical by default — see below. */
  angle = 96,
}: {
  children?: ReactNode;
  className?: string;
  angle?: number;
}) {
  const [plate, setPlate] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let live = true;
    loadPlate()
      .then((image) => {
        if (live) setPlate(image);
      })
      .catch(() => {
        // The CSS fallback underneath is already correct; nothing to do.
      });
    return () => {
      live = false;
    };
  }, []);

  const { ref, state } = useShader<HTMLDivElement>(
    flutedGlassFragmentShader,
    {
      u_image: plate ?? undefined,

      // Flutes. Vertical (or near enough) is the only defensible choice:
      // horizontal ribs read as a venetian blind, and exact verticals read as a
      // rendering artefact, so it sits a few degrees off.
      u_shape: 1, // lines
      u_angle: angle,
      u_size: 0.17,

      // Prism rather than lens: a prism splits colour along the rib, which is
      // the entire point of doing this in WebGL instead of CSS.
      u_distortionShape: 1, // prism
      u_distortion: 0.6,
      u_stretch: 0.1,
      u_shift: 0,

      u_blur: 0.34,
      u_edges: 0.28,
      u_shadows: 0.2,
      u_highlights: 0.46,

      u_colorBack: rgba("#f8f5ef", 0),
      u_colorShadow: rgba("#6f6350", 0.5),
      u_colorHighlight: rgba("#ffffff", 0.85),

      u_grainMixer: 0.12,
      u_grainOverlay: 0,

      u_marginLeft: 0,
      u_marginRight: 0,
      u_marginTop: 0,
      u_marginBottom: 0,

      u_fit: 2, // cover
      u_scale: 1,
      u_rotation: 0,
      u_originX: 0.5,
      u_originY: 0.5,
      u_offsetX: 0,
      u_offsetY: 0,
      u_worldWidth: 0,
      u_worldHeight: 0,
    },
    {
      // Slower than the ground, because this one is looked at directly.
      speed: 0.06,
      stillFrame: 9000,
      minPixelRatio: 2,
      // Only mount once the plate has actually decoded — the mount throws on an
      // incomplete image.
      enabled: plate !== null,
    },
  );

  return (
    <div className={className ? `frost ${className}` : "frost"}>
      {state !== "unsupported" && <div className="frost__shader" ref={ref} aria-hidden="true" />}
      <div className="frost__content">{children}</div>
    </div>
  );
}
