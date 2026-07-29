import { useState } from "react";

import { api, ApiError } from "../lib/api.ts";
import { useSession, useToast } from "../lib/store.tsx";
import { Field } from "../components/ui.tsx";

type Mode = "login" | "redeem";

export function Gate() {
  const { setMe, needsBootstrap } = useSession();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>(needsBootstrap ? "redeem" : "login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<{ key: string; handle: string } | null>(null);

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
        setFreshKey({ key: result.personalKey, handle: result.me.handle });
        setMe(result.me);
      } else {
        const result = await api.login(handle, personalKey);
        setMe(result.me);
        toast(`Willkommen zurück, ${result.me.displayName}.`, "success");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Etwas ist schiefgelaufen.");
    } finally {
      setBusy(false);
    }
  }

  // Shown once, right after redeeming - this is the only time the key is visible.
  if (freshKey) {
    return (
      <div className="gate">
        <div className="glass glass--sheen gate__card fade-up">
          <div className="gate__logo" />
          <span className="eyebrow">Willkommen an Bord</span>
          <h1 style={{ margin: "8px 0 14px" }}>Dein Schlüssel</h1>
          <p className="muted">
            Notier dir das jetzt. Der Schlüssel wird nur einmal angezeigt und ist zusammen mit deinem
            Namen dein Login auf jedem weiteren Gerät.
          </p>

          <div className="keycard" style={{ margin: "20px 0" }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Name: {freshKey.handle}
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
                  toast("Schlüssel kopiert.", "success");
                } catch {
                  toast("Kopieren hat nicht geklappt – bitte abschreiben.", "error");
                }
              }}
            >
              Kopieren
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setFreshKey(null)}>
              Habe ich notiert
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gate">
      <div className="glass glass--sheen gate__card fade-up">
        <div className="gate__logo" />
        <span className="eyebrow">Durst Brixen · intern</span>
        <h1 style={{ margin: "8px 0 12px" }}>
          Mai<span className="gradient-text">ausfluginator</span>
        </h1>
        <p className="muted">
          Die Bewertungszentrale unserer Mai-Ausflüge. Vom Kilometerstand ab HQ über die Wartezeit
          aufs Essen bis zum Foto vom Teller – hier landet alles.
        </p>

        {needsBootstrap && (
          <div className="keycard" style={{ marginTop: 18 }}>
            <strong>Erster Start.</strong> Der Admin-Einladungscode steht in der Server-Konsole.
          </div>
        )}

        <div className="gate__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className="gate__tab"
            aria-selected={mode === "login"}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Anmelden
          </button>
          <button
            type="button"
            role="tab"
            className="gate__tab"
            aria-selected={mode === "redeem"}
            onClick={() => {
              setMode("redeem");
              setError(null);
            }}
          >
            Einladung einlösen
          </button>
        </div>

        <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
          {mode === "redeem" ? (
            <>
              <Field label="Einladungscode" hint="Steht in deiner Einladung, Groß-/Kleinschreibung egal.">
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
              <Field label="Name" hint="Dein Anzeigename oder dein Kurzname.">
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

          {error && (
            <div className="toast toast--error" style={{ animation: "none" }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "Moment…" : mode === "redeem" ? "Einladung einlösen" : "Anmelden"}
          </button>
        </form>

        <p className="muted small" style={{ marginTop: 18 }}>
          Kein Zugang? Frag jemanden aus der Runde nach einem Einladungscode – anders kommt hier
          niemand rein.
        </p>
      </div>
    </div>
  );
}
