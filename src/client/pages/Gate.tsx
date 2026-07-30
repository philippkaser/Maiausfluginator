import { useState } from "react";

import { api, ApiError } from "../lib/api.ts";
import { useSession, useToast } from "../lib/store.tsx";
import type { Me } from "../../shared/types.ts";
import { Field, Mark, Segmented } from "../components/ui.tsx";

type Mode = "login" | "redeem";

export function Gate() {
  const { setMe, needsBootstrap } = useSession();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>(needsBootstrap ? "redeem" : "login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<{ key: string; handle: string; me: Me } | null>(null);

  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [personalKey, setPersonalKey] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "redeem") {
        const result = await api.redeem(code, displayName);
        // The session cookie is already set, so `me` is deliberately left
        // alone until the key is dismissed — publishing it here would swap
        // the Gate out for the app and the key would never be shown at all.
        setFreshKey({ key: result.personalKey, handle: result.me.handle, me: result.me });
      } else {
        const result = await api.login(handle, personalKey);
        setMe(result.me);
        toast(`Willkommen zurück, ${result.me.displayName}.`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Etwas ist schiefgelaufen.");
    } finally {
      setBusy(false);
    }
  }

  // Shown once, right after redeeming — the only time the key is visible.
  if (freshKey) {
    return (
      <div className="gate">
        <div className="card gate__card glass--rim">
          <div className="gate__mark">
            <Mark size={30} />
          </div>
          <h1 style={{ fontSize: "1.8rem" }}>Dein Schlüssel</h1>
          <p className="muted" style={{ marginTop: 10 }}>
            Notier ihn dir jetzt. Er wird nur einmal angezeigt und ist zusammen mit deinem Namen dein
            Login auf jedem weiteren Gerät.
          </p>

          <div className="keycard" style={{ margin: "20px 0" }}>
            <div className="field__label" style={{ marginBottom: 6 }}>
              {freshKey.handle}
            </div>
            <div className="keycard__code">{freshKey.key}</div>
          </div>

          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(freshKey.key);
                  toast("Schlüssel kopiert.");
                } catch {
                  toast("Kopieren hat nicht geklappt – bitte abschreiben.", "error");
                }
              }}
            >
              Kopieren
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setMe(freshKey.me)}>
              Habe ich notiert
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gate">
      <div className="card gate__card glass--rim">
        <div className="gate__mark">
          <Mark size={30} />
        </div>

        <h1 style={{ fontSize: "1.8rem" }}>Maiausfluginator</h1>
        <p className="muted" style={{ marginTop: 10 }}>
          Die Bewertungszentrale unserer Mai-Ausflüge. Zutritt nur mit Einladung.
        </p>

        {needsBootstrap && (
          <div className="keycard small" style={{ marginTop: 18 }}>
            Erster Start: der Admin-Einladungscode steht in der Server-Konsole.
          </div>
        )}

        <div style={{ margin: "22px 0 18px" }}>
          <Segmented
            value={mode}
            label="Zugang"
            options={[
              { value: "login", label: "Anmelden" },
              { value: "redeem", label: "Einladung einlösen" },
            ]}
            onChange={(next) => {
              setMode(next);
              setError(null);
            }}
          />
        </div>

        <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
          {mode === "redeem" ? (
            <>
              <Field label="Einladungscode" hint="Groß-/Kleinschreibung egal.">
                <input
                  className="input input--code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="XXXX-XXXX-XXXX"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  required
                />
              </Field>
              <Field label="Dein Name" hint="So erscheinst du bei deinen Bewertungen.">
                <input
                  className="input"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Anna Gruber"
                  autoComplete="name"
                  maxLength={40}
                  required
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Name">
                <input
                  className="input"
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                  placeholder="anna.gruber"
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="Schlüssel">
                <input
                  className="input input--code"
                  value={personalKey}
                  onChange={(event) => setPersonalKey(event.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  autoComplete="current-password"
                  spellCheck={false}
                  required
                />
              </Field>
            </>
          )}

          {error && <div className="inline-error">{error}</div>}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "Moment…" : mode === "redeem" ? "Einladung einlösen" : "Anmelden"}
          </button>
        </form>

        <p className="dim small" style={{ marginTop: 18 }}>
          Kein Zugang? Frag jemanden aus der Runde nach einem Einladungscode.
        </p>
      </div>
    </div>
  );
}
