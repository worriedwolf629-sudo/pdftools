import React, { useEffect, useRef, useState } from 'react';
import {
  Loader2, AlertCircle, Copy, Sliders, Sparkles, Check, Undo2, Trash2,
  Type, Pencil, Eraser, Highlighter, Square, FileUp, Plus, Minus
} from 'lucide-react';
import JSZip from 'jszip';
import type { PDFTool } from '../registry/tools';
import { FileDropzone } from './FileDropzone';
import { AdSlot } from './AdSlot';
import { PagePicker } from './PagePicker';
import { SignaturePad } from './SignaturePad';
import { Field, Segmented, Toggle, ProgressBar, SuccessBadge, inputCls } from './ui';
import {
  mergePDFs, splitPDF, compressPDF, compressPdfToTargetSize, imagesToPDF, pdfToImages, zipImages, rotatePDF, deletePagesPDF,
  extractPagesPDF, addWatermarkPDF, addPageNumbersPDF, protectPDF, unlockPDF, extractTextPDF, extractImagesPDF,
  getPDFMetadata, updatePDFMetadata, getPDFInfo, pdfInfoToText, ocrPDF, signPDF, typedSignatureToPng, editPDF,
  textToPDF, markdownToPDF, comparePDFs, friendlyError, formatBytes, stripPdfExt,
  needsUnicodeRendering, combinePagesNUp, previewNUpFirstSheet, renderPdfPage, resolveNUpGrid
} from '../utils/pdfEngine';
import { parseSizeToBytes } from '../utils/fileSizeTarget';
import { ResultVerificationCard } from './ResultVerificationCard';
import type {
  Annotation, CompareResult, CompressPreset, ImageFormat, NumberPosition, PdfInfo, PdfMetadata, Progress,
  NUpPagesOption, NUpReadingOrder, NUpSheetSize, NUpOrientation, NUpConfig
} from '../utils/pdfEngine';

interface ToolWorkstationProps {
  tool: PDFTool;
  initialFiles?: File[];
  onOpenFile?: (file: File) => void;
}

type Result = { blob: Blob; filename: string };
type EditTool = 'text' | 'draw' | 'whiteout' | 'highlight' | 'box';

const OCR_LANGS = [
  ['eng', 'English'], ['hin', 'Hindi'], ['kan', 'Kannada'], ['tam', 'Tamil'], ['tel', 'Telugu'], ['mar', 'Marathi'],
  ['ben', 'Bengali'], ['urd', 'Urdu'], ['ara', 'Arabic'], ['spa', 'Spanish'], ['fra', 'French'], ['deu', 'German'],
  ['chi_sim', 'Chinese (Simplified)']
] as const;

const MULTI_TOOLS = ['merge-pdf', 'jpg-to-pdf', 'compare-pdf'];
const TEXT_TOOLS = ['text-to-pdf', 'markdown-to-pdf'];
const needsFile = (id: string) => !TEXT_TOOLS.includes(id);

