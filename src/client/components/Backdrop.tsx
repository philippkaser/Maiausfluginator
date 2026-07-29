import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The ground the whole app floats on: a fragment shader painting a slow
 * aurora.
 *
 * Two rounds of domain warping over value-noise fbm, coloured by mixing four
 * palette stops along the warp field. That is what keeps it from looking like
 * the usual pair of blurred blobs — the boundaries between colours are folded
 * into each other rather than blended, so the field has filaments and eddies
 * instead of a soft bruise.
 *
 * It is deliberately cheap: the field has no detail above a few cycles per
 * screen, so it renders at 55 % resolution and is upscaled by the compositor
 * for free, at 30 fps, paused whenever the tab is hidden. On a machine with no
 * WebGL at all, a static CSS gradient stands in.
 */

const VERTEX = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_pointer;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    value += amp * noise(p);
    p = rot * p * 2.03;
    amp *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  // Centred and aspect-corrected, so the field never stretches with the window.
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;

  float t = u_time * 0.038;
  // The pointer leans on the field rather than dragging it — barely there,
  // but enough that the page feels like it is aware of you.
  p += u_pointer * 0.06;

  vec2 q = vec2(
    fbm(p * 1.55 + vec2(0.0, t * 1.4)),
    fbm(p * 1.55 + vec2(5.2, 1.3) - t * 1.1)
  );

  vec2 r = vec2(
    fbm(p * 1.85 + 2.6 * q + vec2(1.7, 9.2) + t * 1.9),
    fbm(p * 1.85 + 2.6 * q + vec2(8.3, 2.8) - t * 1.5)
  );

  float f = fbm(p * 1.7 + 2.2 * r);

  // Almost the whole frame is ink and midnight blue. The greens only surface
  // where the warp folds hardest — hence the steep powers — and the warm stop
  // is a rumour in one corner. A field that is evenly lit everywhere reads as
  // fog, and glass laid on fog stops looking like glass.
  vec3 deep = vec3(0.012, 0.020, 0.034);
  vec3 night = vec3(0.075, 0.180, 0.330);
  vec3 teal = vec3(0.098, 0.430, 0.455);
  vec3 mint = vec3(0.278, 0.741, 0.639);
  vec3 lime = vec3(0.741, 0.925, 0.478);
  vec3 rose = vec3(0.667, 0.290, 0.404);

  vec3 col = deep;
  col = mix(col, night, smoothstep(0.24, 0.88, f));
  col = mix(col, teal, pow(clamp(length(q) * 0.82, 0.0, 1.0), 1.7));
  col = mix(col, mint, pow(clamp(r.x * 1.35, 0.0, 1.0), 2.8) * 0.95);
  col = mix(col, lime, pow(clamp(r.y * 1.3, 0.0, 1.0), 4.5) * 0.5);
  col = mix(
    col,
    rose,
    pow(clamp(q.y * 1.1, 0.0, 1.0), 3.0) * smoothstep(0.1, 0.9, 1.0 - uv.y) *
      smoothstep(0.85, 0.15, uv.x) * 0.7
  );

  // Caustics: thin bright creases where the folded field doubles back.
  float crease = pow(max(0.0, sin((f + r.x) * 9.0 - u_time * 0.3)), 12.0);
  col += crease * 0.05 * vec3(0.7, 1.0, 0.9);

  // A slow large-scale mask so parts of the screen are genuinely dark. This is
  // what gives the field a shape instead of an even glow.
  col *= 0.5 + 0.5 * smoothstep(0.22, 0.82, fbm(p * 0.62 + vec2(t * 1.2, -t)));
  // Light falls from above; the bottom of the screen sits in shadow.
  col *= 0.38 + 0.62 * smoothstep(-0.2, 1.1, uv.y + f * 0.35);
  col *= 1.25;

  // A touch of noise before quantisation, or the wide smooth areas band into
  // visible steps on 8-bit displays.
  col += (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) / 220.0;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Sets up the program and returns a draw function, or null if WebGL is out. */
function createRenderer(canvas: HTMLCanvasElement) {
  const gl =
    (canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    }) as WebGLRenderingContext | null) ??
    (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
  if (!gl) return null;

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  // One oversized triangle instead of two — same coverage, no seam down the
  // diagonal, one vertex fewer to think about.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "u_res");
  const uTime = gl.getUniformLocation(program, "u_time");
  const uPointer = gl.getUniformLocation(program, "u_pointer");

  // The field is smooth by construction, so rendering below device resolution
  // costs nothing visible and saves most of the fill.
  const SCALE = 0.55;

  return {
    gl,
    resize() {
      const width = Math.max(1, Math.round(canvas.clientWidth * SCALE));
      const height = Math.max(1, Math.round(canvas.clientHeight * SCALE));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    },
    draw(time: number, pointerX: number, pointerY: number) {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uPointer, pointerX, pointerY);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

function Aurora({ onFail }: { onFail: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const renderer = createRenderer(canvas);
    if (!renderer) {
      onFail();
      return;
    }

    const onContextLost = (event: Event) => {
      event.preventDefault();
      onFail();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const onPointerMove = (event: PointerEvent) => {
      pointer.targetX = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.targetY = 1 - (event.clientY / window.innerHeight) * 2;
    };

    let frame = 0;
    let last = 0;
    const start = performance.now();

    const still = () => {
      renderer.resize();
      // A fixed offset into the animation: the frame at t=0 is the least
      // interesting one the field ever produces.
      renderer.draw(42, 0, 0);
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (now - last < 33) return; // 30 fps is plenty for a swell this slow
      last = now;
      if (document.hidden) return;
      pointer.x += (pointer.targetX - pointer.x) * 0.045;
      pointer.y += (pointer.targetY - pointer.y) * 0.045;
      renderer.resize();
      renderer.draw((now - start) / 1000, pointer.x, pointer.y);
    };

    const startAnimating = () => {
      if (reduced.matches) {
        still();
        return;
      }
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      frame = requestAnimationFrame(loop);
    };

    const stopAnimating = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener("pointermove", onPointerMove);
    };

    const onMotionChange = () => {
      stopAnimating();
      startAnimating();
    };

    const onResize = () => {
      if (reduced.matches) still();
    };

    startAnimating();
    reduced.addEventListener("change", onMotionChange);
    window.addEventListener("resize", onResize);

    return () => {
      stopAnimating();
      reduced.removeEventListener("change", onMotionChange);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("webglcontextlost", onContextLost);
    };
  }, [onFail]);

  return <canvas ref={ref} className="backdrop__shader" aria-hidden="true" />;
}

export function Backdrop() {
  const [failed, setFailed] = useState(false);
  // Stable, or every re-render of the app would tear down the GL context.
  const onFail = useCallback(() => setFailed(true), []);

  return (
    <div className="backdrop" aria-hidden="true">
      {failed ? <div className="backdrop__fallback" /> : <Aurora onFail={onFail} />}
      <div className="backdrop__vignette" />
      <div className="backdrop__grain" />
    </div>
  );
}
