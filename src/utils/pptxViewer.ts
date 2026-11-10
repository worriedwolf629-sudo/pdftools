import JSZip from 'jszip';

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

export async function parsePPTX(fileOrBuffer: File | Blob | ArrayBuffer, fileName = 'presentation.pptx'): Promise<PPTXPresentation> {
  const buffer = fileOrBuffer instanceof File || fileOrBuffer instanceof Blob
    ? await fileOrBuffer.arrayBuffer()
    : fileOrBuffer;
  const zip = await JSZip.loadAsync(buffer);
  
  // 1. Collect all media files from ppt/media/
  const mediaMap = new Map<string, string>();
  const allImages: { name: string; url: string }[] = [];
  
  const mediaFiles = Object.keys(zip.files).filter((path) => path.startsWith('ppt/media/'));
  for (const path of mediaFiles) {
    const fileEntry = zip.files[path];
    if (fileEntry && !fileEntry.dir) {
      const blob = await fileEntry.async('blob');
      const url = URL.createObjectURL(blob);
      const name = path.replace('ppt/media/', '');
      mediaMap.set(name, url);
      mediaMap.set(`../media/${name}`, url);
      allImages.push({ name, url });
    }
  }

  // 2. Discover slide files
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

  const slides: PPTXSlide[] = [];

  for (let i = 0; i < slidePaths.length; i++) {
    const slidePath = slidePaths[i];
    const slideNumber = i + 1;
    const slideXmlText = await zip.files[slidePath].async('string');
    
    // Parse slide XML
    const parser = new DOMParser();
    const doc = parser.parseFromString(slideXmlText, 'text/xml');
    
    // Extract paragraphs and text
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

    // Fallback: if no paragraphs found, get all text
    if (paragraphs.length === 0) {
      const allTextElements = doc.querySelectorAll('t, a\\:t');
      allTextElements.forEach((t) => {
        const txt = t.textContent?.trim();
        if (txt) paragraphs.push(txt);
      });
    }

    const title = paragraphs[0] || `Slide ${slideNumber}`;
    const rawText = paragraphs.join(' ');

    // Extract slide images from slide rels
    const relsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
    const slideImages: { id: string; url: string; name: string }[] = [];

    if (zip.files[relsPath]) {
      const relsXml = await zip.files[relsPath].async('string');
      const relsDoc = parser.parseFromString(relsXml, 'text/xml');
      const relElements = relsDoc.querySelectorAll('Relationship');
      
      relElements.forEach((rel) => {
        const type = rel.getAttribute('Type') || '';
        const target = rel.getAttribute('Target') || '';
        const id = rel.getAttribute('Id') || '';
        
        if (type.includes('/image') && target) {
          const cleanTarget = target.replace(/^(\.\.\/)+media\//, '').replace(/^media\//, '');
          const url = mediaMap.get(cleanTarget) || mediaMap.get(target);
          if (url) {
            slideImages.push({ id, url, name: cleanTarget });
          }
        }
      });
    }

    // Extract speaker notes if any
    let notes: string | undefined = undefined;
    const notesPath = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
    if (zip.files[notesPath]) {
      const notesXml = await zip.files[notesPath].async('string');
      const notesDoc = parser.parseFromString(notesXml, 'text/xml');
      const noteTexts: string[] = [];
      notesDoc.querySelectorAll('t, a\\:t').forEach((t) => {
        if (t.textContent?.trim()) noteTexts.push(t.textContent.trim());
      });
      if (noteTexts.length > 0) {
        notes = noteTexts.join(' ');
      }
    }

    slides.push({
      slideNumber,
      title,
      paragraphs,
      images: slideImages,
      notes,
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
