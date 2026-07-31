/**
 * Food-Pics.
 *
 * Drag and drop, captions, likes, and a lightbox. The photographs are the only
 * place in this design where colour arrives uninvited, so they get a plain glass
 * frame and no treatment: a plate of Schlutzkrapfen does not need a gradient over
 * it.
 *
 * Images are only served to signed-in members — see the photo route on the
 * server. That is why there is no thumbnail cache and no CDN: the whole point is
 * that these do not leave the building.
 */

import { useEffect, useRef, useState } from "react";

import { useFocusTrap, useScrollLock } from "../lib/a11y.ts";
import { api, ApiError, photoUrl } from "../lib/api.ts";
import { formatRelative } from "../lib/format.ts";
import { useSession, useToast } from "../lib/store.tsx";
import type { Photo } from "../../shared/types.ts";
import { Avatar, Empty, Pane } from "./ui.tsx";

const MAX_MB = 12;

export function PhotoPanel({
  tripId,
  photos,
  onChange,
}: {
  tripId: string;
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
}) {
  const { me } = useSession();
  const toast = useToast();
  const picker = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [caption, setCaption] = useState("");
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(list.length);
    const uploaded: Photo[] = [];

    for (const file of list) {
      if (file.size > MAX_MB * 1024 * 1024) {
        toast(`${file.name} ist größer als ${MAX_MB} MB.`, "error");
        continue;
      }
      try {
        const result = await api.uploadPhoto(tripId, file, caption);
        uploaded.push(result.photo);
      } catch (err) {
        toast(
          err instanceof ApiError ? err.message : `${file.name} ließ sich nicht hochladen.`,
          "error",
        );
      }
    }

    setUploading(0);
    setCaption("");
    if (uploaded.length > 0) {
      onChange([...uploaded, ...photos]);
      toast(`${uploaded.length} ${uploaded.length === 1 ? "Foto" : "Fotos"} da.`, "success");
    }
  }

  async function toggleLike(photo: Photo) {
    // Optimistic — a like is not worth a spinner.
    const optimistic = photos.map((entry) =>
      entry.id === photo.id
        ? { ...entry, likedByMe: !entry.likedByMe, likes: entry.likes + (entry.likedByMe ? -1 : 1) }
        : entry,
    );
    onChange(optimistic);

    try {
      const result = await api.likePhoto(photo.id);
      onChange(
        optimistic.map((entry) =>
          entry.id === photo.id
            ? { ...entry, likes: result.likes, likedByMe: result.likedByMe }
            : entry,
        ),
      );
    } catch {
      onChange(photos);
      toast("Das Like ging verloren.", "error");
    }
  }

  async function remove(photo: Photo) {
    if (!confirm("Foto löschen?")) return;
    try {
      await api.deletePhoto(photo.id);
      onChange(photos.filter((entry) => entry.id !== photo.id));
      setLightbox(null);
      toast("Foto gelöscht.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Das ließ sich nicht löschen.", "error");
    }
  }

  return (
    <Pane as="section">
      <div className="section__head">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Food-Pics</span>
          <h2>
            {photos.length} {photos.length === 1 ? "Foto" : "Fotos"}
          </h2>
        </div>
        <button type="button" className="btn btn--sm" onClick={() => picker.current?.click()}>
          Foto hinzufügen
        </button>
      </div>

      {photos.length === 0 ? (
        <Empty title="Noch kein Teller dokumentiert.">
          <p className="small">Zieh Bilder hierher oder nimm den Knopf oben.</p>
        </Empty>
      ) : (
        <div className="gallery">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="shot on-photo"
              onClick={() => setLightbox(photo)}
              aria-label={
                photo.caption
                  ? `${photo.caption}, Foto von ${photo.userName}`
                  : `Foto von ${photo.userName}`
              }
            >
              <img
                src={photoUrl(photo.id)}
                alt=""
                loading="lazy"
                decoding="async"
                width={photo.width ?? undefined}
                height={photo.height ?? undefined}
              />
              <span className="shot__bar" aria-hidden="true">
                <Avatar name={photo.userName} hue={photo.userHue} size="sm" />
                <span className="shot__caption">{photo.caption ?? photo.userName}</span>
                {photo.likes > 0 && <span className="shot__likes">♥ {photo.likes}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      <div
        className="dropzone"
        data-active={dragging}
        role="button"
        tabIndex={0}
        aria-label="Fotos auswählen"
        onClick={() => picker.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            picker.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files);
        }}
      >
        {uploading > 0 ? (
          <span className="small dim">
            {uploading} {uploading === 1 ? "Bild wird" : "Bilder werden"} hochgeladen…
          </span>
        ) : (
          <span className="small dim">
            Bilder hierher ziehen oder klicken · JPEG, PNG, WebP, HEIC · bis {MAX_MB} MB
          </span>
        )}
      </div>

      <label className="field" style={{ marginTop: 12 }}>
        <span className="field__label">Bildtext für den nächsten Upload</span>
        <input
          className="input"
          placeholder="Optional — „der Kaiserschmarrn, der alles entschied“"
          value={caption}
          maxLength={200}
          onChange={(event) => setCaption(event.target.value)}
        />
      </label>

      <input
        ref={picker}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files) void upload(event.target.files);
          event.target.value = "";
        }}
      />

      {lightbox && (
        <Lightbox
          photo={lightbox}
          photos={photos}
          canDelete={me?.id === lightbox.userId || me?.isAdmin === true}
          onShow={setLightbox}
          onClose={() => setLightbox(null)}
          onLike={toggleLike}
          onDelete={remove}
        />
      )}
    </Pane>
  );
}

