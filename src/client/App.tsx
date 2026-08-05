/**
 * The shell.
 *
 * Three sections and two pages. The Rangliste is the results, Ausflüge is the
 * browsable season, Runde is the people — and everything that is a form, a
 * setting or a chore is a sheet on top of whichever of those you were reading.
 * The old version had six flat pages, one of them called "Eintragen", which
 * meant navigating away from the ranking in order to add something to it.
 */

import { useRef, useState } from "react";

import { Frost } from "./components/Frost.tsx";
import { Ground } from "./components/Ground.tsx";
import { Sheet } from "./components/Sheet.tsx";
import { Avatar, Mark, SegmentedNav, Spinner } from "./components/ui.tsx";
import { api } from "./lib/api.ts";
import { SeasonProvider } from "./lib/data.tsx";
import { formatRelative } from "./lib/format.ts";
import { useScrollProgress } from "./lib/motion.ts";
import { Link, useRouter } from "./lib/router.tsx";
import { useSession, useToast } from "./lib/store.tsx";
import { Ausfluege } from "./pages/Ausfluege.tsx";
import { Gate } from "./pages/Gate.tsx";
import { Rangliste } from "./pages/Rangliste.tsx";
import { Runde } from "./pages/Runde.tsx";
import { TripPage } from "./pages/TripPage.tsx";
import { AdminSheet } from "./sheets/AdminSheet.tsx";
import { NewTripSheet } from "./sheets/NewTripSheet.tsx";

type SectionId = "/" | "/ausfluege" | "/runde";

const SECTIONS: { value: SectionId; label: string; title: string }[] = [
  { value: "/", label: "Rangliste", title: "Der Mai-Score, nach deiner Gewichtung" },
  { value: "/ausfluege", label: "Ausflüge", title: "Alle Ziele, mit Fotos und Radar" },
  { value: "/runde", label: "Runde", title: "Wer bewertet wie — und die Auszeichnungen" },
];

/** Which section a path belongs to. A single trip belongs to Ausflüge. */
function sectionFor(path: string): SectionId {
  if (path.startsWith("/ausflug/") || path.startsWith("/ausfluege")) return "/ausfluege";
  if (path.startsWith("/runde")) return "/runde";
  return "/";
}

type OpenSheet = "neu" | "verwaltung" | "konto" | null;

/**
 * The dock. Only exists below 760px, where the rail's middle is too narrow for
 * three labels and a thumb cannot reach the top of the screen anyway.
 *
 * It renders after <main> so the tab order matches the visual order: on a phone
 * the sections are at the bottom of the screen, and being focused before the
 * page content would put the navigation somewhere the eye is not.
 */
function Dock() {
  const { path } = useRouter();
  return (
    <div className="dock">
      <SegmentedNav current={sectionFor(path)} options={SECTIONS} label="Bereich" block />
    </div>
  );
}

function Rail({ onOpen }: { onOpen: (sheet: OpenSheet) => void }) {
  const { me } = useSession();
  const { path } = useRouter();
  const rail = useRef<HTMLElement | null>(null);

  // Condenses the rail and drives the reading-progress hairline. Written
  // straight to the element, so scrolling never renders React.
  useScrollProgress(rail);

  return (
    <header className="rail" ref={rail}>
      <span className="rail__progress" aria-hidden="true" />
      <div className="rail__inner">
        <Link to="/" className="brand" aria-label="Maiausfluginator, zur Rangliste">
          <Mark size={22} />
          <span className="brand__title">Maiausfluginator</span>
        </Link>

        <div className="rail__mid">
          <SegmentedNav current={sectionFor(path)} options={SECTIONS} label="Bereich" bare />
        </div>

        <div className="rail__end">
          <button type="button" className="btn btn--sm" onClick={() => onOpen("neu")}>
            Eintragen
          </button>
          <button
            type="button"
            className="rail__me"
            onClick={() => onOpen("konto")}
            aria-label={`Konto von ${me?.displayName ?? "dir"}`}
            title={me ? `Angemeldet als ${me.displayName}` : undefined}
          >
            {me && <Avatar name={me.displayName} hue={me.hue} size="sm" />}
          </button>
        </div>
      </div>
    </header>
  );
}

