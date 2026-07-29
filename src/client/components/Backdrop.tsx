import { useEffect, useRef } from "react";

/**
 * The voxel field.
 *
 * An isometric grid of columns whose heights come from a few summed sine waves,
 * snapped to discrete levels. Deliberately near-monochrome: it is a texture in
 * the room, not the subject of the page.
 *
 * The field is unbounded — rather than laying out a fixed block of cubes and
 * hoping it is large enough, the projection is inverted to find exactly which
 * grid cells fall inside the viewport. That fills any aspect ratio edge to edge
 * and draws nothing that would land off-screen.
 */
function drawVoxels(canvas: HTMLCanvasElement, time: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return;

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // Tile size scales with the viewport. Drawing is geometry-bound rather than
  // fill-bound, so cube count is the only lever that matters for frame cost —
  // hence chunky tiles and a hard budget as a backstop on very large windows.
  const CUBE_BUDGET = 5200;
  const preferred = Math.sqrt(width * height) / 20;
  const budgetFloor = Math.sqrt((4 * width * height * 1.2) / CUBE_BUDGET);
  const tile = Math.min(140, Math.max(40, preferred, budgetFloor));

  const tileW = tile;
  const tileH = tile * 0.5;
  const cubeH = tile * 0.52;
  const maxLift = cubeH * 3.2;

  const originX = width / 2;
  const originY = height / 2;

  // Screen position is x = originX + u·tileW/2, y = originY + v·tileH/2 - lift,
  // where u = i - j and v = i + j. Inverting that gives the visible band of u/v.
  const uMin = Math.floor((2 * -originX) / tileW) - 2;
  const uMax = Math.ceil((2 * (width - originX)) / tileW) + 2;
  const vMin = Math.floor((2 * -originY) / tileH) - 2;
  // Columns further back can still be lifted into view, so reach past the bottom.
  const vMax = Math.ceil((2 * (height + maxLift - originY)) / tileH) + 2;

  // Cool grey with a faint blue lift towards the peaks.
  const ramp: [number, number, number][] = [
    [116, 124, 142],
    [140, 152, 176],
    [170, 186, 214],
    [198, 214, 240],
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

  // Back to front: rising v moves towards the viewer, so later draws overlap.
  for (let v = vMin; v <= vMax; v++) {
    // u = 2i - v, so u and v always share parity.
    let u = uMin;
    if (Math.abs((u - v) % 2) === 1) u++;

    for (; u <= uMax; u += 2) {
      const i = (u + v) / 2;
      const j = (v - u) / 2;

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

      const x = originX + u * (tileW / 2);
      const y = originY + v * (tileH / 2) - lift;

      if (y + tileH + columnH < 0 || y > height) continue;

      const [r, g, b] = sample(level);
      // Aerial perspective: the far edge of the field sits back in the haze.
      const depth = Math.min(1, Math.max(0, y / height));
      const alpha = (0.045 + level * 0.16) * (0.34 + depth * 0.66);

      // Top face — the lit one.
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + tileW / 2, y + tileH / 2);
      ctx.lineTo(x, y + tileH);
      ctx.lineTo(x - tileW / 2, y + tileH / 2);
      ctx.closePath();
      ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
      ctx.fill();
      // A hairline along the top edges separates neighbouring cubes.
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.35})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Left face — in shadow.
      ctx.beginPath();
      ctx.moveTo(x - tileW / 2, y + tileH / 2);
      ctx.lineTo(x, y + tileH);
      ctx.lineTo(x, y + tileH + columnH);
      ctx.lineTo(x - tileW / 2, y + tileH / 2 + columnH);
      ctx.closePath();
      ctx.fillStyle = `rgba(${(r * 0.34) | 0}, ${(g * 0.36) | 0}, ${(b * 0.44) | 0}, ${alpha * 0.95})`;
      ctx.fill();

      // Right face — half lit.
      ctx.beginPath();
      ctx.moveTo(x + tileW / 2, y + tileH / 2);
      ctx.lineTo(x, y + tileH);
      ctx.lineTo(x, y + tileH + columnH);
      ctx.lineTo(x + tileW / 2, y + tileH / 2 + columnH);
      ctx.closePath();
      ctx.fillStyle = `rgba(${(r * 0.6) | 0}, ${(g * 0.63) | 0}, ${(b * 0.72) | 0}, ${alpha * 0.82})`;
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

    if (reduced) {
      drawVoxels(canvas, 0);
      const onResize = () => drawVoxels(canvas, 0);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    let frame = 0;
    let last = 0;
    const start = performance.now();

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
      <div className="backdrop__wash backdrop__wash--a" />
      <div className="backdrop__wash backdrop__wash--b" />
      <VoxelField />
      <div className="backdrop__grain" />
    </div>
  );
}
