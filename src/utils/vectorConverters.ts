import JSZip from 'jszip';
import pptxgen from 'pptxgenjs';
import ImageTracer from 'imagetracerjs';
import { pdfjsLib } from './pdfjs';
import { PDFDocument } from '@cantoo/pdf-lib';

/**
 * Converts each page of a PDF document into a slide in a PowerPoint (.pptx) file.
 */
export async function convertPdfToPptx(
  pdfBytes: Uint8Array | ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes)
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const pptx = new pptxgen();

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages);
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for sharp slides

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const imgDataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Set slide dimensions matching page aspect ratio
    const slide = pptx.addSlide();
    slide.background = { data: imgDataUrl };
  }

  const pptxBlob = (await pptx.write({ outputType: 'blob' })) as Blob;
  return pptxBlob;
}

/**
 * Converts a PDF into a Comic Book Archive (.cbz) containing sequentially numbered JPEGs.
 */
export async function convertPdfToCbz(
  pdfBytes: Uint8Array | ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes)
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const zip = new JSZip();

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
    const imgBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
    );

    if (imgBlob) {
      const padIndex = String(pageNum).padStart(4, '0');
      zip.file(`page_${padIndex}.jpg`, imgBlob);
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Extracts a PDF page as a pure scalable SVG vector using client-side vector tracing.
 */
export async function extractPdfPageAsSvg(
  pdfBytes: Uint8Array | ArrayBuffer,
  pageNumber: number = 1
): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes)
  });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2.0 });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
  return await traceImageToSvg(canvas);
}

/**
 * Converts a raster image (canvas or image file) into a clean, scalable SVG vector
 * using client-side image tracing (inspired by Potrace in Filee).
 */
export async function traceImageToSvg(
  imageSource: HTMLImageElement | HTMLCanvasElement | ImageData | File | Blob
): Promise<string> {
  let imgData: ImageData;

  if (imageSource instanceof ImageData) {
    imgData = imageSource;
  } else if (imageSource instanceof HTMLCanvasElement) {
    const ctx = imageSource.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    imgData = ctx.getImageData(0, 0, imageSource.width, imageSource.height);
  } else {
    // Load image into canvas
    const img = new Image();
    const url =
      imageSource instanceof File || imageSource instanceof Blob
        ? URL.createObjectURL(imageSource)
        : imageSource.src;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    ctx.drawImage(img, 0, 0);
    imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (imageSource instanceof File || imageSource instanceof Blob) {
      URL.revokeObjectURL(url);
    }
  }

  // Use ImageTracer to vectorize the image data
  return new Promise((resolve) => {
    // Preset: posterized2 or detailed vector tracing
    const svgString = ImageTracer.imagedataToSVG(imgData, {
      colorsorting: true,
      scale: 1,
      roundcoords: 1,
      lcpr: 0,
      qcpr: 0,
      desc: false
    });
    resolve(svgString);
  });
}

/**
 * Converts an SVG string into a PDF document.
 */
export async function convertSvgToPdf(svgString: string): Promise<Uint8Array> {
  let width = 612;
  let height = 792;

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    width = parseFloat(svgEl?.getAttribute('width') || '612') || 612;
    height = parseFloat(svgEl?.getAttribute('height') || '792') || 792;
  } else {
    const wMatch = svgString.match(/width=["']?(\d+(\.\d+)?)["']?/);
    const hMatch = svgString.match(/height=["']?(\d+(\.\d+)?)["']?/);
    if (wMatch) width = parseFloat(wMatch[1]) || 612;
    if (hMatch) height = parseFloat(hMatch[1]) || 792;
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([width, height]);

  // Render SVG to image data on canvas in browser environment, then embed into PDF
  if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const img = new Image();
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL('image/png');
      const pngImageBytes = await fetch(pngUrl).then((r) => r.arrayBuffer());
      const pngImage = await pdfDoc.embedPng(pngImageBytes);

      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: width,
        height: height
      });
    }
  }

  return await pdfDoc.save();
}
