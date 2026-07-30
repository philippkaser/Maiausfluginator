import { useEffect, useState } from "react";

import { api, ApiError } from "../lib/api.ts";
import { formatRelative } from "../lib/format.ts";
import { useToast } from "../lib/store.tsx";
import type { Invite } from "../../shared/types.ts";
import { Empty, Field, Spinner, Tag } from "../components/ui.tsx";

export function Admin() {
  const toast = useToast();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [note, setNote] = useState("");
  const [grantsAdmin, setGrantsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    api
      .invites()
      .then((data) => setInvites(data.invites))
      .catch((err) => toast(err instanceof ApiError ? err.message : "Laden fehlgeschlagen", "error"));
  }

  useEffect(load, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.createInvite(note.trim() || null, grantsAdmin);
      setNote("");
      setGrantsAdmin(false);
      load();
      try {
        await navigator.clipboard.writeText(result.code);
        toast(`Code ${result.code} erstellt und kopiert.`, "success");
      } catch {
        toast(`Code erstellt: ${result.code}`, "success");
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Hat nicht geklappt", "error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(code: string) {
    if (!confirm(`Code ${code} zurückziehen?`)) return;
    try {
      await api.revokeInvite(code);
      load();
      toast("Code zurückgezogen.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Hat nicht geklappt", "error");
    }
  }

  const open = invites?.filter((invite) => invite.usedAt === null) ?? [];
  const used = invites?.filter((invite) => invite.usedAt !== null) ?? [];

  return (
    <div className="stack stack--lg">
      <div>
        <h1>Einladungen</h1>
        <p className="lead" style={{ marginTop: 10 }}>
          Jeder Code gilt genau einmal. Wer ihn einlöst, wählt seinen Namen und bekommt einen
          persönlichen Schlüssel – den solltest du nie zu sehen bekommen.
        </p>
      </div>

      <section className="card card--pad">
        <form onSubmit={create} className="stack">
          <Field label="Notiz" hint="Für wen ist der Code? Nur intern sichtbar.">
            <input
              className="input"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Für Anna aus der Vorstufe"
              maxLength={120}
            />
          </Field>
          <label className="row row--tight" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={grantsAdmin}
              onChange={(event) => setGrantsAdmin(event.target.checked)}
            />
            <span className="small">Dieser Code macht das neue Mitglied zum Admin</span>
          </label>
          <button type="submit" className="btn btn--primary" disabled={busy} style={{ alignSelf: "flex-start" }}>
            {busy ? "Moment…" : "Code erzeugen"}
          </button>
        </form>
      </section>

      <section className="card card--pad">
        <h2 style={{ marginBottom: 16 }}>Offene Codes ({open.length})</h2>
        {invites === null ? (
          <Spinner />
        ) : open.length === 0 ? (
          <Empty title="Kein offener Code.">
            <p className="small">Erzeug oben einen, wenn jemand dazukommen soll.</p>
          </Empty>
        ) : (
          <div className="stack stack--sm">
            {open.map((invite) => (
              <div key={invite.code} className="row row--between" style={{ padding: "12px 0", borderTop: "1px solid var(--hairline)" }}>
                <div>
                  <div className="mono" style={{ fontSize: "1.05rem", fontWeight: 600 }}>
                    {invite.code}
                  </div>
                  <div className="dim small">
                    {invite.note ?? "ohne Notiz"} · erstellt {formatRelative(invite.createdAt)}
                    {invite.createdByName ? ` von ${invite.createdByName}` : ""}
                  </div>
                </div>
                <div className="row row--tight">
                  {invite.grantsAdmin && <Tag accent>Admin</Tag>}
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(invite.code);
                        toast("Code kopiert.", "success");
                      } catch {
                        toast("Kopieren hat nicht geklappt.", "error");
                      }
                    }}
                  >
                    Kopieren
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => revoke(invite.code)}
                  >
                    Zurückziehen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {used.length > 0 && (
        <section className="card card--pad">
          <h2 style={{ marginBottom: 16 }}>Eingelöste Codes ({used.length})</h2>
          <div className="table__scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Eingelost von</th>
                  <th>Wann</th>
                  <th>Notiz</th>
                </tr>
              </thead>
              <tbody>
                {used.map((invite) => (
                  <tr key={invite.code}>
                    <td className="mono small">{invite.code}</td>
                    <td>{invite.usedByName ?? "–"}</td>
                    <td className="dim small">{invite.usedAt ? formatRelative(invite.usedAt) : "–"}</td>
                    <td className="dim small">{invite.note ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
