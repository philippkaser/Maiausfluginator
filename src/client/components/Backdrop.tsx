import { useEffect, useRef } from "react";

/**
 * The voxel field.
 *
 * An isometric grid of cubes whose heights come from a few summed sine waves -
 * cheap, seamless, and smooth enough to look like a slow swell. Each cube is
 * shaded from a gradient ramp so the whole field reads as one soft aurora
 * rather than 700 individual blocks.
 */
function drawVoxels(canvas: HTMLCanvasElement, time: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const tile = Math.max(22, Math.min(42, width / 34));
  const tileW = tile;
  const tileH = tile * 0.5;
  const cubeH = tile * 0.52;

  // Enough cubes to cover the viewport diagonally, capped so phones stay smooth.
  const cols = Math.min(44, Math.ceil(width / tileW) + 8);
  const rows = Math.min(44, Math.ceil(height / tileH) + 6);

  const originX = width / 2;
  const originY = height * 0.62 - ((cols + rows) * tileH) / 4;

  // Aurora ramp: mint -> sky -> violet -> rose.
  const ramp: [number, number, number][] = [
    [124, 245, 213],
    [122, 162, 255],
    [199, 146, 255],
    [255, 158, 196],
  ];

  const sample = (t: number): [number, number, number] => {
    const clamped = Math.min(0.999, Math.max(0, t));
    const scaled = clamped * (ramp.length - 1);
    const index = Math.floor(scaled);
    const frac = scaled - index;
    const a = ramp[index]!;
    const b = ramp[Math.min(ramp.length - 1, index + 1)]!;
    return [
      a[0] + (b[0] - a[0]) * frac,
      a[1] + (b[1] - a[1]) * frac,
      a[2] + (b[2] - a[2]) * frac,
    ];
  };

  for (let sum = 0; sum <= cols + rows; sum++) {
    for (let i = Math.max(0, sum - rows); i <= Math.min(cols, sum); i++) {
      const j = sum - i;

      const wave =
        Math.sin(i * 0.34 + time * 0.42) +
        Math.sin(j * 0.29 - time * 0.31) +
        Math.sin((i + j) * 0.16 + time * 0.23) * 0.8;
      const norm = Math.min(1, Math.max(0, (wave + 2.8) / 5.6));
      // Snap to discrete levels: that terracing is what makes it read as
      // voxels instead of a smooth dune, while the colour ramp stays gradient.
      const level = Math.round(norm * 7) / 7;
      const lift = level * cubeH * 3.2;
      // Sides run all the way down to the shared base plane, so the field reads
      // as a terrain of columns rather than blocks floating in the dark.
      const columnH = cubeH + lift;

      const x = originX + (i - j) * (tileW / 2);
      const y = originY + (i + j) * (tileH / 2) - lift;

      if (x < -tileW * 2 || x > width + tileW * 2 || y < -tileH * 6 || y > height + tileH * 4) {
        continue;
      }

      const [r, g, b] = sample(level);
      // Taller cubes catch more light; the field fades towards the horizon.
      const depth = 1 - Math.min(1, sum / (cols + rows));
      const alpha = (0.07 + level * 0.3) * (0.3 + depth * 0.7);

      // Top face - the lit one.
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + tileW / 2, y + tileH / 2);
      ctx.lineTo(x, y + tileH);
      ctx.lineTo(x - tileW / 2, y + tileH / 2);
      ctx.closePath();
      ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
      ctx.fill();
      // A hairline along the top edges separates neighbouring cubes.
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.28})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Left face - in shadow.
      ctx.beginPath();
      ctx.moveTo(x - tileW / 2, y + tileH / 2);
      ctx.lineTo(x, y + tileH);
      ctx.lineTo(x, y + tileH + columnH);
      ctx.lineTo(x - tileW / 2, y + tileH / 2 + columnH);
      ctx.closePath();
      ctx.fillStyle = `rgba(${(r * 0.3) | 0}, ${(g * 0.32) | 0}, ${(b * 0.45) | 0}, ${alpha * 0.95})`;
      ctx.fill();

      // Right face - half lit.
      ctx.beginPath();
      ctx.moveTo(x + tileW / 2, y + tileH / 2);
      ctx.lineTo(x, y + tileH);
      ctx.lineTo(x, y + tileH + columnH);
      ctx.lineTo(x + tileW / 2, y + tileH / 2 + columnH);
      ctx.closePath();
      ctx.fillStyle = `rgba(${(r * 0.62) | 0}, ${(g * 0.64) | 0}, ${(b * 0.75) | 0}, ${alpha * 0.8})`;
      ctx.fill();
    }
  }
}

function VoxelField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = 0;
    let start = performance.now();

    if (reduced) {
      drawVoxels(canvas, 0);
      const onResize = () => drawVoxels(canvas, 0);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      // 30 fps is plenty for a slow swell and halves the paint cost.
      if (now - last < 33) return;
      last = now;
      if (document.hidden) return;
      drawVoxels(canvas, (now - start) / 1000);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={ref} className="backdrop__voxels" aria-hidden="true" />;
}

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__blob backdrop__blob--a" />
      <div className="backdrop__blob backdrop__blob--b" />
      <div className="backdrop__blob backdrop__blob--c" />
      <div className="backdrop__blob backdrop__blob--d" />
      <VoxelField />
      <div className="backdrop__grain" />
    </div>
  );
}
