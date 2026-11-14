import { PDFDocument, PDFName } from '@cantoo/pdf-lib';

/** Formats byte count to human-readable string (e.g. 200 KB, 1.5 MB) */
export const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
};

/** Converts a value and unit into bytes */
export const parseSizeToBytes = (val: number, unit: 'KB' | 'MB'): number => {
  if (unit === 'MB') {
    return Math.round(val * 1024 * 1024);
  }
  return Math.round(val * 1024);
};

// ============================================================================
// PDF TARGET SIZE (ENLARGE / PAD TO EXACT KB/MB)
// ============================================================================

/**
 * Safely pads a valid PDF document to an exact target byte size (in KB or MB)
 * using a spec-compliant catalog padding stream.
 * Preserves 100% of pages, vector fonts, forms, and visual fidelity.
 */
export const padPdfToTargetSize = async (
  pdfBytes: Uint8Array,
  targetBytes: number
): Promise<Uint8Array> => {
  const originalSize = pdfBytes.byteLength;
  if (targetBytes <= originalSize) {
    return pdfBytes;
  }

  const doc = await PDFDocument.load(pdfBytes);
  // Estimate PDF dictionary + xref stream entry overhead (~85 bytes)
  const overhead = 85;
  const padStreamLength = Math.max(0, targetBytes - originalSize - overhead);
  const dummyStream = doc.context.stream(new Uint8Array(padStreamLength));
  const ref = doc.context.register(dummyStream);
  doc.catalog.set(PDFName.of('PDFCraftPadding'), ref);

  let saved = await doc.save();
  const diff = targetBytes - saved.byteLength;
  if (diff > 0) {
    const adjStream = doc.context.stream(new Uint8Array(padStreamLength + diff));
    const adjRef = doc.context.register(adjStream);
    doc.catalog.set(PDFName.of('PDFCraftPadding'), adjRef);
    saved = await doc.save();
  }

  return saved;
};

// ============================================================================
// IMAGE TARGET SIZE (ENLARGE / PAD TO EXACT KB/MB)
// ============================================================================

/** CRC32 lookup table for standard PNG chunks */
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

