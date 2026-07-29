import { useEffect, useState } from "react";

import { api, ApiError } from "../lib/api.ts";
import { formatDate } from "../lib/format.ts";
import { useSession, useToast } from "../lib/store.tsx";
import type { Member } from "../../shared/types.ts";
import { Avatar, Spinner, Tag } from "../components/ui.tsx";

export function Members() {
  const { me } = useSession();
  const toast = useToast();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => {
    api
      .members()
      .then((data) => setMembers(data.members))
      .catch((err) => toast(err instanceof ApiError ? err.message : "Laden fehlgeschlagen", "error"));
  }, [toast]);

  async function rotate() {
    if (!confirm("Neuen Schlüssel erzeugen? Der alte gilt danach nicht mehr.")) return;
    try {
      const result = await api.rotateKey();
      setNewKey(result.personalKey);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Hat nicht geklappt", "error");
    }
  }

  return (
    <div className="stack stack--lg fade-in">
      <div className="pagehead">
<h1>Mitglieder</h1>
        <button type="button" className="btn btn--sm" onClick={rotate}>
          Meinen Schlüssel erneuern
        </button>
      </div>

      {newKey && (
        <div className="keycard">
          <div className="field__label" style={{ marginBottom: 8 }}>
            Neuer Schlüssel – nur jetzt sichtbar
          </div>
          <div className="keycard__code">{newKey}</div>
          <button
            type="button"
            className="btn btn--sm"
            style={{ marginTop: 12 }}
            onClick={() => setNewKey(null)}
          >
            Habe ich notiert
          </button>
        </div>
      )}

      <section className="card card--pad">
        {members === null ? (
          <Spinner label="Mitglieder werden geladen…" />
        ) : (
          <div className="table__scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Mitglied</th>
                  <th>Bewertungen</th>
                  <th>Fotos</th>
                  <th>Schnitt vergeben</th>
                  <th>Dabei seit</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="row row--tight" style={{ flexWrap: "nowrap" }}>
                        <Avatar name={member.displayName} hue={member.hue} size="sm" />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 560 }}>
                            {member.displayName}
                            {member.id === me?.id && <span className="dim small"> · du</span>}
                          </div>
                          <div className="dim small mono">{member.handle}</div>
                        </div>
                        {member.isAdmin && <Tag>Admin</Tag>}
                      </div>
                    </td>
                    <td className="tnum">{member.ratingCount}</td>
                    <td className="tnum">{member.photoCount}</td>
                    <td className="tnum">
                      {member.avgGiven === null ? (
                        <span className="dim">–</span>
                      ) : (
                        `${member.avgGiven.toFixed(1)} / 10`
                      )}
                    </td>
                    <td className="dim small">
                      {formatDate(new Date(member.createdAt).toISOString().slice(0, 10))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="dim small">
        Der „Schnitt vergeben“ zeigt, wie streng jemand bewertet – praktisch, wenn man wissen will,
        ob eine 6 von dieser Person schon ein Lob ist.
      </p>
    </div>
  );
}
