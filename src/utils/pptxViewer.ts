import JSZip from 'jszip';

export interface PPTXSlideText {
  slideNumber: number;
  title: string;
  paragraphs: string[];
}

export interface PPTXSlide {
  slideNumber: number;
  title: string;
  paragraphs: string[];
  images: { id: string; url: string; name: string }[];
  notes?: string;
  rawText: string;
}

export interface PPTXPresentation {
  fileName: string;
  slideCount: number;
  slides: PPTXSlide[];
  allImages: { name: string; url: string }[];
}

/**
 * Sanitizes a PPTX zip archive in memory before passing to pptx-preview:
 * 1. Checks [Content_Types].xml for <Override PartName="..."> references.
 *    If the referenced file does not exist in the zip archive (common in Office 365,
 *    Google Slides, Canva exports that leave dead slideMaster/slideLayout overrides),
 *    the dead <Override> entry is stripped so pptx-preview doesn't abort loading slides.
 * 2. Returns the clean ArrayBuffer.
 */
export async function sanitizePptxArchive(
  fileOrBuffer: File | Blob | ArrayBuffer
): Promise<ArrayBuffer> {
  const buffer =
    fileOrBuffer instanceof File || fileOrBuffer instanceof Blob
      ? await fileOrBuffer.arrayBuffer()
      : fileOrBuffer;

  try {
    const zip = await JSZip.loadAsync(buffer);
    let modified = false;

    // 1. Sanitize [Content_Types].xml
    const ctFile = zip.file('[Content_Types].xml');
    if (ctFile) {
      const ctXml = await ctFile.async('text');
      const cleanedCtXml = ctXml.replace(
        /<Override\b[^>]*\bPartName=["']([^"']+)["'][^>]*\/>/gi,
        (match, partName) => {
          const relativePath = partName.replace(/^\//, '');
          if (!zip.file(relativePath)) {
            modified = true;
            return '';
          }
          return match;
        }
      );
      if (modified) {
        zip.file('[Content_Types].xml', cleanedCtXml);
      }
    }

    if (modified) {
      return await zip.generateAsync({ type: 'arraybuffer' });
    }

    return buffer;
  } catch (err) {
    console.warn('PPTX pre-sanitization bypassed due to error:', err);
    return buffer;
  }
}

/**
 * Text-only fallback parser using JSZip.
 * Reads ppt/slides/slide*.xml and extracts slide text in order.
 */
export async function extractPPTXTextFallback(
  fileOrBuffer: File | Blob | ArrayBuffer
): Promise<PPTXSlideText[]> {
  const buffer =
    fileOrBuffer instanceof File || fileOrBuffer instanceof Blob
      ? await fileOrBuffer.arrayBuffer()
      : fileOrBuffer;

  const zip = await JSZip.loadAsync(buffer);

  // Discover slide files matching ppt/slides/slide*.xml in numerical order
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

  const slides: PPTXSlideText[] = [];
  const parser = new DOMParser();

  for (let i = 0; i < slidePaths.length; i++) {
    const slidePath = slidePaths[i];
    const slideNumber = i + 1;
    const xml = await zip.files[slidePath].async('string');
    const doc = parser.parseFromString(xml, 'text/xml');

    const paragraphs: string[] = [];
    const pElements = doc.querySelectorAll('p, a\\:p');

    pElements.forEach((p) => {
      const tElements = p.querySelectorAll('t, a\\:t');
      const textParts: string[] = [];
      tElements.forEach((t) => {
        if (t.textContent) textParts.push(t.textContent);
      });
      const combined = textParts.join('').trim();
      if (combined.length > 0) {
        paragraphs.push(combined);
      }
    });

    // Fallback: if no paragraphs found, grab all text elements
    if (paragraphs.length === 0) {
      const allText = doc.querySelectorAll('t, a\\:t');
      allText.forEach((t) => {
        const txt = t.textContent?.trim();
        if (txt) paragraphs.push(txt);
      });
    }

    slides.push({
      slideNumber,
      title: paragraphs[0] || `Slide ${slideNumber}`,
      paragraphs: paragraphs.length > 0 ? paragraphs : ['(Empty slide or shapes only)']
    });
  }

  return slides;
}

export async function parsePPTX(
  fileOrBuffer: File | Blob | ArrayBuffer,
  fileName = 'presentation.pptx'
): Promise<PPTXPresentation> {
  const buffer =
    fileOrBuffer instanceof File || fileOrBuffer instanceof Blob
      ? await fileOrBuffer.arrayBuffer()
      : fileOrBuffer;
  const zip = await JSZip.loadAsync(buffer);

  const mediaFiles = Object.keys(zip.files).filter((path) => path.startsWith('ppt/media/'));
  const allImages: { name: string; url: string }[] = [];

  for (const path of mediaFiles) {
    const fileEntry = zip.files[path];
    if (fileEntry && !fileEntry.dir) {
      const blob = await fileEntry.async('blob');
      const url = URL.createObjectURL(blob);
      const name = path.replace('ppt/media/', '');
      allImages.push({ name, url });
    }
  }

  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

  const slides: PPTXSlide[] = [];
  const parser = new DOMParser();

  for (let i = 0; i < slidePaths.length; i++) {
    const slidePath = slidePaths[i];
    const slideNumber = i + 1;
    const slideXmlText = await zip.files[slidePath].async('string');
    const doc = parser.parseFromString(slideXmlText, 'text/xml');

    const paragraphs: string[] = [];
    const pElements = doc.querySelectorAll('p, a\\:p');

    pElements.forEach((p) => {
      const tElements = p.querySelectorAll('t, a\\:t');
      const textParts: string[] = [];
      tElements.forEach((t) => {
        if (t.textContent) textParts.push(t.textContent);
      });
      const combined = textParts.join('').trim();
      if (combined.length > 0) {
        paragraphs.push(combined);
      }
    });

    if (paragraphs.length === 0) {
      const allTextElements = doc.querySelectorAll('t, a\\:t');
      allTextElements.forEach((t) => {
        const txt = t.textContent?.trim();
        if (txt) paragraphs.push(txt);
      });
    }

    const title = paragraphs[0] || `Slide ${slideNumber}`;
    const rawText = paragraphs.join(' ');

    slides.push({
      slideNumber,
      title,
      paragraphs,
      images: [],
      rawText
    });
  }

  return {
    fileName,
    slideCount: slides.length,
    slides,
    allImages
  };
}