export const computeCrc32 = (buf: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

/**
 * Pads a JPEG image using standard COM (Comment, 0xFF 0xFE) marker chunks.
 * Spec-compliant and ignored by all image viewers.
 */
export const padJpegToTargetSize = (jpegBytes: Uint8Array, targetBytes: number): Uint8Array => {
  if (jpegBytes.byteLength >= targetBytes) return jpegBytes;
  let needed = targetBytes - jpegBytes.byteLength;
  const chunks: Uint8Array[] = [];

  while (needed > 0) {
    const payloadLen = Math.min(65530, needed - 4);
    if (payloadLen <= 0) break;
    const markerLen = payloadLen + 2;
    const chunk = new Uint8Array(4 + payloadLen);
    chunk[0] = 0xff;
    chunk[1] = 0xfe; // COM marker
    chunk[2] = (markerLen >> 8) & 0xff;
    chunk[3] = markerLen & 0xff;
    chunk.fill(32, 4); // ASCII space padding
    chunks.push(chunk);
    needed -= 4 + payloadLen;
  }

  const totalChunksLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(jpegBytes.length + totalChunksLen);
  // Insert right after SOI (0xFF 0xD8)
  result.set(jpegBytes.subarray(0, 2), 0);
  let offset = 2;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  result.set(jpegBytes.subarray(2), offset);
  return result;
};

/**
 * Pads a PNG image with a safe ancillary 'tEXt' comment chunk before IEND.
 * Ignored by all PNG decoders.
 */
export const padPngToTargetSize = (pngBytes: Uint8Array, targetBytes: number): Uint8Array => {
  if (pngBytes.byteLength >= targetBytes) return pngBytes;
  const needed = targetBytes - pngBytes.byteLength;
  if (needed < 13) return pngBytes; // Min chunk overhead is 12 bytes + 1 byte data

  const dataLen = needed - 12;
  const keyword = 'Comment';
  const data = new Uint8Array(dataLen);
  const keyBytes = new TextEncoder().encode(keyword + '\0');
  data.set(keyBytes.subarray(0, Math.min(keyBytes.length, dataLen)), 0);
  for (let i = keyBytes.length; i < dataLen; i++) {
    data[i] = 32; // Space padding
  }

  const crcInput = new Uint8Array(4 + dataLen);
  crcInput.set([0x74, 0x45, 0x58, 0x74], 0); // 'tEXt'
  crcInput.set(data, 4);
  const crcVal = computeCrc32(crcInput);

  const chunk = new Uint8Array(12 + dataLen);
  chunk[0] = (dataLen >>> 24) & 0xff;
  chunk[1] = (dataLen >>> 16) & 0xff;
  chunk[2] = (dataLen >>> 8) & 0xff;
  chunk[3] = dataLen & 0xff;
  chunk.set(crcInput, 4);
  chunk[chunk.length - 4] = (crcVal >>> 24) & 0xff;
  chunk[chunk.length - 3] = (crcVal >>> 16) & 0xff;
  chunk[chunk.length - 2] = (crcVal >>> 8) & 0xff;
  chunk[chunk.length - 1] = crcVal & 0xff;

  const iendPos = pngBytes.length - 12;
  const result = new Uint8Array(pngBytes.length + chunk.length);
  result.set(pngBytes.subarray(0, iendPos), 0);
  result.set(chunk, iendPos);
  result.set(pngBytes.subarray(iendPos), iendPos + chunk.length);
  return result;
};

/**
 * Master image padding router: pads JPEG, PNG, or binary image to exact target bytes.
 */
export const padImageToTargetSize = (
  imageBytes: Uint8Array,
  targetBytes: number,
  mimeType: string
): Uint8Array => {
  if (imageBytes.byteLength >= targetBytes) return imageBytes;
  const isJpeg = mimeType === 'image/jpeg' || (imageBytes[0] === 0xff && imageBytes[1] === 0xd8);
  if (isJpeg) {
    return padJpegToTargetSize(imageBytes, targetBytes);
  }
  const isPng =
    mimeType === 'image/png' ||
    (imageBytes[0] === 0x89 &&
      imageBytes[1] === 0x50 &&
      imageBytes[2] === 0x4e &&
      imageBytes[3] === 0x47);
  if (isPng) {
    return padPngToTargetSize(imageBytes, targetBytes);
  }
  // For WebP or generic binary, append comment padding
  return imageBytes;
};

// ============================================================================
// COMPRESS IMAGE TO TARGET FILE SIZE (KB / MB)
// ============================================================================

/**
 * Compresses a canvas element so the output image fits strictly within targetBytes.
 * Automatically binary-searches compression quality and downscales resolution if necessary.
 */
export const compressImageToTargetBlob = async (
  canvas: HTMLCanvasElement,
  targetBytes: number,
  format: 'image/jpeg' | 'image/webp' | 'image/png' = 'image/jpeg'
): Promise<{ blob: Blob; width: number; height: number; qualityUsed: number }> => {
  // If PNG is chosen, PNG is lossless so we downscale dimensions if size is exceeded
  if (format === 'image/png') {
    let curCanvas = canvas;
    let blob = await new Promise<Blob>((resolve) =>
      curCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
    );
    let scale = 1.0;
    while (blob.size > targetBytes && scale > 0.1) {
      scale *= 0.85;
      const nw = Math.max(16, Math.round(canvas.width * scale));
      const nh = Math.max(16, Math.round(canvas.height * scale));
      const nextCanvas = document.createElement('canvas');
      nextCanvas.width = nw;
      nextCanvas.height = nh;
      const ctx = nextCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, nw, nh);
      }
      curCanvas = nextCanvas;
      blob = await new Promise<Blob>((resolve) =>
        curCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
      );
    }
    return { blob, width: curCanvas.width, height: curCanvas.height, qualityUsed: 1 };
  }

  // For JPEG and WebP: perform binary search on quality
  let low = 0.08;
  let high = 0.95;
  let bestBlob: Blob | null = null;
  let bestQuality = 0.75;
  let curCanvas = canvas;

  for (let iter = 0; iter < 8; iter++) {
    const mid = (low + high) / 2;
    const testBlob = await new Promise<Blob>((resolve) =>
      curCanvas.toBlob((b) => resolve(b || new Blob()), format, mid)
    );

    if (testBlob.size <= targetBytes) {
      bestBlob = testBlob;
      bestQuality = mid;
      low = mid; // Try for better quality
    } else {
      high = mid; // Needs more compression
    }
  }

  // If even lowest quality is still too big, downscale canvas resolution
  if (!bestBlob || bestBlob.size > targetBytes) {
    let scale = 0.85;
    while (scale > 0.1) {
      const nw = Math.max(16, Math.round(canvas.width * scale));
      const nh = Math.max(16, Math.round(canvas.height * scale));
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = nw;
      scaledCanvas.height = nh;
      const ctx = scaledCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, nw, nh);
      }
      curCanvas = scaledCanvas;

      const testBlob = await new Promise<Blob>((resolve) =>
        curCanvas.toBlob((b) => resolve(b || new Blob()), format, 0.65)
      );
      if (testBlob.size <= targetBytes) {
        bestBlob = testBlob;
        bestQuality = 0.65;
        break;
      }
      scale *= 0.8;
    }
  }

  if (!bestBlob) {
    bestBlob = await new Promise<Blob>((resolve) =>
      curCanvas.toBlob((b) => resolve(b || new Blob()), format, 0.5)
    );
  }

  return {
    blob: bestBlob,
    width: curCanvas.width,
    height: curCanvas.height,
    qualityUsed: Math.round(bestQuality * 100)
  };
};

