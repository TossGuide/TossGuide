import { describe, expect, it } from 'vitest';
import { fitWithin, orientationTransform, parseExifOrientation, swapsAxes } from '../src/lib/image';

/** Build a minimal JPEG with an APP1/EXIF segment carrying one Orientation entry. */
function jpegWithOrientation(o: number, little = false): ArrayBuffer {
  const bytes: number[] = [0xff, 0xd8, 0xff, 0xe1];
  const tiff: number[] = [];
  const u16 = (v: number) => (little ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) => (little ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24] : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  tiff.push(...u16(1)); // one IFD entry
  tiff.push(...u16(0x0112), ...u16(3), ...u32(1), ...u16(o), 0, 0);
  tiff.push(...u32(0));
  const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const size = payload.length + 2;
  bytes.push(size >> 8, size & 0xff, ...payload, 0xff, 0xd9);
  return new Uint8Array(bytes).buffer;
}

describe('parseExifOrientation', () => {
  it('reads big- and little-endian orientation tags', () => {
    for (const o of [1, 3, 6, 8]) {
      expect(parseExifOrientation(jpegWithOrientation(o))).toBe(o);
      expect(parseExifOrientation(jpegWithOrientation(o, true))).toBe(o);
    }
  });
  it('returns 1 for non-JPEGs, truncated or junk data', () => {
    expect(parseExifOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBe(1);
    expect(parseExifOrientation(new ArrayBuffer(0))).toBe(1);
    expect(parseExifOrientation(jpegWithOrientation(6).slice(0, 20))).toBe(1);
    expect(parseExifOrientation(jpegWithOrientation(42))).toBe(1);
  });
});

describe('fitWithin', () => {
  it('downscales keeping aspect ratio, never upscales', () => {
    expect(fitWithin(4032, 3024, 448)).toEqual({ width: 448, height: 336 });
    expect(fitWithin(200, 100, 448)).toEqual({ width: 200, height: 100 });
    expect(fitWithin(0, 100, 448)).toEqual({ width: 0, height: 0 });
  });
});

describe('orientation transforms', () => {
  // Apply a transform to a point the way canvas does: x' = a*x + c*y + e, y' = b*x + d*y + f
  const apply = (t: number[], x: number, y: number) => [t[0]! * x + t[2]! * y + t[4]!, t[1]! * x + t[3]! * y + t[5]!];
  it('orientation 6 (phone portrait) rotates 90° clockwise into the output canvas', () => {
    // Source is 4 wide x 3 tall; output canvas is 3 wide x 4 tall.
    const t = orientationTransform(6, 3, 4);
    expect(apply(t, 0, 0)).toEqual([3, 0]); // top-left -> top-right
    expect(apply(t, 4, 3)).toEqual([0, 4]); // bottom-right -> bottom-left
  });
  it('every orientation maps the source rectangle exactly onto the output canvas', () => {
    for (let o = 1; o <= 8; o++) {
      const [w, h] = swapsAxes(o) ? [3, 4] : [4, 3];
      const t = orientationTransform(o, w, h);
      const corners = [[0, 0], [4, 0], [0, 3], [4, 3]].map(([x, y]) => apply(t, x!, y!));
      const xs = corners.map((c) => c[0]!).sort((a, b) => a - b);
      const ys = corners.map((c) => c[1]!).sort((a, b) => a - b);
      expect([xs[0], xs[3], ys[0], ys[3]], `orientation ${o}`).toEqual([0, w, 0, h]);
    }
  });
});
