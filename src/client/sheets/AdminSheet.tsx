/**
 * Verwaltung.
 *
 * Two chores, and they are the same chore twice: getting somebody in. An invite
 * code for a person who is not in the list yet, a fresh key for a person who is
 * but mislaid theirs.
 *
 * An admin cannot look up anybody's key. Only an Argon2id hash of it is stored,
 * so there is nothing to look up — the only thing that can be done for someone
 * locked out is to issue a new key, which invalidates the old one. That is a
 * strictly smaller power than "admins can see keys" and it is the reason this
 * sheet says *ausstellen* and never *anzeigen*.
 */

import { useCallback, useEffect, useState } from "react";

import { Sheet } from "../components/Sheet.tsx";
import { Avatar, Empty, Field, Spinner, Tag } from "../components/ui.tsx";
import { api, ApiError } from "../lib/api.ts";
import { formatRelative } from "../lib/format.ts";
import { useSession, useToast } from "../lib/store.tsx";
import type { Invite, Member } from "../../shared/types.ts";

export function AdminSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { me } = useSession();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [note, setNote] = useState("");
  const [grantsAdmin, setGrantsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  // The one key currently readable anywhere. Held here, and dismissed by hand —
  // never a toast, because a toast takes the only copy with it when it fades.
  const [issued, setIssued] = useState<{ member: Member; key: string } | null>(null);

  const load = useCallback(() => {
    api
      .invites()
      .then((data) => setInvites(data.invites))
      .catch((err) =>
        toast(err instanceof ApiError ? err.message : "Die Codes laden nicht.", "error"),
      );
    api
      .members()
      .then((data) => setMembers(data.members))
      .catch((err) =>
        toast(err instanceof ApiError ? err.message : "Die Mitglieder laden nicht.", "error"),
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

  async function resetKey(member: Member) {
    if (
      !confirm(
        `Neuen Schlüssel für ${member.displayName} ausstellen?\n\n` +
          "Der alte verfällt sofort und alle angemeldeten Geräte werden abgemeldet. " +
          "Den neuen bekommst du genau einmal zu sehen — du musst ihn weitergeben.",
      )
    ) {
      return;
    }

    try {
      const result = await api.resetMemberKey(member.id);
      setMembers(result.members);
      setIssued({ member, key: result.personalKey });
    } catch (err) {
      toast(
        err instanceof ApiError ? err.message : "Das hat nicht geklappt.",
        "error",
      );
    }
  }

  const open = invites?.filter((invite) => invite.usedAt === null) ?? [];
  const used = invites?.filter((invite) => invite.usedAt !== null) ?? [];

  return (
    <Sheet
      title="Verwaltung"
      description="Einladungen ausgeben und verlorene Schlüssel ersetzen."
      onClose={onClose}
      footer={
        <button type="submit" form="new-invite" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? "Moment…" : "Code erzeugen"}
        </button>
      }
    >
      <div className="stack stack--md">
        {/* ---------------------------------------------------------------- */}
        {/* Members and their keys                                            */}
        {/* ---------------------------------------------------------------- */}

        <div className="stack">
          <div>
            <span className="eyebrow">Schlüssel</span>
            <p className="small dim" style={{ marginTop: 6 }}>
              Niemand kann einen bestehenden Schlüssel nachsehen — gespeichert ist nur ein Hash. Wer
              seinen verloren hat, bekommt hier einen neuen; der alte verfällt dabei.
            </p>
          </div>

          {issued ? (
            <div className="keycard">
              <div className="field__label" style={{ marginBottom: 6 }}>
                Neuer Schlüssel für {issued.member.displayName} — nur jetzt sichtbar
              </div>
              <div className="keycard__code">{issued.key}</div>
              <div className="row row--tight" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => void copy(issued.key, "Kopiert.")}
                >
                  Kopieren
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => setIssued(null)}
                >
                  Weitergegeben
                </button>
              </div>
              <p className="small dim" style={{ marginTop: 12, marginBottom: 0 }}>
                Zusammen mit dem Namen <strong>{issued.member.handle}</strong> ist das das Login.
                Sobald {issued.member.displayName} drin ist, sollte der Schlüssel im eigenen Konto
                erneuert werden — dann hat ihn wieder nur eine Person gesehen.
              </p>
            </div>
          ) : members === null ? (
            <Spinner />
          ) : (
            <div className="rows">
              {members.map((member) => (
                <div key={member.id} className="rows__row">
                  <div className="row row--tight" style={{ minWidth: 0 }}>
                    <Avatar name={member.displayName} hue={member.hue} size="sm" />
                    <div style={{ minWidth: 0 }}>
                      <strong>{member.displayName}</strong>
                      <div className="dim small">
                        {member.handle}
                        {member.keyResetAt !== null &&
                          ` · Schlüssel ${formatRelative(member.keyResetAt)} ausgestellt${
                            member.keyResetByName ? ` von ${member.keyResetByName}` : ""
                          }`}
                      </div>
                    </div>
                  </div>
                  <div className="row row--tight">
                    {member.isAdmin && <Tag tone="copper">Verwaltung</Tag>}
                    {member.id === me?.id ? (
                      <span className="dim small">dein Konto</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => void resetKey(member)}
                      >
                        Neuer Schlüssel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <hr className="divider" />

        {/* ---------------------------------------------------------------- */}
        {/* Invites                                                           */}
        {/* ---------------------------------------------------------------- */}

        <div className="stack">
          <span className="eyebrow">Einladen</span>
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
        </div>

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
