/**
 * Verwaltung.
 *
 * Invite codes, and nothing else — this app has no settings worth a page. Each
 * code works exactly once; whoever redeems it picks their own name and gets a
 * personal key that an admin should never see.
 */

import { useCallback, useEffect, useState } from "react";

import { Sheet } from "../components/Sheet.tsx";
import { Empty, Field, Spinner, Tag } from "../components/ui.tsx";
import { api, ApiError } from "../lib/api.ts";
import { formatRelative } from "../lib/format.ts";
import { useToast } from "../lib/store.tsx";
import type { Invite } from "../../shared/types.ts";

export function AdminSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [note, setNote] = useState("");
  const [grantsAdmin, setGrantsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .invites()
      .then((data) => setInvites(data.invites))
      .catch((err) =>
        toast(err instanceof ApiError ? err.message : "Die Codes laden nicht.", "error"),
      );
  }, [toast]);

  useEffect(load, [load]);

  async function copy(code: string, message: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast(message, "success");
    } catch {
      // Clipboard access is denied outside a secure context, which is exactly
      // where this app often runs — so say the code out loud instead of failing.
      toast(`Code: ${code}`, "success");
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.createInvite(note.trim() || null, grantsAdmin);
      setNote("");
      setGrantsAdmin(false);
      load();
      await copy(result.code, `${result.code} erstellt und kopiert.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Das hat nicht geklappt.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(code: string) {
    if (!confirm(`Code ${code} zurückziehen?`)) return;
    try {
      await api.revokeInvite(code);
      load();
      toast("Zurückgezogen.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Das hat nicht geklappt.", "error");
    }
  }

  const open = invites?.filter((invite) => invite.usedAt === null) ?? [];
  const used = invites?.filter((invite) => invite.usedAt !== null) ?? [];

  return (
    <Sheet
      title="Einladungen"
      description="Jeder Code gilt genau einmal."
      onClose={onClose}
      footer={
        <button type="submit" form="new-invite" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? "Moment…" : "Code erzeugen"}
        </button>
      }
    >
      <div className="stack stack--md">
        <form id="new-invite" onSubmit={create} className="stack">
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
            <span className="small">Macht das neue Mitglied zum Admin</span>
          </label>
        </form>

        <hr className="divider" />

        <div className="stack">
          <span className="eyebrow">Offen ({open.length})</span>

          {invites === null ? (
            <Spinner />
          ) : open.length === 0 ? (
            <Empty title="Kein offener Code.">
              <p className="small">Erzeug einen, wenn jemand dazukommen soll.</p>
            </Empty>
          ) : (
            <div className="rows">
              {open.map((invite) => (
                <div key={invite.code} className="rows__row">
                  <div style={{ minWidth: 0 }}>
                    <div className="code">{invite.code}</div>
                    <div className="dim small">
                      {invite.note ?? "ohne Notiz"} · {formatRelative(invite.createdAt)}
                      {invite.createdByName ? ` von ${invite.createdByName}` : ""}
                    </div>
                  </div>
                  <div className="row row--tight">
                    {invite.grantsAdmin && <Tag tone="copper">Admin</Tag>}
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => void copy(invite.code, "Kopiert.")}
                    >
                      Kopieren
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => void revoke(invite.code)}
                    >
                      Zurückziehen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {used.length > 0 && (
          <>
            <hr className="divider" />
            <div className="stack">
              <span className="eyebrow">Eingelöst ({used.length})</span>
              <div className="rows">
                {used.map((invite) => (
                  <div key={invite.code} className="rows__row">
                    <div style={{ minWidth: 0 }}>
                      <div className="code code--dim">{invite.code}</div>
                      <div className="dim small">
                        {invite.usedByName ?? "unbekannt"} ·{" "}
                        {invite.usedAt ? formatRelative(invite.usedAt) : "–"}
                      </div>
                    </div>
                    {invite.note && <span className="dim small">{invite.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
