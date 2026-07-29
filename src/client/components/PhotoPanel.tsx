import { useEffect, useRef, useState } from "react";

import { api, ApiError, photoUrl } from "../lib/api.ts";
import { formatRelative } from "../lib/format.ts";
import { useSession, useToast } from "../lib/store.tsx";
import type { Photo } from "../../shared/types.ts";
import { Avatar, Empty } from "./ui.tsx";

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
  const inputRef = useRef<HTMLInputElement>(null);
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
        toast(err instanceof ApiError ? err.message : `${file.name} konnte nicht hochgeladen werden`, "error");
      }
    }
    setUploading(0);
    setCaption("");
    if (uploaded.length > 0) {
      onChange([...uploaded, ...photos]);
      toast(`${uploaded.length} ${uploaded.length === 1 ? "Foto" : "Fotos"} hochgeladen.`, "success");
    }
  }

  async function toggleLike(photo: Photo) {
    // Optimistic - the like count is not worth a spinner.
    const optimistic = photos.map((p) =>
      p.id === photo.id
        ? { ...p, likedByMe: !p.likedByMe, likes: p.likes + (p.likedByMe ? -1 : 1) }
        : p,
    );
    onChange(optimistic);
    try {
      const result = await api.likePhoto(photo.id);
      onChange(
        optimistic.map((p) =>
          p.id === photo.id ? { ...p, likes: result.likes, likedByMe: result.likedByMe } : p,
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
      onChange(photos.filter((p) => p.id !== photo.id));
      setLightbox(null);
      toast("Foto gelöscht.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen", "error");
    }
  }

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const index = photos.findIndex((p) => p.id === lightbox.id);
        const next = event.key === "ArrowRight" ? index + 1 : index - 1;
        const target = photos[(next + photos.length) % photos.length];
        if (target) setLightbox(target);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, photos]);

  return (
    <section className="card card--pad">
      <div className="section__head">
        <h2>
          {photos.length} {photos.length === 1 ? "Foto" : "Fotos"}
        </h2>
        <button type="button" className="btn btn--sm" onClick={() => inputRef.current?.click()}>
          Foto hinzufügen
        </button>
      </div>

      {photos.length === 0 ? (
        <Empty title="Noch kein Teller dokumentiert.">
          <p className="small">Zieh Bilder hierher oder nutz den Button oben.</p>
        </Empty>
      ) : (
        <div className="gallery">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="shot"
              onClick={() => setLightbox(photo)}
              aria-label={photo.caption ?? `Foto von ${photo.userName}`}
            >
              <img
                src={photoUrl(photo.id)}
                alt={photo.caption ?? `Foto von ${photo.userName}`}
                loading="lazy"
                decoding="async"
                width={photo.width ?? undefined}
                height={photo.height ?? undefined}
              />
              <span className="shot__overlay">
                <Avatar name={photo.userName} hue={photo.userHue} size="sm" />
                <span
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {photo.caption ?? photo.userName}
                </span>
                {photo.likes > 0 && <span style={{ marginLeft: "auto" }}>♥ {photo.likes}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      <div
        className="dropzone"
        data-active={dragging}
        style={{ marginTop: 16 }}
        onClick={() => inputRef.current?.click()}
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
          <span className="dim small">
            {uploading} {uploading === 1 ? "Bild wird" : "Bilder werden"} hochgeladen…
          </span>
        ) : (
          <span className="dim small">
            Bilder hierher ziehen oder klicken · JPEG, PNG, WebP, HEIC · max. {MAX_MB} MB
          </span>
        )}
      </div>

      <input
        className="input"
        style={{ marginTop: 10 }}
        placeholder="Bildtext für den nächsten Upload (optional)"
        value={caption}
        maxLength={200}
        onChange={(event) => setCaption(event.target.value)}
      />

      <input
        ref={inputRef}
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
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Foto"
          onClick={(event) => {
            if (event.target === event.currentTarget) setLightbox(null);
          }}
        >
          <div className="stack stack--sm" style={{ alignItems: "center" }}>
            <img className="lightbox__img" src={photoUrl(lightbox.id)} alt={lightbox.caption ?? ""} />
            <div className="lightbox__bar">
              <Avatar name={lightbox.userName} hue={lightbox.userHue} size="sm" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.88rem" }}>{lightbox.caption ?? lightbox.userName}</div>
                <div className="muted small">
                  {lightbox.userName} · {formatRelative(lightbox.createdAt)}
                </div>
              </div>
              <button
                type="button"
                className="likebtn"
                aria-pressed={lightbox.likedByMe}
                style={{ marginLeft: "auto" }}
                onClick={() => {
                  void toggleLike(lightbox);
                  setLightbox({
                    ...lightbox,
                    likedByMe: !lightbox.likedByMe,
                    likes: lightbox.likes + (lightbox.likedByMe ? -1 : 1),
                  });
                }}
              >
                ♥ {lightbox.likes}
              </button>
              {(me?.id === lightbox.userId || me?.isAdmin) && (
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => remove(lightbox)}>
                  Löschen
                </button>
              )}
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setLightbox(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
