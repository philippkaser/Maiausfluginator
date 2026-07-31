/**
 * Gewichtung.
 *
 * Nobody agrees on what makes a good Ausflug, so the ranking is not fixed:
 * everyone can re-weight the seven components and watch the list reorder behind
 * the sheet. It lives here rather than on the page because it belongs to the
 * reader, not to the ranking — the Rangliste is a document and this is a lens
 * held up to it. The setting stays in this browser and nowhere else.
 */

import { Sheet } from "../components/Sheet.tsx";
import { Segmented } from "../components/ui.tsx";
import {
  COMPONENTS,
  COMPONENT_LABELS,
  DEFAULT_WEIGHTS,
  WEIGHT_PRESETS,
  type Weights,
} from "../../shared/scoring.ts";

export function WeightSheet({
  weights,
  onChange,
  presetId,
  onPreset,
  onClose,
}: {
  weights: Weights;
  onChange: (weights: Weights) => void;
  presetId: string;
  onPreset: (id: string) => void;
  onClose: () => void;
}) {
  const total = COMPONENTS.reduce((sum, key) => sum + weights[key], 0) || 1;
  const active = WEIGHT_PRESETS.find((preset) => preset.id === presetId);

  const options = WEIGHT_PRESETS.map((preset) => ({
    value: preset.id,
    label: preset.label,
    title: preset.blurb,
  }));
  if (!active) options.push({ value: "eigen", label: "Eigen", title: "Deine Regler" });

  return (
    <Sheet
      title="Gewichtung"
      description={active?.blurb ?? "Deine eigene Mischung — die Rangliste rechnet live mit."}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn btn--block"
          onClick={() => {
            onPreset("haus");
            onChange(DEFAULT_WEIGHTS);
          }}
        >
          Zurück aufs Hausrezept
        </button>
      }
    >
      <div className="stack stack--md">
        <Segmented
          value={active ? presetId : "eigen"}
          options={options}
          label="Voreinstellung"
          block
          onChange={(id) => {
            const preset = WEIGHT_PRESETS.find((entry) => entry.id === id);
            onPreset(id);
            onChange(preset ? preset.weights : DEFAULT_WEIGHTS);
          }}
        />

        <div className="stack">
          {COMPONENTS.map((key) => (
            <label key={key} className="slider">
              <span className="slider__head">
                <span className="slider__name">{COMPONENT_LABELS[key]}</span>
                <span className="slider__pct tnum">
                  {Math.round((weights[key] / total) * 100)} %
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={weights[key]}
                style={{ ["--fill" as string]: `${(weights[key] / 50) * 100}%` }}
                onChange={(event) => {
                  // Touching any slider means you have left the preset behind.
                  onPreset("eigen");
                  onChange({ ...weights, [key]: Number(event.target.value) });
                }}
                aria-label={`Gewicht ${COMPONENT_LABELS[key]}`}
              />
            </label>
          ))}
        </div>

        <p className="small dim">
          Die Prozente sind Anteile an der Summe, nicht Absolutwerte — zieh einen Regler hoch und die
          anderen werden von selbst leichter. Komponenten ohne Angaben fallen aus der Rechnung.
        </p>
      </div>
    </Sheet>
  );
}
