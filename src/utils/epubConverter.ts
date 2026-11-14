import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

export interface EpubChapter {
  id: string;
  title: string;
  htmlContent: string;
  plainText: string;
}

export interface EpubBook {
  title: string;
  author: string;
  coverUrl?: string;
  chapters: EpubChapter[];
}

/**
 * Parses an EPUB file into structured chapters and metadata using JSZip.
 */
export async function parseEpub(fileOrBuffer: File | Blob | ArrayBuffer): Promise<EpubBook> {
  const buffer =
    fileOrBuffer instanceof File || fileOrBuffer instanceof Blob
      ? await fileOrBuffer.arrayBuffer()
      : fileOrBuffer;

  const zip = await JSZip.loadAsync(buffer);

  // 1. Find root OPF file path from META-INF/container.xml
  const containerXml = await zip.files['META-INF/container.xml']?.async('text');
  if (!containerXml) {
    throw new Error('Invalid EPUB: META-INF/container.xml missing');
  }

  let rootfilePath = '';
  if (typeof DOMParser !== 'undefined') {
    const containerDoc = new DOMParser().parseFromString(containerXml, 'text/xml');
    rootfilePath = containerDoc.querySelector('rootfile')?.getAttribute('full-path') || '';
  } else {
    const match = containerXml.match(/full-path=["']([^"']+)["']/);
    if (match) rootfilePath = match[1];
  }

  if (!rootfilePath || !zip.files[rootfilePath]) {
    throw new Error('Invalid EPUB: OPF package file not found');
  }

  // Determine base path for relative URLs in EPUB
  const opfDir = rootfilePath.includes('/') ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1) : '';

  // 2. Parse OPF package file
  const opfXml = await zip.files[rootfilePath].async('text');
  let title = 'Untitled EPUB';
  let author = 'Unknown Author';
  const manifestItems = new Map<string, string>();
  const spineItemRefs: string[] = [];

  if (typeof DOMParser !== 'undefined') {
    const opfDoc = new DOMParser().parseFromString(opfXml, 'text/xml');
    title = opfDoc.querySelector('title, dc\\:title')?.textContent || 'Untitled EPUB';
    author = opfDoc.querySelector('creator, dc\\:creator')?.textContent || 'Unknown Author';

    opfDoc.querySelectorAll('manifest > item').forEach((item) => {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      if (id && href) {
        manifestItems.set(id, opfDir + href);
      }
    });

    opfDoc.querySelectorAll('spine > itemref').forEach((ref) => {
      const idref = ref.getAttribute('idref');
      if (idref) spineItemRefs.push(idref);
    });
  } else {
    const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    if (titleMatch) title = titleMatch[1];
    const authorMatch = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
    if (authorMatch) author = authorMatch[1];

    const itemRegex = /<item\s+[^>]*id=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi;
    let m;
    while ((m = itemRegex.exec(opfXml)) !== null) {
      manifestItems.set(m[1], opfDir + m[2]);
    }
    const spineRegex = /<itemref\s+[^>]*idref=["']([^"']+)["'][^>]*\/?>/gi;
    while ((m = spineRegex.exec(opfXml)) !== null) {
      spineItemRefs.push(m[1]);
    }
  }

  const chapters: EpubChapter[] = [];

  for (let idx = 0; idx < spineItemRefs.length; idx++) {
    const idref = spineItemRefs[idx];
    if (!idref) continue;
    const itemPath = manifestItems.get(idref);
    if (!itemPath || !zip.files[itemPath]) continue;

    const html = await zip.files[itemPath].async('text');
    let chapterTitle = `Chapter ${idx + 1}`;
    let htmlContent = html;
    let plainText = '';

    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      chapterTitle = doc.querySelector('h1, h2, h3, title')?.textContent?.trim() || `Chapter ${idx + 1}`;
      htmlContent = doc.body?.innerHTML || html;
      plainText = doc.body?.textContent?.trim() || '';
    } else {
      const headingMatch = html.match(/<(?:h[1-3]|title)[^>]*>([^<]+)<\/(?:h[1-3]|title)>/i);
      if (headingMatch) chapterTitle = headingMatch[1].trim();
      plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    chapters.push({
      id: idref,
      title: chapterTitle,
      htmlContent,
      plainText
    });
  }

  return {
    title,
    author,
    chapters
  };
}

/**
 * Converts an EPUB book into a formatted PDF document.
 */
export async function convertEpubToPdf(
  fileOrBuffer: File | Blob | ArrayBuffer,
  onProgress?: (chapter: number, total: number) => void
): Promise<Uint8Array> {
  const book = await parseEpub(fileOrBuffer);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  // Title Page
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(book.title, 54, 200);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.text(`By ${book.author}`, 54, 230);

  doc.setFontSize(10);
  doc.setTextColor(140);
  doc.text(`Converted to PDF via PDFCraft • ${book.chapters.length} Chapters`, 54, 260);

  // Chapters
  for (let c = 0; c < book.chapters.length; c++) {
    onProgress?.(c + 1, book.chapters.length);
    const chapter = book.chapters[c];
    doc.addPage();

    // Chapter Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(20);
    doc.text(chapter.title, 54, 60);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50);

    // Split text into lines that fit page width (500 pt printable width)
    const splitLines = doc.splitTextToSize(chapter.plainText, 504);
    let y = 90;

    for (let l = 0; l < splitLines.length; l++) {
      if (y > 740) {
        doc.addPage();
        y = 54;
      }
      doc.text(splitLines[l], 54, y);
      y += 14;
    }
  }

  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}
