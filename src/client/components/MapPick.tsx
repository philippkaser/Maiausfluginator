/**
 * The map you pick a spot on.
 *
 * Written by hand rather than pulled in, for the same reason everything else
 * here is: a slippy map is a grid of images positioned by two logarithms, and a
 * mapping library is two hundred kilobytes of everything else — layer managers,
 * popups, a second event system, its own CSS with its own idea of what a control
 * looks like. What is actually needed is below, and it takes the pointer
 * handling, the focus ring and the hairlines from the design system already in
 * this app instead of fighting them.
 *
 * Tiles come from `/api/tiles/...`, which is our own server (see `server/osm.ts`
 * — the browser never talks to OpenStreetMap).
 *
 * Two decisions worth defending:
 *
 *   - **A tap drops the pin, a drag moves the map.** Told apart by how far the
 *     pointer travelled, not by which button or how long it was held. Anything
 *     under a few pixels was somebody aiming at a spot.
 *   - **The wheel only zooms with ⌘ or Ctrl held.** This map lives inside a
 *     scrolling sheet, and a map that swallows the scroll wheel traps the page
 *     behind it. The +/− buttons are always there, and they are real buttons, so
 *     the keyboard gets them for free.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { formatKm, formatMinutes } from "../lib/format.ts";
import { haversineKm, roadDistanceKm, estimateTravelMin } from "../../shared/geo.ts";

const TILE = 256;
const MIN_ZOOM = 6;
const MAX_ZOOM = 19;
/** Close enough to see a doorway; where a fresh pick lands. */
const DEFAULT_ZOOM = 14;

/* ------------------------------------------------------------------ */
/* Web Mercator, in tile units                                          */
/* ------------------------------------------------------------------ */

/**
 * Everything below counts in *tiles*, fractionally — tile 3.5 is the middle of
 * tile 3. Pixels are that times 256. Keeping one unit for both the grid and the
 * markers is what stops this from being a file full of conversions.
 */
const lonToTileX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;

const latToTileY = (lat: number, z: number) => {
  const φ = (Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(φ) + 1 / Math.cos(φ)) / Math.PI) / 2) * 2 ** z;
};

const tileXToLon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;

