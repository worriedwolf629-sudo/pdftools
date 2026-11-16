import {
  Document, Paragraph, TextRun, HeadingLevel, Packer, Table, TableRow, TableCell, WidthType
} from 'docx';
import * as XLSX from 'xlsx';
import { openPdfjs, type Progress } from './pdfEngine';

export interface PdfToDocxResult {
  blob: Blob;
  charCount: number;
  pageCount: number;
  isScanned: boolean;
}

export interface PdfToExcelResult {
  blob: Blob;
  sheetCount: number;
  rowCount: number;
  isScanned: boolean;
}

/**
 * PDF to Word (.docx)
 * Parses PDF text streams, analyzes font typography, and builds an editable OpenXML (.docx)
 * document using headings, paragraphs, bullet lists, and tables.
 */
export async function convertPdfToDocx(
  file: File | Blob,
  onProgress?: Progress
): Promise<PdfToDocxResult> {
  const doc = await openPdfjs(file);
  const totalPages = doc.numPages;
  const docxChildren: any[] = [];
  let totalChars = 0;

  try {
    for (let p = 1; p <= totalPages; p++) {
      onProgress?.(Math.round((p / totalPages) * 100), `Parsing page ${p} of ${totalPages}`);
      const page = await doc.getPage(p);
      const textContent = await page.getTextContent();
      const items = (textContent.items as any[]).filter((it) => it.str && it.str.trim());

      if (items.length === 0) {
        docxChildren.push(
          new Paragraph({
            children: [new TextRun({ text: `[Page ${p} - Scanned image / No digital text stream]`, italics: true, color: '888888' })]
          })
        );
        continue;
      }

      const fontSizes = items.map((it) => Math.abs(it.transform[0] || it.transform[3] || 10));
      fontSizes.sort((a, b) => a - b);
      const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)] || 11;

      interface TextLine {
        y: number;
        fontSize: number;
        items: Array<{ x: number; str: string; width: number }>;
      }
      const lines: TextLine[] = [];

      for (const item of items) {
        totalChars += item.str.length;
        const x = item.transform[4];
        const y = item.transform[5];
        const size = Math.abs(item.transform[0] || item.transform[3] || medianFontSize);

        let matchLine = lines.find((l) => Math.abs(l.y - y) <= 3.5);
        if (!matchLine) {
          matchLine = { y, fontSize: size, items: [] };
          lines.push(matchLine);
        }
        matchLine.items.push({ x, str: item.str, width: item.width || 0 });
      }

      lines.sort((a, b) => b.y - a.y);

      let tableRows: string[][] = [];

      const flushTable = () => {
        if (tableRows.length > 0) {
          const maxCols = Math.max(...tableRows.map((r) => r.length));
          if (maxCols >= 2) {
            const docxRows = tableRows.map((row) => {
              const cells = row.concat(Array(Math.max(0, maxCols - row.length)).fill('')).map(
                (cellText) =>
                  new TableCell({
                    children: [new Paragraph({ text: cellText || ' ' })],
                    width: { size: Math.floor(100 / maxCols), type: WidthType.PERCENTAGE }
                  })
              );
              return new TableRow({ children: cells });
            });

            docxChildren.push(
              new Table({
                rows: docxRows,
                width: { size: 100, type: WidthType.PERCENTAGE }
              })
            );
            docxChildren.push(new Paragraph({ text: '' }));
          } else {
            tableRows.forEach((r) => docxChildren.push(new Paragraph({ text: r.join(' ') })));
          }
          tableRows = [];
        }
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        line.items.sort((a, b) => a.x - b.x);

        const isMultiCol = line.items.length >= 2 && line.items.some((it, idx) => idx > 0 && it.x - (line.items[idx - 1].x + line.items[idx - 1].width) > 35);

        if (isMultiCol) {
          tableRows.push(line.items.map((it) => it.str.trim()));
          continue;
        } else if (tableRows.length > 0) {
          flushTable();
        }

        const lineText = line.items.map((it) => it.str).join(' ').trim();
        if (!lineText) continue;

        const sizeRatio = line.fontSize / medianFontSize;

        if (sizeRatio >= 1.7 && lineText.length < 80) {
          docxChildren.push(
            new Paragraph({
              text: lineText,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 }
            })
          );
        } else if (sizeRatio >= 1.35 && lineText.length < 100) {
          docxChildren.push(
            new Paragraph({
              text: lineText,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 }
            })
          );
        } else if (sizeRatio >= 1.15 && lineText.length < 120) {
          docxChildren.push(
            new Paragraph({
              text: lineText,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 120, after: 60 }
            })
          );
        } else if (/^[\u2022\u2023\u25E6\u2043\u2219\*\-\+]\s+/.test(lineText)) {
          docxChildren.push(
            new Paragraph({
              text: lineText.replace(/^[\u2022\u2023\u25E6\u2043\u2219\*\-\+]\s+/, ''),
              bullet: { level: 0 },
              spacing: { after: 60 }
            })
          );
        } else {
          docxChildren.push(
            new Paragraph({
              children: [new TextRun({ text: lineText })],
              spacing: { after: 100 }
            })
          );
        }
      }

      if (tableRows.length > 0) flushTable();

      // Add page break separator if multiple pages
      if (p < totalPages) {
        docxChildren.push(new Paragraph({ children: [new TextRun({ text: `--- Page Break (Page ${p}) ---`, color: 'aaaaaa', italics: true })] }));
      }
    }
  } finally {
    void doc.loadingTask.destroy();
  }

  const wordDoc = new Document({
    sections: [
      {
        properties: {},
        children: docxChildren.length > 0 ? docxChildren : [new Paragraph({ text: '(Empty document)' })]
      }
    ]
  });

  const docxBlob = await Packer.toBlob(wordDoc);
  const isScanned = totalChars < 50 && totalPages > 0;

  return {
    blob: docxBlob,
    charCount: totalChars,
    pageCount: totalPages,
    isScanned
  };
}

