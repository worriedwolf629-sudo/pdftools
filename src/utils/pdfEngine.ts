import { PDFDocument, rgb, degrees, StandardFonts, PDFName } from '@cantoo/pdf-lib';
import type { PDFPage, PDFFont } from '@cantoo/pdf-lib';
import type { PDFPageProxy } from 'pdfjs-dist';
import JSZip from 'jszip';
import { pdfjsLib } from './pdfjs';
import { createCanvas, canvasToBlob } from './canvas';
import { parsePageRanges, parsePageSegments } from './ranges';
import { diffLines } from './diff';
import type { DiffOp } from './diff';

import { needsUnicodeRendering } from './textPdf';
export { textToPDF, markdownToPDF, needsUnicodeRendering } from './textPdf';
export { parsePageRanges } from './ranges';

/* ================================================================== */
/* Shared helpers                                                       */
/* ================================================================== */

export type Progress = (pct: number, label?: string) => void;

/** Yield to the browser so progress bars can repaint between heavy steps. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export const fileToArrayBuffer = (file: File | Blob): Promise<ArrayBuffer> => file.arrayBuffer();

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

export const stripPdfExt = (name: string) => name.replace(/\.pdf$/i, '');

const hexToRgb = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const v = m ? parseInt(m[1], 16) : 0;
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
};

/** Turns library errors into something a user can act on. */
export const friendlyError = (err: unknown): string => {
  const e = err as { name?: string; code?: number; message?: string } | undefined;
  const msg = e?.message ?? String(err ?? '');

  if (e?.name === 'PasswordException') {
    return e.code === 2
      ? 'Incorrect password. Please try again.'
      : 'This PDF is password-protected. Use the Unlock PDF tool first.';
  }
  if (/incorrect password|password incorrect|wrong password|invalid password|bad password/i.test(msg)) {
    return 'Incorrect password. Please try again.';
  }
  if (/encrypted/i.test(msg)) {
    return 'This PDF is password-protected. Use the Unlock PDF tool first.';
  }
  if (/WinAnsi|cannot encode/i.test(msg)) {
    return 'That text contains characters the built-in PDF fonts cannot draw. Use Latin characters (A–Z, accents, punctuation).';
  }
  if (/Invalid PDF|Failed to parse|No PDF header|InvalidPDFException/i.test(msg) || e?.name === 'InvalidPDFException') {
    return 'This file does not look like a valid PDF (it may be corrupted).';
  }
  return msg || 'Something went wrong while processing the file.';
};

/** Load with pdf-lib. Encrypted files surface a friendly error unless a password is given. */
const loadPdf = async (
  file: File | Blob,
  opts: { password?: string; ignoreEncryption?: boolean } = {}
): Promise<PDFDocument> => {
  const buf = await fileToArrayBuffer(file);
  return PDFDocument.load(buf, {
    password: opts.password,
    ignoreEncryption: opts.ignoreEncryption,
    updateMetadata: false
  });
};

