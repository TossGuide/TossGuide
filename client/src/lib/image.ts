/**
 * Image utilities: phone photos -> small, correctly-rotated RGBA pixels for the model.
 *
 * Phone cameras often save photos sideways and record the real orientation in an
 * EXIF tag. If we ignore it, the model sees a sideways coffee cup. We decode with
 * `imageOrientation: 'none'`, read the EXIF tag ourselves and rotate on a canvas,
 * so behaviour is the same in every browser.
 */

/** Read the EXIF Orientation (1-8) from a JPEG. Returns 1 (normal) if absent or not a JPEG. */
export function parseExifOrientation(buf: ArrayBuffer): number {
  const view = new DataView(buf);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1; // not a JPEG
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1) {
      // APP1 segment: "Exif\0\0" then a TIFF header
      const start = offset + 4;
      if (start + 6 > view.byteLength || view.getUint32(start) !== 0x45786966) return 1;
      const tiff = start + 6;
      if (tiff + 8 > view.byteLength) return 1;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd0 = tiff + view.getUint32(tiff + 4, little);
      if (ifd0 + 2 > view.byteLength) return 1;
      const entries = view.getUint16(ifd0, little);
      for (let i = 0; i < entries; i++) {
        const e = ifd0 + 2 + i * 12;
        if (e + 10 > view.byteLength) return 1;
        if (view.getUint16(e, little) === 0x0112) {
          const v = view.getUint16(e + 8, little);
          return v >= 1 && v <= 8 ? v : 1;
        }
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00 || size < 2) return 1; // corrupt
    offset += 2 + size;
  }
  return 1;
}

/** Scale (w, h) down to fit within maxSide, keeping aspect ratio; never upscales. */
export function fitWithin(w: number, h: number, maxSide: number): { width: number; height: number } {
  if (!(w > 0 && h > 0)) return { width: 0, height: 0 };
  const s = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

/** Orientations 5-8 swap width and height. */
export const swapsAxes = (orientation: number) => orientation >= 5 && orientation <= 8;

/**
 * Canvas transform for an EXIF orientation, given the OUTPUT canvas size (w, h).
 * Returns [a, b, c, d, e, f] for ctx.setTransform. Reference: EXIF 2.3 spec, tag 0x0112.
 */
export function orientationTransform(o: number, w: number, h: number): [number, number, number, number, number, number] {
  switch (o) {
    case 2: return [-1, 0, 0, 1, w, 0]; // mirrored
    case 3: return [-1, 0, 0, -1, w, h]; // 180°
    case 4: return [1, 0, 0, -1, 0, h]; // mirrored vertically
    case 5: return [0, 1, 1, 0, 0, 0]; // transpose
    case 6: return [0, 1, -1, 0, w, 0]; // 90° clockwise (most common phone portrait)
    case 7: return [0, -1, -1, 0, w, h]; // transverse
    case 8: return [0, -1, 1, 0, 0, h]; // 90° counter-clockwise
    default: return [1, 0, 0, 1, 0, 0];
  }
}

/** Max side length sent to the model worker (the CLIP processor crops to 224 anyway). */
export const MODEL_INPUT_MAX = 448;

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Draw any image source, rotated per EXIF and downscaled, then read back RGBA pixels. */
export function toPixels(src: CanvasImageSource, srcW: number, srcH: number, orientation = 1): Pixels {
  const rotated = swapsAxes(orientation);
  const { width: dw, height: dh } = fitWithin(srcW, srcH, MODEL_INPUT_MAX); // size of the unrotated draw
  const outW = rotated ? dh : dw;
  const outH = rotated ? dw : dh;
  const canvas = makeCanvas(outW, outH);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.setTransform(...orientationTransform(orientation, outW, outH));
  ctx.drawImage(src, 0, 0, dw, dh);
  const img = ctx.getImageData(0, 0, outW, outH);
  return { data: img.data, width: outW, height: outH };
}

/** Uploaded file -> pixels, with EXIF orientation applied exactly once. */
export async function fileToPixels(file: Blob): Promise<Pixels> {
  const buf = await file.arrayBuffer();
  const orientation = parseExifOrientation(buf);
  try {
    // Ask the browser NOT to auto-rotate, so we apply the EXIF orientation ourselves (consistently).
    const bmp = await createImageBitmap(file, { imageOrientation: 'none' });
    const px = toPixels(bmp, bmp.width, bmp.height, orientation);
    bmp.close();
    return px;
  } catch {
    // Older browsers: <img> decoding already applies EXIF rotation, so don't rotate again.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return toPixels(img, img.naturalWidth, img.naturalHeight, 1);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Grab the current video frame (live camera) as pixels. */
export function videoToPixels(video: HTMLVideoElement): Pixels {
  return toPixels(video, video.videoWidth, video.videoHeight, 1);
}
