# Maiausfluginator

Die Bewertungszentrale für unsere **Mai-Ausflüge**. Nur mit Einladung, gebaut mit
[Bun](https://bun.sh) und React.

Jeder Ausflug bekommt einen **Mai-Score** von 0 bis 100. Er entsteht aus sieben Komponenten –
fünf davon bewerten die Mitglieder selbst, zwei sind objektiv:

| Komponente | Standardgewicht | Quelle |
| --- | --- | --- |
| Essen | 28 | Bewertung 1–10 |
| Gesamterlebnis | 18 | Bewertung 1–10 |
| Ambiente & Aussicht | 12 | Bewertung 1–10 |
| Service | 10 | Bewertung 1–10 |
| Preis-Leistung | 12 | Bewertung 1–10 |
| Wartezeit aufs Essen | 10 | Median der gemeldeten Minuten |
| Anfahrt | 10 | Entfernung und Fahrzeit ab dem Durst HQ Brixen |

Die Gewichte sind kein Gesetz: jede und jeder kann die Rangliste live neu gewichten (Presets
*Feinschmecker*, *Mittagspause*, *Panorama*, *Buchhaltung* – oder eigene Regler). Die Regler
liegen in einer Schublade, nicht mitten in der Rangliste: die Gewichtung gehört dem Lesenden,
nicht der Liste. Die Einstellung bleibt lokal im Browser.

Komponenten ohne Daten fallen aus der Rechnung und die übrigen Gewichte werden hochgerechnet –
ein Ausflug verliert also nichts, nur weil niemand die Wartezeit notiert hat.

## Was drin ist

Drei Bereiche, und alles, was Formular oder Einstellung ist, liegt in einer Schublade
darüber — nicht auf einer eigenen Seite.

**Rangliste** — die Ergebnisse. Oben die Spitze der Saison als eine sehr große Zahl mit
den sieben Komponenten, aus denen sie entsteht; darunter das Podium; darunter das ganze
Feld als eine Liste. Sortierbar nach Score, Datum, Nähe oder Tempo, mit einem Filter für
die eigenen offenen Bewertungen.

**Ausflüge** — die Saison zum Durchsehen. Ein Raster aus Fotos, Filter (zuletzt, beste,
um die Ecke, mit Karte, ungehört) und das **Radar**: alle Ziele nach echter Himmelsrichtung und
Entfernung ab HQ, aus den Koordinaten im Haus gezeichnet — kein Kartenbild, keine Kachel,
nur Richtung und Weite.

**Runde** — die Leute. Die **Auszeichnungen** der Saison als Urkunden gesetzt (bester
Teller, Küchen-Blitz, Geduldsprobe, Expedition, Diskussionsstoff) und die Mitgliederliste
samt „wie streng bewertet wer eigentlich".

**Ein Ausflug** ist eine eigene Seite: das Titelbild als Kopf mit den Fakten auf einer
Milchglasplatte darüber, die Aufschlüsselung des Scores, jede Stimme mit ihrem Kommentar,
die Fotogalerie.

In Schubladen: **Bewerten** (fünf Regler, Wartezeit, Durst-Karte, Kommentar — eine Stimme
pro Person und Ausflug, jederzeit änderbar), **Eintragen** (mit Karte, siehe unten), die
**Gewichtung**, das eigene **Konto** samt Schlüssel und die **Verwaltung** — Einladungscodes
und neue Schlüssel für die, die ihren verlegt haben. `?bewerten` an der Adresse
eines Ausflugs öffnet das Bewertungsformular direkt — „du hast noch drei offen" ist damit
eine Liste von Links.

**Die Karte.** Ein Lokal, das noch nicht in der Liste steht, wird über eine Karte
eingetragen und nicht mehr über Zahlen: Namen tippen, Treffer wählen — Ort, Adresse,
Küche, Website und Koordinaten kommen mit —, oder gleich den Punkt antippen. Entfernung
und Fahrzeit ab HQ stehen unter der Karte und ändern sich mit dem Stift, gerechnet mit
demselben Code, den der Server beim Speichern benutzt (`shared/geo.ts`). Die
Koordinatenfelder gibt es weiterhin, eine Schublade tiefer: für eine Hütte, die keine
Vermessung kennt, und für den, der die echte Fahrzeit gefahren hat.

**Durst-Karte.** Beim Bewerten wird mitgefragt, ob die Karte angenommen wurde — ja, nein
oder nicht probiert. Zehn Euro weniger auf die Rechnung sind der größte einzelne Hebel auf
das, was ein Ausflug kostet, also wird das nicht in irgendeinen Mittelwert verrechnet,
sondern berichtet: als Kupfer-Etikett auf der Ausflugsseite, als Häkchen in der Rangliste
und als eigener Filter. Widerspruch bleibt sichtbar — wenn einer den Rabatt bekam und eine
abgewiesen wurde, steht genau das dort, statt von einer Mehrheit überstimmt zu werden. Auf
den Mai-Score wirkt es (noch) nicht: das würde jeden bestehenden Score verschieben.

Dazu, überall: **Food-Pics** mit Drag & Drop, Bildtexten, Likes und Lightbox (Bilder sind
nur für angemeldete Mitglieder abrufbar) und die **Anfahrt**, aus den Koordinaten ab dem
HQ gerechnet (Luftlinie → Umwegfaktor → Fahrzeit). Wer die echten Werte kennt, trägt sie
ein; die gewinnen immer.

## Starten

```bash
bun install
bun run dev        # http://localhost, mit Hot Reload
```

Der Server hört standardmäßig auf **Port 80**, damit die Adresse im Haus einfach
`http://maiausfluginator` lautet — ohne Doppelpunkt und Zahl dahinter. Ports unter 1024 sind
unter Linux und macOS privilegiert, der Prozess braucht also entweder root, einmalig

```bash
sudo setcap 'cap_net_bind_service=+ep' "$(which bun)"
```

oder schlicht einen anderen Port: `PORT=3000 bun run dev`. Fehlen die Rechte, sagt der Server
das beim Start mit genau diesen drei Möglichkeiten statt mit einem nackten `EACCES`.

Beim allerersten Start gibt es noch keine Mitglieder. Der Server legt dann automatisch einen
**Admin-Einladungscode** an und schreibt ihn in die Konsole:

```
  Noch keine Mitglieder. Erster Admin-Einladungscode:

      X7QK-2M4D-PB9R
```

Diesen Code an der Tür unter *Einladung einlösen* verwenden. Danach vergibt man weitere Codes in
der App über das eigene Konto (Avatar rechts oben) → *Verwaltung* oder auf der Kommandozeile:

```bash
bun run invite                 # normales Mitglied
bun run invite --admin         # mit Adminrechten
bun run invite "Für Anna"      # mit Notiz
```

Für den Produktivbetrieb:

```bash
bun run start
```

## Anmeldung ohne Passwörter

Es gibt weder E-Mail-Versand noch Passwörter. Wer einen Einladungscode einlöst, wählt seinen
Namen und bekommt **einmalig** einen persönlichen Schlüssel angezeigt (`XXXX-XXXX-XXXX-XXXX`).
Name plus Schlüssel ist das Login auf jedem weiteren Gerät. Solange man noch angemeldet ist:
im eigenen **Konto** (Avatar rechts oben) → *Schlüssel erneuern* gibt es einen neuen, der alte
verfällt sofort.

Gespeichert wird nur ein Argon2id-Hash des Schlüssels. Sessions sind zufällige Tokens, von denen
in der Datenbank ebenfalls nur der SHA-256 liegt; das Cookie ist `HttpOnly` und `SameSite=Lax`.
Hinter einem TLS-Proxy wird es automatisch `Secure` (oder erzwungen mit `FORCE_SECURE_COOKIES=1`).

### Schlüssel weg, gar nicht mehr angemeldet

Der häufigste Fall, und er braucht einen anderen Weg: es gibt keine Adresse, an die sich ein
Link schicken ließe, und **nachsehen kann den Schlüssel niemand** — auch kein Admin, denn in
der Datenbank liegt nur der Hash. Ein verlorener Schlüssel ist also nicht wiederherstellbar,
er ist nur ersetzbar.

Deshalb: ein Admin öffnet *Konto → Verwaltung*, drückt beim betreffenden Mitglied auf **Neuer
Schlüssel** und liest den vor. Der alte verfällt dabei sofort und alle Geräte dieses Mitglieds
werden abgemeldet — wer seinen Schlüssel verloren hat, weiß nicht, wer ihn gefunden hat.

Das ist die eine Stelle, an der eine Person kurzzeitig Zugang zum Konto einer anderen
verschaffen könnte, also wird sie nicht stillschweigend benutzt:

- Wer den Schlüssel ausgestellt hat und wann, steht am Mitglied (`users.key_reset_at` /
  `key_reset_by`) und ist in der Verwaltung sichtbar.
- **Das Mitglied selbst sieht es auch**, im eigenen Konto: „Dein aktueller Schlüssel wurde
  vor zwei Tagen von Philipp für dich ausgestellt." Ein Klick auf *Schlüssel erneuern* macht
  daraus wieder einen, den nur eine Person kennt — und löscht damit auch den Hinweis.
- Den eigenen Schlüssel kann ein Admin auf diesem Weg nicht erneuern; das gehört ins eigene
  Konto, wo es die Session gleich mit erneuert statt sie wegzuwerfen.

Die Alternative wäre gewesen, Schlüssel im Klartext zu speichern, damit ein Admin sie
*ansehen* kann. Das ist dieselbe Bequemlichkeit für alle Beteiligten und ein dauerhaft
lesbares Passwortverzeichnis als Preis. Ein ausgestellter Schlüssel ist die kleinere
Befugnis: er wirkt einmal, er ist sichtbar protokolliert, und das Mitglied kann ihn
zurücknehmen.

## Konfiguration

Alles optional:

| Variable | Default | Bedeutung |
| --- | --- | --- |
| `PORT` | `80` | Port (unter 1024 = privilegiert, siehe oben) |
| `HOST` | `0.0.0.0` | Interface |
| `DATA_DIR` | `./data` | Datenbank und Uploads |
| `DB_PATH` | `$DATA_DIR/mai.sqlite` | Pfad der SQLite-Datei |
| `HQ_LAT` / `HQ_LON` | `46.7266` / `11.6435` | Startpunkt aller Messungen |
| `HQ_LABEL` | `Durst HQ Brixen` | Anzeigename des Startpunkts |
| `FORCE_SECURE_COOKIES` | – | `1` erzwingt `Secure` auf dem Session-Cookie |
| `SKIP_SEED` | – | `1` legt beim Start keine Beispiel-Lokale an |
| `OSM_CONTACT` | – | Kontaktadresse im User-Agent Richtung OpenStreetMap (siehe unten) |
| `TILE_URL` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | Woher die Kacheln kommen |
| `NOMINATIM_URL` | `https://nominatim.openstreetmap.org` | Woher die Ortssuche kommt |

Die HQ-Koordinaten sind eine Näherung für die Julius-Durst-Straße in Brixen. Wenn ihr ab einer
anderen Tür messen wollt, einfach überschreiben.

## Daten

Alles liegt in `data/`: `mai.sqlite` (WAL-Modus), `data/uploads/` für die Fotos und
`data/tiles/` für die Kartenkacheln, die schon einmal geholt wurden. Ein Backup ist ein
Kopieren dieses Ordners — `tiles/` darf man dabei weglassen, es füllt sich von selbst wieder.
Löscht man einen Ausflug, verschwinden Bewertungen und Bilddateien mit ihm.

Beim ersten Start werden zwölf **Beispiel-Lokale** rund um Brixen angelegt, damit die Auswahl
nicht leer ist. Das sind Platzhalter mit echten Ortskoordinaten – umbenennen, korrigieren oder
löschen. Bewertungen sind keine dabei: jede Zahl in dieser App kommt von jemandem, der dort war.

## Aufbau

```
src/
  shared/      Typen, die Score-Berechnung und die Geo-Rechnung
               (Server und Client rechnen identisch)
  server/      Bun.serve, SQLite (samt Migrationen in db.ts), Auth, Geo,
               Upload-Handling, osm.ts als einzige Tür nach draußen
  client/
    pages/       die drei Bereiche, ein Ausflug, die Tür
    sheets/      alles, was Formular oder Einstellung ist
    components/  Grund, Glas, Score, Zeile, Karte, Radar, Landkarte, Fotos
    lib/         Router, Saison-Cache, Bewegung, Shader-Naht, Tastatur
    styles.css   das Design-System
```

Der Server bündelt den Client selbst – Bun kann `index.html` direkt als Route servieren, es gibt
also keinen zweiten Build-Schritt und keine Bundler-Konfiguration. Die Schriftdateien liegen unter
`src/client/assets/fonts/` und werden von einer eigenen Route ausgeliefert; warum sie *nicht* im
Stylesheet stehen, steht als Kommentar in `index.html`.

Die Liste der Ausflüge wird **einmal** geholt, nicht pro Bereich: alle drei Bereiche lesen dieselbe
Saison aus `lib/data.tsx`. Wer etwas bewertet, sieht die Rangliste sofort umsortieren — die Antwort
enthält alles Nötige, nachgeladen werden im Hintergrund nur die serverseitig gerechneten Summen und
Auszeichnungen.

```bash
bun run typecheck
```

## Aussehen

**Frostlicht.** Warmes Alpentageslicht: cremeweißes Papier, eine langsame Aurora dahinter, und
jede Oberfläche eine Scheibe Milchglas darauf. Die Typografie trägt die Hierarchie, Farbe wird für
fast nichts ausgegeben.

Drei Materialien, mehr nicht:

- **Grund** — die Aurora: ein WebGL-Feld weicher, driftender Lichtfelder. Das Einzige, was sich
  immer bewegt.
- **Glas** — jede Oberfläche: bereift, kantenbeleuchtet, nie eine flache Füllung.
- **Schrift** — Fraunces für alles, was eine Stimme hat, die System-Sans für alles, was ein
  Etikett ist.

Die Regel für die Schrift lohnt sich auszusprechen, weil sie leicht zu brechen ist: Wenn es etwas
ist, das jemand vorlesen würde — ein Titel, der Score, ein Zitat — ist es Serif. Wenn es ein Wort
ist, das sagt, was ein Knopf tut, ist es Sans.

Farbe gibt es für genau zwei Dinge. **Tannengrün** (`--accent`) für Werte: Scores, Meter, den
Zustand eines Reglers. **Kupfer** (`--copper`) ausschließlich für das Außergewöhnliche — Platz eins,
eine Auszeichnung, ein Rekord. Nie für „aktiv". Alles andere ist warmes Grau auf Papier.

### Eine Antwort ist kein Ort

Beide Segment-Regler sehen gleich aus und sind es nicht, und der Unterschied hat einmal Geld
gekostet: „Angenommen / Abgelehnt / Nicht probiert" bei der Durst-Karte war Milchglas auf
Milchglas und praktisch unlesbar.

Beim **Navigieren** ist das in Ordnung. Die gleitende Scheibe in der Schiene ist nicht das
Einzige, was sagt, wo man ist — die ganze Seite hat sich geändert. Bei einer **Antwort** ist sie
es doch: die drei Wörter stehen so oder so da, und eine weiße Scheibe auf weißem Glas ist keine
Antwort, die jemand ablesen kann. Deshalb nimmt der Regler einer Antwort Tanne auf — schwach
getönte Füllung, Haarlinie, und das gewählte Wort selbst in Tanne. Das ist der Zustand eines
Bedienelements, also genau das, wofür die eine Akzentfarbe da ist.

Was dabei *nicht* passiert: fetter werden. Ein fetteres Wort ist ein breiteres Wort, und die
Scheibe müsste ihm hinterherlaufen.

### Die Scheibe

Eine Scheibe ist kein Rahmen plus Füllung. Sie ist ein bereifter Film, eine Kante, an der Licht
ein- und austritt, und ein Glanzlicht, das dem Zeiger folgt. Die Kante ist das Interessante: ein
maskierter Kegelverlauf, weiß dort wo das Licht eintrifft, mit einer Spur Tanne und Kupfer auf dem
Weg herum, abgedunkelt dort wo es austritt. Das ist Refraktion, und deshalb liest sich eine Scheibe
auf den ersten Blick als Glas und nicht als abgerundetes Rechteck.

Panes sind großzügig, die **Zeilen darin sind es nicht**: so bleibt eine Rangliste aus zwanzig
Einträgen eine Seite und wird nicht zur Rolle.

### Der Score

Die Zahl *ist* die Grafik. Kein Ring, keine Tachonadel — ein Wert von 100, sehr groß in Fraunces
gesetzt, darunter die sieben Komponenten als Haarlinien-Meter. Ein Ring würde viel Tinte dafür
ausgeben, „von 100" zu sagen, was die Zahl schon sagt, und hätte keinen Platz mehr für das, woraus
sie entsteht. Ziffern sind durchgehend tabellarisch: ein Score, der beim Verschieben der Regler
seitlich wandert, liest sich als Animation des Layouts statt als Änderung des Werts.

Fehlt für eine Komponente die Angabe, ist das keine Null: das Meter wird gestrichelt gezeichnet.
Eine Null und eine Leerstelle sind verschiedene Tatsachen.

### Aufbau der Oberfläche

Oben eine schwebende **Schiene**: Marke links, die drei Bereiche als gleitende Scheibe in der
Mitte, Eintragen und Konto rechts. Sie verdichtet sich beim Scrollen, und eine Tannen-Haarlinie an
der oberen Kante zeigt, wie weit die Seite gelesen ist. Unter 760 px verlassen die Bereiche die
Schiene und werden zu einem **Dock** am Daumenende des Bildschirms.

Die Bereiche sind **Links**, keine Knöpfe: Mittelklick und ⌘-Klick öffnen einen Bereich in einem
neuen Tab, die Statuszeile zeigt, wohin es geht, und `aria-current` sagt, wo man ist.

Alles, was Einstellung, Formular oder Verwaltungskram ist, liegt in einer **Schublade** von rechts.
Auf dem Telefon kommt sie von unten, mit einem Streifen Seite über sich, damit sie eine Schicht
bleibt und nicht zur Navigation wird.

### Bewegung

Langsam und schwerelos. Nichts bewegt sich mehr als vierzehn Pixel, und alles, was sich bewegt,
lässt sich Zeit dabei: eine einzige lange Kurve (`cubic-bezier(.16, 1, .3, 1)`) macht die ganze
Arbeit — sie startet schnell und kommt ohne Stoß an, weshalb 700 ms sich nicht träge anfühlen.

Abschnitte steigen beim Hereinscrollen in Dokumentreihenfolge auf, einen Takt versetzt; ein
einzelner `IntersectionObserver` pro Seite treibt das, Abschnitte melden sich mit `data-reveal` an
(`lib/motion.ts`). Die Meter wachsen dabei wirklich von null. Der Score zählt beim ersten Zeichnen
einmal hoch — animiert wird ein Fortschritt von 0 bis 1, nicht die Zahl, weshalb eine neu gewichtete
Rangliste den Wert einfach ändert statt jedes Mal wie ein Spielautomat durchzulaufen. Das Titelbild
fährt über eine halbe Minute kaum merklich hinein.

Bei `prefers-reduced-motion: reduce` lösen sich alle diese Haken in Endzustände auf, und die Shader
stehen auf einem einzelnen Standbild. Reduzierte Bewegung heißt **angekommen**, nicht schneller
animiert.

### Shader

Grund und Milchglas kommen von [Paper Shaders](https://shaders.com) (`@paper-design/shaders`,
Apache-2.0). `lib/shader.ts` ist die Naht dazwischen. Die Bibliothek erledigt die harten Teile
selbst — Canvas, Resize- und Intersection-Observer, Pixelverhältnis, Uhr, und sie hält die
Animation an, sobald der Tab im Hintergrund liegt oder das Element aus dem Bild scrollt. Übrig
bleiben genau die drei Dinge, die sie nicht entscheidet: React-Lebenszyklus, kein WebGL2, und
reduzierte Bewegung.

**Der Grund** ist *Mesh Gradient*: große weiche Farbfelder, die über das Papier ziehen wie
Tageslicht hinter einem Vorhang. Der Punkt der Palette ist Zurückhaltung — jedes Feld ist ein
Fast-Weiß, ein paar Prozent nach Salbei, Minze, Stroh oder Pfirsich gezogen. Kein Feld ist eine
Farbe, jedes ist ein Lichtschimmer auf Papier. Bei einem Zehntel der normalen Geschwindigkeit
dauert eine ganze Drift Minuten — das ist der Unterschied zwischen Wetter und Animation.

**Das Milchglas** ist *Fluted Glass*, an den zwei oder drei Stellen, die einen ganzen Bildschirm
tragen: die Tür, der Kopf der Rangliste, ein Ausflug ohne Foto. Überall sonst heißt „bereift"
`backdrop-filter`, was das Dahinterliegende weichzeichnen, aber nicht brechen kann. Dieser Shader
kann es: Licht spaltet sich entlang der Rillen, Farbe trennt sich an jeder Kante. Gebrochen wird
**nicht die Seite** — das würde einen Shader an das Layout koppeln und bei jedem Scrollen neu
zeichnen. Gebrochen wird eine kleine Platte aus weichen warmen Farbfeldern, einmal als SVG-Data-URI
erzeugt: ein Textur-Upload, nichts weiter. Ein echtes geriffeltes Fenster ist ohnehin eine
Oberfläche und kein Ausblick. Die Rillen laufen fast senkrecht (waagrechte lesen sich als
Jalousie, exakt senkrechte als Rendering-Fehler), und das Ganze bleibt unter 50 % Deckkraft.

Beide fallen ohne WebGL2 auf statisches CSS zurück — die zwei Farbwäschen im Grund liegen dafür
sowieso im DOM.

### Hell — und was für ein Dunkel nötig wäre

Das Design ist hell, und zwar ausschließlich. Ein halb abgestimmtes Dunkel wären zwei mittelmäßige
Designs statt eines guten. Getan ist aber die Vorarbeit: **jeder** Farbwert in `styles.css` ist ein
semantisches Token, auch in den SVGs (Inline-SVG löst CSS-Variablen auf, das Radar hat deshalb
keinen einzigen Literalwert). Ein Nachtmodus wäre derselbe Token-Block mit anderen Zahlen plus eine
neue Palette in `components/Ground.tsx`. Die Stelle dafür ist in `styles.css` markiert.

### Kontrast

Die vier Grautöne der Schrift sind keine freien Entscheidungen. Jeder wurde so weit abgedunkelt,
dass er WCAG AA gegen den *schlechtesten* Hintergrund erreicht, auf dem er landen kann — Papier
unter dem tiefsten Ton, den die Aurora darüberlegen kann (`#ece6da`), nicht Papier allein. Dort
gemessen: `--ink` 13,2:1, `--ink-2` 6,3:1, `--ink-3` 4,5:1. `--ink-4` liegt bei 3,0:1 und ist
deshalb ausschließlich Platzhalter, Chevrons und Dekoration — nie eine Zahl und nie ein Wort, das
jemand lesen muss.

### Tastatur

Ein fixierter Balken bedeutet, dass die erste Tab-Taste jedes Mal auf der Navigation landet, also
gibt es einen Sprunglink zum Inhalt. Das Dock wird **nach** dem Inhalt gerendert, damit die
Tab-Reihenfolge der sichtbaren entspricht: auf dem Telefon stehen die Bereiche unten.

Schublade und Lightbox sind Schichten über der Seite und schulden derselben Tastatur dasselbe —
Fokus hinein, Fokus gefangen, Fokus zurück an die Stelle, von der er kam, Escape schließt, die Seite
darunter scrollt nicht und verrutscht auch nicht dabei. Das steht **einmal** in `lib/a11y.ts`, damit
eine Korrektur beide erreicht.

## Die Karte, und die eine Anfrage nach draußen

Ein Lokal wurde früher über **Koordinaten** eingetragen, `lat`/`lon` von Hand. Das war eine
Notlösung und fühlte sich auch so an — niemand hat Koordinaten im Kopf. Jetzt ist da eine
Karte: Namen tippen und einen Treffer wählen, oder den Punkt antippen.

Das kostet etwas, und weil es die einzige Stelle ist, an der diese App das Haus verlässt,
gehört es ausgeschrieben.

### Der Browser fragt nicht selbst

Kartenkacheln und Ortssuche kommen von OpenStreetMap. Beide gehen aber **über unseren eigenen
Server**, der sie holt und behält (`server/osm.ts`):

```
Browser ──▶ /api/tiles/{z}/{x}/{y}   ─┬─ Treffer: data/tiles/…
                                      └─ Fehltreffer: tile.openstreetmap.org
Browser ──▶ /api/places/search?q=…   ───▶ nominatim.openstreetmap.org
```

Der Unterschied ist nicht kosmetisch. Ohne diesen Umweg schickt jeder Browser im Haus seine
Adresse, seinen User-Agent und einen Referrer, der sagt, in welcher Anwendung er gerade steckt,
an einen fremden Server — pro Kachel. Mit dem Umweg sieht OpenStreetMap **eine** Maschine in
Brixen eine Kachel abrufen. Wer in welches Tal geschaut hat, bleibt hier. Das ist genau die
Eigenschaft, für die das Radar gebaut wurde, so weit gehalten, wie sie sich halten lässt,
sobald es überhaupt eine Karte gibt.

Was dabei gilt:

- **Beide Endpunkte brauchen eine Session.** Ein offener Kachel-Proxy ist fremde Bandbreite
  auf eigene Rechnung.
- **Kacheln liegen für immer in `data/tiles/`.** Eine Kachel ändert sich seltener als ein
  Lokal umzieht; der zweite Blick auf dieselbe Gegend braucht kein Netz. `rm -rf data/tiles`
  ist die Aktualisierung.
- **Nominatim wird auf eine Anfrage pro Sekunde gedrosselt**, serverseitig und für alle
  gemeinsam — ein Debounce im Browser ist eine Bitte, und es gibt zwanzig Browser. Antworten
  werden eine Stunde behalten.
- **`OSM_CONTACT` setzen.** Die Nutzungsbedingungen beider Dienste wollen einen User-Agent,
  der die Anwendung benennt und einen Weg lässt, sich zu beschweren. Es läuft auch ohne, es
  ist nur schlechter Stil gegenüber gestifteter Infrastruktur.
- **Alles bleibt umlenkbar.** `TILE_URL` und `NOMINATIM_URL` zeigen woandershin, wenn im Haus
  einmal ein eigener Kachelsatz oder eine eigene Nominatim-Instanz steht. Dann verlässt gar
  nichts mehr das Gebäude, und am Client ändert sich keine Zeile.

Was die Karte **nicht** tut: routen. Entfernung und Fahrzeit sind weiter Luftlinie →
Umwegfaktor → Fahrzeit aus `shared/geo.ts`. Der einzige Unterschied ist, dass die Koordinaten
jetzt aus einem Kartenklick kommen statt aus einem Zahlenfeld, und dass die Rechnung schon
unter der Karte mitläuft, weil sie im geteilten Code liegt und der Client sie selbst ausführen
kann.

### Wie die Karte gezeichnet ist

`components/MapPick.tsx`, von Hand und ohne Bibliothek. Eine Slippy Map ist ein Gitter von
Bildern, positioniert über zwei Logarithmen; eine Kartenbibliothek ist zweihundert Kilobyte von
allem anderen — Layer-Verwaltung, Popups, ein zweites Event-System, eigenes CSS mit eigener
Meinung darüber, wie ein Bedienelement aussieht. Was gebraucht wird, sind das Gitter, das
Ziehen und der Stift, und die nehmen Fokusring, Haarlinie und Kurve aus dem Design-System,
das schon da ist.

Zwei Entscheidungen, die eine Begründung verdienen:

- **Ein Tipp setzt den Stift, ein Ziehen verschiebt die Karte.** Unterschieden wird an der
  zurückgelegten Strecke, nicht an Taste oder Dauer: unter fünf Pixeln hat jemand gezielt.
- **Das Rad zoomt nur mit ⌘ oder Ctrl.** Die Karte liegt in einer scrollenden Schublade, und
  eine Karte, die das Mausrad frisst, sperrt die Seite hinter sich ein. Die +/−-Knöpfe sind
  immer da und echte Knöpfe, also hat die Tastatur sie umsonst.

Die Kartenfläche ist die einzige Oberfläche in dieser App, die jemand anders gezeichnet hat,
und wird behandelt wie ein Foto: hinter eine Haarlinie in die Scheibe gesenkt, ein paar Prozent
entsättigt und gewärmt, damit OSMs Blau und Rosa in dieser Palette liegen statt darüber zu
rufen. Darauf liegen genau zwei eigene Zeichen — der Stift in Tanne, weil er der Wert ist, der
gerade gewählt wird, und das HQ in Kupfer, weil es der Fixpunkt ist, von dem alles gemessen
wird — verbunden durch eine gestrichelte Haarlinie. Gestrichelt, weil das eine Aussage über
Entfernung ist und keine Route, die jemand fährt.

Das **Radar** bleibt, unverändert. Es ist keine schlechte Karte, sondern eine andere Aussage:
alle Ziele nach Richtung und Weite ab HQ auf einen Blick, ohne eine einzige Kachel.

## Ausblick: wie wer hingefahren ist

**Noch nicht gebaut,** und der Teil, der nach der Karte übrig ist.

Gewünscht: **Verkehrsmittel pro Person** — Rad, Auto, zu Fuß, Bus. Entfernung und Dauer ergeben
sich daraus, statt für alle gleich angenommen zu werden.

### Was das anfasst

| Stelle | Änderung |
| --- | --- |
| `shared/geo.ts` | Die Schätzung aus Luftlinie und Umwegfaktor wird durch echtes Routing ersetzt — pro Verkehrsmittel. |
| `restaurants` (Tabelle) | `distance_km`/`travel_min` werden vom festen Wert zur Route pro Verkehrsmittel. |
| `ratings` (Tabelle) | Neu: womit *diese* Person angereist ist. |
| `shared/scoring.ts` | Die Komponente **Anfahrt** ist heute eine Zahl pro Lokal. Mit Verkehrsmitteln pro Person wird sie eine Verteilung. |
| `server/osm.ts` | Eine zweite Art Anfrage nach draußen, oder eine eigene Routing-Maschine. |

### Was vorher zu entscheiden ist

**Wer routet?** Für belastbare Zeiten pro Verkehrsmittel braucht es eine Routing-Maschine
(OSRM, Valhalla, GraphHopper — alle selbst hostbar) oder einen Dienst. Ohne die eine ist „mit
dem Rad" nur ein anderer Multiplikator auf die Luftlinie, also genau die Schätzung, die ersetzt
werden soll. Selbst gehostet hat hier einen zusätzlichen Reiz: es wäre die eine Anfrage nach
draußen wieder los.

**Wessen Anfahrt zählt für den Score?** Wenn Anna mit dem Rad kommt und Markus fährt, sind das
zwei verschiedene Anfahrten zum selben Teller. Denkbar: der Median über alle Anreisen, oder das
Verkehrsmittel der Mehrheit, oder die Anfahrt bleibt am Lokal (mit dem Auto als Bezug) und das
Verkehrsmittel wird nur erfasst und angezeigt. Die erste Variante ist die ehrlichste und die
einzige, die die Rangliste verändert — deshalb gehört sie ausgesprochen und nicht nebenbei
entschieden.

**Was passiert mit den zwölf Beispiel-Lokalen und den bestehenden Ausflügen?** Deren Koordinaten
sind Näherungen. Eine Migration kann sie übernehmen, aber die gerouteten Werte werden von den
heute gespeicherten abweichen — und damit die Anfahrts-Komponente jedes bestehenden Scores.
