/**
 * Runde — the people.
 *
 * Two things that used to be scattered: the season's awards (they were a box in
 * the corner of the ranking) and the members (they were a spreadsheet on their
 * own page). Both are really about who we are as a group rather than about where
 * we ate, which is why they now share a section.
 *
 * The awards are set as citations, not as stat tiles. "Bester Teller — Gasthof
 * Sonnenhof, 9,2 von 10" is a sentence, and a sentence read in a serif carries
 * more than the same numbers stacked in a box.
 */

import { useEffect, useState } from "react";

import { Avatar, Empty, Meter, Pane, Spinner } from "../components/ui.tsx";
import { api, ApiError } from "../lib/api.ts";
import { useSeason } from "../lib/data.tsx";
import { formatDate } from "../lib/format.ts";
import { useReveal } from "../lib/motion.ts";
import { Link } from "../lib/router.tsx";
import { useSession } from "../lib/store.tsx";
import type { Member } from "../../shared/types.ts";

export function Runde() {
  const { me } = useSession();
  const { stats } = useSeason();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reveal = useReveal([members === null, stats === null]);

  useEffect(() => {
    let live = true;
    api
      .members()
      .then((data) => {
        if (live) setMembers(data.members);
      })
      .catch((err) => {
        if (live) setError(err instanceof ApiError ? err.message : "Die Runde lädt gerade nicht.");
      });
    return () => {
      live = false;
    };
  }, []);

  const awards = stats?.awards ?? [];
  const earned = awards.filter((award) => award.tripId !== null);
  const pending = awards.filter((award) => award.tripId === null);

  return (
    <div className="stack stack--lg" ref={reveal}>
      <header className="stack" data-reveal>
        <span className="eyebrow">Die Runde</span>
        <h1>Wer hier isst und urteilt</h1>
        <p className="lead">
          Jede Zahl in dieser App kommt von jemandem, der dort war. Hier steht, von wem — und was die
          Saison an Rekorden hergegeben hat.
        </p>
      </header>

      <section data-reveal>
        <div className="section__head">
          <div className="stack" style={{ gap: 4 }}>
            <span className="eyebrow">Auszeichnungen</span>
            <h2>Rekorde der Saison</h2>
          </div>
        </div>

        {stats === null ? (
          <Pane>
            <Spinner />
          </Pane>
        ) : earned.length === 0 ? (
          <Pane>
            <Empty title="Noch nichts zu feiern.">
              <p className="small">
                Die Auszeichnungen füllen sich mit den ersten Bewertungen von selbst.
              </p>
            </Empty>
          </Pane>
        ) : (
          <div className="citations">
            {earned.map((award) => (
              <Link
                key={award.key}
                to={`/ausflug/${award.tripId}`}
                className="pane pane--action citation"
              >
                <span className="citation__title">{award.title}</span>
                <span className="citation__winner">{award.tripTitle}</span>
                <span className="citation__value tnum">{award.value}</span>
                <span className="citation__why small dim">{award.subtitle}</span>
              </Link>
            ))}

            {pending.map((award) => (
              <div key={award.key} className="pane pane--quiet citation citation--open">
                <span className="citation__title">{award.title}</span>
                <span className="citation__winner dim">Noch offen</span>
                <span className="citation__why small dim">{award.subtitle}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section data-reveal>
        <div className="section__head">
          <div className="stack" style={{ gap: 4 }}>
            <span className="eyebrow">
              {members ? `${members.length} ${members.length === 1 ? "Mitglied" : "Mitglieder"}` : "Mitglieder"}
            </span>
            <h2>Wie streng wer bewertet</h2>
          </div>
        </div>

        {error ? (
          <Pane>
            <Empty title="Die Runde lädt gerade nicht.">
              <p className="small">{error}</p>
            </Empty>
          </Pane>
        ) : members === null ? (
          <Pane>
            <Spinner label="Mitglieder…" />
          </Pane>
        ) : (
          <>
            <Pane pad={false} flush>
              <div className="rows rows--flush">
                {members.map((member) => (
                  <MemberRow key={member.id} member={member} isMe={member.id === me?.id} />
                ))}
              </div>
            </Pane>

            <p className="small dim" style={{ marginTop: 16 }}>
              Der vergebene Schnitt sagt, wie streng jemand urteilt — praktisch, wenn man wissen will,
              ob eine 6 von dieser Person schon ein Lob ist.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function MemberRow({ member, isMe }: { member: Member; isMe: boolean }) {
  return (
    <div className="mrow">
      <Avatar name={member.displayName} hue={member.hue} />

      <span className="mrow__who">
        <span className="mrow__name">
          {member.displayName}
          {isMe && <span className="dim small"> · du</span>}
          {member.isAdmin && <span className="tag tag--copper mrow__badge">Verwaltung</span>}
        </span>
        <span className="mrow__meta small dim">
          {member.ratingCount} {member.ratingCount === 1 ? "Bewertung" : "Bewertungen"} ·{" "}
          {member.photoCount} {member.photoCount === 1 ? "Foto" : "Fotos"} · dabei seit{" "}
          {formatDate(new Date(member.createdAt).toISOString().slice(0, 10))}
        </span>
      </span>

      <span className="mrow__strict">
        {member.avgGiven === null ? (
          <span className="dim small">noch keine Stimme</span>
        ) : (
          <Meter
            label={`${member.avgGiven.toFixed(1).replace(".", ",")} von 10`}
            value={member.avgGiven}
            max={10}
            detail={member.avgGiven >= 8 ? "gnädig" : member.avgGiven <= 6 ? "streng" : "ausgewogen"}
          />
        )}
      </span>
    </div>
  );
}