/** Your own key. Shown once, and only if you ask for a new one. */
function KeyRenewal() {
  const toast = useToast();
  const { me, setMe } = useSession();
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="stack">
      <div>
        <strong>Dein Schlüssel</strong>
        <p className="small dim">
          Name und Schlüssel zusammen sind dein Login auf jedem weiteren Gerät. Verloren? Ein neuer
          macht den alten sofort ungültig.
        </p>
      </div>

      {/* An admin can issue a key for someone who lost theirs — which means for a
          moment two people knew it. Saying so is the price of that power being
          useful: the member can see it happened, and undo the sharing with one
          click below. */}
      {me?.keyResetByName && me.keyResetAt !== null && (
        <p className="small notice">
          Dein aktueller Schlüssel wurde {formatRelative(me.keyResetAt)} von {me.keyResetByName} für
          dich ausgestellt. Erneuere ihn hier, dann kennt ihn wieder nur du.
        </p>
      )}

      {key ? (
        <div className="keycard">
          <div className="field__label" style={{ marginBottom: 6 }}>
            Nur jetzt sichtbar — notier ihn
          </div>
          <div className="keycard__code">{key}</div>
        </div>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={async () => {
            if (!confirm("Neuen Schlüssel erzeugen? Der alte verfällt sofort.")) return;
            setBusy(true);
            try {
              const result = await api.rotateKey();
              setKey(result.personalKey);
              // This key has been seen by nobody else, so the notice above is no
              // longer true.
              if (me) setMe({ ...me, keyResetAt: null, keyResetByName: null });
            } catch {
              toast("Das hat nicht geklappt. Dein alter Schlüssel gilt weiter.", "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Moment…" : "Schlüssel erneuern"}
        </button>
      )}
    </div>
  );
}

/** The account sheet: who you are, your key, the admin door, and the way out. */
function AccountSheet({ onClose, onAdmin }: { onClose: () => void; onAdmin: () => void }) {
  const { me, signOut } = useSession();
  if (!me) return null;

  return (
    <Sheet title="Dein Konto" description={me.displayName} onClose={onClose}>
      <div className="stack stack--md">
        <div className="row">
          <Avatar name={me.displayName} hue={me.hue} size="lg" />
          <div className="stack" style={{ gap: 2 }}>
            <strong>{me.displayName}</strong>
            <span className="small dim">
              {me.handle}
              {me.isAdmin && " · Verwaltung"}
            </span>
          </div>
        </div>

        <hr className="divider" />
        <KeyRenewal />

        {me.isAdmin && (
          <>
            <hr className="divider" />
            <div className="stack">
              <div>
                <strong>Verwaltung</strong>
                <p className="small dim">
                  Einladungscodes ausgeben und zurückziehen — und für wen den Schlüssel verlegt hat,
                  einen neuen ausstellen.
                </p>
              </div>
              <button type="button" className="btn" onClick={onAdmin}>
                Verwaltung öffnen
              </button>
            </div>
          </>
        )}

        <hr className="divider" />
        <button type="button" className="btn btn--danger" onClick={() => void signOut()}>
          Abmelden
        </button>
      </div>
    </Sheet>
  );
}

function Routes() {
  const { path } = useRouter();

  const trip = /^\/ausflug\/([^/]+)$/.exec(path);
  if (trip) return <TripPage tripId={trip[1]!} />;

  switch (path) {
    case "/":
      return <Rangliste />;
    case "/ausfluege":
      return <Ausfluege />;
    case "/runde":
      return <Runde />;
    default:
      return (
        <Frost className="notfound">
          <div className="empty">
            <div className="empty__title">Diesen Weg gibt es nicht.</div>
            <p className="small">
              <Link to="/" className="link">
                Zurück zur Rangliste
              </Link>
            </p>
          </div>
        </Frost>
      );
  }
}

export function App() {
  const { me, loading } = useSession();
  const { path } = useRouter();
  const [sheet, setSheet] = useState<OpenSheet>(null);

  return (
    <>
      <Ground />

      {loading ? (
        <div className="center-screen">
          <Spinner label="Einen Moment…" />
        </div>
      ) : !me ? (
        <Gate />
      ) : (
        <SeasonProvider>
          {/* A fixed rail means the first Tab lands on navigation every time.
              This gives the keyboard a way straight to the content. */}
          <a href="#inhalt" className="skip">
            Zum Inhalt springen
          </a>

          <Rail onOpen={setSheet} />

          {/* Keyed on the path so a section change remounts and replays the
              reveal choreography rather than swapping content in place. */}
          <main className="shell page-enter" id="inhalt" key={path}>
            <Routes />
          </main>

          <Dock />

          {sheet === "neu" && <NewTripSheet onClose={() => setSheet(null)} />}
          {sheet === "verwaltung" && <AdminSheet onClose={() => setSheet(null)} />}
          {sheet === "konto" && (
            <AccountSheet onClose={() => setSheet(null)} onAdmin={() => setSheet("verwaltung")} />
          )}
        </SeasonProvider>
      )}
    </>
  );
}
