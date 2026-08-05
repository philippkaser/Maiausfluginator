/**
 * The front door.
 *
 * The first screen anyone sees, and the only one they see before they are a
 * member — so it carries the design language on its own: one refracted glass
 * panel on the aurora, the mark, and two ways in. There is no marketing copy
 * because there is nothing to sell; this is an invite-only list of where a
 * company had lunch.
 *
 * There are no passwords and no email anywhere in this app. Redeem an invite,
 * pick a name, and you are shown a personal key exactly once. Name plus key is
 * the login on every other device.
 */

import { useState } from "react";

import { Frost } from "../components/Frost.tsx";
import { Field, Mark, Segmented } from "../components/ui.tsx";
import { api, ApiError } from "../lib/api.ts";
import { useSession, useToast } from "../lib/store.tsx";

type Mode = "login" | "redeem";

export function Gate() {
  const { setMe, needsBootstrap } = useSession();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>(needsBootstrap ? "redeem" : "login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<{ key: string; handle: string } | null>(null);

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
        // The key is shown before the session is used, so nobody lands in the
        // app having never seen it.
        setFresh({ key: result.personalKey, handle: result.me.handle });
        setMe(result.me);
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

  return (
    <main className="gate">
        <Frost className="gate__panel">
          {fresh ? (
            // Shown once, right after redeeming — the only moment the key exists
            // in readable form anywhere.
            <div className="gate__inner stack stack--md">
              <span className="gate__mark" aria-hidden="true">
                <Mark size={26} />
              </span>

              <div className="stack" style={{ gap: 8 }}>
                <h1 className="gate__title">Dein Schlüssel</h1>
                <p className="muted">
                  Notier ihn jetzt. Er wird nur dieses eine Mal angezeigt und ist zusammen mit deinem
                  Namen dein Login auf jedem weiteren Gerät.
                </p>
              </div>

              <div className="keycard">
                <div className="field__label" style={{ marginBottom: 6 }}>
                  {fresh.handle}
                </div>
                <div className="keycard__code">{fresh.key}</div>
              </div>

              <div className="row">
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(fresh.key);
                      toast("Kopiert.");
                    } catch {
                      toast("Kopieren geht hier nicht — bitte abschreiben.", "error");
                    }
                  }}
                >
                  Kopieren
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setFresh(null)}
                >
                  Habe ich notiert
                </button>
              </div>
            </div>
          ) : (
            <div className="gate__inner stack stack--md">
              <span className="gate__mark" aria-hidden="true">
                <Mark size={26} />
              </span>

              <div className="stack" style={{ gap: 8 }}>
                <h1 className="gate__title">Maiausfluginator</h1>
                <p className="muted">
                  Die Bewertungszentrale unserer Mai-Ausflüge. Zutritt nur mit Einladung.
                </p>
              </div>

              {needsBootstrap && (
                <div className="keycard small">
                  Erster Start: der Admin-Einladungscode steht in der Server-Konsole.
                </div>
              )}

              <Segmented
                value={mode}
                label="Zugang"
                block
                options={[
                  { value: "login", label: "Anmelden" },
                  { value: "redeem", label: "Einladung einlösen" },
                ]}
                onChange={(next) => {
                  setMode(next);
                  setError(null);
                }}
              />

              <form onSubmit={submit} className="stack">
                {mode === "redeem" ? (
                  <>
                    <Field label="Einladungscode" hint="Groß- und Kleinschreibung ist egal.">
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

                {error && (
                  <div className="inline-error" role="alert">
                    {error}
                  </div>
                )}

                <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
                  {busy ? "Moment…" : mode === "redeem" ? "Einladung einlösen" : "Anmelden"}
                </button>
              </form>

              {/* Two different dead ends, and the way out of each is a different
                  person's doing — so both are spelled out. Nobody can look a key
                  up (only a hash of it is stored), which is why the answer to a
                  lost one is a new one and not a reminder. */}
              <p className="small dim">
                {mode === "redeem"
                  ? "Kein Code? Frag jemanden aus der Runde — jeder Code gilt genau einmal."
                  : "Schlüssel verloren? Nachsehen kann ihn niemand. Ein Admin aus der Runde stellt dir in der Verwaltung einen neuen aus, der alte verfällt dabei."}
              </p>
            </div>
          )}
      </Frost>
    </main>
  );
}