const tileYToLat = (y: number, z: number) => {
  const n = Math.PI - 2 * Math.PI * (y / 2 ** z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

interface View {
  lat: number;
  lon: number;
  z: number;
}

export interface Spot {
  lat: number;
  lon: number;
}

/* ------------------------------------------------------------------ */
/* The component                                                        */
/* ------------------------------------------------------------------ */

export function MapPick({
  hq,
  value,
  onPick,
  busy = false,
}: {
  hq: { label: string; lat: number; lon: number };
  value: Spot | null;
  onPick: (spot: Spot) => void;
  /** True while the address for the current pin is still being looked up. */
  busy?: boolean;
}) {
  const surface = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>(() => ({
    lat: value?.lat ?? hq.lat,
    lon: value?.lon ?? hq.lon,
    z: value ? DEFAULT_ZOOM : 12,
  }));

  /* -- measurement ------------------------------------------------- */

  useLayoutEffect(() => {
    const element = surface.current;
    if (!element) return;
    const measure = () =>
      setSize({ w: element.clientWidth, h: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /* -- following the value from outside ---------------------------- */

  // A search result sets `value` from above, and the map has to go there. Only
  // when it actually changed, though: recentring on every render would fight
  // the member's own panning.
  const followed = useRef<string | null>(null);
  useEffect(() => {
    if (!value) return;
    const key = `${value.lat.toFixed(6)},${value.lon.toFixed(6)}`;
    if (followed.current === key) return;
    followed.current = key;
    setView((current) => ({
      lat: value.lat,
      lon: value.lon,
      z: Math.max(current.z, DEFAULT_ZOOM),
    }));
  }, [value]);

  /* -- panning ----------------------------------------------------- */

  // Held in a ref, not in state: a drag is sixty events a second and none of
  // them are worth a render of their own — the view state below is.
  const drag = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);

  const panBy = useCallback((dxPixels: number, dyPixels: number) => {
    setView((current) => {
      const scale = 2 ** current.z;
      const x = lonToTileX(current.lon, current.z) - dxPixels / TILE;
      const y = latToTileY(current.lat, current.z) - dyPixels / TILE;
      return {
        ...current,
        lon: tileXToLon(x, current.z),
        // Clamped so the map cannot be dragged off the top of the world.
        lat: tileYToLat(Math.max(0, Math.min(scale, y)), current.z),
      };
    });
  }, []);

  /** Zoom keeping one point on screen fixed — the cursor, or the centre. */
  const zoomAround = useCallback(
    (delta: number, anchorX?: number, anchorY?: number) => {
      setView((current) => {
        const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.z + delta));
        if (z === current.z) return current;

        const ax = anchorX ?? size.w / 2;
        const ay = anchorY ?? size.h / 2;

        // Where the anchor is now, in tile units, and where it would land after
        // the scale change. The difference is what the centre has to absorb so
        // the thing under the cursor stays under the cursor.
        const offsetX = (ax - size.w / 2) / TILE;
        const offsetY = (ay - size.h / 2) / TILE;
        const anchorLon = tileXToLon(lonToTileX(current.lon, current.z) + offsetX, current.z);
        const anchorLat = tileYToLat(latToTileY(current.lat, current.z) + offsetY, current.z);

        const nextX = lonToTileX(anchorLon, z) - offsetX;
        const nextY = latToTileY(anchorLat, z) - offsetY;

        return { z, lon: tileXToLon(nextX, z), lat: tileYToLat(nextY, z) };
      });
    },
    [size.w, size.h],
  );

  // Attached by hand because zooming has to preventDefault, and React's onWheel
  // is registered passive — where preventDefault does nothing but log a warning.
  useEffect(() => {
    const element = surface.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      // Without a modifier this is someone scrolling the sheet, not zooming.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const box = element.getBoundingClientRect();
      zoomAround(
        event.deltaY < 0 ? 1 : -1,
        event.clientX - box.left,
        event.clientY - box.top,
      );
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [zoomAround]);

  /* -- geometry for this frame ------------------------------------- */

  const centreX = lonToTileX(view.lon, view.z);
  const centreY = latToTileY(view.lat, view.z);

  /** Tile coordinates -> pixel position inside the surface. */
  const toScreen = (lat: number, lon: number) => ({
    x: (lonToTileX(lon, view.z) - centreX) * TILE + size.w / 2,
    y: (latToTileY(lat, view.z) - centreY) * TILE + size.h / 2,
  });

  const tiles: { key: string; url: string; left: number; top: number }[] = [];
  if (size.w > 0 && size.h > 0) {
    const span = 2 ** view.z;
    const firstX = Math.floor(centreX - size.w / 2 / TILE);
    const lastX = Math.floor(centreX + size.w / 2 / TILE);
    const firstY = Math.floor(centreY - size.h / 2 / TILE);
    const lastY = Math.floor(centreY + size.h / 2 / TILE);

    for (let x = firstX; x <= lastX; x += 1) {
      for (let y = firstY; y <= lastY; y += 1) {
        // Above the pole and below it there is no map, so draw nothing rather
        // than asking for a tile that does not exist.
        if (y < 0 || y >= span) continue;
        // The world wraps sideways; the position does not.
        const wrappedX = ((x % span) + span) % span;
        tiles.push({
          key: `${view.z}/${x}/${y}`,
          url: `/api/tiles/${view.z}/${wrappedX}/${y}`,
          left: Math.round((x - centreX) * TILE + size.w / 2),
          top: Math.round((y - centreY) * TILE + size.h / 2),
        });
      }
    }
  }

  const pin = value ? toScreen(value.lat, value.lon) : null;
  const home = toScreen(hq.lat, hq.lon);

  const straight = value ? haversineKm(hq.lat, hq.lon, value.lat, value.lon) : null;
  const road = straight === null ? null : roadDistanceKm(straight);

  /* -- pointer handling -------------------------------------------- */

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    state.moved += Math.abs(dx) + Math.abs(dy);
    state.x = event.clientX;
    state.y = event.clientY;
    panBy(dx, dy);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    drag.current = null;
    if (!state || state.id !== event.pointerId) return;

    // Under five pixels of travel nobody was panning — they were pointing at a
    // spot, and a map that ignores that is a map you cannot use.
    if (state.moved < 5) {
      const box = event.currentTarget.getBoundingClientRect();
      const offsetX = (event.clientX - box.left - size.w / 2) / TILE;
      const offsetY = (event.clientY - box.top - size.h / 2) / TILE;
      onPick({
        lat: tileYToLat(centreY + offsetY, view.z),
        lon: tileXToLon(centreX + offsetX, view.z),
      });
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    // A screenful is too much and a pixel is nothing; an eighth of the view is a
    // step you can see and repeat.
    const step = Math.max(24, Math.round(size.w / 8));
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };

    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      panBy(move[0], move[1]);
      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomAround(1);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomAround(-1);
    } else if (event.key === "Enter" || event.key === " ") {
      // The centre of the view is the one point the keyboard can aim at.
      event.preventDefault();
      onPick({ lat: view.lat, lon: view.lon });
    }
  }

  return (
    <div className="mappick">
      <div
        ref={surface}
        className="mappick__surface"
        // A group rather than an application: the arrow keys are described
        // below, and the numbers underneath the map are the path that never
        // depends on being able to see it.
        role="group"
        aria-label="Karte — Ort auswählen"
        aria-describedby="mappick-help"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={onKeyDown}
      >
        <div className="mappick__tiles" aria-hidden="true">
          {tiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              width={TILE}
              height={TILE}
              draggable={false}
              className="mappick__tile"
              style={{ left: tile.left, top: tile.top }}
              /**
               * A tile fades in from nothing, which means "nothing" is the state
               * it is in until something says otherwise — and `onLoad` does not
               * fire for an image that finished loading before React attached the
               * handler. Every tile is served `immutable`, so on the second visit
               * to the sheet that is *all* of them, and the map would come up
               * blank. So the ref checks `complete` as well.
               */
              ref={(element) => {
                if (element?.complete) element.classList.add("is-loaded");
              }}
              onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
              // A hole in the map, not a broken image icon in the middle of it.
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
            />
          ))}
        </div>

        {/* The line home. Same statement as the Radar makes, drawn on the thing
            being measured: this is how far from the door you just pointed. */}
        {pin && (
          <svg className="mappick__link" aria-hidden="true">
            <line x1={home.x} y1={home.y} x2={pin.x} y2={pin.y} />
          </svg>
        )}

        <span className="mappick__hq" style={{ left: home.x, top: home.y }} title={hq.label}>
          <span className="mappick__hq-dot" />
          <span className="mappick__hq-label">{hq.label}</span>
        </span>

        {pin && (
          <span
            className={busy ? "mappick__pin is-busy" : "mappick__pin"}
            style={{ left: pin.x, top: pin.y }}
          />
        )}

        <div className="mappick__zoom">
          <button
            type="button"
            className="mappick__btn"
            onClick={() => zoomAround(1)}
            disabled={view.z >= MAX_ZOOM}
            aria-label="Näher heranzoomen"
          >
            +
          </button>
          <button
            type="button"
            className="mappick__btn"
            onClick={() => zoomAround(-1)}
            disabled={view.z <= MIN_ZOOM}
            aria-label="Weiter herauszoomen"
          >
            −
          </button>
        </div>

        {/* Required by the licence, and it is the honest thing on the screen:
            somebody else surveyed all of this. */}
        <a
          className="mappick__credit"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer noopener"
        >
          © OpenStreetMap
        </a>
      </div>

      <div className="mappick__foot">
        <span className="mappick__read tnum" role="status">
          {road === null ? (
            "Tipp auf den Ort — oder such ihn oben."
          ) : (
            <>
              {formatKm(road)} ab HQ · {formatMinutes(estimateTravelMin(road))} Fahrt
            </>
          )}
        </span>
        <span id="mappick-help" className="mappick__help">
          Ziehen verschiebt, ⌘/Ctrl + Rad zoomt. Mit der Tastatur: Pfeiltasten
          verschieben, + und − zoomen, Enter setzt die Mitte.
        </span>
      </div>
    </div>
  );
}
