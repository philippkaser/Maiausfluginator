/**
 * The Mai-Score, drawn.
 *
 * The number *is* the visual. No ring, no gauge, no dial — a score out of 100
 * set very large in Fraunces at its display optical size, with the seven
 * components underneath as hairline meters. A ring would spend a lot of ink
 * saying "out of 100", which the number already says, and would leave no room to
 * show what the score is actually made of.
 *
 * Figures are tabular throughout. A score that shifts sideways as the weights
 * change reads as an animation of the layout instead of a change in the value.
 */

import { useCountUp } from "../lib/motion.ts";
import { de1 } from "../../shared/num.ts";
import type { ScoreBreakdown } from "../../shared/scoring.ts";
import { Meter } from "./ui.tsx";

/**
 * The big number. `countKey` decides what counts as "the first time": pass the
 * trip id and it counts up once when the trip appears, then simply changes as
 * the reader moves the weight sliders.
 */
export function ScoreNumeral({
  score,
  countKey,
  size = "lg",
}: {
  score: number | null;
  countKey: string;
  size?: "lg" | "md";
}) {
  const shown = useCountUp(score, countKey);

  return (
    <div className={size === "lg" ? "numeral" : "numeral numeral--md"}>
      <span className="numeral__value tnum">
        {shown === null ? "–" : shown >= 99.95 ? "100" : de1(shown)}
      </span>
      <span className="numeral__unit">
        {score === null ? "noch offen" : <>von 100</>}
      </span>
    </div>
  );
}

/** The seven components, as they contributed to the score above them. */
export function Breakdown({
  breakdown,
  note = true,
}: {
  breakdown: ScoreBreakdown;
  note?: boolean;
}) {
  return (
    <div className="stack">
      <div className="breakdown">
        {breakdown.parts.map((part) => (
          <Meter
            key={part.component}
            label={part.label}
            value={part.value}
            weight={part.effectiveWeight * 100}
            detail={part.detail}
          />
        ))}
      </div>

      {note && breakdown.partial && (
        <p className="small dim">
          Für einzelne Komponenten fehlen Angaben. Die übrigen Gewichte wurden hochgerechnet — ein
          Ausflug verliert nichts, nur weil niemand die Wartezeit notiert hat.
        </p>
      )}
    </div>
  );
}
