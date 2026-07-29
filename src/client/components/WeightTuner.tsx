import {
  COMPONENTS,
  COMPONENT_LABELS,
  DEFAULT_WEIGHTS,
  WEIGHT_PRESETS,
  type Weights,
} from "../../shared/scoring.ts";

/**
 * Nobody agrees on what makes a good Ausflug, so the ranking is not fixed:
 * every member can re-weight the seven components and watch the list reorder.
 */
export function WeightTuner({
  weights,
  onChange,
  presetId,
  onPreset,
  open,
  onToggle,
}: {
  weights: Weights;
  onChange: (weights: Weights) => void;
  presetId: string;
  onPreset: (id: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const total = COMPONENTS.reduce((sum, key) => sum + weights[key], 0) || 1;
  const activePreset = WEIGHT_PRESETS.find((preset) => preset.id === presetId);

  return (
    <section className="glass glass--sheen glass--pad">
      <div className="row row--between">
        <div>
          <span className="eyebrow">Gewichtung</span>
          <h2 style={{ marginTop: 4 }}>Wonach ranken wir?</h2>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onToggle} aria-expanded={open}>
          {open ? "Regler ausblenden" : "Regler zeigen"}
        </button>
      </div>

      <p className="muted small" style={{ margin: "10px 0 16px", maxWidth: "62ch" }}>
        {activePreset?.blurb ?? "Eigene Mischung – die Rangliste rechnet live mit deinen Reglern."}
      </p>

      <div className="tuner__presets">
        {WEIGHT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="preset"
            aria-pressed={preset.id === presetId}
            onClick={() => {
              onPreset(preset.id);
              onChange(preset.weights);
            }}
            title={preset.blurb}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className="preset"
          onClick={() => {
            onPreset("haus");
            onChange(DEFAULT_WEIGHTS);
          }}
        >
          Zurücksetzen
        </button>
      </div>

      {open && (
        <>
          <hr className="divider" style={{ margin: "20px 0 18px" }} />
          <div className="sliders">
            {COMPONENTS.map((key) => {
              const share = Math.round((weights[key] / total) * 100);
              return (
                <label key={key} className="field" style={{ gap: 2 }}>
                  <span className="slider__head">
                    <span>{COMPONENT_LABELS[key]}</span>
                    <span className="slider__pct">{share} %</span>
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
              );
            })}
          </div>
          <p className="muted small" style={{ marginTop: 14 }}>
            Komponenten ohne Daten werden übersprungen und die übrigen Gewichte entsprechend
            hochgerechnet – ein Ausflug verliert also nichts, nur weil niemand die Wartezeit notiert hat.
          </p>
        </>
      )}
    </section>
  );
}
