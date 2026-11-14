import { describe, it, expect } from 'vitest';
import {
  applyScanEnhancer,
  applyInvertFilter,
  apply1BitDither
} from '../src/utils/visualFilters';
import {
  parseStructuredData,
  convertToCsv,
  convertToYaml,
  convertToJson,
  convertToXml,
  convertDataToPdfReport
} from '../src/utils/dataConverters';
import { convertSvgToPdf } from '../src/utils/vectorConverters';
import { convertEpubToPdf } from '../src/utils/epubConverter';
import JSZip from 'jszip';

function mockImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  return {
    data,
    width,
    height,
    colorSpace: 'srgb'
  } as ImageData;
}

describe('Feature 6: Document Visual Filters & Pre-Processing', () => {
  it('applyInvertFilter inverts RGB channels while keeping alpha intact', () => {
    // 2x1 test image: [R, G, B, A]
    const data = new Uint8ClampedArray([
      255, 0, 100, 255,
      10, 20, 30, 128
    ]);
    const imgData = mockImageData(data, 2, 1);
    applyInvertFilter(imgData);

    // First pixel: 255-255=0, 255-0=255, 255-100=155, alpha stays 255
    expect(imgData.data[0]).toBe(0);
    expect(imgData.data[1]).toBe(255);
    expect(imgData.data[2]).toBe(155);
    expect(imgData.data[3]).toBe(255);

    // Second pixel: 255-10=245, 255-20=235, 255-30=225, alpha stays 128
    expect(imgData.data[4]).toBe(245);
    expect(imgData.data[5]).toBe(235);
    expect(imgData.data[6]).toBe(225);
    expect(imgData.data[7]).toBe(128);
  });

  it('applyScanEnhancer boosts text contrast and whitens light background', () => {
    // Light gray pixel (lum > 180) and dark text pixel (lum < 180)
    const data = new Uint8ClampedArray([
      200, 200, 200, 255, // Light paper gray
      50, 50, 50, 255     // Dark text ink
    ]);
    const imgData = mockImageData(data, 2, 1);
    applyScanEnhancer(imgData, { threshold: 180 });

    // Light gray pixel is boosted toward 255
    expect(imgData.data[0]).toBeGreaterThan(200);
    expect(imgData.data[1]).toBeGreaterThan(200);
    expect(imgData.data[2]).toBeGreaterThan(200);

    // Dark text pixel is darkened for enhanced contrast
    expect(imgData.data[4]).toBeLessThanOrEqual(50);
  });

  it('apply1BitDither produces binary 0 or 255 pixels via error diffusion', () => {
    const data = new Uint8ClampedArray([
      240, 240, 240, 255,
      30, 30, 30, 255
    ]);
    const imgData = mockImageData(data, 2, 1);
    apply1BitDither(imgData);

    // Floyd-Steinberg outputs either 0 or 255 for all channels
    for (let i = 0; i < imgData.data.length; i += 4) {
      expect([0, 255]).toContain(imgData.data[i]);
      expect([0, 255]).toContain(imgData.data[i + 1]);
      expect([0, 255]).toContain(imgData.data[i + 2]);
    }
  });
});

