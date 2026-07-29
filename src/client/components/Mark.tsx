import { useEffect, useId, useRef, useState } from "react";
import { liquidMetalFragmentShader, toProcessedLiquidMetal } from "@paper-design/shaders";

import { color, mountShader, supportsShaders } from "../lib/shader.ts";
import { useTheme, type Theme } from "../lib/theme.tsx";

/**
 * The mark: the isometric cube, cast in liquid metal (shaders.com's Mercury).
 *
 * Paper's liquid-metal shader takes a silhouette rather than artwork — it
 * pre-processes the source into an edge-distance field and runs an animated
 * stripe pattern through it, bending the stripes along the contour. So the
 * source below is the cube as three solid faces, each inset a hair so the
 * seams survive as gaps in the silhouette and the shape still reads as a cube
 * and not as a hexagon.
 *
 * The pre-processing is a one-off per page (it rasterises and walks the
 * shape), so it is kept in a module-level promise and shared by every mark on
 * screen. Where WebGL2 is missing, or while the silhouette is still being
 * processed, the flat SVG below stands in — same geometry, so nothing jumps.
 */

const FACES = {
  top: "M12.0 2.76 20.56 7.6 12.0 12.44 3.44 7.6Z",
  left: "M3.12 8.09 11.68 12.93 11.68 21.11 3.12 16.27Z",
  right: "M20.88 8.09 12.32 12.93 12.32 21.11 20.88 16.27Z",
};

const SILHOUETTE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">` +
    `<g fill="#ffffff">` +
    `<path d="${FACES.top}"/><path d="${FACES.left}"/><path d="${FACES.right}"/>` +
    `</g></svg>`,
)}`;

/** Chrome reads differently on each ground: warmer and brighter on ink. */
const MERCURY: Record<Theme, { back: string; tint: string }> = {
  // The tint burns into the metal, so a saturated one turns the whole mark to
  // soot at this size. Pale on ink, a shade deeper on paper.
  dark: { back: "#00000000", tint: "rgba(168, 242, 218, 0.5)" },
  light: { back: "#00000000", tint: "rgba(23, 130, 106, 0.42)" },
};

let silhouettePromise: Promise<HTMLImageElement> | null = null;

function loadSilhouette(): Promise<HTMLImageElement> {
  silhouettePromise ??= toProcessedLiquidMetal(SILHOUETTE).then(
    ({ pngBlob }) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const url = URL.createObjectURL(pngBlob);
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Silhouette konnte nicht geladen werden"));
        };
        image.src = url;
      }),
  );
  return silhouettePromise;
}

/** The flat cube — the fallback, and the shape the shader is cut from. */
function Glyph({ size }: { size: number }) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--mark-hi)" />
          <stop offset="100%" stopColor="var(--mark-lo)" />
        </linearGradient>
      </defs>
      <path d={FACES.top} fill={`url(#${id}-top)`} />
      <path d={FACES.left} fill="var(--mark-lo)" fillOpacity="0.4" />
      <path d={FACES.right} fill="var(--mark-face)" fillOpacity="0.26" />
    </svg>
  );
}

export function Mark({ size = 26 }: { size?: number }) {
  const { theme } = useTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !supportsShaders()) return;

    let disposed = false;
    let dispose: (() => void) | undefined;

    loadSilhouette()
      .then((image) => {
        if (disposed) return;
        const mount = mountShader({
          parent: host,
          fragmentShader: liquidMetalFragmentShader,
          uniforms: {
            u_image: image,
            u_imageAspectRatio: 1,
            u_isImage: true,
            u_colorBack: color(MERCURY[theme].back),
            u_colorTint: color(MERCURY[theme].tint),
            // Few, broad bands: at 26 px a dense stripe pattern is mud.
            u_repetition: 2.1,
            u_softness: 0.62,
            u_shiftRed: 0.24,
            u_shiftBlue: -0.24,
            u_distortion: 0.1,
            u_contour: 0.72,
            u_angle: 30,
            u_shape: 0,
          },
          sizing: { fit: "contain", scale: 1 },
          speed: 0.5,
          // The mark is tiny, so oversampling it is free and it is the only
          // thing keeping the contour from crawling.
          minPixelRatio: 4,
          maxPixelCount: 1024 * 1024,
        });
        if (!mount) return;
        setLive(true);
        dispose = () => {
          mount.dispose();
          setLive(false);
        };
      })
      .catch(() => {
        /* the glyph stays */
      });

    return () => {
      disposed = true;
      dispose?.();
    };
  }, [theme]);

  return (
    <span
      className="mark"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Maiausfluginator"
    >
      <span className="mark__shader" ref={hostRef} />
      <span className="mark__glyph" data-hidden={live}>
        <Glyph size={size} />
      </span>
    </span>
  );
}