const openPdfjs = async (file: File | Blob, password?: string) => {
  const data = new Uint8Array(await fileToArrayBuffer(file));
  const base = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/`;
  const task = pdfjsLib.getDocument({
    data,
    password,
    // Optional resources: pdf.js falls back gracefully if these are unreachable.
    standardFontDataUrl: `${base}standard_fonts/`,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true
  });
  return task.promise;
};

const renderPageToCanvas = async (page: PDFPageProxy, scale: number) => {
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas;
};

/** Render one page of a PDF to a canvas (used by the visual page picker). */
export const renderPdfPage = async (file: File | Blob, pageNum: number, targetWidth: number) => {
  const doc = await openPdfjs(file);
  try {
    const n = Math.min(Math.max(1, pageNum), doc.numPages);
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const canvas = await renderPageToCanvas(page, (targetWidth / base.width) * dpr);
    return { canvas, numPages: doc.numPages, aspect: base.height / base.width, widthPt: base.width, heightPt: base.height };
  } finally {
    void doc.loadingTask.destroy();
  }
};

/**
 * pdf-lib draws in the page's *unrotated* space, but users look at the *displayed* page.
 * This maps displayed coordinates (origin bottom-left, y up) back to PDF space so Sign / Edit /
 * Watermark / Page Numbers land where the user sees them even on pages with /Rotate set.
 */
interface Frame {
  rot: number;
  Wd: number;
  Hd: number;
  toPdf: (a: number, b: number) => { x: number; y: number };
  /** percent from the displayed top-left -> displayed coords (y up) */
  fromTopLeftPct: (xPct: number, yPct: number) => { a: number; b: number };
}

const frameOf = (page: PDFPage): Frame => {
  const { width: w, height: h } = page.getSize();
  const rot = (((Math.round(page.getRotation().angle / 90) * 90) % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const Wd = swap ? h : w;
  const Hd = swap ? w : h;
  const toPdf = (a: number, b: number) => {
    switch (rot) {
      case 90:
        return { x: Hd - b, y: a };
      case 180:
        return { x: Wd - a, y: Hd - b };
      case 270:
        return { x: b, y: Wd - a };
      default:
        return { x: a, y: b };
    }
  };
  return {
    rot,
    Wd,
    Hd,
    toPdf,
    fromTopLeftPct: (xPct, yPct) => ({ a: (xPct / 100) * Wd, b: Hd - (yPct / 100) * Hd })
  };
};

const drawTextDisplayed = (
  page: PDFPage,
  frame: Frame,
  font: PDFFont,
  text: string,
  size: number,
  a: number,
  b: number,
  opts: { color?: ReturnType<typeof rgb>; opacity?: number; angle?: number } = {}
) => {
  const p = frame.toPdf(a, b);
  page.drawText(text, {
    x: p.x,
    y: p.y,
    size,
    font,
    color: opts.color ?? rgb(0, 0, 0),
    opacity: opts.opacity,
    rotate: degrees(frame.rot + (opts.angle ?? 0))
  });
};

const rectDisplayed = (frame: Frame, aLeft: number, bBottom: number, w: number, h: number) => {
  const p1 = frame.toPdf(aLeft, bBottom);
  const p2 = frame.toPdf(aLeft + w, bBottom + h);
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    width: Math.abs(p2.x - p1.x),
    height: Math.abs(p2.y - p1.y)
  };
};

/**
 * The built-in PDF fonts only cover Latin (WinAnsi); pdf-lib silently turns anything else into "?".
 * For Hindi / Kannada / Arabic / CJK text we render it with the browser's own fonts and place it as an image.
 */
const textImage = async (text: string, size: number, color: string) => {
  const S = 3;
  const family = '"Noto Sans", "Noto Sans Devanagari", "Noto Sans Kannada", "Noto Sans Arabic", "Segoe UI", system-ui, sans-serif';
  const font = `600 ${size * S}px ${family}`;
  const lines = text.split('\n');
  const probe = createCanvas(8, 8).getContext('2d')!;
  probe.font = font;
  const maxW = Math.max(...lines.map((l) => probe.measureText(l).width), 1);
  const lineH = size * S * 1.35;
  const pad = size * S * 0.3;
  const canvas = createCanvas(Math.ceil(maxW + pad * 2), Math.ceil(lineH * lines.length + pad * 2));
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, pad, pad + i * lineH));
  const blob = await canvasToBlob(canvas, 'image/png');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w: canvas.width / S, h: canvas.height / S, pad: pad / S };
};

/* ================================================================== */
/* 1. Merge                                                             */
/* ================================================================== */

export const mergePDFs = async (files: File[], onProgress?: Progress): Promise<Uint8Array> => {
  if (files.length < 2) throw new Error('Add at least two PDF files to merge.');
  const merged = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    onProgress?.(Math.round((i / files.length) * 100), `Merging ${files[i].name}`);
    let pdf: PDFDocument;
    try {
      pdf = await loadPdf(files[i]);
    } catch (e) {
      throw new Error(`${files[i].name}: ${friendlyError(e)}`);
    }
    const pages = await merged.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
    await tick();
  }
  return merged.save();
};

/* ================================================================== */
/* 2. Split                                                             */
/* ================================================================== */

export interface SplitOptions {
  mode: 'range' | 'everyN';
  rangeStr?: string;
  everyN?: number;
}

export const splitPDF = async (
  file: File,
  options: SplitOptions
): Promise<{ pdfBytes: Uint8Array; filename: string }[]> => {
  const src = await loadPdf(file);
  const total = src.getPageCount();
  const base = stripPdfExt(file.name);
  const groups: { pages: number[]; name: string }[] = [];

  if (options.mode === 'everyN') {
    const n = Math.max(1, Math.floor(options.everyN || 1));
    for (let i = 0, part = 1; i < total; i += n, part++) {
      const pages = Array.from({ length: Math.min(n, total - i) }, (_, k) => i + k + 1);
      groups.push({ pages, name: `${base}_part${part}.pdf` });
    }
  } else {
    const segments = parsePageSegments(options.rangeStr || `1-${total}`, total);
    segments.forEach((pages, idx) => {
      const label = pages.length === 1 ? `page_${pages[0]}` : `pages_${pages[0]}-${pages[pages.length - 1]}`;
      groups.push({ pages, name: `${base}_${label}${segments.length > 1 ? `_${idx + 1}` : ''}.pdf` });
    });
  }

  const results: { pdfBytes: Uint8Array; filename: string }[] = [];
  for (const g of groups) {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, g.pages.map((p) => p - 1));
    copied.forEach((p) => out.addPage(p));
    results.push({ pdfBytes: await out.save(), filename: g.name });
  }
  return results;
};

/* ================================================================== */
/* 3. Compress                                                          */
/* ================================================================== */

export type CompressPreset = 'low' | 'medium' | 'high';

const COMPRESS_SETTINGS: Record<CompressPreset, { dpi: number; quality: number }> = {
  low: { dpi: 150, quality: 0.85 },
  medium: { dpi: 110, quality: 0.7 },
  high: { dpi: 72, quality: 0.5 }
};

import { padPdfToTargetSize } from './fileSizeTarget';

export interface CompressResult {
  pdfBytes: Uint8Array;
  originalSize: number;
  newSize: number;
  /** 'optimized' = lossless re-pack, 'rasterized' = pages re-encoded as JPEG, 'enlarged' = padded to target size, 'unchanged' = nothing smaller found */
  method: 'optimized' | 'rasterized' | 'enlarged' | 'unchanged';
}

export const compressPDF = async (
  file: File,
  preset: CompressPreset,
  onProgress?: Progress
): Promise<CompressResult> => {
  const originalBytes = new Uint8Array(await fileToArrayBuffer(file));
  const originalSize = originalBytes.byteLength;

  // Candidate 1: lossless re-pack (object streams, dropped unreferenced objects). Keeps text selectable.
  onProgress?.(5, 'Optimizing structure');
  let best: { bytes: Uint8Array; method: CompressResult['method'] } = { bytes: originalBytes, method: 'unchanged' };
  try {
    const doc = await loadPdf(file);
    const clean = await PDFDocument.create();
    const pages = await clean.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => clean.addPage(p));
    const repacked = await clean.save({ useObjectStreams: true });
    if (repacked.byteLength < best.bytes.byteLength) best = { bytes: repacked, method: 'optimized' };
  } catch (e) {
    if (/encrypted|password/i.test((e as Error).message)) throw e;
  }

  // Candidate 2: re-render every page as a JPEG. Big savings on scans/photos, but flattens text.
  const { dpi, quality } = COMPRESS_SETTINGS[preset];
  const scale = dpi / 72;
  const pdfjsDoc = await openPdfjs(file);
  try {
    const out = await PDFDocument.create();
    for (let i = 1; i <= pdfjsDoc.numPages; i++) {
      onProgress?.(10 + Math.round((i / pdfjsDoc.numPages) * 85), `Compressing page ${i} of ${pdfjsDoc.numPages}`);
      const page = await pdfjsDoc.getPage(i);
      const canvas = await renderPageToCanvas(page, scale);
      const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      const img = await out.embedJpg(await blob.arrayBuffer());
      const pt = page.getViewport({ scale: 1 });
      const p = out.addPage([pt.width, pt.height]);
      p.drawImage(img, { x: 0, y: 0, width: pt.width, height: pt.height });
      page.cleanup();
      await tick();
    }
    const raster = await out.save({ useObjectStreams: true });
    // Only use it if it is clearly smaller (>8%) than the best lossless candidate.
    if (raster.byteLength < best.bytes.byteLength * 0.92) best = { bytes: raster, method: 'rasterized' };
  } finally {
    void pdfjsDoc.loadingTask.destroy();
  }

  onProgress?.(100, 'Done');
  return { pdfBytes: best.bytes, originalSize, newSize: best.bytes.byteLength, method: best.method };
};

export const enlargePdfToTargetSize = async (
  file: File | Blob,
  targetBytes: number,
  onProgress?: Progress
): Promise<CompressResult> => {
  onProgress?.(15, 'Reading PDF document');
  const buffer = await file.arrayBuffer();
  const originalBytes = new Uint8Array(buffer);
  const originalSize = originalBytes.byteLength;

  if (targetBytes <= originalSize) {
    return { pdfBytes: originalBytes, originalSize, newSize: originalSize, method: 'unchanged' };
  }

  onProgress?.(50, 'Enlarging PDF structure to target size');
  const padded = await padPdfToTargetSize(originalBytes, targetBytes);
  onProgress?.(100, 'Done');
  return {
    pdfBytes: padded,
    originalSize,
    newSize: padded.byteLength,
    method: 'enlarged'
  };
};

export const compressPdfToTargetSize = async (
  file: File | Blob,
  targetBytes: number,
  onProgress?: Progress
): Promise<CompressResult> => {
  const buffer = await file.arrayBuffer();
  const originalBytes = new Uint8Array(buffer);
  const originalSize = originalBytes.byteLength;

  // If user requested target size >= current, enlarge to that target size!
  if (targetBytes >= originalSize) {
    return enlargePdfToTargetSize(file, targetBytes, onProgress);
  }

  // Candidate 1: lossless structure cleanup
  onProgress?.(10, 'Optimizing PDF structure (lossless)');
  let best: { bytes: Uint8Array; method: CompressResult['method'] } = { bytes: originalBytes, method: 'unchanged' };
  try {
    const doc = await PDFDocument.load(originalBytes);
    const clean = await PDFDocument.create();
    const pages = await clean.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => clean.addPage(p));
    const repacked = await clean.save({ useObjectStreams: true });
    if (repacked.byteLength <= targetBytes) {
      onProgress?.(100, 'Done');
      return { pdfBytes: repacked, originalSize, newSize: repacked.byteLength, method: 'optimized' };
    }
    if (repacked.byteLength < best.bytes.byteLength) {
      best = { bytes: repacked, method: 'optimized' };
    }
  } catch (e) {
    if (/encrypted|password/i.test((e as Error).message)) throw e;
  }

  // Candidate 2: Adaptive raster downsample to hit target bytes
  const profiles = [
    { dpi: 150, quality: 0.82 },
    { dpi: 120, quality: 0.70 },
    { dpi: 96, quality: 0.55 },
    { dpi: 72, quality: 0.40 },
    { dpi: 50, quality: 0.25 }
  ];

  const pdfjsDoc = await openPdfjs(file);
  try {
    for (let pIdx = 0; pIdx < profiles.length; pIdx++) {
      const { dpi, quality } = profiles[pIdx];
      const scale = dpi / 72;
      onProgress?.(20 + pIdx * 15, `Testing compression profile (${dpi} DPI, ${Math.round(quality * 100)}% quality)`);

      const out = await PDFDocument.create();
      for (let i = 1; i <= pdfjsDoc.numPages; i++) {
        const page = await pdfjsDoc.getPage(i);
        const canvas = await renderPageToCanvas(page, scale);
        const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        const img = await out.embedJpg(await blob.arrayBuffer());
        const pt = page.getViewport({ scale: 1 });
        const p = out.addPage([pt.width, pt.height]);
        p.drawImage(img, { x: 0, y: 0, width: pt.width, height: pt.height });
        page.cleanup();
      }
      const raster = await out.save({ useObjectStreams: true });
      if (raster.byteLength < best.bytes.byteLength) {
        best = { bytes: raster, method: 'rasterized' };
      }
      if (raster.byteLength <= targetBytes) {
        break;
      }
    }
  } finally {
    void pdfjsDoc.loadingTask.destroy();
  }

  // Compression must NEVER return a file larger than original input
  if (best.bytes.byteLength > originalSize) {
    best = { bytes: originalBytes, method: 'unchanged' };
  }

  onProgress?.(100, 'Done');
  return { pdfBytes: best.bytes, originalSize, newSize: best.bytes.byteLength, method: best.method };
};

/* ================================================================== */
/* 4. Images -> PDF                                                     */
/* ================================================================== */

export interface ImagesToPdfOptions {
  pageSize?: 'fit' | 'a4' | 'letter';
  orientation?: 'auto' | 'portrait' | 'landscape';
  margin?: number;
}

const sniffImage = (b: Uint8Array): 'png' | 'jpg' | null => {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  return null;
};

/** Reads the EXIF orientation tag (1 = normal). Phone photos are often stored rotated. */
const getJpegOrientation = (b: Uint8Array): number => {
  if (b[0] !== 0xff || b[1] !== 0xd8) return 1;
  let off = 2;
  while (off + 4 < b.length && b[off] === 0xff) {
    const marker = b[off + 1];
    const len = (b[off + 2] << 8) | b[off + 3];
    if (marker === 0xe1 && b[off + 4] === 0x45 && b[off + 5] === 0x78 && b[off + 6] === 0x69 && b[off + 7] === 0x66) {
      const t = off + 10;
      const little = b[t] === 0x49;
      const r16 = (o: number) => (little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
      const r32 = (o: number) =>
        little
          ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
          : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
      const ifd = t + r32(t + 4);
      const n = r16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (r16(e) === 0x0112) return r16(e + 8);
      }
      return 1;
    }
    off += 2 + len;
  }
  return 1;
};

const normalizeImage = async (file: File): Promise<{ bytes: Uint8Array; kind: 'png' | 'jpg' }> => {
  const bytes = new Uint8Array(await fileToArrayBuffer(file));
  const kind = sniffImage(bytes);
  const orientation = kind === 'jpg' ? getJpegOrientation(bytes) : 1;
  if (kind && orientation === 1) return { bytes, kind };

  // WebP / GIF / BMP / AVIF, or a JPEG that needs its EXIF rotation applied: redraw via canvas.
  if (typeof createImageBitmap !== 'function') {
    throw new Error(`${file.name}: unsupported image format. Use JPG or PNG.`);
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`${file.name}: could not read this image.`);
  }
  const canvas = createCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const asJpeg = kind === 'jpg';
  const blob = await canvasToBlob(canvas, asJpeg ? 'image/jpeg' : 'image/png', 0.92);
  return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: asJpeg ? 'jpg' : 'png' };
};

export const imagesToPDF = async (
  images: File[],
  options: ImagesToPdfOptions = {},
  onProgress?: Progress
): Promise<Uint8Array> => {
  if (images.length === 0) throw new Error('Add at least one image.');
  const pdfDoc = await PDFDocument.create();
  const margin = options.margin ?? 10;
  const sizes = { a4: [595.28, 841.89], letter: [612, 792] } as const;

  for (let i = 0; i < images.length; i++) {
    onProgress?.(Math.round((i / images.length) * 100), `Adding ${images[i].name}`);
    const { bytes, kind } = await normalizeImage(images[i]);
    const img = kind === 'png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);

    let pageW = img.width + margin * 2;
    let pageH = img.height + margin * 2;
    const fixed = options.pageSize === 'a4' || options.pageSize === 'letter';

    if (fixed) {
      [pageW, pageH] = sizes[options.pageSize as 'a4' | 'letter'];
      const landscape =
        options.orientation === 'landscape' || (options.orientation !== 'portrait' && img.width > img.height);
      if (landscape && pageW < pageH) [pageW, pageH] = [pageH, pageW];
      if (!landscape && options.orientation === 'portrait' && pageW > pageH) [pageW, pageH] = [pageH, pageW];
    }

    const page = pdfDoc.addPage([pageW, pageH]);
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    // Fit-to-page on fixed sizes (scale up allowed); keep native size when the page wraps the image.
    const scale = Math.min(maxW / img.width, maxH / img.height, fixed ? Infinity : 1);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
    await tick();
  }
  return pdfDoc.save();
};

/* ================================================================== */
/* 5. PDF -> Images                                                     */
/* ================================================================== */

export type ImageFormat = 'jpg' | 'png' | 'webp';
const MIME: Record<ImageFormat, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export const pdfToImages = async (
  file: File,
  format: ImageFormat = 'jpg',
  scale = 2,
  onProgress?: Progress
): Promise<{ blob: Blob; pageNum: number }[]> => {
  const doc = await openPdfjs(file);
  const results: { blob: Blob; pageNum: number }[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress?.(Math.round(((i - 1) / doc.numPages) * 100), `Rendering page ${i} of ${doc.numPages}`);
      const page = await doc.getPage(i);
      const canvas = await renderPageToCanvas(page, scale);
      results.push({ blob: await canvasToBlob(canvas, MIME[format], 0.92), pageNum: i });
      page.cleanup();
      await tick();
    }
  } finally {
    void doc.loadingTask.destroy();
  }
  return results;
};

export const zipImages = async (
  images: { blob: Blob; pageNum: number }[],
  format: ImageFormat,
  baseName: string
): Promise<Blob> => {
  const zip = new JSZip();
  const pad = String(images.length).length;
  images.forEach((img) => zip.file(`${baseName}_page_${String(img.pageNum).padStart(pad, '0')}.${format}`, img.blob));
  return zip.generateAsync({ type: 'blob' });
};

/* ================================================================== */
/* 6-8. Rotate / Delete / Extract pages                                 */
/* ================================================================== */

export const rotatePDF = async (file: File, angle: number, pagesSpec = 'all'): Promise<Uint8Array> => {
  const pdf = await loadPdf(file);
  const selected = new Set(parsePageRanges(pagesSpec || 'all', pdf.getPageCount()));
  pdf.getPages().forEach((page, idx) => {
    if (selected.has(idx + 1)) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((((current + angle) % 360) + 360) % 360));
    }
  });
  return pdf.save();
};

export const deletePagesPDF = async (file: File, pagesSpec: string): Promise<Uint8Array> => {
  const src = await loadPdf(file);
  const total = src.getPageCount();
  const toDelete = new Set(parsePageRanges(pagesSpec, total));
  const keep = Array.from({ length: total }, (_, i) => i).filter((i) => !toDelete.has(i + 1));
  if (keep.length === 0) throw new Error('You cannot delete every page. Leave at least one page in the document.');
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keep);
  pages.forEach((p) => out.addPage(p));
  return out.save();
};

export const extractPagesPDF = async (file: File, pagesSpec: string): Promise<Uint8Array> => {
  const src = await loadPdf(file);
  const pageNums = parsePageRanges(pagesSpec, src.getPageCount());
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, pageNums.map((p) => p - 1));
  pages.forEach((p) => out.addPage(p));
  return out.save();
};

export interface ResizePdfOptions {
  mode: 'scale' | 'paper' | 'file-size';
  scaleFactor?: number;
  paperSize?: 'A4' | 'Letter' | 'Legal' | 'A3' | 'Tabloid';
  targetBytes?: number;
}

export const resizePDF = async (
  file: File | Blob,
  options: ResizePdfOptions
): Promise<Uint8Array> => {
  if (options.mode === 'file-size' && options.targetBytes) {
    const res = await compressPdfToTargetSize(file, options.targetBytes);
    return res.pdfBytes;
  }

  const buffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(buffer);
  const pages = pdf.getPages();

  for (const page of pages) {
    if (options.mode === 'scale' && options.scaleFactor) {
      const sf = options.scaleFactor;
      page.scale(sf, sf);
    } else if (options.mode === 'paper' && options.paperSize) {
      let w = 595.28;
      let h = 841.89; // A4
      if (options.paperSize === 'Letter') {
        w = 612;
        h = 792;
      } else if (options.paperSize === 'Legal') {
        w = 612;
        h = 1008;
      } else if (options.paperSize === 'A3') {
        w = 841.89;
        h = 1190.55;
      } else if (options.paperSize === 'Tabloid') {
        w = 792;
        h = 1224;
      }
      page.setSize(w, h);
    }
  }
  return pdf.save();
};

/* ================================================================== */
/* 9. Watermark                                                         */
/* ================================================================== */

export interface WatermarkOptions {
  opacity?: number;
  fontSize?: number;
  color?: string;
  angle?: number;
  pagesSpec?: string;
}

export const addWatermarkPDF = async (file: File, text: string, options: WatermarkOptions = {}): Promise<Uint8Array> => {
  if (!text.trim()) throw new Error('Enter the watermark text.');
  const pdf = await loadPdf(file);
  const total = pdf.getPageCount();
  const selected = new Set(parsePageRanges(options.pagesSpec || 'all', total));

  const opacity = options.opacity ?? 0.3;
  const size = options.fontSize ?? 56;
  const angle = options.angle ?? 45;
  const colorHex = options.color ?? '#808080';
  const color = hexToRgb(colorHex);
  const rad = (angle * Math.PI) / 180;
  const unicode = needsUnicodeRendering(text);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const imgSize = unicode ? await textImage(text, size, colorHex) : null;
  const img = imgSize ? await pdf.embedPng(imgSize.bytes) : null;

  pdf.getPages().forEach((page, idx) => {
    if (!selected.has(idx + 1)) return;
    const frame = frameOf(page);
    const cx = frame.Wd / 2;
    const cy = frame.Hd / 2;
    // Place the origin so the text's *center* sits on the page center after rotating.
    const tw = imgSize ? imgSize.w : font.widthOfTextAtSize(text, size);
    const th = imgSize ? imgSize.h : font.heightAtSize(size, { descender: false });
    const a = cx - (Math.cos(rad) * tw) / 2 + (Math.sin(rad) * th) / 2;
    const b = cy - (Math.sin(rad) * tw) / 2 - (Math.cos(rad) * th) / 2;
    if (img && imgSize) {
      const p = frame.toPdf(a, b);
      page.drawImage(img, {
        x: p.x,
        y: p.y,
        width: imgSize.w,
        height: imgSize.h,
        rotate: degrees(frame.rot + angle),
        opacity
      });
    } else {
      drawTextDisplayed(page, frame, font, text, size, a, b, { color, opacity, angle });
    }
  });
  return pdf.save();
};

/* ================================================================== */
/* 10. Page numbers                                                     */
/* ================================================================== */

export type NumberPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface PageNumberOptions {
  position?: NumberPosition;
  format?: string;
  startFrom?: number;
  fontSize?: number;
  skipFirst?: boolean;
}

export const addPageNumbersPDF = async (file: File, options: PageNumberOptions = {}): Promise<Uint8Array> => {
  const pdf = await loadPdf(file);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const total = pages.length;
  const size = options.fontSize ?? 10;
  const start = Number.isFinite(options.startFrom) ? (options.startFrom as number) : 1;
  const fmt = options.format || 'Page {n} of {total}';
  if (needsUnicodeRendering(fmt)) {
    throw new Error('The page-number format can only use Latin characters, digits and punctuation.');
  }
  const pos = options.position ?? 'bottom-center';

  pages.forEach((page, idx) => {
    if (options.skipFirst && idx === 0) return;
    const n = idx + start;
    const label = fmt.split('{n}').join(String(n)).split('{total}').join(String(total + start - 1));
    const frame = frameOf(page);
    const tw = font.widthOfTextAtSize(label, size);
    const pad = 30;
    const [v, h] = pos.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
    const a = h === 'left' ? pad : h === 'right' ? frame.Wd - pad - tw : (frame.Wd - tw) / 2;
    const b = v === 'top' ? frame.Hd - pad - size * 0.8 : pad;
    drawTextDisplayed(page, frame, font, label, size, a, b, { color: rgb(0.2, 0.2, 0.2) });
  });
  return pdf.save();
};

/* ================================================================== */
/* 11-12. Protect / Unlock (real encryption)                            */
/* ================================================================== */

export interface ProtectOptions {
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
  allowModifying?: boolean;
}

const randomSecret = (): string => {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const protectPDF = async (file: File, userPassword: string, options: ProtectOptions = {}): Promise<Uint8Array> => {
  if (!userPassword) throw new Error('Enter a password to protect the PDF with.');
  const pdf = await loadPdf(file);
  pdf.encrypt({
    userPassword,
    // A separate owner password is what makes the permission flags meaningful.
    ownerPassword: options.ownerPassword || randomSecret(),
    permissions: {
      printing: options.allowPrinting === false ? false : 'highResolution',
      copying: options.allowCopying !== false,
      modifying: options.allowModifying !== false,
      annotating: options.allowModifying !== false,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: options.allowModifying !== false
    }
  });
  return pdf.save();
};

export const unlockPDF = async (file: File, password: string): Promise<Uint8Array> => {
  const probe = await loadPdf(file, { ignoreEncryption: true });
  if (!probe.isEncrypted) {
    throw new Error('This PDF is not password-protected, so there is nothing to unlock.');
  }
  let pdf: PDFDocument;
  try {
    pdf = await loadPdf(file, { password });
  } catch (e) {
    const msg = (e as Error).message ?? '';
    if (/encrypted|password/i.test(msg)) {
      throw new Error(password ? 'Incorrect password. Please try again.' : 'This PDF needs a password to open.');
    }
    throw e;
  }
  // Copy into a fresh document so the output carries no encryption dictionary.
  const out = await PDFDocument.create();
  const pages = await out.copyPages(pdf, pdf.getPageIndices());
  pages.forEach((p) => out.addPage(p));
  const t = pdf.getTitle();
  if (t) out.setTitle(t);
  const a = pdf.getAuthor();
  if (a) out.setAuthor(a);
  return out.save();
};

/* ================================================================== */
/* 13. Text extraction                                                  */
/* ================================================================== */

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  hasEOL?: boolean;
}

const pageTextLines = async (page: PDFPageProxy): Promise<string[]> => {
  const content = await page.getTextContent();
  const lines: string[] = [];
  let line = '';
  let lastY: number | null = null;
  let lastEnd = 0;
  for (const raw of content.items) {
    if (!('str' in raw)) continue;
    const item = raw as unknown as TextItemLike;
    const y = item.transform[5];
    const x = item.transform[4];
    if (lastY !== null && Math.abs(y - lastY) > 3) {
      lines.push(line.replace(/\s+$/g, ''));
      line = '';
      lastEnd = 0;
    }
    if (line && x - lastEnd > 1.5 && !line.endsWith(' ') && !item.str.startsWith(' ')) line += ' ';
    line += item.str;
    lastY = y;
    lastEnd = x + item.width;
    if (item.hasEOL) {
      lines.push(line.replace(/\s+$/g, ''));
      line = '';
      lastY = null;
      lastEnd = 0;
    }
  }
  if (line) lines.push(line.replace(/\s+$/g, ''));
  return lines.filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''));
};

export const extractTextPDF = async (file: File, onProgress?: Progress): Promise<string> => {
  const doc = await openPdfjs(file);
  try {
    const out: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress?.(Math.round(((i - 1) / doc.numPages) * 100), `Reading page ${i} of ${doc.numPages}`);
      const page = await doc.getPage(i);
      const lines = await pageTextLines(page);
      out.push(`--- Page ${i} ---\n${lines.join('\n')}`);
      page.cleanup();
      await tick();
    }
    const text = out.join('\n\n').trim();
    const hasText = out.some((s) => s.split('\n').slice(1).join('').trim().length > 0);
    if (!hasText) {
      throw new Error('No selectable text found. This looks like a scanned PDF. Try the OCR tool instead.');
    }
    return text;
  } finally {
    void doc.loadingTask.destroy();
  }
};

/* ================================================================== */
/* 14. Extract embedded images                                          */
/* ================================================================== */

interface RawPdfImage {
  width: number;
  height: number;
  kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
  bitmap?: ImageBitmap;
}

const getPdfObj = (page: PDFPageProxy, name: string): Promise<RawPdfImage | null> =>
  new Promise((resolve) => {
    const store = name.startsWith('g_') ? page.commonObjs : page.objs;
    const timer = setTimeout(() => resolve(null), 4000);
    try {
      store.get(name, (obj: RawPdfImage) => {
        clearTimeout(timer);
        resolve(obj ?? null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });

const rawImageToCanvas = (img: RawPdfImage): HTMLCanvasElement | null => {
  if (!img || !img.width || !img.height) return null;
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d')!;

  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0);
    return canvas;
  }
  if (!img.data) return null;

  const { width, height, data } = img;
  const out = ctx.createImageData(width, height);
  const px = out.data;

  if (img.kind === 3 /* RGBA_32BPP */ || data.length === width * height * 4) {
    px.set(data.subarray(0, px.length));
  } else if (img.kind === 2 /* RGB_24BPP */ || data.length === width * height * 3) {
    for (let i = 0, j = 0; i < width * height; i++, j += 3) {
      px[i * 4] = data[j];
      px[i * 4 + 1] = data[j + 1];
      px[i * 4 + 2] = data[j + 2];
      px[i * 4 + 3] = 255;
    }
  } else if (img.kind === 1 /* GRAYSCALE_1BPP */) {
    const rowBytes = (width + 7) >> 3;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bit = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
        const v = bit ? 255 : 0;
        const o = (y * width + x) * 4;
        px[o] = px[o + 1] = px[o + 2] = v;
        px[o + 3] = 255;
      }
    }
  } else {
    return null;
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
};

export const extractImagesPDF = async (
  file: File,
  onProgress?: Progress
): Promise<{ blob: Blob; count: number }> => {
  const doc = await openPdfjs(file);
  const zip = new JSZip();
  let count = 0;
  try {
    const OPS = pdfjsLib.OPS;
    for (let p = 1; p <= doc.numPages; p++) {
      onProgress?.(Math.round(((p - 1) / doc.numPages) * 100), `Scanning page ${p} of ${doc.numPages}`);
      const page = await doc.getPage(p);
      const ops = await page.getOperatorList();
      const seen = new Set<string>();
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (fn !== OPS.paintImageXObject && fn !== OPS.paintInlineImageXObject) continue;
        const arg = ops.argsArray[i]?.[0];
        let img: RawPdfImage | null = null;
        if (typeof arg === 'string') {
          if (seen.has(arg)) continue;
          seen.add(arg);
          img = await getPdfObj(page, arg);
        } else if (arg && typeof arg === 'object') {
          img = arg as RawPdfImage;
        }
        if (!img || img.width < 16 || img.height < 16) continue;
        const canvas = rawImageToCanvas(img);
        if (!canvas) continue;
        const blob = await canvasToBlob(canvas, 'image/png');
        count++;
        zip.file(`page_${p}_image_${count}.png`, blob);
      }
      page.cleanup();
      await tick();
    }
  } finally {
    void doc.loadingTask.destroy();
  }
  if (count === 0) {
    throw new Error('No embedded images were found in this PDF. Use "PDF to JPG" to export whole pages instead.');
  }
  return { blob: await zip.generateAsync({ type: 'blob' }), count };
};

/* ================================================================== */
/* 15-16. Metadata & info                                               */
/* ================================================================== */

export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
}

export const getPDFMetadata = async (file: File): Promise<PdfMetadata> => {
  const pdf = await loadPdf(file, { ignoreEncryption: true });
  return {
    title: pdf.getTitle() || '',
    author: pdf.getAuthor() || '',
    subject: pdf.getSubject() || '',
    keywords: pdf.getKeywords() || '',
    creator: pdf.getCreator() || '',
    producer: pdf.getProducer() || ''
  };
};

export const updatePDFMetadata = async (file: File, m: Partial<PdfMetadata>): Promise<Uint8Array> => {
  const pdf = await loadPdf(file);
  if (m.title !== undefined) pdf.setTitle(m.title);
  if (m.author !== undefined) pdf.setAuthor(m.author);
  if (m.subject !== undefined) pdf.setSubject(m.subject);
  if (m.keywords !== undefined) {
    pdf.setKeywords(
      m.keywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }
  if (m.creator !== undefined) pdf.setCreator(m.creator);
  if (m.producer !== undefined) pdf.setProducer(m.producer);
  pdf.setModificationDate(new Date());
  return pdf.save();
};

const paperName = (wPt: number, hPt: number): string => {
  const [w, h] = wPt < hPt ? [wPt, hPt] : [hPt, wPt];
  const near = (a: number, b: number) => Math.abs(a - b) < 4;
  if (near(w, 595) && near(h, 842)) return 'A4';
  if (near(w, 612) && near(h, 792)) return 'US Letter';
  if (near(w, 612) && near(h, 1008)) return 'US Legal';
  if (near(w, 420) && near(h, 595)) return 'A5';
  if (near(w, 842) && near(h, 1191)) return 'A3';
  return 'Custom';
};

export interface PdfInfo {
  filename: string;
  fileSizeFormatted: string;
  fileSizeBytes: number;
  pageCount: number;
  paper: string;
  dimensionsPoints: string;
  dimensionsInches: string;
  dimensionsMm: string;
  title: string;
  author: string;
  creator: string;
  producer: string;
  created: string;
  modified: string;
  isEncrypted: string;
}

export const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;

export const getPDFInfo = async (file: File): Promise<PdfInfo> => {
  const pdf = await loadPdf(file, { ignoreEncryption: true });
  const pages = pdf.getPages();
  const first = pages[0];
  const { width, height } = first ? first.getSize() : { width: 0, height: 0 };
  const date = (d?: Date) => (d ? d.toLocaleString() : 'N/A');
  return {
    filename: file.name,
    fileSizeFormatted: formatBytes(file.size),
    fileSizeBytes: file.size,
    pageCount: pages.length,
    paper: paperName(width, height),
    dimensionsPoints: `${Math.round(width)} × ${Math.round(height)} pt`,
    dimensionsInches: `${(width / 72).toFixed(2)}" × ${(height / 72).toFixed(2)}"`,
    dimensionsMm: `${(width * 0.352778).toFixed(0)} × ${(height * 0.352778).toFixed(0)} mm`,
    title: pdf.getTitle() || 'N/A',
    author: pdf.getAuthor() || 'N/A',
    creator: pdf.getCreator() || 'N/A',
    producer: pdf.getProducer() || 'N/A',
    created: date(pdf.getCreationDate()),
    modified: date(pdf.getModificationDate()),
    isEncrypted: pdf.isEncrypted ? 'Yes' : 'No'
  };
};

export const pdfInfoToText = (info: PdfInfo): string =>
  [
    `File: ${info.filename}`,
    `Size: ${info.fileSizeFormatted}`,
    `Pages: ${info.pageCount}`,
    `Page size: ${info.paper} (${info.dimensionsMm}, ${info.dimensionsInches}, ${info.dimensionsPoints})`,
    `Title: ${info.title}`,
    `Author: ${info.author}`,
    `Creator: ${info.creator}`,
    `Producer: ${info.producer}`,
    `Created: ${info.created}`,
    `Modified: ${info.modified}`,
    `Encrypted: ${info.isEncrypted}`
  ].join('\n');

/* ================================================================== */
/* 17. OCR                                                              */
/* ================================================================== */

export const ocrPDF = async (file: File, language = 'eng', onProgress?: Progress): Promise<string> => {
  // Loaded on demand: tesseract is large and only needed for this tool.
  const { createWorker } = await import('tesseract.js');
  const doc = await openPdfjs(file);
  const total = doc.numPages;
  let current = 0;
  const worker = await createWorker(language, 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        onProgress?.(
          Math.round(((current + m.progress) / total) * 100),
          `Recognizing page ${current + 1} of ${total}`
        );
      } else if (m.status.includes('loading')) {
        onProgress?.(2, 'Loading OCR language data');
      }
    }
  });
  try {
    const parts: string[] = [];
    for (let i = 1; i <= total; i++) {
      current = i - 1;
      const page = await doc.getPage(i);
      const canvas = await renderPageToCanvas(page, 2.5);
      const res = await worker.recognize(canvas);
      parts.push(`--- Page ${i} ---\n${res.data.text.trim()}`);
      page.cleanup();
    }
    return parts.join('\n\n').trim();
  } finally {
    await worker.terminate();
    void doc.loadingTask.destroy();
  }
};

/* ================================================================== */
/* 18. Sign                                                             */
/* ================================================================== */

export interface SignOptions {
  /** 1-based page, or 'all' / 'last' */
  pages: number | 'all' | 'last';
  /** top-left of the signature, as % of the displayed page */
  xPct: number;
  yPct: number;
  /** signature width as % of the displayed page width */
  widthPct: number;
}

export const signPDF = async (file: File, signaturePng: Blob | string, opts: SignOptions): Promise<Uint8Array> => {
  const pdf = await loadPdf(file);
  const pages = pdf.getPages();
  const sigBytes =
    typeof signaturePng === 'string'
      ? new Uint8Array(await (await fetch(signaturePng)).arrayBuffer())
      : new Uint8Array(await signaturePng.arrayBuffer());
  const sig = await pdf.embedPng(sigBytes);

  const targets =
    opts.pages === 'all'
      ? pages.map((_, i) => i)
      : opts.pages === 'last'
        ? [pages.length - 1]
        : [Math.max(0, Math.min(opts.pages - 1, pages.length - 1))];

  for (const idx of targets) {
    const page = pages[idx];
    const frame = frameOf(page);
    const w = (opts.widthPct / 100) * frame.Wd;
    const h = (sig.height / sig.width) * w;
    const { a, b } = frame.fromTopLeftPct(opts.xPct, opts.yPct);
    // clamp so the signature never hangs off the page
    const left = Math.max(0, Math.min(a, frame.Wd - w));
    const bottom = Math.max(0, Math.min(b - h, frame.Hd - h));
    const p = frame.toPdf(left, bottom);
    page.drawImage(sig, { x: p.x, y: p.y, width: w, height: h, rotate: degrees(frame.rot) });
  }
  return pdf.save();
};

/** Renders a typed name as a transparent-background PNG signature. */
export const typedSignatureToPng = async (text: string, color = '#1e1b4b'): Promise<Blob> => {
  const font = `italic 600 64px "Segoe Script", "Brush Script MT", "Snell Roundhand", Georgia, serif`;
  const measure = createCanvas(10, 10).getContext('2d')!;
  measure.font = font;
  const w = Math.ceil(measure.measureText(text).width) + 40;
  const canvas = createCanvas(w, 120);
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 20, 62);
  return canvasToBlob(canvas, 'image/png');
};

/* ================================================================== */
/* 19. Edit                                                             */
/* ================================================================== */

export type Annotation =
  | { type: 'text'; page: number; xPct: number; yPct: number; text: string; size: number; color: string }
  | { type: 'whiteout' | 'highlight' | 'box'; page: number; xPct: number; yPct: number; wPct: number; hPct: number; color?: string }
  | { type: 'draw'; page: number; points: { xPct: number; yPct: number }[]; color: string; thickness: number };

export const editPDF = async (file: File, annotations: Annotation[]): Promise<Uint8Array> => {
  if (annotations.length === 0) throw new Error('Add at least one edit (text, drawing, whiteout or highlight) first.');
  const pdf = await loadPdf(file);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  for (const ann of annotations) {
    const page = pages[Math.max(0, Math.min(ann.page - 1, pages.length - 1))];
    const frame = frameOf(page);

    if (ann.type === 'text' && needsUnicodeRendering(ann.text)) {
      const t = await textImage(ann.text, ann.size, ann.color);
      const image = await pdf.embedPng(t.bytes);
      const { a, b } = frame.fromTopLeftPct(ann.xPct, ann.yPct);
      const p = frame.toPdf(a - t.pad, b + t.pad - t.h);
      page.drawImage(image, { x: p.x, y: p.y, width: t.w, height: t.h, rotate: degrees(frame.rot) });
    } else if (ann.type === 'text') {
      const lines = ann.text.split('\n');
      const { a, b } = frame.fromTopLeftPct(ann.xPct, ann.yPct);
      lines.forEach((line, i) => {
        if (!line) return;
        drawTextDisplayed(page, frame, font, line, ann.size, a, b - ann.size * 0.9 - i * ann.size * 1.2, {
          color: hexToRgb(ann.color)
        });
      });
    } else if (ann.type === 'draw') {
      for (let i = 1; i < ann.points.length; i++) {
        const p1 = frame.fromTopLeftPct(ann.points[i - 1].xPct, ann.points[i - 1].yPct);
        const p2 = frame.fromTopLeftPct(ann.points[i].xPct, ann.points[i].yPct);
        page.drawLine({
          start: frame.toPdf(p1.a, p1.b),
          end: frame.toPdf(p2.a, p2.b),
          thickness: ann.thickness,
          color: hexToRgb(ann.color),
          lineCap: 1
        });
      }
    } else {
      const left = (ann.xPct / 100) * frame.Wd;
      const w = (ann.wPct / 100) * frame.Wd;
      const h = (ann.hPct / 100) * frame.Hd;
      const bottom = frame.Hd - (ann.yPct / 100) * frame.Hd - h;
      const r = rectDisplayed(frame, left, bottom, w, h);
      if (ann.type === 'whiteout') {
        page.drawRectangle({ ...r, color: rgb(1, 1, 1) });
      } else if (ann.type === 'highlight') {
        page.drawRectangle({ ...r, color: hexToRgb(ann.color ?? '#ffe600'), opacity: 0.4 });
      } else {
        page.drawRectangle({ ...r, borderColor: hexToRgb(ann.color ?? '#dc2626'), borderWidth: 1.5 });
      }
    }
  }
  return pdf.save();
};

/* ================================================================== */
/* 20. Compare                                                          */
/* ================================================================== */

export interface CompareResult {
  pagesA: number;
  pagesB: number;
  ops: DiffOp[];
  added: number;
  removed: number;
  unchanged: number;
}

const collectLines = async (
  file: File,
  onProgress: Progress | undefined,
  from: number,
  to: number
): Promise<{ lines: string[]; pages: number }> => {
  const doc = await openPdfjs(file);
  try {
    const lines: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress?.(
        from + Math.round(((i - 1) / doc.numPages) * (to - from)),
        `Reading ${file.name} (page ${i}/${doc.numPages})`
      );
      const page = await doc.getPage(i);
      for (const l of await pageTextLines(page)) {
        const t = l.replace(/\s+/g, ' ').trim();
        if (t) lines.push(t);
      }
      page.cleanup();
      await tick();
    }
    return { lines, pages: doc.numPages };
  } finally {
    void doc.loadingTask.destroy();
  }
};

export const comparePDFs = async (a: File, b: File, onProgress?: Progress): Promise<CompareResult> => {
  const A = await collectLines(a, onProgress, 0, 45);
  const B = await collectLines(b, onProgress, 45, 90);
  onProgress?.(92, 'Comparing text');
  await tick();
  const ops = diffLines(A.lines, B.lines);
  return {
    pagesA: A.pages,
    pagesB: B.pages,
    ops,
    added: ops.filter((o) => o.type === 'add').length,
    removed: ops.filter((o) => o.type === 'del').length,
    unchanged: ops.filter((o) => o.type === 'same').length
  };
};

/* ================================================================== */
/* 24. Combine Pages (N-up: multiple pages per sheet)                   */
/* ================================================================== */

export type NUpPagesOption = 2 | 4 | 6 | 8 | 9 | 16 | 'custom';
export type NUpReadingOrder = 'left-to-right' | 'top-to-bottom';
export type NUpSheetSize = 'a4' | 'letter' | 'same-as-first';
export type NUpOrientation = 'auto' | 'portrait' | 'landscape';

export interface NUpConfig {
  pagesPerSheet: NUpPagesOption;
  customRows?: number;
  customCols?: number;
  layout2Up?: 'horizontal' | 'vertical';
  layout6Up?: '2x3' | '3x2';
  layout8Up?: '2x4' | '4x2';
  readingOrder?: NUpReadingOrder;
  sheetSize?: NUpSheetSize;
  orientation?: NUpOrientation;
  marginMm?: number;
  gapMm?: number;
  drawBorder?: boolean;
}

export const resolveNUpGrid = (config: NUpConfig): { rows: number; cols: number; nPerSheet: number } => {
  let rows = 2;
  let cols = 2;

  switch (config.pagesPerSheet) {
    case 2:
      if (config.layout2Up === 'vertical') {
        rows = 2;
        cols = 1;
      } else {
        rows = 1;
        cols = 2;
      }
      break;
    case 4:
      rows = 2;
      cols = 2;
      break;
    case 6:
      if (config.layout6Up === '3x2') {
        rows = 3;
        cols = 2;
      } else {
        rows = 2;
        cols = 3;
      }
      break;
    case 8:
      if (config.layout8Up === '4x2') {
        rows = 4;
        cols = 2;
      } else {
        rows = 2;
        cols = 4;
      }
      break;
    case 9:
      rows = 3;
      cols = 3;
      break;
    case 16:
      rows = 4;
      cols = 4;
      break;
    case 'custom':
      rows = Math.max(1, Math.min(10, config.customRows || 2));
      cols = Math.max(1, Math.min(10, config.customCols || 2));
      break;
    default:
      rows = 2;
      cols = 2;
  }

  return { rows, cols, nPerSheet: rows * cols };
};

export const drawEmbeddedPageInBox = (
  sheet: any,
  emb: any,
  origRot: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  drawBorder: boolean
) => {
  const rot = ((origRot % 360) + 360) % 360;
  const isSideways = rot === 90 || rot === 270;
  const visualW = isSideways ? emb.height : emb.width;
  const visualH = isSideways ? emb.width : emb.height;

  const scale = Math.min(boxW / visualW, boxH / visualH);
  const scaledW = visualW * scale;
  const scaledH = visualH * scale;

  const originX = boxX + (boxW - scaledW) / 2;
  const originY = boxY + (boxH - scaledH) / 2;

  const rawScaledW = emb.width * scale;
  const rawScaledH = emb.height * scale;

  if (rot === 0) {
    sheet.drawPage(emb, { x: originX, y: originY, width: rawScaledW, height: rawScaledH });
  } else if (rot === 90) {
    sheet.drawPage(emb, {
      x: originX,
      y: originY + scaledH,
      width: rawScaledW,
      height: rawScaledH,
      rotate: degrees(-90)
    });
  } else if (rot === 180) {
    sheet.drawPage(emb, {
      x: originX + scaledW,
      y: originY + scaledH,
      width: rawScaledW,
      height: rawScaledH,
      rotate: degrees(-180)
    });
  } else if (rot === 270) {
    sheet.drawPage(emb, {
      x: originX + scaledW,
      y: originY,
      width: rawScaledW,
      height: rawScaledH,
      rotate: degrees(-270)
    });
  }

  if (drawBorder) {
    sheet.drawRectangle({
      x: originX,
      y: originY,
      width: scaledW,
      height: scaledH,
      borderWidth: 0.5,
      borderColor: rgb(0.55, 0.55, 0.55)
    });
  }

  return { x: originX, y: originY, width: scaledW, height: scaledH };
};

export const resolveSheetDimensions = (
  sheetSize: NUpSheetSize = 'a4',
  orientation: NUpOrientation = 'auto',
  firstPageDim: { width: number; height: number },
  avgPageDim: { width: number; height: number },
  rows: number,
  cols: number,
  marginPt: number,
  gapPt: number
): { width: number; height: number } => {
  let baseW = 595.28;
  let baseH = 841.89;

  if (sheetSize === 'letter') {
    baseW = 612;
    baseH = 792;
  } else if (sheetSize === 'same-as-first') {
    baseW = firstPageDim.width || 595.28;
    baseH = firstPageDim.height || 841.89;
  }

  const minDim = Math.min(baseW, baseH);
  const maxDim = Math.max(baseW, baseH);

  if (orientation === 'portrait') {
    return { width: minDim, height: maxDim };
  }
  if (orientation === 'landscape') {
    return { width: maxDim, height: minDim };
  }

  // Auto best fit
  const calcScale = (w: number, h: number) => {
    const availW = w - 2 * marginPt - (cols - 1) * gapPt;
    const availH = h - 2 * marginPt - (rows - 1) * gapPt;
    if (availW <= 0 || availH <= 0) return 0;
    const cW = availW / cols;
    const cH = availH / rows;
    return Math.min(cW / (avgPageDim.width || 1), cH / (avgPageDim.height || 1));
  };

  const scalePortrait = calcScale(minDim, maxDim);
  const scaleLandscape = calcScale(maxDim, minDim);

  if (scaleLandscape > scalePortrait) {
    return { width: maxDim, height: minDim };
  }
  return { width: minDim, height: maxDim };
};

export const combinePagesNUp = async (
  file: File | Blob,
  config: NUpConfig,
  onProgress?: Progress
): Promise<{ pdfBytes: Uint8Array; totalSheets: number; totalPages: number; nPerSheet: number }> => {
  onProgress?.(5, 'Loading PDF document');
  const buffer = await file.arrayBuffer();

  let srcDoc: any;
  try {
    srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: false });
  } catch (err: any) {
    if (/encrypted|password/i.test(err?.message || '')) {
      throw new Error('This PDF is password-protected. Please unlock it with the Unlock PDF tool first.');
    }
    throw new Error('Unable to read this PDF document. The file may be corrupted.');
  }

  const totalPages = srcDoc.getPageCount();
  if (totalPages === 0) {
    throw new Error('This PDF has no pages.');
  }

  const { rows, cols, nPerSheet } = resolveNUpGrid(config);
  const totalSheets = Math.ceil(totalPages / nPerSheet);

  onProgress?.(15, 'Preparing pages for embedding');
  // Guard against blank pages with missing Contents stream
  for (const p of srcDoc.getPages()) {
    if (!p.node.Contents()) {
      const stream = srcDoc.context.stream('');
      const ref = srcDoc.context.register(stream);
      p.node.set(PDFName.of('Contents'), ref);
    }
  }

  const outDoc = await PDFDocument.create();
  const pageIndices = Array.from({ length: totalPages }, (_, i) => i);
  const embedded = await outDoc.embedPdf(srcDoc, pageIndices);

  const marginPt = (config.marginMm ?? 10) * 2.83465;
  const gapPt = (config.gapMm ?? 4) * 2.83465;

  const firstP = srcDoc.getPages()[0];
  const firstDim = { width: firstP.getWidth(), height: firstP.getHeight() };
  let sumW = 0, sumH = 0;
  for (const p of srcDoc.getPages()) {
    sumW += p.getWidth();
    sumH += p.getHeight();
  }
  const avgDim = { width: sumW / totalPages, height: sumH / totalPages };

  const { width: sheetW, height: sheetH } = resolveSheetDimensions(
    config.sheetSize,
    config.orientation,
    firstDim,
    avgDim,
    rows,
    cols,
    marginPt,
    gapPt
  );

  const availW = sheetW - 2 * marginPt - (cols - 1) * gapPt;
  const availH = sheetH - 2 * marginPt - (rows - 1) * gapPt;
  const cellW = availW / cols;
  const cellH = availH / rows;

  for (let s = 0; s < totalSheets; s++) {
    onProgress?.(
      20 + Math.round(((s + 1) / totalSheets) * 75),
      `Assembling sheet ${s + 1} of ${totalSheets}`
    );
    await tick();

    const sheet = outDoc.addPage([sheetW, sheetH]);

    for (let k = 0; k < nPerSheet; k++) {
      const pIdx = s * nPerSheet + k;
      if (pIdx >= totalPages) break;

      const emb = embedded[pIdx];
      const origRot = srcDoc.getPages()[pIdx].getRotation().angle;

      let r = Math.floor(k / cols);
      let c = k % cols;
      if (config.readingOrder === 'top-to-bottom') {
        c = Math.floor(k / rows);
        r = k % rows;
      }

      const cellLeftX = marginPt + c * (cellW + gapPt);
      const cellTopY = sheetH - marginPt - r * (cellH + gapPt);
      const cellBottomY = cellTopY - cellH;

      drawEmbeddedPageInBox(sheet, emb, origRot, cellLeftX, cellBottomY, cellW, cellH, !!config.drawBorder);
    }
  }

  onProgress?.(98, 'Saving N-up PDF');
  await tick();
  const pdfBytes = await outDoc.save();
  onProgress?.(100, 'Done');

  return { pdfBytes, totalSheets, totalPages, nPerSheet };
};

export const previewNUpFirstSheet = async (
  file: File | Blob,
  config: NUpConfig
): Promise<{ blob: Blob; totalPages: number; totalSheets: number; nPerSheet: number }> => {
  const buffer = await file.arrayBuffer();
  let srcDoc: any;
  try {
    srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: false });
  } catch (err: any) {
    if (/encrypted|password/i.test(err?.message || '')) {
      throw new Error('This PDF is password-protected.');
    }
    throw new Error('Unable to read PDF.');
  }

  const totalPages = srcDoc.getPageCount();
  const { rows, cols, nPerSheet } = resolveNUpGrid(config);
  const totalSheets = Math.ceil(totalPages / nPerSheet);

  const takePages = Math.min(totalPages, nPerSheet);
  const pageIndices = Array.from({ length: takePages }, (_, i) => i);

  for (const idx of pageIndices) {
    const p = srcDoc.getPages()[idx];
    if (!p.node.Contents()) {
      const s = srcDoc.context.stream('');
      const ref = srcDoc.context.register(s);
      p.node.set(PDFName.of('Contents'), ref);
    }
  }

  const outDoc = await PDFDocument.create();
  const embedded = await outDoc.embedPdf(srcDoc, pageIndices);

  const marginPt = (config.marginMm ?? 10) * 2.83465;
  const gapPt = (config.gapMm ?? 4) * 2.83465;

  const firstP = srcDoc.getPages()[0];
  const firstDim = { width: firstP.getWidth(), height: firstP.getHeight() };

  const { width: sheetW, height: sheetH } = resolveSheetDimensions(
    config.sheetSize,
    config.orientation,
    firstDim,
    firstDim,
    rows,
    cols,
    marginPt,
    gapPt
  );

  const sheet = outDoc.addPage([sheetW, sheetH]);
  const availW = sheetW - 2 * marginPt - (cols - 1) * gapPt;
  const availH = sheetH - 2 * marginPt - (rows - 1) * gapPt;
  const cellW = availW / cols;
  const cellH = availH / rows;

  for (let k = 0; k < takePages; k++) {
    const emb = embedded[k];
    const origRot = srcDoc.getPages()[k].getRotation().angle;

    let r = Math.floor(k / cols);
    let c = k % cols;
    if (config.readingOrder === 'top-to-bottom') {
      c = Math.floor(k / rows);
      r = k % rows;
    }

    const cellLeftX = marginPt + c * (cellW + gapPt);
    const cellTopY = sheetH - marginPt - r * (cellH + gapPt);
    const cellBottomY = cellTopY - cellH;

    drawEmbeddedPageInBox(sheet, emb, origRot, cellLeftX, cellBottomY, cellW, cellH, !!config.drawBorder);
  }

  const pdfBytes = await outDoc.save();
  return {
    blob: new Blob([pdfBytes as any], { type: 'application/pdf' }),
    totalPages,
    totalSheets,
    nPerSheet
  };
};
