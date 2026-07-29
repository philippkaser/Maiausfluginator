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

Die Gewichte sind kein Gesetz: Auf der Startseite kann jede und jeder die Rangliste live neu
gewichten (Presets *Feinschmecker*, *Mittagspause*, *Panorama*, *Buchhaltung* – oder eigene
Regler). Die Einstellung bleibt lokal im Browser.

Komponenten ohne Daten fallen aus der Rechnung und die übrigen Gewichte werden hochgerechnet –
ein Ausflug verliert also nichts, nur weil niemand die Wartezeit notiert hat.

## Was drin ist

- **Rangliste** mit live umgewichtbarem Mai-Score, Sortierung nach Score, Datum, Entfernung
  oder Wartezeit und einem Filter für die eigenen offenen Bewertungen.
- **Ausflugsdetails**: Aufschlüsselung des Scores, alle Stimmen mit Kommentaren, Fotogalerie.
- **Bewertung** in fünf Dimensionen plus der Wartezeit in Minuten und einem Kommentar.
  Jede Person hat genau eine Stimme pro Ausflug und kann sie jederzeit ändern.
- **Food-Pics**: Drag & Drop, Bildtexte, Likes, Lightbox. Bilder sind nur für angemeldete
  Mitglieder abrufbar.
- **Anfahrt** wird aus den Koordinaten ab dem HQ gerechnet (Luftlinie → Umwegfaktor →
  Fahrzeit). Wer die echten Werte kennt, trägt sie ein; die gewinnen immer.
- **Radar**: alle Ziele nach echter Himmelsrichtung und Entfernung ab HQ, ganz ohne
  Kartendienst von außen.
- **Auszeichnungen** der Saison: bester Teller, Küchen-Blitz, Geduldsprobe, Expedition,
  Diskussionsstoff und mehr.
- **Mitgliederliste** samt „wie streng bewertet wer eigentlich".
- **Verwaltung** für Einladungscodes.

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

Diesen Code auf der Startseite unter *Einladung einlösen* verwenden. Danach vergibt man weitere
Codes in der App unter *Verwaltung* oder auf der Kommandozeile:

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
Name plus Schlüssel ist das Login auf jedem weiteren Gerät. Verloren? Unter *Mitglieder →
Meinen Schlüssel erneuern* gibt es einen neuen, der alte verfällt sofort.

Gespeichert wird nur ein Argon2id-Hash des Schlüssels. Sessions sind zufällige Tokens, von denen
in der Datenbank ebenfalls nur der SHA-256 liegt; das Cookie ist `HttpOnly` und `SameSite=Lax`.
Hinter einem TLS-Proxy wird es automatisch `Secure` (oder erzwungen mit `FORCE_SECURE_COOKIES=1`).

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

Die HQ-Koordinaten sind eine Näherung für die Julius-Durst-Straße in Brixen. Wenn ihr ab einer
anderen Tür messen wollt, einfach überschreiben.

## Daten

Alles liegt in `data/`: `mai.sqlite` (WAL-Modus) und `data/uploads/` für die Fotos. Ein Backup
ist ein Kopieren dieses Ordners. Löscht man einen Ausflug, verschwinden Bewertungen und Bilddateien
mit ihm.

Beim ersten Start werden zwölf **Beispiel-Lokale** rund um Brixen angelegt, damit die Auswahl
nicht leer ist. Das sind Platzhalter mit echten Ortskoordinaten – umbenennen, korrigieren oder
löschen. Bewertungen sind keine dabei: jede Zahl in dieser App kommt von jemandem, der dort war.

## Aufbau

```
src/
  shared/      Typen und die Score-Berechnung (Server und Client rechnen identisch)
  server/      Bun.serve, SQLite, Auth, Geo, Upload-Handling
  client/      React 19, eigener Mini-Router, Design-System in styles.css
```

Der Server bündelt den Client selbst – Bun kann `index.html` direkt als Route servieren, es gibt
also keinen zweiten Build-Schritt und keine Bundler-Konfiguration.

```bash
bun run typecheck
```

## Aussehen

Glas über einer Aurora. Alles auf dem Bildschirm ist eines von drei Dingen: der lebende
Farbverlauf im Grund, eine Glasscheibe darauf, oder Typografie. Tiefe entsteht wie bei echtem
Glas — eine helle Kante dort, wo das Licht auftrifft, ein dunkler Schlagschatten darunter,
und eine Unschärfe, die die Farbe von hinten aufnimmt.

Zwei Farbverläufe tragen die ganze Palette: **spring** (Mint → Chartreuse) für den Akzent,
Scores und alles Bejahende, **dusk** (Aprikose → Rosé) als warmer Gegenpunkt, sparsam
eingesetzt. Beide stehen samt allen anderen Tokens oben in `styles.css` — wer die Anmutung
ändern will, ändert zwei Zeilen.

Trennung passiert weiter über Haarlinien: die Rangliste ist eine gruppierte Liste, keine
Sammlung schwebender Kacheln. Sortierung und Presets laufen über Segmented Controls, deren
helle Pille zwischen den Optionen gleitet, statt ein- und auszuschalten — die Breite wird
gemessen, damit die Beschriftungen beliebig lang sein dürfen. Zeigt die Maus auf eine
Scheibe, wandert ein weiches Glanzlicht mit; die Position landet als `--mx`/`--my` am
Element, gerendert wird in CSS.

Der Hintergrund ist ein Fragment-Shader: zwei Runden Domain-Warping über fbm-Value-Noise,
eingefärbt, indem vier Palettenstopps entlang des Warp-Feldes gemischt werden. Genau das
unterscheidet ihn von den üblichen zwei weichgezeichneten Farbklecksen — die Grenzen zwischen
den Farben werden ineinander gefaltet statt überblendet, das Feld bekommt Filamente und
Wirbel. Fast alles bleibt Tinte und Mitternachtsblau; das Grün taucht nur dort auf, wo die
Faltung am schärfsten ist.

Er ist bewusst billig: Das Feld hat keine Details oberhalb weniger Zyklen pro Bildschirm,
also rendert er bei 55 % Auflösung mit 30 fps und wird vom Compositor gratis hochskaliert.
Im Hintergrund-Tab pausiert er, bei `prefers-reduced-motion` steht ein einzelnes Standbild,
und wo es gar kein WebGL gibt, springt ein statischer CSS-Verlauf ein.
