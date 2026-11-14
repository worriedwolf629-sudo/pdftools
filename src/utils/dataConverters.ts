import * as yaml from 'js-yaml';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export interface DataConversionResult {
  content: string;
  mimeType: string;
  defaultExtension: string;
}

/**
 * Parses JSON, YAML, CSV, or XML string into standard JavaScript object/array.
 */
export function parseStructuredData(text: string, formatHint?: string): any {
  const trimmed = text.trim();

  // Try JSON
  if (formatHint === 'json' || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fallback
    }
  }

  // Try YAML
  if (formatHint === 'yaml' || formatHint === 'yml') {
    try {
      return yaml.load(trimmed);
    } catch {
      // fallback
    }
  }

  // Try CSV
  if (formatHint === 'csv' || formatHint === 'tsv') {
    const wb = XLSX.read(trimmed, { type: 'string' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet);
  }

  // Try YAML fallback for generic text
  try {
    return yaml.load(trimmed);
  } catch {
    throw new Error('Unable to parse input data. Ensure it is valid JSON, YAML, or CSV.');
  }
}

/**
 * Converts structured data to CSV format.
 */
export function convertToCsv(data: any): string {
  const arr = Array.isArray(data) ? data : [data];
  const ws = XLSX.utils.json_to_sheet(arr);
  return XLSX.utils.sheet_to_csv(ws);
}

/**
 * Converts structured data to YAML format.
 */
export function convertToYaml(data: any): string {
  return yaml.dump(data, { indent: 2, lineWidth: -1 });
}

/**
 * Converts structured data to formatted JSON string.
 */
export function convertToJson(data: any): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Simple XML serialization from object/array.
 */
export function convertToXml(data: any, rootTag = 'root'): string {
  const toXml = (obj: any, tag: string): string => {
    if (obj === null || obj === undefined) return `<${tag}/>`;
    if (typeof obj !== 'object') {
      const sanitized = String(obj)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<${tag}>${sanitized}</${tag}>`;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => toXml(item, 'item')).join('\n');
    }
    const inner = Object.keys(obj)
      .map((key) => {
        const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
        return toXml(obj[key], cleanKey);
      })
      .join('\n');
    return `<${tag}>\n${inner}\n</${tag}>`;
  };

  return `<?xml version="1.0" encoding="UTF-8"?>\n${toXml(data, rootTag)}`;
}

/**
 * Converts tabular or structured data into a clean, printable PDF report.
 */
export async function convertDataToPdfReport(
  data: any,
  title: string = 'Data Report'
): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const rows = Array.isArray(data) ? data : [data];

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 40, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on ${new Date().toLocaleString()} • ${rows.length} records`, 40, 68);

  // Extract columns
  const allKeys = Array.from(
    new Set(
      rows.reduce((acc: string[], row: any) => {
        if (typeof row === 'object' && row !== null) {
          acc.push(...Object.keys(row));
        }
        return acc;
      }, [])
    )
  ).slice(0, 7); // Max 7 columns for letter page width

  let y = 100;
  const colWidth = Math.floor(520 / Math.max(1, allKeys.length));

  // Table Header
  doc.setFillColor(240, 243, 246);
  doc.rect(40, y - 14, 532, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30);

  allKeys.forEach((key, colIdx) => {
    const x = 45 + colIdx * colWidth;
    doc.text(String(key).slice(0, 14), x, y);
  });

  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50);

  // Table Rows
  for (let r = 0; r < rows.length; r++) {
    if (y > 720) {
      doc.addPage();
      y = 60;
    }

    const row = rows[r];
    allKeys.forEach((key, colIdx) => {
      const x = 45 + colIdx * colWidth;
      const cellVal = typeof row === 'object' && row !== null ? String(row[key] ?? '') : String(row);
      doc.text(cellVal.slice(0, 18), x, y);
    });

    // Row separator line
    doc.setDrawColor(230, 230, 230);
    doc.line(40, y + 4, 572, y + 4);
    y += 18;
  }

  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}
