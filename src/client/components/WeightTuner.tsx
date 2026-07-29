import { useState } from "react";

import {
  COMPONENTS,
  COMPONENT_LABELS,
  DEFAULT_WEIGHTS,
  WEIGHT_PRESETS,
  type Weights,
} from "../../shared/scoring.ts";
import { Segmented } from "./ui.tsx";

/**
 * Nobody agrees on what makes a good Ausflug, so the ranking is not fixed:
 * every member can re-weight the seven components and watch the list reorder.
 */
export function WeightTuner({
  weights,
  onChange,
  presetId,
  onPreset,
}: {
  weights: Weights;
  onChange: (weights: Weights) => void;
  presetId: string;
  onPreset: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = COMPONENTS.reduce((sum, key) => sum + weights[key], 0) || 1;
  const activePreset = WEIGHT_PRESETS.find((preset) => preset.id === presetId);

  const options = WEIGHT_PRESETS.map((preset) => ({
    value: preset.id,
    label: preset.label,
    title: preset.blurb,
  }));
  if (!activePreset) options.push({ value: "eigen", label: "Eigen", title: "Deine Regler" });

  return (
    <section className="card card--pad">
      <div className="section__head" style={{ marginBottom: 12 }}>
        <div>
          <h2>Gewichtung</h2>
          <p className="small dim" style={{ marginTop: 4 }}>
            {activePreset?.blurb ?? "Eigene Mischung — die Rangliste rechnet live mit."}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--quiet btn--sm"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? "Regler ausblenden" : "Regler"}
        </button>
      </div>

      <Segmented
        value={activePreset ? presetId : "eigen"}
        options={options}
        label="Voreinstellung"
        onChange={(id) => {
          const preset = WEIGHT_PRESETS.find((entry) => entry.id === id);
          onPreset(id);
          onChange(preset ? preset.weights : DEFAULT_WEIGHTS);
        }}
      />

      {open && (
        <>
          <hr className="divider" style={{ margin: "18px 0 16px" }} />
          <div className="sliders">
            {COMPONENTS.map((key) => (
              <label key={key} className="field" style={{ gap: 2 }}>
                <span className="slider__head">
                  <span>{COMPONENT_LABELS[key]}</span>
                  <span className="slider__pct">{Math.round((weights[key] / total) * 100)} %</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={weights[key]}
                  style={{ ["--fill" as string]: `${(weights[key] / 50) * 100}%` }}
                  onChange={(event) => {
                    onPreset("eigen");
                    onChange({ ...weights, [key]: Number(event.target.value) });
                  }}
                  aria-label={`Gewicht ${COMPONENT_LABELS[key]}`}
                />
              </label>
            ))}
          </div>
          <p className="small dim" style={{ marginTop: 14 }}>
            Komponenten ohne Daten werden übersprungen und die übrigen Gewichte entsprechend
            hochgerechnet.
          </p>
        </>
      )}
    </section>
  );
}