export const ToolWorkstation: React.FC<ToolWorkstationProps> = ({ tool, initialFiles, onOpenFile }) => {
  const id = tool.id;
  const [files, setFiles] = useState<File[]>(initialFiles || []);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ pct: 0, label: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  // outputs
  const [extractedText, setExtractedText] = useState('');
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [showSame, setShowSame] = useState(false);
  const [compressStats, setCompressStats] = useState<{ orig: number; now: number; method: string } | null>(null);
  const [info, setInfo] = useState<PdfInfo | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const previewRef = useRef<string[]>([]);

  // options
  const [splitMode, setSplitMode] = useState<'range' | 'everyN'>('range');
  const [splitRange, setSplitRange] = useState('1-2');
  const [splitEveryN, setSplitEveryN] = useState(1);
  const [compressLevel, setCompressLevel] = useState<CompressPreset>('medium');
  const [compressType, setCompressType] = useState<'target' | 'preset'>('target');
  const [targetPdfSizeVal, setTargetPdfSizeVal] = useState<number>(200);
  const [targetPdfSizeUnit, setTargetPdfSizeUnit] = useState<'KB' | 'MB'>('KB');
  const [pageSize, setPageSize] = useState<'fit' | 'a4' | 'letter'>('a4');
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [margin, setMargin] = useState(20);
  const [rotateAngle, setRotateAngle] = useState(90);
  const [pagesSpec, setPagesSpec] = useState('1');
  const [wmText, setWmText] = useState('CONFIDENTIAL');
  const [wmOpacity, setWmOpacity] = useState(0.3);
  const [wmSize, setWmSize] = useState(56);
  const [wmAngle, setWmAngle] = useState(45);
  const [wmColor, setWmColor] = useState('#808080');
  const [numPos, setNumPos] = useState<NumberPosition>('bottom-center');
  const [numFormat, setNumFormat] = useState('Page {n} of {total}');
  const [numStart, setNumStart] = useState(1);
  const [numSkipFirst, setNumSkipFirst] = useState(false);
  const [password, setPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(true);
  const [allowEdit, setAllowEdit] = useState(true);
  const [ocrLang, setOcrLang] = useState('eng');
  const [imgFormat, setImgFormat] = useState<ImageFormat>('jpg');
  const [imgScale, setImgScale] = useState(2);
  const [meta, setMeta] = useState<PdfMetadata>({ title: '', author: '', subject: '', keywords: '', creator: '', producer: '' });

  // combine-pages-nup
  const [nupPagesPerSheet, setNupPagesPerSheet] = useState<NUpPagesOption>(4);
  const [nupCustomRows, setNupCustomRows] = useState<number>(2);
  const [nupCustomCols, setNupCustomCols] = useState<number>(2);
  const [nupLayout2Up, setNupLayout2Up] = useState<'horizontal' | 'vertical'>('horizontal');
  const [nupLayout6Up, setNupLayout6Up] = useState<'2x3' | '3x2'>('2x3');
  const [nupLayout8Up, setNupLayout8Up] = useState<'2x4' | '4x2'>('2x4');
  const [nupReadingOrder, setNupReadingOrder] = useState<NUpReadingOrder>('left-to-right');
  const [nupSheetSize, setNupSheetSize] = useState<NUpSheetSize>('a4');
  const [nupOrientation, setNupOrientation] = useState<NUpOrientation>('auto');
  const [nupMarginMm, setNupMarginMm] = useState<number>(10);
  const [nupGapMm, setNupGapMm] = useState<number>(4);
  const [nupDrawBorder, setNupDrawBorder] = useState<boolean>(true);
  const [nupPreviewUrl, setNupPreviewUrl] = useState<string | null>(null);
  const [nupPreviewLoading, setNupPreviewLoading] = useState<boolean>(false);
  const [nupSummary, setNupSummary] = useState<{ totalPages: number; totalSheets: number; nPerSheet: number } | null>(null);
  const [rawText, setRawText] = useState(
    id === 'markdown-to-pdf'
      ? '# My Document\n\nWrite **Markdown** here.\n\n- Headings, lists and quotes work\n- Long text paginates automatically\n\n> Convert it to a PDF with one click.'
      : 'Type or paste your text here.\n\nIt will be wrapped and paginated automatically.'
  );

  // sign
  const [sigMode, setSigMode] = useState<'type' | 'draw'>('type');
  const [sigText, setSigText] = useState('Your Name');
  const [sigDrawn, setSigDrawn] = useState<string | null>(null);
  const [sigTyped, setSigTyped] = useState<{ blob: Blob; url: string } | null>(null);
  const [sigPage, setSigPage] = useState(1);
  const [sigApply, setSigApply] = useState<'page' | 'all' | 'last'>('page');
  const [sigPos, setSigPos] = useState({ x: 55, y: 82 });
  const [sigWidth, setSigWidth] = useState(26);

  // edit
  const [editTool, setEditTool] = useState<EditTool>('text');
  const [editPage, setEditPage] = useState(1);
  const [editText, setEditText] = useState('Your text');
  const [editSize, setEditSize] = useState(16);
  const [editColor, setEditColor] = useState('#dc2626');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const onProgress: Progress = (pct, label) => setProgress({ pct: Math.max(3, Math.min(100, pct)), label: label ?? 'Processing…' });

  const setPreviewBlobs = (blobs: Blob[]) => {
    previewRef.current.forEach((u) => URL.revokeObjectURL(u));
    previewRef.current = blobs.slice(0, 12).map((b) => URL.createObjectURL(b));
    setPreviews(previewRef.current);
  };
  useEffect(() => () => previewRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // typed signature preview
  useEffect(() => {
    if (id !== 'sign-pdf' || sigMode !== 'type' || !sigText.trim()) return;
    let cancelled = false;
    let url = '';
    typedSignatureToPng(sigText).then((blob) => {
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setSigTyped({ blob, url });
    }).catch(() => undefined);
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [id, sigMode, sigText]);

  // combine-pages-nup live preview of first sheet
  useEffect(() => {
    if (id !== 'combine-pages-nup' || files.length === 0) {
      if (nupPreviewUrl) {
        URL.revokeObjectURL(nupPreviewUrl);
        setNupPreviewUrl(null);
      }
      setNupSummary(null);
      return;
    }

    let cancelled = false;
    let localUrl = '';
    const config: NUpConfig = {
      pagesPerSheet: nupPagesPerSheet,
      customRows: nupCustomRows,
      customCols: nupCustomCols,
      layout2Up: nupLayout2Up,
      layout6Up: nupLayout6Up,
      layout8Up: nupLayout8Up,
      readingOrder: nupReadingOrder,
      sheetSize: nupSheetSize,
      orientation: nupOrientation,
      marginMm: nupMarginMm,
      gapMm: nupGapMm,
      drawBorder: nupDrawBorder
    };

    setNupPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const preview = await previewNUpFirstSheet(files[0], config);
        if (cancelled) return;
        setNupSummary({
          totalPages: preview.totalPages,
          totalSheets: preview.totalSheets,
          nPerSheet: preview.nPerSheet
        });

        const rendered = await renderPdfPage(preview.blob, 1, 480);
        if (cancelled) return;
        const blob = await new Promise<Blob | null>((res) => rendered.canvas.toBlob((b: Blob | null) => res(b), 'image/jpeg', 0.85));
        if (cancelled || !blob) return;

        localUrl = URL.createObjectURL(blob);
        setNupPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return localUrl;
        });
      } catch (e) {
        // silent preview failure on corrupted/initial read
      } finally {
        if (!cancelled) setNupPreviewLoading(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [
    id,
    files,
    nupPagesPerSheet,
    nupCustomRows,
    nupCustomCols,
    nupLayout2Up,
    nupLayout6Up,
    nupLayout8Up,
    nupReadingOrder,
    nupSheetSize,
    nupOrientation,
    nupMarginMm,
    nupGapMm,
    nupDrawBorder
  ]);

  const clearOutputs = () => {
    setError(''); setSuccess(''); setResult(null); setExtractedText(''); setCompare(null);
    setCompressStats(null); setPreviewBlobs([]);
  };

  const handleFilesSelected = async (incoming: File[]) => {
    clearOutputs();
    setInfo(null);
    if (MULTI_TOOLS.includes(id)) {
      let next = [...files, ...incoming];
      if (id === 'compare-pdf' && next.length > 2) {
        next = next.slice(0, 2);
        setError('Compare needs exactly two PDFs, so the extra files were ignored.');
      }
      setFiles(next);
      return;
    }
    const f = incoming[0];
    setFiles([f]);
    setAnnotations([]); setEditPage(1); setSigPage(1);
    if (id === 'pdf-metadata') {
      try { setMeta(await getPDFMetadata(f)); } catch (e) { setError(friendlyError(e)); }
    } else if (id === 'pdf-info') {
      try {
        const i = await getPDFInfo(f);
        setInfo(i);
        setResult({ blob: new Blob([pdfInfoToText(i)], { type: 'text/plain;charset=utf-8' }), filename: `${stripPdfExt(f.name)}_info.txt` });
      } catch (e) { setError(friendlyError(e)); }
    }
  };

  const handleRemove = (i: number) => { setFiles((p) => p.filter((_, k) => k !== i)); clearOutputs(); };
  const handleMove = (from: number, to: number) => {
    setFiles((p) => { const n = [...p]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; });
    clearOutputs();
  };

  const loadTextFile = async (f: File | undefined) => {
    if (f) setRawText(await f.text());
  };

  const finishPdf = (bytes: Uint8Array, filename: string, msg = 'Done! Your file is ready to download.') => {
    setResult({ blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), filename });
    setSuccess(msg);
  };

  const handleProcess = async () => {
    if (needsFile(id) && files.length === 0) { setError('Please upload a file first.'); return; }
    clearOutputs();
    setBusy(true);
    onProgress(3, 'Starting…');
    await new Promise((r) => setTimeout(r, 30)); // let the progress bar paint
    const f = files[0];
    const base = f ? stripPdfExt(f.name) : 'document';

    try {
      switch (id) {
        case 'open-file':
          if (f) {
            setSuccess(`Loaded ${f.name} for instant viewing.`);
          }
          break;

        case 'merge-pdf':
          finishPdf(await mergePDFs(files, onProgress), 'merged_document.pdf', `Merged ${files.length} files into one PDF.`);
          break;

        case 'split-pdf': {
          const parts = await splitPDF(f, { mode: splitMode, rangeStr: splitRange, everyN: splitEveryN });
          if (parts.length === 1) { finishPdf(parts[0].pdfBytes, parts[0].filename); break; }
          const zip = new JSZip();
          parts.forEach((p) => zip.file(p.filename, p.pdfBytes));
          setResult({ blob: await zip.generateAsync({ type: 'blob' }), filename: `${base}_split.zip` });
          setSuccess(`Split into ${parts.length} PDF files (downloaded as a ZIP).`);
          break;
        }

        case 'compress-pdf': {
          const targetBytes = parseSizeToBytes(targetPdfSizeVal, targetPdfSizeUnit);
          const r = compressType === 'target'
            ? await compressPdfToTargetSize(f, targetBytes, onProgress)
            : await compressPDF(f, compressLevel, onProgress);
          setCompressStats({ orig: r.originalSize, now: r.newSize, method: r.method });
          const isEnlarged = r.method === 'enlarged';
          finishPdf(r.pdfBytes, isEnlarged ? `enlarged_${f.name}` : `compressed_${f.name}`,
            isEnlarged
              ? `Enlarged PDF file size to ${formatBytes(r.newSize)} (${targetPdfSizeVal} ${targetPdfSizeUnit}) for portal upload requirements.`
              : r.method === 'unchanged'
              ? 'This PDF is already well optimized — no smaller version was found, so the original is kept.'
              : r.method === 'rasterized'
                ? 'Compressed to fit target size. Pages were optimized as high-clarity images.'
                : 'Compressed without any quality loss. Text stays selectable.');
          break;
        }

        case 'pdf-to-jpg': {
          const imgs = await pdfToImages(f, imgFormat, imgScale, onProgress);
          setPreviewBlobs(imgs.map((i) => i.blob));
          if (imgs.length === 1) {
            setResult({ blob: imgs[0].blob, filename: `${base}.${imgFormat}` });
          } else {
            setResult({ blob: await zipImages(imgs, imgFormat, base), filename: `${base}_images.zip` });
          }
          setSuccess(`Exported ${imgs.length} page${imgs.length === 1 ? '' : 's'} as ${imgFormat.toUpperCase()}.`);
          break;
        }

        case 'jpg-to-pdf':
          finishPdf(await imagesToPDF(files, { pageSize, orientation, margin }, onProgress), 'converted_images.pdf', `Combined ${files.length} image${files.length === 1 ? '' : 's'} into a PDF.`);
          break;

        case 'rotate-pdf':
          finishPdf(await rotatePDF(f, rotateAngle, pagesSpec), `rotated_${f.name}`, 'Pages rotated.');
          break;
        case 'delete-pdf-pages':
          finishPdf(await deletePagesPDF(f, pagesSpec), `trimmed_${f.name}`, 'Selected pages removed.');
          break;
        case 'extract-pages':
          finishPdf(await extractPagesPDF(f, pagesSpec), `extracted_${f.name}`, 'Pages extracted into a new PDF.');
          break;

        case 'combine-pages-nup': {
          const config: NUpConfig = {
            pagesPerSheet: nupPagesPerSheet,
            customRows: nupCustomRows,
            customCols: nupCustomCols,
            layout2Up: nupLayout2Up,
            layout6Up: nupLayout6Up,
            layout8Up: nupLayout8Up,
            readingOrder: nupReadingOrder,
            sheetSize: nupSheetSize,
            orientation: nupOrientation,
            marginMm: nupMarginMm,
            gapMm: nupGapMm,
            drawBorder: nupDrawBorder
          };
          const r = await combinePagesNUp(f, config, onProgress);
          finishPdf(
            r.pdfBytes,
            `${base}_${r.nPerSheet}up.pdf`,
            `Combined ${r.totalPages} pages into ${r.totalSheets} sheets (${r.nPerSheet} pages per sheet).`
          );
          break;
        }

        case 'watermark-pdf':
          finishPdf(await addWatermarkPDF(f, wmText, { opacity: wmOpacity, fontSize: wmSize, angle: wmAngle, color: wmColor, pagesSpec: pagesSpec.trim() || 'all' }), `watermarked_${f.name}`, 'Watermark added.');
          break;

        case 'add-page-numbers':
          finishPdf(await addPageNumbersPDF(f, { position: numPos, format: numFormat, startFrom: numStart, skipFirst: numSkipFirst }), `numbered_${f.name}`, 'Page numbers added.');
          break;

        case 'protect-pdf':
          finishPdf(await protectPDF(f, password, { ownerPassword: ownerPassword || undefined, allowPrinting: allowPrint, allowCopying: allowCopy, allowModifying: allowEdit }), `protected_${f.name}`, 'Encrypted with AES-256. Keep your password safe — it cannot be recovered.');
          break;
        case 'unlock-pdf':
          finishPdf(await unlockPDF(f, password), `unlocked_${f.name}`, 'Password removed.');
          break;

        case 'pdf-to-text': {
          const txt = await extractTextPDF(f, onProgress);
          setExtractedText(txt);
          setResult({ blob: new Blob([txt], { type: 'text/plain;charset=utf-8' }), filename: `${base}.txt` });
          setSuccess('Text extracted.');
          break;
        }
        case 'ocr-pdf': {
          const txt = await ocrPDF(f, ocrLang, onProgress);
          setExtractedText(txt);
          setResult({ blob: new Blob([txt], { type: 'text/plain;charset=utf-8' }), filename: `${base}_ocr.txt` });
          setSuccess('OCR complete.');
          break;
        }
        case 'extract-images': {
          const r = await extractImagesPDF(f, onProgress);
          setResult({ blob: r.blob, filename: `${base}_images.zip` });
          setSuccess(`Extracted ${r.count} embedded image${r.count === 1 ? '' : 's'}.`);
          break;
        }

        case 'pdf-metadata':
          finishPdf(await updatePDFMetadata(f, meta), `updated_${f.name}`, 'Metadata updated.');
          break;

        case 'text-to-pdf':
          finishPdf(await textToPDF(rawText), 'document.pdf');
          break;
        case 'markdown-to-pdf':
          finishPdf(await markdownToPDF(rawText), 'document.pdf');
          break;

        case 'combine-pages-nup': {
          const config: NUpConfig = {
            pagesPerSheet: nupPagesPerSheet,
            customRows: nupCustomRows,
            customCols: nupCustomCols,
            layout2Up: nupLayout2Up,
            layout6Up: nupLayout6Up,
            layout8Up: nupLayout8Up,
            readingOrder: nupReadingOrder,
            sheetSize: nupSheetSize,
            orientation: nupOrientation,
            marginMm: nupMarginMm,
            gapMm: nupGapMm,
            drawBorder: nupDrawBorder
          };
          const r = await combinePagesNUp(f, config, onProgress);
          const gridLabel = nupPagesPerSheet === 'custom' ? `${nupCustomRows}x${nupCustomCols}` : `${r.nPerSheet}up`;
          finishPdf(
            r.pdfBytes,
            `${base}_${gridLabel}.pdf`,
            `Combined ${r.totalPages} pages into ${r.totalSheets} sheets (${r.nPerSheet} pages per sheet).`
          );
          break;
        }

        case 'sign-pdf': {
          const sig: Blob | string | null = sigMode === 'draw' ? sigDrawn : sigTyped?.blob ?? null;
          if (!sig) throw new Error(sigMode === 'draw' ? 'Draw your signature first.' : 'Type your name to create a signature.');
          finishPdf(await signPDF(f, sig, { pages: sigApply === 'page' ? sigPage : sigApply, xPct: sigPos.x, yPct: sigPos.y, widthPct: sigWidth }), `signed_${f.name}`, 'Signature added.');
          break;
        }

        case 'edit-pdf':
          finishPdf(await editPDF(f, annotations), `edited_${f.name}`, `Applied ${annotations.length} edit${annotations.length === 1 ? '' : 's'}.`);
          break;

        case 'compare-pdf': {
          if (files.length !== 2) throw new Error('Add exactly two PDFs to compare.');
          const r = await comparePDFs(files[0], files[1], onProgress);
          setCompare(r);
          setSuccess(r.added + r.removed === 0 ? 'No text differences found.' : `Found ${r.removed} removed and ${r.added} added line${r.removed + r.added === 1 ? '' : 's'}.`);
          break;
        }

        default:
          throw new Error('This tool is not available yet.');
      }
    } catch (err) {
      console.error(err);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Tool-specific option panels                                        */
  /* ---------------------------------------------------------------- */

  const pageSpecField = (label: string, hint: string, placeholder: string) => (
    <Field label={label} hint={hint}>
      <input className={inputCls} value={pagesSpec} onChange={(e) => setPagesSpec(e.target.value)} placeholder={placeholder} />
    </Field>
  );

  const editToolBtn = (t: EditTool, label: string, Icon: React.ElementType) => (
    <button
      key={t}
      type="button"
      onClick={() => setEditTool(t)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-all ${
        editTool === t
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  const addAnn = (a: Annotation) => setAnnotations((p) => [...p, a]);
  const sigImgUrl = sigMode === 'draw' ? sigDrawn : sigTyped?.url ?? null;

  const renderOptions = () => {
    switch (id) {
      case 'split-pdf':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Split mode">
              <select className={inputCls} value={splitMode} onChange={(e) => setSplitMode(e.target.value as 'range' | 'everyN')}>
                <option value="range">Custom page ranges</option>
                <option value="everyN">Every N pages</option>
              </select>
            </Field>
            {splitMode === 'range' ? (
              <Field label="Page ranges" hint="Each comma-separated part becomes its own PDF. e.g. 1-3, 5, 8-">
                <input className={inputCls} value={splitRange} onChange={(e) => setSplitRange(e.target.value)} placeholder="1-3, 5, 8-" />
              </Field>
            ) : (
              <Field label="Pages per file">
                <input type="number" min={1} className={inputCls} value={splitEveryN} onChange={(e) => setSplitEveryN(Math.max(1, parseInt(e.target.value) || 1))} />
              </Field>
            )}
          </div>
        );

      case 'compress-pdf':
        return (
          <div className="space-y-4">
            <Field label="Compression / Resize Mode">
              <Segmented
                value={compressType}
                onChange={setCompressType}
                options={[
                  { value: 'target', label: 'Target Size (KB / MB)', desc: 'Exact target file size' },
                  { value: 'preset', label: 'Quality Presets', desc: 'Extreme, Balanced, Light' }
                ]}
              />
            </Field>

            {compressType === 'target' ? (
              <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Quick Target Size Presets:
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-xs font-mono">
                    {[
                      { val: 50, unit: 'KB' },
                      { val: 100, unit: 'KB' },
                      { val: 200, unit: 'KB' },
                      { val: 500, unit: 'KB' },
                      { val: 1, unit: 'MB' },
                      { val: 2, unit: 'MB' },
                      { val: 5, unit: 'MB' }
                    ].map((p) => {
                      const isSel = targetPdfSizeVal === p.val && targetPdfSizeUnit === p.unit;
                      return (
                        <button
                          key={`${p.val}${p.unit}`}
                          type="button"
                          onClick={() => {
                            setTargetPdfSizeVal(p.val);
                            setTargetPdfSizeUnit(p.unit as any);
                          }}
                          className={`py-1.5 rounded-lg border font-mono transition-all text-center ${
                            isSel
                              ? 'bg-indigo-600 text-white font-bold border-indigo-400 shadow-sm'
                              : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {p.val} {p.unit}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Custom Target PDF Size:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      value={targetPdfSizeVal}
                      onChange={(e) => setTargetPdfSizeVal(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                    <select
                      value={targetPdfSizeUnit}
                      onChange={(e) => setTargetPdfSizeUnit(e.target.value as any)}
                      className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:border-indigo-500"
                    >
                      <option value="KB">KB</option>
                      <option value="MB">MB</option>
                    </select>
                  </div>
                </div>

                {files[0] && (() => {
                  const curBytes = files[0].size;
                  const targetBytes = parseSizeToBytes(targetPdfSizeVal, targetPdfSizeUnit);
                  const isEnlarge = targetBytes > curBytes;
                  return (
                    <div
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        isEnlarge
                          ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-300'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      <span>
                        {isEnlarge ? '📈 Enlarge file size to' : '🗜️ Compress file size to'}:
                      </span>
                      <span className="font-mono font-bold">
                        {targetPdfSizeVal} {targetPdfSizeUnit} ({isEnlarge ? `+${formatBytes(targetBytes - curBytes)}` : `-${formatBytes(curBytes - targetBytes)}`})
                      </span>
                    </div>
                  );
                })()}

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ideal for portals requiring strict file size limits (e.g. under 200 KB) or minimum sizes (e.g. at least 500 KB).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Segmented value={compressLevel} onChange={setCompressLevel} options={[
                  { value: 'high', label: 'Extreme', desc: 'Smallest file' },
                  { value: 'medium', label: 'Recommended', desc: 'Balanced' },
                  { value: 'low', label: 'Light', desc: 'Best quality' }
                ]} />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  We first try a lossless clean-up (text stays selectable). Only if that is not enough and image compression saves a lot do we convert pages to images — and we never return a file bigger than the original.
                </p>
              </div>
            )}
          </div>
        );

      case 'pdf-to-jpg':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Image format">
              <Segmented value={imgFormat} onChange={setImgFormat} options={[{ value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }, { value: 'webp', label: 'WebP' }]} />
            </Field>
            <Field label="Quality">
              <Segmented value={imgScale} onChange={setImgScale} options={[{ value: 1, label: 'Standard', desc: '72 dpi' }, { value: 2, label: 'High', desc: '144 dpi' }, { value: 3, label: 'Ultra', desc: '216 dpi' }]} />
            </Field>
          </div>
        );

      case 'jpg-to-pdf':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Page size">
              <select className={inputCls} value={pageSize} onChange={(e) => setPageSize(e.target.value as typeof pageSize)}>
                <option value="a4">A4</option><option value="letter">US Letter</option><option value="fit">Fit to image</option>
              </select>
            </Field>
            <Field label="Orientation">
              <select className={inputCls} value={orientation} onChange={(e) => setOrientation(e.target.value as typeof orientation)} disabled={pageSize === 'fit'}>
                <option value="auto">Auto</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option>
              </select>
            </Field>
            <Field label="Margin">
              <select className={inputCls} value={margin} onChange={(e) => setMargin(parseInt(e.target.value))}>
                <option value={0}>None</option><option value={20}>Small</option><option value={48}>Large</option>
              </select>
            </Field>
          </div>
        );

      case 'rotate-pdf':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Rotation">
              <Segmented value={rotateAngle} onChange={setRotateAngle} options={[
                { value: 90, label: '90° right' }, { value: 180, label: '180°' }, { value: 270, label: '90° left' }
              ]} />
            </Field>
            {pageSpecField('Pages', 'Use "all", "odd", "even" or ranges like 1-3, 5', 'all')}
          </div>
        );
      case 'delete-pdf-pages':
        return pageSpecField('Pages to delete', 'e.g. 2, 4-6, last', '2-3');
      case 'extract-pages':
        return pageSpecField('Pages to extract', 'e.g. 1-3, 7 — pages come out in the order you write them', '1-3');

      case 'watermark-pdf':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Watermark text" hint={needsUnicodeRendering(wmText) ? 'Non-Latin text is supported — it is drawn as an image.' : undefined}>
              <input className={inputCls} value={wmText} onChange={(e) => setWmText(e.target.value)} />
            </Field>
            <Field label="Colour">
              <input type="color" className="h-[42px] w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 cursor-pointer" value={wmColor} onChange={(e) => setWmColor(e.target.value)} />
            </Field>
            <Field label={`Opacity (${Math.round(wmOpacity * 100)}%)`}>
              <input type="range" min={0.05} max={1} step={0.05} value={wmOpacity} onChange={(e) => setWmOpacity(parseFloat(e.target.value))} className="w-full accent-indigo-600" />
            </Field>
            <Field label={`Size (${wmSize} pt)`}>
              <input type="range" min={16} max={140} step={2} value={wmSize} onChange={(e) => setWmSize(parseInt(e.target.value))} className="w-full accent-indigo-600" />
            </Field>
            <Field label={`Angle (${wmAngle}°)`}>
              <input type="range" min={0} max={90} step={5} value={wmAngle} onChange={(e) => setWmAngle(parseInt(e.target.value))} className="w-full accent-indigo-600" />
            </Field>
            {pageSpecField('Apply to pages', '"all" or e.g. 1-3, 5', 'all')}
          </div>
        );

      case 'add-page-numbers':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Position">
              <select className={inputCls} value={numPos} onChange={(e) => setNumPos(e.target.value as NumberPosition)}>
                {['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left'].map((p) => (
                  <option key={p} value={p}>{p.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </Field>
            <Field label="Start numbering at">
              <input type="number" className={inputCls} value={numStart} onChange={(e) => setNumStart(parseInt(e.target.value) || 1)} />
            </Field>
            <Field label="Format" hint="Use {n} for the page number and {total} for the page count">
              <input className={inputCls} value={numFormat} onChange={(e) => setNumFormat(e.target.value)} />
            </Field>
            <div className="flex items-end pb-2"><Toggle checked={numSkipFirst} onChange={setNumSkipFirst} label="Skip the first page (cover)" /></div>
          </div>
        );

      case 'protect-pdf':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Password to open the PDF">
                <input type="password" autoComplete="new-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter a strong password" />
              </Field>
              <Field label="Owner password (optional)" hint="Needed to change permissions later">
                <input type="password" autoComplete="new-password" className={inputCls} value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Toggle checked={allowPrint} onChange={setAllowPrint} label="Allow printing" />
              <Toggle checked={allowCopy} onChange={setAllowCopy} label="Allow copying text" />
              <Toggle checked={allowEdit} onChange={setAllowEdit} label="Allow editing" />
            </div>
          </div>
        );
      case 'unlock-pdf':
        return (
          <Field label="Current password" hint="Leave empty if the PDF only has editing/printing restrictions">
            <input type="password" autoComplete="off" className={`${inputCls} sm:w-1/2`} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter the PDF password" />
          </Field>
        );

      case 'ocr-pdf':
        return (
          <Field label="Document language" hint="Language data (a few MB) is downloaded the first time you use a language.">
            <select className={`${inputCls} sm:w-1/2`} value={ocrLang} onChange={(e) => setOcrLang(e.target.value)}>
              {OCR_LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </Field>
        );

      case 'pdf-metadata':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['title', 'author', 'subject', 'creator'] as const).map((k) => (
              <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
                <input className={inputCls} value={meta[k]} onChange={(e) => setMeta({ ...meta, [k]: e.target.value })} />
              </Field>
            ))}
            <Field label="Keywords" hint="Comma separated" className="sm:col-span-2">
              <input className={inputCls} value={meta.keywords} onChange={(e) => setMeta({ ...meta, keywords: e.target.value })} />
            </Field>
          </div>
        );

      case 'pdf-info':
        return info ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs animate-pop-in">
            {[
              ['Pages', String(info.pageCount)], ['File size', info.fileSizeFormatted], ['Page size', `${info.paper} · ${info.dimensionsMm}`],
              ['Encrypted', info.isEncrypted], ['Title', info.title], ['Author', info.author], ['Created', info.created], ['Producer', info.producer]
            ].map(([k, v]) => (
              <div key={k} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-slate-400">{k}</div>
                <div className="font-bold text-sm break-words text-slate-900 dark:text-white">{v}</div>
              </div>
            ))}
          </div>
        ) : null;

      case 'sign-pdf':
        return (
          <div className="space-y-5">
            <Segmented value={sigMode} onChange={setSigMode} options={[{ value: 'type', label: 'Type' }, { value: 'draw', label: 'Draw' }]} />
            {sigMode === 'type' ? (
              <Field label="Your name">
                <input className={`${inputCls} sm:w-1/2`} value={sigText} onChange={(e) => setSigText(e.target.value)} />
              </Field>
            ) : (
              <div className="max-w-md"><SignaturePad onChange={setSigDrawn} /></div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Apply to">
                <Segmented value={sigApply} onChange={setSigApply} options={[{ value: 'page', label: 'This page' }, { value: 'all', label: 'All pages' }, { value: 'last', label: 'Last page' }]} />
              </Field>
              <Field label={`Size (${sigWidth}% of page width)`}>
                <input type="range" min={10} max={60} value={sigWidth} onChange={(e) => setSigWidth(parseInt(e.target.value))} className="w-full accent-indigo-600" />
              </Field>
            </div>
            <PagePicker
              file={files[0]}
              page={sigPage}
              onPageChange={setSigPage}
              mode="point"
              hint="Click the page to place your signature"
              onPoint={(x, y) => setSigPos({ x: Math.min(x, 100 - sigWidth), y })}
              overlay={() =>
                sigImgUrl ? (
                  <img
                    src={sigImgUrl}
                    alt="Signature preview"
                    draggable={false}
                    className="absolute pointer-events-none ring-2 ring-indigo-500/70 ring-offset-1 rounded-sm bg-indigo-500/5 transition-[left,top] duration-200"
                    style={{ left: `${Math.min(sigPos.x, 100 - sigWidth)}%`, top: `${sigPos.y}%`, width: `${sigWidth}%` }}
                  />
                ) : null
              }
            />
          </div>
        );

      case 'edit-pdf':
        return (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {editToolBtn('text', 'Text', Type)}
              {editToolBtn('draw', 'Draw', Pencil)}
              {editToolBtn('whiteout', 'Whiteout', Eraser)}
              {editToolBtn('highlight', 'Highlight', Highlighter)}
              {editToolBtn('box', 'Box', Square)}
            </div>
            {editTool === 'text' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Text" className="sm:col-span-2" hint={needsUnicodeRendering(editText) ? 'Non-Latin text is supported — it is placed as an image.' : undefined}>
                  <textarea rows={2} className={inputCls} value={editText} onChange={(e) => setEditText(e.target.value)} />
                </Field>
                <Field label="Size">
                  <div className="flex items-center gap-2">
                    <button type="button" className="btn-secondary !p-2" onClick={() => setEditSize((s) => Math.max(6, s - 2))} aria-label="Smaller"><Minus className="w-4 h-4" /></button>
                    <span className="w-10 text-center font-semibold tabular-nums">{editSize}</span>
                    <button type="button" className="btn-secondary !p-2" onClick={() => setEditSize((s) => Math.min(72, s + 2))} aria-label="Larger"><Plus className="w-4 h-4" /></button>
                  </div>
                </Field>
              </div>
            )}
            {(editTool === 'text' || editTool === 'draw' || editTool === 'box') && (
              <Field label="Colour">
                <input type="color" className="h-10 w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 cursor-pointer" value={editColor} onChange={(e) => setEditColor(e.target.value)} />
              </Field>
            )}
            <PagePicker
              file={files[0]}
              page={editPage}
              onPageChange={setEditPage}
              mode={editTool === 'text' ? 'point' : editTool === 'draw' ? 'path' : 'rect'}
              hint={editTool === 'text' ? 'Click where the text should start' : editTool === 'draw' ? 'Drag to draw' : 'Drag to select an area'}
              onPoint={(x, y) => {
                if (!editText.trim()) { setError('Type the text to place first.'); return; }
                setError('');
                addAnn({ type: 'text', page: editPage, xPct: x, yPct: y, text: editText, size: editSize, color: editColor });
              }}
              onRect={(x, y, w, h) =>
                addAnn({ type: editTool as 'whiteout' | 'highlight' | 'box', page: editPage, xPct: x, yPct: y, wPct: w, hPct: h, color: editTool === 'highlight' ? '#ffe600' : editColor })
              }
              onPath={(pts) => addAnn({ type: 'draw', page: editPage, points: pts, color: editColor, thickness: 2 })}
              overlay={(pi) => (
                <>
                  {annotations.map((a, i) => {
                    if (a.page !== editPage) return null;
                    if (a.type === 'text') {
                      return (
                        <div key={i} className="absolute whitespace-pre leading-[1.2] pointer-events-none animate-pop-in" style={{ left: `${a.xPct}%`, top: `${a.yPct}%`, color: a.color, fontSize: `${(a.size / pi.widthPt) * 100}cqw`, fontFamily: 'Helvetica, Arial, sans-serif' }}>
                          {a.text}
                        </div>
                      );
                    }
                    if (a.type === 'draw') {
                      return (
                        <svg key={i} className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <polyline points={a.points.map((p) => `${p.xPct},${p.yPct}`).join(' ')} fill="none" stroke={a.color} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
                        </svg>
                      );
                    }
                    const style: React.CSSProperties = { left: `${a.xPct}%`, top: `${a.yPct}%`, width: `${a.wPct}%`, height: `${a.hPct}%` };
                    return (
                      <div key={i} className="absolute pointer-events-none animate-pop-in" style={{
                        ...style,
                        background: a.type === 'whiteout' ? '#fff' : a.type === 'highlight' ? 'rgba(255,230,0,0.4)' : 'transparent',
                        border: a.type === 'box' ? `1.5px solid ${a.color}` : a.type === 'whiteout' ? '1px dashed #cbd5e1' : 'none'
                      }} />
                    );
                  })}
                </>
              )}
            />
            <div className="flex items-center justify-between flex-wrap gap-3">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{annotations.length} edit{annotations.length === 1 ? '' : 's'} added</span>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary !py-2 !px-3 text-sm" disabled={!annotations.length} onClick={() => setAnnotations((p) => p.slice(0, -1))}><Undo2 className="w-4 h-4" /> Undo</button>
                <button type="button" className="btn-secondary !py-2 !px-3 text-sm" disabled={!annotations.length} onClick={() => setAnnotations([])}><Trash2 className="w-4 h-4" /> Clear</button>
              </div>
            </div>
          </div>
        );

      case 'combine-pages-nup': {
        const gridInfo = resolveNUpGrid({
          pagesPerSheet: nupPagesPerSheet,
          customRows: nupCustomRows,
          customCols: nupCustomCols,
          layout2Up: nupLayout2Up,
          layout6Up: nupLayout6Up,
          layout8Up: nupLayout8Up
        });

        return (
          <div className="space-y-6">
            {/* Live Preview & Summary Card */}
            {nupSummary && (
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base">
                    {gridInfo.nPerSheet}×
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                      {nupSummary.totalPages} pages → {nupSummary.totalSheets} {nupSummary.totalSheets === 1 ? 'sheet' : 'sheets'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Grid: {gridInfo.rows} rows × {gridInfo.cols} cols ({gridInfo.nPerSheet} per sheet)
                    </div>
                  </div>
                </div>
                {nupPreviewUrl && (
                  <div className="relative group shrink-0">
                    <img
                      src={nupPreviewUrl}
                      alt="Sheet 1 Preview"
                      className="h-28 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 bg-white object-contain"
                    />
                    {nupPreviewLoading && (
                      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] rounded-lg flex items-center justify-center text-white">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 text-[9px] font-mono bg-slate-900/80 text-white px-1.5 py-0.5 rounded">
                      Sheet 1 Preview
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 1. Pages Per Sheet */}
            <Field label="Pages per sheet" hint="How many pages to place on each printed sheet">
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 font-mono text-xs">
                {([2, 4, 6, 8, 9, 16, 'custom'] as const).map((opt) => (
                  <button
                    key={String(opt)}
                    type="button"
                    onClick={() => setNupPagesPerSheet(opt)}
                    className={`py-2 px-1 rounded-xl border font-bold transition-all text-center ${
                      nupPagesPerSheet === opt
                        ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                    }`}
                  >
                    {opt === 'custom' ? 'Custom' : `${opt}-up`}
                  </button>
                ))}
              </div>
            </Field>

            {/* Sub-layout conditional options */}
            {nupPagesPerSheet === 2 && (
              <Field label="2-up Layout">
                <Segmented
                  value={nupLayout2Up}
                  onChange={(v) => setNupLayout2Up(v as any)}
                  options={[
                    { value: 'horizontal', label: 'Side by Side (1×2)', desc: 'Left & Right' },
                    { value: 'vertical', label: 'Stacked (2×1)', desc: 'Top & Bottom' }
                  ]}
                />
              </Field>
            )}

            {nupPagesPerSheet === 6 && (
              <Field label="6-up Layout">
                <Segmented
                  value={nupLayout6Up}
                  onChange={(v) => setNupLayout6Up(v as any)}
                  options={[
                    { value: '2x3', label: '2 rows × 3 cols', desc: 'Landscape style' },
                    { value: '3x2', label: '3 rows × 2 cols', desc: 'Portrait style' }
                  ]}
                />
              </Field>
            )}

            {nupPagesPerSheet === 8 && (
              <Field label="8-up Layout">
                <Segmented
                  value={nupLayout8Up}
                  onChange={(v) => setNupLayout8Up(v as any)}
                  options={[
                    { value: '2x4', label: '2 rows × 4 cols', desc: 'Wide format' },
                    { value: '4x2', label: '4 rows × 2 cols', desc: 'Tall format' }
                  ]}
                />
              </Field>
            )}

            {nupPagesPerSheet === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Rows">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={nupCustomRows}
                    onChange={(e) => setNupCustomRows(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Columns">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={nupCustomCols}
                    onChange={(e) => setNupCustomCols(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className={inputCls}
                  />
                </Field>
              </div>
            )}

            {/* Reading Order */}
            <Field label="Page Ordering Sequence">
              <Segmented
                value={nupReadingOrder}
                onChange={(v) => setNupReadingOrder(v as any)}
                options={[
                  { value: 'left-to-right', label: 'Left to Right (Row-first)', desc: '1 2 → 3 4' },
                  { value: 'top-to-bottom', label: 'Top to Bottom (Col-first)', desc: '1 3 ↓ 2 4' }
                ]}
              />
            </Field>

            {/* Sheet Size & Orientation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Output Sheet Size">
                <select
                  value={nupSheetSize}
                  onChange={(e) => setNupSheetSize(e.target.value as any)}
                  className={inputCls}
                >
                  <option value="a4">A4 (210 × 297 mm)</option>
                  <option value="letter">US Letter (8.5 × 11 in)</option>
                  <option value="same-as-first">Same as original PDF page</option>
                </select>
              </Field>

              <Field label="Sheet Orientation">
                <select
                  value={nupOrientation}
                  onChange={(e) => setNupOrientation(e.target.value as any)}
                  className={inputCls}
                >
                  <option value="auto">Auto (Best Fit scale maximizer)</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </Field>
            </div>

            {/* Margins & Gaps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={`Sheet Margin: ${nupMarginMm} mm`} hint="Outer padding around each sheet">
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={nupMarginMm}
                  onChange={(e) => setNupMarginMm(parseInt(e.target.value) || 0)}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </Field>

              <Field label={`Page Gap: ${nupGapMm} mm`} hint="Space between adjacent pages">
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={nupGapMm}
                  onChange={(e) => setNupGapMm(parseInt(e.target.value) || 0)}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </Field>
            </div>

            {/* Border toggle */}
            <div className="pt-1">
              <Toggle
                checked={nupDrawBorder}
                onChange={setNupDrawBorder}
                label="Draw thin border line around each embedded page"
              />
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const optionsVisible = TEXT_TOOLS.includes(id) || files.length > 0;
  const hasSettings = !['merge-pdf', 'pdf-to-text', 'extract-images', 'compare-pdf', 'text-to-pdf', 'markdown-to-pdf'].includes(id) && files.length > 0;
  const hideRunButton = id === 'pdf-info';
  const runDisabled = busy || (needsFile(id) && files.length === 0) || (id === 'compare-pdf' && files.length !== 2) || (id === 'merge-pdf' && files.length < 2);

  const diffToShow = compare ? compare.ops.filter((o) => showSame || o.type !== 'same') : [];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-3 animate-page-in">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" /> {tool.categoryName}
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-heading">{tool.seo.h1}</h1>
        <p className="text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">{tool.seo.intro}</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-10 shadow-xl shadow-indigo-500/5 space-y-6 animate-page-in" style={{ animationDelay: '80ms' }}>
        {needsFile(id) && (
          <FileDropzone
            multiple={MULTI_TOOLS.includes(id)}
            accept={id === 'jpg-to-pdf' ? 'image/*' : '.pdf,application/pdf'}
            onFilesSelected={handleFilesSelected}
            files={files}
            onRemoveFile={handleRemove}
            onMoveFile={id === 'merge-pdf' || id === 'jpg-to-pdf' ? handleMove : undefined}
            badges={id === 'compare-pdf' ? ['A', 'B'] : undefined}
            label={id === 'jpg-to-pdf' ? 'Choose Image Files (JPG, PNG, WebP…)' : id === 'compare-pdf' ? 'Choose two PDFs (original, then modified)' : id === 'merge-pdf' ? 'Choose PDF files to merge' : 'Choose PDF File'}
          />
        )}

        {TEXT_TOOLS.includes(id) && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-bold text-slate-900 dark:text-white font-heading">{id === 'markdown-to-pdf' ? 'Markdown' : 'Plain text'}</label>
              <label className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer hover:underline">
                <FileUp className="w-3.5 h-3.5" /> Load a {id === 'markdown-to-pdf' ? '.md' : '.txt'} file
                <input type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={(e) => { void loadTextFile(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
            <textarea rows={10} value={rawText} onChange={(e) => setRawText(e.target.value)} className={`${inputCls} font-mono`} />
            {needsUnicodeRendering(rawText) && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Your text uses a non-Latin script, so pages will be rendered as images (text won't be selectable in the PDF).</p>
            )}
          </div>
        )}

        {optionsVisible && (hasSettings || id === 'pdf-info') && (
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 animate-fade-in">
            {id !== 'pdf-info' && (
              <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-heading flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-500" /> Tool Settings
              </h4>
            )}
            {renderOptions()}
          </div>
        )}

        {error && (
          <div role="alert" className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-start gap-2 animate-pop-in">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {busy && <ProgressBar pct={progress.pct} label={progress.label} />}
        {success && !busy && !result && <SuccessBadge>{success}</SuccessBadge>}

        {/* Live Result Verification & Preview Card */}
        {result && (
          <ResultVerificationCard
            result={result}
            onReset={() => {
              setResult(null);
              setSuccess('');
              setPreviewBlobs([]);
            }}
            onOpenInViewer={onOpenFile}
            compressStats={compressStats}
            successMessage={success}
          />
        )}

        {!hideRunButton && !result && (
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={handleProcess}
              disabled={runDisabled}
              className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base"
            >
              {busy ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Working…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>{tool.name}</span>
                </>
              )}
            </button>
          </div>
        )}

        {!result && previews.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 animate-fade-in">
            {previews.map((u, i) => (
              <img key={u} src={u} alt={`Page ${i + 1}`} className="rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm w-full h-auto animate-pop-in" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
        )}

        {!result && extractedText && (
          <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Extracted text</span>
              <CopyButton text={extractedText} />
            </div>
            <textarea readOnly rows={8} value={extractedText} className={`${inputCls} font-mono text-xs`} />
          </div>
        )}

        {compare && (
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800 animate-fade-in">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800">A: {compare.pagesA} page{compare.pagesA === 1 ? '' : 's'}</span>
              <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800">B: {compare.pagesB} page{compare.pagesB === 1 ? '' : 's'}</span>
              <span className="px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300">−{compare.removed} removed</span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">+{compare.added} added</span>
              <span className="ml-auto"><Toggle checked={showSame} onChange={setShowSame} label={`Show unchanged (${compare.unchanged})`} /></span>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-96 overflow-y-auto font-mono text-xs">
              {diffToShow.length === 0 && <div className="p-6 text-center text-slate-500">The text content of both PDFs is identical.</div>}
              {diffToShow.slice(0, 1500).map((o, i) => (
                <div key={i} className={`px-3 py-1 whitespace-pre-wrap break-words border-b border-slate-100 dark:border-slate-800/60 ${
                  o.type === 'add' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                  : o.type === 'del' ? 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 line-through decoration-red-400/50'
                  : 'text-slate-500'}`}>
                  <span className="select-none inline-block w-4 opacity-60">{o.type === 'add' ? '+' : o.type === 'del' ? '−' : ' '}</span>{o.text}
                </div>
              ))}
              {diffToShow.length > 1500 && <div className="p-3 text-center text-slate-500">…and {diffToShow.length - 1500} more lines</div>}
            </div>
          </div>
        )}

        <AdSlot type="result-area" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-200 dark:border-slate-800">
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white font-heading">How to use {tool.name}</h3>
          <div className="space-y-3 stagger">
            {tool.seo.howToSteps.map((s, idx) => (
              <div key={idx} style={{ ['--i' as string]: idx }} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white text-sm font-heading mb-1">{s.step}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white font-heading">Key Features &amp; FAQ</h3>
          <div className="space-y-3 stagger">
            {tool.seo.features.map((feat, idx) => (
              <div key={`f${idx}`} style={{ ['--i' as string]: idx }} className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                <div className="font-bold text-indigo-900 dark:text-indigo-300 text-sm font-heading mb-1">{feat.title}</div>
                <p className="text-xs text-slate-600 dark:text-slate-400">{feat.desc}</p>
              </div>
            ))}
            {tool.seo.faqs.map((faq, idx) => (
              <div key={`q${idx}`} style={{ ['--i' as string]: idx + tool.seo.features.length }} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-white text-sm mb-1">Q: {faq.question}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
      }}
      className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-semibold hover:underline"
    >
      {done ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy text</>}
    </button>
  );
};
