import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { PDFDocument, rgb, StandardFonts } from '@cantoo/pdf-lib';
import { parsePPTX, sanitizePptxArchive } from './pptxViewer';

export interface OfficeConversionResult {
  pdfBytes: Uint8Array;
  detectedFormat: 'docx' | 'xlsx' | 'pptx' | 'html';
  pageCount: number;
  warnings?: string[];
}

/**
 * 1. Word (DOCX / DOC) to PDF
 * Converts DOCX semantic structures via mammoth.js to clean HTML,
 * then renders to a multi-page PDF preserving selectable text.
 */
export async function convertDocxToPdf(
  fileOrBuffer: File | Blob | ArrayBuffer
): Promise<Uint8Array> {
  const arrayBuffer =
    fileOrBuffer instanceof ArrayBuffer
      ? fileOrBuffer
      : await fileOrBuffer.arrayBuffer();

  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const container = document.createElement('div');
  container.style.width = '750px';
  container.style.padding = '40px';
  container.style.fontFamily = 'Helvetica, Arial, sans-serif';
  container.style.fontSize = '12pt';
  container.style.lineHeight = '1.6';
  container.style.color = '#1e293b';
  container.style.backgroundColor = '#ffffff';

  // Apply clean Word-like document styling
  container.innerHTML = `
    <style>
      h1 { font-size: 22pt; font-weight: bold; margin-bottom: 12pt; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4pt; }
      h2 { font-size: 16pt; font-weight: bold; margin-top: 14pt; margin-bottom: 8pt; color: #1e293b; }
      h3 { font-size: 13pt; font-weight: bold; margin-top: 10pt; margin-bottom: 6pt; color: #334155; }
      p { margin-bottom: 8pt; }
      ul, ol { margin-left: 20pt; margin-bottom: 8pt; }
      li { margin-bottom: 3pt; }
      table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
      th, td { border: 1px solid #94a3b8; padding: 6pt 8pt; font-size: 10pt; text-align: left; }
      th { background-color: #f1f5f9; font-weight: bold; }
      blockquote { border-left: 3px solid #6366f1; padding-left: 10pt; margin: 8pt 0; color: #475569; font-style: italic; }
      img { max-width: 100%; height: auto; margin: 8pt 0; }
    </style>
    ${html || '<p>(Empty Word document)</p>'}
  `;

  document.body.appendChild(container);

  try {
    const doc = new jsPDF({
      unit: 'pt',
      format: 'a4',
      orientation: 'portrait'
    });

    await doc.html(container, {
      x: 36,
      y: 36,
      width: 523, // 595.28 - 72pt margins
      windowWidth: 750,
      autoPaging: 'text'
    });

    const output = doc.output('arraybuffer');
    return new Uint8Array(output);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 2. Excel (XLSX / XLS / CSV) to PDF
 * Converts worksheets into cleanly bordered, zebra-striped PDF tables in landscape A4.
 */
export async function convertExcelToPdf(
  fileOrBuffer: File | Blob | ArrayBuffer
): Promise<Uint8Array> {
  const arrayBuffer =
    fileOrBuffer instanceof ArrayBuffer
      ? fileOrBuffer
      : await fileOrBuffer.arrayBuffer();

  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const container = document.createElement('div');
  container.style.width = '1000px';
  container.style.padding = '30px';
  container.style.fontFamily = 'Helvetica, Arial, sans-serif';
  container.style.color = '#0f172a';
  container.style.backgroundColor = '#ffffff';

  let fullHtml = `
    <style>
      .sheet-title { font-size: 16pt; font-weight: bold; color: #1e293b; margin: 16pt 0 8pt 0; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 24pt; font-size: 9pt; }
      th, td { border: 1px solid #cbd5e1; padding: 5pt 7pt; text-align: left; }
      tr:nth-child(even) { background-color: #f8fafc; }
      tr:first-child td { background-color: #e2e8f0; font-weight: bold; color: #0f172a; }
    </style>
  `;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const tableHtml = XLSX.utils.sheet_to_html(ws);
    fullHtml += `
      <div class="sheet-title">Sheet: ${sheetName}</div>
      ${tableHtml}
    `;
  }

  container.innerHTML = fullHtml;
  document.body.appendChild(container);

  try {
    const doc = new jsPDF({
      unit: 'pt',
      format: 'a4',
      orientation: 'landscape'
    });

    await doc.html(container, {
      x: 30,
      y: 30,
      width: 780, // 841.89 - 60pt margins
      windowWidth: 1000,
      autoPaging: 'text'
    });

    const output = doc.output('arraybuffer');
    return new Uint8Array(output);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 3. HTML to PDF
 * Renders raw HTML string or .html file into a paginated PDF with selectable text.
 */
export async function convertHtmlToPdf(
  htmlContent: string
): Promise<Uint8Array> {
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.padding = '30px';
  container.style.fontFamily = 'Helvetica, Arial, sans-serif';
  container.style.color = '#0f172a';
  container.style.backgroundColor = '#ffffff';
  container.innerHTML = htmlContent;

  document.body.appendChild(container);

  try {
    const doc = new jsPDF({
      unit: 'pt',
      format: 'a4',
      orientation: 'portrait'
    });

    await doc.html(container, {
      x: 36,
      y: 36,
      width: 523,
      windowWidth: 800,
      autoPaging: 'text'
    });

    const output = doc.output('arraybuffer');
    return new Uint8Array(output);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 4. PowerPoint (PPTX) to PDF
 * Converts PPTX slides into a landscape presentation slide deck PDF.
 */
export async function convertPptxToPdf(
  fileOrBuffer: File | Blob | ArrayBuffer
): Promise<Uint8Array> {
  const cleanBuffer = await sanitizePptxArchive(fileOrBuffer);
  const pres = await parsePPTX(cleanBuffer);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // 16:9 Landscape slide dimensions: 841.89 x 473.56 pt
  const slideW = 841.89;
  const slideH = 473.56;

  for (let i = 0; i < pres.slides.length; i++) {
    const slide = pres.slides[i];
    const page = doc.addPage([slideW, slideH]);

    // Gradient-like clean slide background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: slideW,
      height: slideH,
      color: rgb(0.97, 0.98, 1.0)
    });

    // Top Header Accent Line
    page.drawRectangle({
      x: 40,
      y: slideH - 35,
      width: slideW - 80,
      height: 3,
      color: rgb(0.39, 0.40, 0.95)
    });

    // Slide Title
    const titleText = (slide.title || `Slide ${slide.slideNumber}`).slice(0, 90);
    page.drawText(titleText, {
      x: 45,
      y: slideH - 68,
      size: 22,
      font: fontBold,
      color: rgb(0.06, 0.09, 0.16)
    });

    // Slide Body Paragraphs
    let curY = slideH - 110;
    const bodyParagraphs = slide.paragraphs.slice(1);

    if (bodyParagraphs.length === 0) {
      page.drawText('(No text content on this slide)', {
        x: 45,
        y: curY,
        size: 13,
        font,
        color: rgb(0.5, 0.55, 0.65)
      });
    } else {
      for (const p of bodyParagraphs.slice(0, 8)) {
        if (curY < 60) break;
        const line = p.length > 110 ? p.slice(0, 107) + '...' : p;
        page.drawText(`• ${line}`, {
          x: 55,
          y: curY,
          size: 14,
          font,
          color: rgb(0.15, 0.2, 0.3)
        });
        curY -= 28;
      }
    }

    // Slide Footer Badge
    page.drawText(`${slide.slideNumber} / ${pres.slides.length}`, {
      x: slideW - 90,
      y: 20,
      size: 10,
      font,
      color: rgb(0.5, 0.55, 0.65)
    });
  }

  return doc.save();
}

/**
 * Master Router: Automatically detects format and converts to PDF
 */
export async function convertOfficeFileToPdf(
  file: File
): Promise<OfficeConversionResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    const bytes = await convertDocxToPdf(file);
    return { pdfBytes: bytes, detectedFormat: 'docx', pageCount: 1 };
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv') || name.endsWith('.tsv')) {
    const bytes = await convertExcelToPdf(file);
    return { pdfBytes: bytes, detectedFormat: 'xlsx', pageCount: 1 };
  }

  if (name.endsWith('.pptx') || name.endsWith('.ppt')) {
    const bytes = await convertPptxToPdf(file);
    return { pdfBytes: bytes, detectedFormat: 'pptx', pageCount: 1 };
  }

  if (name.endsWith('.html') || name.endsWith('.htm')) {
    const text = await file.text();
    const bytes = await convertHtmlToPdf(text);
    return { pdfBytes: bytes, detectedFormat: 'html', pageCount: 1 };
  }

  throw new Error(`Unsupported format "${file.name}". Upload Word (.docx), Excel (.xlsx, .csv), PowerPoint (.pptx), or HTML.`);
}

