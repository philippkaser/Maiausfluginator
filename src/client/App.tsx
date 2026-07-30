import { Backdrop } from "./components/Backdrop.tsx";
import { Avatar, Mark, Spinner } from "./components/ui.tsx";
import { Link, useRouter } from "./lib/router.tsx";
import { useSession } from "./lib/store.tsx";
import { Admin } from "./pages/Admin.tsx";
import { Gate } from "./pages/Gate.tsx";
import { Members } from "./pages/Members.tsx";
import { NewTrip } from "./pages/NewTrip.tsx";
import { Ranking } from "./pages/Ranking.tsx";
import { TripPage } from "./pages/TripPage.tsx";

const NAV = [
  { to: "/", label: "Rangliste" },
  { to: "/neu", label: "Eintragen" },
  { to: "/mitglieder", label: "Mitglieder" },
];

function Topbar() {
  const { me, signOut } = useSession();
  const { path } = useRouter();

  const links = me?.isAdmin ? [...NAV, { to: "/verwaltung", label: "Verwaltung" }] : NAV;

  return (
    <header className="topbar">
      <div className="topbar__inner glass glass--rim">
        <Link to="/" className="brand">
          <Mark />
          <span className="brand__title">Maiausfluginator</span>
        </Link>

        <nav className="nav">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="nav__link"
              aria-current={
                link.to === "/" ? (path === "/" ? "page" : undefined) : path.startsWith(link.to) ? "page" : undefined
              }
            >
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        {me && (
          <div className="topbar__me">
            <Avatar name={me.displayName} hue={me.hue} />
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              onClick={() => void signOut()}
              title={`Angemeldet als ${me.displayName}`}
            >
              Abmelden
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function Routes() {
  const { path } = useRouter();
  const { me } = useSession();

  const tripMatch = /^\/ausflug\/([^/]+)$/.exec(path);
  if (tripMatch) return <TripPage tripId={tripMatch[1]!} />;

  switch (path) {
    case "/":
      return <Ranking />;
    case "/neu":
      return <NewTrip />;
    case "/mitglieder":
      return <Members />;
    case "/verwaltung":
      return me?.isAdmin ? (
        <Admin />
      ) : (
        <div className="card card--pad">
          <h2>Nur für Admins</h2>
          <p className="muted">Diese Seite ist der Verwaltung vorbehalten.</p>
        </div>
      );
    default:
      return (
        <div className="card card--pad">
          <h2>Seite nicht gefunden</h2>
          <p className="muted">
            Den Weg gibt es nicht. <Link to="/">Zurück zur Rangliste</Link>.
          </p>
        </div>
      );
  }
}

export function App() {
  const { me, loading } = useSession();
  const { path } = useRouter();
  // Trip pages share one key: moving between two of them should feel like the
  // same screen updating, not a whole new page sliding in.
  const pageKey = path.startsWith("/ausflug/") ? "/ausflug" : path;

  return (
    <>
      <Backdrop />
      {loading ? (
        <div className="center-screen">
          <Spinner label="Einen Moment…" />
        </div>
      ) : !me ? (
        <Gate />
      ) : (
        <>
          <Topbar />
          {/* Keyed on the route so the enter animation replays on every screen. */}
          <main className="shell page" key={pageKey}>
            <Routes />
          </main>
        </>
      )}
    </>
  );
}