/**
 * The lightbox. The same keyboard contract as a sheet — focus in, trapped,
 * handed back — but the frame here is the photograph itself rather than a pane,
 * so it is not one. Arrow keys walk the gallery, which a sheet has no notion of.
 */
function Lightbox({
  photo,
  photos,
  canDelete,
  onShow,
  onClose,
  onLike,
  onDelete,
}: {
  photo: Photo;
  photos: Photo[];
  canDelete: boolean;
  onShow: (photo: Photo) => void;
  onClose: () => void;
  onLike: (photo: Photo) => void;
  onDelete: (photo: Photo) => void;
}) {
  const frame = useRef<HTMLDivElement | null>(null);

  useFocusTrap(frame);
  useScrollLock();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;

      const index = photos.findIndex((entry) => entry.id === photo.id);
      const step = event.key === "ArrowRight" ? 1 : -1;
      const next = photos[(index + step + photos.length) % photos.length];
      if (next) onShow(next);
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [photo, photos, onShow, onClose]);

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption ?? `Foto von ${photo.userName}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="lightbox__frame" ref={frame} tabIndex={-1}>
        <img className="lightbox__img" src={photoUrl(photo.id)} alt={photo.caption ?? ""} />

        <div className="lightbox__bar">
          <Avatar name={photo.userName} hue={photo.userHue} size="sm" />
          <div style={{ minWidth: 0 }}>
            <div className="small">{photo.caption ?? photo.userName}</div>
            <div className="dim small">
              {photo.userName} · {formatRelative(photo.createdAt)}
            </div>
          </div>

          <button
            type="button"
            className="likebtn"
            aria-pressed={photo.likedByMe}
            aria-label={photo.likedByMe ? "Like zurücknehmen" : "Gefällt mir"}
            style={{ marginLeft: "auto" }}
            onClick={() => onLike(photo)}
          >
            ♥ <span className="tnum">{photo.likes}</span>
          </button>

          {canDelete && (
            <button type="button" className="btn btn--danger btn--sm" onClick={() => onDelete(photo)}>
              Löschen
            </button>
          )}
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