/**
 * PDF to Excel (.xlsx)
 * Analyzes text item coordinates (x, y) to detect tabular columns and rows,
 * and builds a structured Excel workbook with one sheet per page.
 */
export async function convertPdfToExcel(
  file: File | Blob,
  onProgress?: Progress
): Promise<PdfToExcelResult> {
  const doc = await openPdfjs(file);
  const totalPages = doc.numPages;
  const wb = XLSX.utils.book_new();
  let totalRows = 0;
  let totalChars = 0;

  try {
    for (let p = 1; p <= totalPages; p++) {
      onProgress?.(Math.round((p / totalPages) * 100), `Extracting tables from page ${p} of ${totalPages}`);
      const page = await doc.getPage(p);
      const textContent = await page.getTextContent();
      const items = (textContent.items as any[]).filter((it) => it.str && it.str.trim());

      interface TextItemCoord {
        x: number;
        y: number;
        str: string;
      }
      const rawItems: TextItemCoord[] = [];

      for (const it of items) {
        totalChars += it.str.length;
        rawItems.push({
          x: it.transform[4],
          y: it.transform[5],
          str: it.str.trim()
        });
      }

      // Group into rows by y coordinate
      const rowsMap = new Map<number, TextItemCoord[]>();
      for (const item of rawItems) {
        let matchedY: number | null = null;
        for (const existingY of rowsMap.keys()) {
          if (Math.abs(existingY - item.y) <= 4) {
            matchedY = existingY;
            break;
          }
        }
        if (matchedY !== null) {
          rowsMap.get(matchedY)!.push(item);
        } else {
          rowsMap.set(item.y, [item]);
        }
      }

      // Sort rows top-to-bottom (descending y)
      const sortedYs = Array.from(rowsMap.keys()).sort((a, b) => b - a);
      const sheetData: string[][] = [];

      for (const y of sortedYs) {
        const rowItems = rowsMap.get(y)!;
        rowItems.sort((a, b) => a.x - b.x);

        // Map into columns
        const rowCells: string[] = [];
        for (const it of rowItems) {
          rowCells.push(it.str);
        }
        if (rowCells.length > 0) {
          sheetData.push(rowCells);
          totalRows++;
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetData.length > 0 ? sheetData : [['(No table data found on this page)']]);
      XLSX.utils.book_append_sheet(wb, ws, `Page ${p}`);
    }
  } finally {
    void doc.loadingTask.destroy();
  }

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const excelBlob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const isScanned = totalChars < 50 && totalPages > 0;

  return {
    blob: excelBlob,
    sheetCount: totalPages,
    rowCount: totalRows,
    isScanned
  };
}
