import { PDFDocument } from '@cantoo/pdf-lib';
import { pdfjsLib } from './pdfjs';

/**
 * Document Visual Filters & Pre-Processing
 * Inspired by Filee's offline image and document pre-processing engine.
 * 100% Client-side canvas pixel processing.
 */

export type DocumentFilterType = 'none' | 'scan-enhance' | 'invert' | 'dither';

/**
 * Scan Enhancer: Whitens gray backgrounds/shadows (typical of camera photos & phone scans)
 * and boosts contrast of text for maximum legibility.
 */
export function applyScanEnhancer(
  imageData: ImageData,
  options: { threshold?: number; contrastMultiplier?: number } = {}
): ImageData {
  const { threshold = 180, contrastMultiplier = 1.35 } = options;
  const data = imageData.data;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Standard relative luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum > threshold) {
      // Fade light gray and shadowed paper background to pure white
      const boost = Math.min(255, lum + (255 - lum) * 0.7);
      data[i] = boost;
      data[i + 1] = boost;
      data[i + 2] = boost;
    } else {
      // Darken ink, signatures, and printed text
      const darkened = Math.max(0, lum * 0.75);
      const contrasted = Math.max(0, Math.min(255, (darkened - 128) * contrastMultiplier + 128));
      data[i] = contrasted;
      data[i + 1] = contrasted;
      data[i + 2] = contrasted;
    }
  }

  return imageData;
}

/**
 * Invert / Dark Mode: Inverts color channels for comfortable reading at night.
 */
export function applyInvertFilter(imageData: ImageData): ImageData {
  const data = imageData.data;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    data[i] = 255 - data[i];         // R
    data[i + 1] = 255 - data[i + 1]; // G
    data[i + 2] = 255 - data[i + 2]; // B
    // Keep Alpha intact
  }

  return imageData;
}

/**
 * Black & White 1-Bit Dither: Floyd-Steinberg error diffusion algorithm.
 * Eliminates gray levels, yielding ultra-crisp monochrome output ideal for legal archives.
 */
export function apply1BitDither(imageData: ImageData): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // Convert to 2D grayscale float array for error diffusion
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      gray[y * width + x] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const curIdx = y * width + x;
      const oldVal = gray[curIdx];
      const newVal = oldVal < 128 ? 0 : 255;
      gray[curIdx] = newVal;
      const quantError = oldVal - newVal;

      // Distribute error to neighboring pixels (Floyd-Steinberg coefficients)
      if (x + 1 < width) {
        gray[curIdx + 1] += (quantError * 7) / 16;
      }
      if (y + 1 < height) {
        if (x - 1 >= 0) {
          gray[(y + 1) * width + (x - 1)] += (quantError * 3) / 16;
        }
        gray[(y + 1) * width + x] += (quantError * 5) / 16;
        if (x + 1 < width) {
          gray[(y + 1) * width + (x + 1)] += (quantError * 1) / 16;
        }
      }
    }
  }

  // Write back to imageData
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const val = gray[y * width + x];
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
    }
  }

  return imageData;
}

/**
 * Apply the specified filter to an existing canvas.
 */
export function applyFilterToCanvas(
  sourceCanvas: HTMLCanvasElement,
  filterType: DocumentFilterType
): HTMLCanvasElement {
  if (filterType === 'none') return sourceCanvas;

  const destCanvas = document.createElement('canvas');
  destCanvas.width = sourceCanvas.width;
  destCanvas.height = sourceCanvas.height;

  const ctx = destCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, destCanvas.width, destCanvas.height);

  switch (filterType) {
    case 'scan-enhance':
      applyScanEnhancer(imgData);
      break;
    case 'invert':
      applyInvertFilter(imgData);
      break;
    case 'dither':
      apply1BitDither(imgData);
      break;
  }

  ctx.putImageData(imgData, 0, 0);
  return destCanvas;
}

/**
 * Export a PDF document with the specified visual filter applied to all pages.
 */
export async function exportPdfWithFilter(
  pdfBytes: Uint8Array | ArrayBuffer,
  filterType: DocumentFilterType,
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  if (filterType === 'none') {
    return pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  }

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes)
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const newDoc = await PDFDocument.create();

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages);
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (filterType === 'scan-enhance') {
      applyScanEnhancer(imgData);
    } else if (filterType === 'invert') {
      applyInvertFilter(imgData);
    } else if (filterType === 'dither') {
      apply1BitDither(imgData);
    }
    ctx.putImageData(imgData, 0, 0);

    const isPng = filterType === 'dither';
    const imgDataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.9);
    const imgBytes = await fetch(imgDataUrl).then((r) => r.arrayBuffer());

    const embeddedImage = isPng
      ? await newDoc.embedPng(imgBytes)
      : await newDoc.embedJpg(imgBytes);

    const pdfPage = newDoc.addPage([viewport.width / 2.0, viewport.height / 2.0]);
    pdfPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: viewport.width / 2.0,
      height: viewport.height / 2.0
    });
  }

  return await newDoc.save();
}