describe('Feature 3: Extended Format Converters', () => {
  it('parses JSON, CSV and YAML structured data correctly', () => {
    const jsonStr = JSON.stringify([{ id: 1, name: 'Triage' }, { id: 2, name: 'Constellation' }]);
    const parsedJson = parseStructuredData(jsonStr, 'json');
    expect(parsedJson).toHaveLength(2);
    expect(parsedJson[0].name).toBe('Triage');

    const csvStr = 'id,name\n1,Triage\n2,Constellation';
    const parsedCsv = parseStructuredData(csvStr, 'csv');
    expect(parsedCsv).toHaveLength(2);
    expect(parsedCsv[1].name).toBe('Constellation');

    const yamlStr = '- id: 1\n  name: Triage\n- id: 2\n  name: Constellation\n';
    const parsedYaml = parseStructuredData(yamlStr, 'yaml');
    expect(parsedYaml).toHaveLength(2);
    expect(parsedYaml[0].name).toBe('Triage');
  });

  it('converts structured data between CSV, YAML, JSON, and XML', () => {
    const data = [{ item: 'Widget', qty: 10, price: 5.99 }];

    const csv = convertToCsv(data);
    expect(csv).toContain('Widget');
    expect(csv).toContain('qty');

    const yamlOut = convertToYaml(data);
    expect(yamlOut).toContain('item: Widget');
    expect(yamlOut).toContain('qty: 10');

    const jsonOut = convertToJson(data);
    expect(JSON.parse(jsonOut)).toEqual(data);

    const xmlOut = convertToXml(data);
    expect(xmlOut).toContain('<item>Widget</item>');
    expect(xmlOut).toContain('<qty>10</qty>');
  });

  it('generates a PDF table report from structured data', async () => {
    const data = [
      { id: 101, name: 'Dr. Jane Smith', department: 'Emergency', status: 'Active' },
      { id: 102, name: 'Dr. John Doe', department: 'Cardiology', status: 'On Call' }
    ];
    const pdfBytes = await convertDataToPdfReport(data, 'Hospital Staff Report');
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(500);

    // Verify PDF header magic bytes %PDF-
    const header = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('converts SVG string into a valid vector PDF document', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#4f46e5" />
        <circle cx="100" cy="100" r="50" fill="#ffffff" />
      </svg>
    `;
    const pdfBytes = await convertSvgToPdf(svg);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(300);

    const header = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('converts an EPUB book archive into a formatted PDF', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file(
      'META-INF/container.xml',
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
    );
    zip.file(
      'OEBPS/content.opf',
      `<?xml version="1.0" encoding="utf-8"?>
      <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Medical Triage Protocols</dc:title>
          <dc:creator>Dr. Smith</dc:creator>
        </metadata>
        <manifest>
          <item id="c1" href="chap1.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="c1"/>
        </spine>
      </package>`
    );
    zip.file(
      'OEBPS/chap1.xhtml',
      '<!DOCTYPE html><html><head><title>Chapter 1</title></head><body><h1>Chapter 1: Assessment</h1><p>Patient vitals monitoring.</p></body></html>'
    );

    const epubBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const pdfBytes = await convertEpubToPdf(epubBuffer);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    const header = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });
});

describe('Feature: Target File Size (KB / MB) Compression & Enlargement', () => {
  it('parses KB/MB and formats byte sizes correctly', async () => {
    const { parseSizeToBytes, formatBytes } = await import('../src/utils/fileSizeTarget');
    expect(parseSizeToBytes(100, 'KB')).toBe(102400);
    expect(parseSizeToBytes(2, 'MB')).toBe(2097152);
    expect(formatBytes(102400)).toBe('100.0 KB');
    expect(formatBytes(2097152)).toBe('2.00 MB');
  });

  it('padPdfToTargetSize enlarges PDF to exact requested target KB/MB', async () => {
    const { padPdfToTargetSize } = await import('../src/utils/fileSizeTarget');
    const { PDFDocument } = await import('@cantoo/pdf-lib');

    const doc = await PDFDocument.create();
    doc.addPage([500, 500]);
    const baseBytes = await doc.save();
    expect(baseBytes.byteLength).toBeLessThan(1000);

    // Target 1: 50 KB
    const target50KB = 50 * 1024;
    const res50 = await padPdfToTargetSize(baseBytes, target50KB);
    expect(res50.byteLength).toBeGreaterThanOrEqual(target50KB);
    expect(res50.byteLength).toBeLessThanOrEqual(target50KB + 20); // within 20 bytes

    // Target 2: 200 KB
    const target200KB = 200 * 1024;
    const res200 = await padPdfToTargetSize(baseBytes, target200KB);
    expect(res200.byteLength).toBeGreaterThanOrEqual(target200KB);
    expect(res200.byteLength).toBeLessThanOrEqual(target200KB + 20);

    // Reload verification: document must be 100% valid
    const reloaded = await PDFDocument.load(res200);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('padJpegToTargetSize pads JPEG with valid COM markers to exact target bytes', async () => {
    const { padJpegToTargetSize } = await import('../src/utils/fileSizeTarget');
    const dummyJpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
    ]);
    const targetBytes = 100 * 1024; // 100 KB
    const padded = padJpegToTargetSize(dummyJpeg, targetBytes);
    expect(padded.byteLength).toBe(targetBytes);
    expect(padded[0]).toBe(0xff);
    expect(padded[1]).toBe(0xd8); // Starts with SOI
    expect(padded[2]).toBe(0xff);
    expect(padded[3]).toBe(0xfe); // COM marker
  });

  it('padPngToTargetSize pads PNG with valid tEXt chunks to exact target bytes', async () => {
    const { padPngToTargetSize } = await import('../src/utils/fileSizeTarget');
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const dummyPng = new Uint8Array(Buffer.from(base64Png, 'base64'));
    const targetBytes = 50 * 1024; // 50 KB
    const padded = padPngToTargetSize(dummyPng, targetBytes);
    expect(padded.byteLength).toBe(targetBytes);
    // Check PNG signature
    expect(padded[0]).toBe(0x89);
    expect(padded[1]).toBe(0x50);
    expect(padded[2]).toBe(0x4e);
    expect(padded[3]).toBe(0x47);
  });

  it('resizePDF handles mode: file-size to enlarge and target size', async () => {
    const { resizePDF } = await import('../src/utils/pdfEngine');
    const { PDFDocument } = await import('@cantoo/pdf-lib');

    const doc = await PDFDocument.create();
    doc.addPage([400, 400]);
    const baseBytes = await doc.save();
    const file = new File([baseBytes], 'test.pdf', { type: 'application/pdf' });

    const targetBytes = 80 * 1024; // 80 KB
    const enlarged = await resizePDF(file, {
      mode: 'file-size',
      targetBytes
    });
    expect(enlarged.byteLength).toBeGreaterThanOrEqual(targetBytes);
    expect(enlarged.byteLength).toBeLessThanOrEqual(targetBytes + 30);
  });

  describe('Feature: Combine Pages (N-up)', () => {
    it('combines a 10-page PDF into 2-up horizontal (5 sheets)', async () => {
      const { combinePagesNUp } = await import('../src/utils/pdfEngine');
      const { PDFDocument } = await import('@cantoo/pdf-lib');

      const doc = await PDFDocument.create();
      for (let i = 0; i < 10; i++) {
        doc.addPage([300, 400]);
      }
      const file = new File([await doc.save()], 'ten-pages.pdf', { type: 'application/pdf' });

      const result = await combinePagesNUp(file, {
        pagesPerSheet: 2,
        layout2Up: 'horizontal',
        sheetSize: 'a4',
        orientation: 'landscape',
        marginMm: 5,
        gapMm: 2,
        drawBorder: true
      });

      expect(result.totalPages).toBe(10);
      expect(result.totalSheets).toBe(5);
      expect(result.nPerSheet).toBe(2);

      const outDoc = await PDFDocument.load(result.pdfBytes);
      expect(outDoc.getPageCount()).toBe(5);
    });

    it('combines a 10-page PDF into 2-up vertical (5 sheets)', async () => {
      const { combinePagesNUp } = await import('../src/utils/pdfEngine');
      const { PDFDocument } = await import('@cantoo/pdf-lib');

      const doc = await PDFDocument.create();
      for (let i = 0; i < 10; i++) {
        doc.addPage([300, 400]);
      }
      const file = new File([await doc.save()], 'ten-pages.pdf', { type: 'application/pdf' });

      const result = await combinePagesNUp(file, {
        pagesPerSheet: 2,
        layout2Up: 'vertical',
        sheetSize: 'a4',
        orientation: 'portrait'
      });

      expect(result.totalSheets).toBe(5);
      const outDoc = await PDFDocument.load(result.pdfBytes);
      expect(outDoc.getPageCount()).toBe(5);
    });

    it('combines a 10-page PDF into 4-up grid (3 sheets: 4+4+2)', async () => {
      const { combinePagesNUp } = await import('../src/utils/pdfEngine');
      const { PDFDocument } = await import('@cantoo/pdf-lib');

      const doc = await PDFDocument.create();
      for (let i = 0; i < 10; i++) {
        doc.addPage([300, 400]);
      }
      const file = new File([await doc.save()], 'ten-pages.pdf', { type: 'application/pdf' });

      const result = await combinePagesNUp(file, {
        pagesPerSheet: 4,
        sheetSize: 'a4'
      });

      expect(result.totalPages).toBe(10);
      expect(result.totalSheets).toBe(3);
      expect(result.nPerSheet).toBe(4);

      const outDoc = await PDFDocument.load(result.pdfBytes);
      expect(outDoc.getPageCount()).toBe(3);
    });

    it('combines a 10-page PDF into 9-up grid (2 sheets: 9+1) and generates preview', async () => {
      const { combinePagesNUp, previewNUpFirstSheet } = await import('../src/utils/pdfEngine');
      const { PDFDocument } = await import('@cantoo/pdf-lib');

      const doc = await PDFDocument.create();
      for (let i = 0; i < 10; i++) {
        doc.addPage([300, 400]);
      }
      const file = new File([await doc.save()], 'ten-pages.pdf', { type: 'application/pdf' });

      const result = await combinePagesNUp(file, {
        pagesPerSheet: 9,
        sheetSize: 'letter',
        drawBorder: true
      });

      expect(result.totalPages).toBe(10);
      expect(result.totalSheets).toBe(2);
      expect(result.nPerSheet).toBe(9);

      const outDoc = await PDFDocument.load(result.pdfBytes);
      expect(outDoc.getPageCount()).toBe(2);

      // Also test preview generation for sheet 1
      const prev = await previewNUpFirstSheet(file, {
        pagesPerSheet: 9,
        sheetSize: 'letter'
      });
      expect(prev.totalPages).toBe(10);
      expect(prev.totalSheets).toBe(2);
      expect(prev.nPerSheet).toBe(9);
      expect(prev.blob.size).toBeGreaterThan(0);
    });
  });
});
