/**
 * Minimal image sniffing - just enough to validate the file really is an image
 * and to learn its aspect ratio so the gallery can reserve space before the
 * bytes arrive. No decoding, no dependencies.
 */

export interface ImageMeta {
  mime: string;
  ext: string;
  width: number | null;
  height: number | null;
}

const enc = new TextDecoder();

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return enc.decode(bytes.subarray(start, start + length));
}

export function sniffImage(bytes: Uint8Array): ImageMeta | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // PNG
  if (
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return {
      mime: "image/png",
      ext: "png",
      width: view.getUint32(16, false),
      height: view.getUint32(20, false),
    };
  }

  // GIF
  if (bytes.length > 10 && ascii(bytes, 0, 3) === "GIF") {
    return {
      mime: "image/gif",
      ext: "gif",
      width: view.getUint16(6, true),
      height: view.getUint16(8, true),
    };
  }

  // JPEG - walk the segment markers until a start-of-frame carries the size.
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1]!;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const length = view.getUint16(offset + 2, false);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        return {
          mime: "image/jpeg",
          ext: "jpg",
          height: view.getUint16(offset + 5, false),
          width: view.getUint16(offset + 7, false),
        };
      }
      offset += 2 + length;
    }
    return { mime: "image/jpeg", ext: "jpg", width: null, height: null };
  }

  // WebP (RIFF container) - VP8 / VP8L / VP8X all store the size differently.
  if (bytes.length > 30 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    const chunk = ascii(bytes, 12, 4);
    if (chunk === "VP8X") {
      const w = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
      const h = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
      return { mime: "image/webp", ext: "webp", width: w, height: h };
    }
    if (chunk === "VP8 ") {
      return {
        mime: "image/webp",
        ext: "webp",
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    if (chunk === "VP8L") {
      const b = bytes.subarray(21, 25);
      const bits = b[0]! | (b[1]! << 8) | (b[2]! << 16) | (b[3]! << 24);
      return {
        mime: "image/webp",
        ext: "webp",
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    return { mime: "image/webp", ext: "webp", width: null, height: null };
  }

  // HEIC / AVIF share the ISO base media file format box layout.
  if (bytes.length > 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand.startsWith("avif") || brand.startsWith("avis")) {
      return { mime: "image/avif", ext: "avif", width: null, height: null };
    }
    if (brand.startsWith("heic") || brand.startsWith("heix") || brand.startsWith("mif1")) {
      return { mime: "image/heic", ext: "heic", width: null, height: null };
    }
  }

  return null;
}
