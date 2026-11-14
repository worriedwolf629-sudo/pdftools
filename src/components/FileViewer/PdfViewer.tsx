import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download, Printer,
  FileEdit, Minimize2, Maximize2, PenTool, Scissors, ScanText, Loader2,
  Sparkles, Moon, Presentation, BookOpen, FileCode, Check, ChevronDown, Scaling, CheckCircle2
} from 'lucide-react';
import { pdfjsLib } from '../../utils/pdfjs';
import { resizePDF } from '../../utils/pdfEngine';
import {
  type DocumentFilterType,
  applyScanEnhancer,
  applyInvertFilter,
  apply1BitDither,
  exportPdfWithFilter
} from '../../utils/visualFilters';
import {
  convertPdfToPptx,
  convertPdfToCbz,
  extractPdfPageAsSvg
} from '../../utils/vectorConverters';
import { parseSizeToBytes, formatBytes } from '../../utils/fileSizeTarget';

interface PdfViewerProps {
  file: File | Blob;
  fileName: string;
  onOpenWithTool?: (toolSlug: string, file: File) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ file, fileName, onOpenWithTool }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [visualFilter, setVisualFilter] = useState<DocumentFilterType>('none');
  const [convertingStatus, setConvertingStatus] = useState<string>('');
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showResizeModal, setShowResizeModal] = useState<boolean>(false);
  const [resizeMode, setResizeMode] = useState<'file-size' | 'paper' | 'scale'>('file-size');
  const [targetSizeVal, setTargetSizeVal] = useState<number>(200);
  const [targetSizeUnit, setTargetSizeUnit] = useState<'KB' | 'MB'>('KB');
  const [resizePaper, setResizePaper] = useState<'A4' | 'Letter' | 'Legal' | 'A3' | 'Tabloid'>('A4');
  const [resizeScale, setResizeScale] = useState<number>(0.75);
  const [resizingPdf, setResizingPdf] = useState<boolean>(false);
  const [pdfProcessedResult, setPdfProcessedResult] = useState<{ blob: Blob; filename: string; size: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // Sync Esc key exit via Fullscreen API event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (rootRef.current?.requestFullscreen) {
          await rootRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (e) {
      console.warn('Fullscreen request failed:', e);
    }
  }, []);

  // Load PDF document
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const buffer = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (isCancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);

        // Generate thumbnails asynchronously for first 25 pages
        const thumbs: string[] = [];
        const maxThumbs = Math.min(doc.numPages, 25);
        for (let i = 1; i <= maxThumbs; i++) {
          try {
            const page = await doc.getPage(i);
            const viewport = page.getViewport({ scale: 0.2 });
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = viewport.width;
            thumbCanvas.height = viewport.height;
            const thumbCtx = thumbCanvas.getContext('2d');
            if (thumbCtx) {
              await page.render({ canvasContext: thumbCtx, viewport, canvas: thumbCanvas } as any).promise;
              thumbs.push(thumbCanvas.toDataURL());
            }
          } catch (e) {
            console.error('Thumbnail generation error:', e);
          }
        }
        if (!isCancelled) {
          setThumbnails(thumbs);
          setLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('PDF load error:', err);
          setError(err?.message || 'Failed to load PDF file.');
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [file]);

  // Render current page onto canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.scale(dpr, dpr);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas
        } as any;

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        // Apply Document Visual Filters & Pre-Processing (Feature 6)
        if (visualFilter !== 'none' && !isCancelled) {
          context.save();
          context.setTransform(1, 0, 0, 1, 0, 0);
          const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
          if (visualFilter === 'scan-enhance') {
            applyScanEnhancer(imgData);
          } else if (visualFilter === 'invert') {
            applyInvertFilter(imgData);
          } else if (visualFilter === 'dither') {
            apply1BitDither(imgData);
          }
          context.putImageData(imgData, 0, 0);
          context.restore();
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Page render error:', err);
        }
      }
    })();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNum, scale, rotation, visualFilter]);

  // Extended Export Handlers (Feature 3 & 6)
  const handleExportPptx = async () => {
    try {
      setConvertingStatus('Converting pages to PowerPoint slides...');
      const buffer = await file.arrayBuffer();
      const pptxBlob = await convertPdfToPptx(buffer, (cur, total) => {
        setConvertingStatus(`Creating slide deck: ${cur} of ${total} slides...`);
      });
      const url = URL.createObjectURL(pptxBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, '') + '.pptx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Failed to convert PDF to PPTX:', e);
      alert('Failed to generate PPTX: ' + (e?.message || e));
    } finally {
      setConvertingStatus('');
      setShowExportMenu(false);
    }
  };

  const handleExportCbz = async () => {
    try {
      setConvertingStatus('Packaging Comic Book Archive (CBZ)...');
      const buffer = await file.arrayBuffer();
      const cbzBlob = await convertPdfToCbz(buffer, (cur, total) => {
        setConvertingStatus(`Archiving comic page: ${cur} of ${total}...`);
      });
      const url = URL.createObjectURL(cbzBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, '') + '.cbz';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Failed to convert PDF to CBZ:', e);
      alert('Failed to generate CBZ: ' + (e?.message || e));
    } finally {
      setConvertingStatus('');
      setShowExportMenu(false);
    }
  };

  const handleExportSvg = async () => {
    try {
      setConvertingStatus(`Extracting vector SVG for page ${pageNum}...`);
      const buffer = await file.arrayBuffer();
      const svgText = await extractPdfPageAsSvg(buffer, pageNum);
      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, '') + `_page_${pageNum}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Failed to extract SVG:', e);
      alert('Failed to extract SVG: ' + (e?.message || e));
    } finally {
      setConvertingStatus('');
      setShowExportMenu(false);
    }
  };

  const handleExportFilteredPdf = async () => {
    if (visualFilter === 'none') return;
    try {
      setConvertingStatus(`Applying ${visualFilter} filter across pages...`);
      const buffer = await file.arrayBuffer();
      const filteredPdfBytes = await exportPdfWithFilter(buffer, visualFilter, (cur, total) => {
        setConvertingStatus(`Processing page ${cur} of ${total}...`);
      });
      const blob = new Blob([filteredPdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, '') + `_${visualFilter}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Failed to export filtered PDF:', e);
      alert('Failed to export filtered PDF: ' + (e?.message || e));
    } finally {
      setConvertingStatus('');
      setShowExportMenu(false);
    }
  };

  const handleExecuteResizePdf = async () => {
    try {
      setResizingPdf(true);
      const targetBytes = parseSizeToBytes(targetSizeVal, targetSizeUnit);
      const resizedBytes = await resizePDF(file, {
        mode: resizeMode,
        paperSize: resizeMode === 'paper' ? resizePaper : undefined,
        scaleFactor: resizeMode === 'scale' ? resizeScale : undefined,
        targetBytes: resizeMode === 'file-size' ? targetBytes : undefined
      });
      const blob = new Blob([resizedBytes as any], { type: 'application/pdf' });
      const tag =
        resizeMode === 'file-size'
          ? targetBytes > file.size
            ? `enlarged_${targetSizeVal}${targetSizeUnit}`
            : `compressed_${targetSizeVal}${targetSizeUnit}`
          : resizeMode === 'paper'
          ? resizePaper
          : `${Math.round(resizeScale * 100)}pct`;
      const outName = fileName.replace(/\.pdf$/i, '') + `_${tag}.pdf`;
      setPdfProcessedResult({
        blob,
        filename: outName,
        size: blob.size
      });
    } catch (e: any) {
      console.error('Resize PDF error:', e);
      alert('Failed to resize PDF: ' + (e?.message || e));
    } finally {
      setResizingPdf(false);
    }
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const url = URL.createObjectURL(file);
    const win = window.open(url, '_blank');
    if (win) {
      win.focus();
      win.print();
    }
  };

  const handleOpenTool = (slug: string) => {
    if (onOpenWithTool) {
      const realFile = file instanceof File ? file : new File([file], fileName, { type: 'application/pdf' });
      onOpenWithTool(slug, realFile);
    }
  };

  // Zoom steps (Issue 3: supporting 50%, 100%, 140%, 200%)
  const zoomSteps = [0.5, 0.75, 1.0, 1.2, 1.4, 1.6, 2.0];
  const handleZoomIn = () => {
    setScale((curr) => {
      const next = zoomSteps.find((s) => s > curr + 0.05);
      return next !== undefined ? next : Math.min(3.0, Number((curr + 0.2).toFixed(1)));
    });
  };
  const handleZoomOut = () => {
    setScale((curr) => {
      const prev = [...zoomSteps].reverse().find((s) => s < curr - 0.05);
      return prev !== undefined ? prev : Math.max(0.4, Number((curr - 0.2).toFixed(1)));
    });
  };

  return (
    <div
      ref={rootRef}
      className={`flex flex-col h-full bg-slate-900/90 text-white rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl backdrop-blur-md relative ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none w-screen h-screen' : ''
      }`}
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-950/80 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          {/* Thumbnails Toggle */}
          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              showThumbnails
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {showThumbnails ? 'Hide Pages' : 'Show Pages'} ({numPages})
          </button>

          {/* Page Navigation */}
          <div className="flex items-center gap-1 bg-slate-800/90 rounded-xl p-1 border border-slate-700/80">
            <button
              onClick={() => setPageNum((p) => Math.max(1, p - 1))}
              disabled={pageNum <= 1}
              className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-2 text-xs font-medium text-slate-300">
              <span className="font-bold text-white">{pageNum}</span> / {numPages}
            </div>
            <button
              onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
              disabled={pageNum >= numPages}
              className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Zoom & Rotation Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800/90 rounded-xl p-1 border border-slate-700/80">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-mono font-semibold text-slate-300 min-w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
            title="Rotate 90° Clockwise"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handlePrint}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200"
            title="Print PDF"
          >
            <Printer className="w-4 h-4" /> Print
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-semibold text-xs text-slate-200"
              title="Extended Format Exports"
            >
              Export As <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showExportMenu && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1.5 z-50 text-xs backdrop-blur-lg"
                onMouseLeave={() => setShowExportMenu(false)}
              >
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Extended Converters
                </div>
                <button
                  onClick={handleExportPptx}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-800 text-slate-200 hover:text-white"
                >
                  <Presentation className="w-4 h-4 text-orange-400" />
                  <div>
                    <div className="font-semibold">PowerPoint Deck (.pptx)</div>
                    <div className="text-[10px] text-slate-400">High-res slide for each page</div>
                  </div>
                </button>
                <button
                  onClick={handleExportCbz}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-800 text-slate-200 hover:text-white"
                >
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-semibold">Comic Book (.cbz)</div>
                    <div className="text-[10px] text-slate-400">Packaged reader archive</div>
                  </div>
                </button>
                <button
                  onClick={handleExportSvg}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-800 text-slate-200 hover:text-white"
                >
                  <FileCode className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="font-semibold">Vector SVG (.svg)</div>
                    <div className="text-[10px] text-slate-400">Pure scalable graphics (p.{pageNum})</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    setShowResizeModal(true);
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-800 text-slate-200 hover:text-white"
                >
                  <Scaling className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="font-semibold">Resize / Scale Pages</div>
                    <div className="text-[10px] text-slate-400">Scale to A4, Letter, or % size</div>
                  </div>
                </button>
                {visualFilter !== 'none' && (
                  <button
                    onClick={handleExportFilteredPdf}
                    className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-indigo-600/30 text-indigo-300 border-t border-slate-800 mt-1"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="font-semibold">Save Filtered PDF</div>
                      <div className="text-[10px] text-indigo-300/80">With {visualFilter} applied</div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white shadow-md shadow-indigo-600/30"
            title="Download PDF"
          >
            <Download className="w-4 h-4" /> Download
          </button>

          {/* Fullscreen Button - Placed inline to the side so it never overlaps other controls */}
          <button
            onClick={toggleFullscreen}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all shrink-0 ${
              isFullscreen
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 shadow-lg shadow-amber-500/10'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold">Exit Fullscreen (Esc)</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold hidden sm:inline">Fullscreen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* PDFCraft Quick Action Bar - Instant Hand-off to Editing Tools */}
      {onOpenWithTool && (
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-950/40 border-b border-indigo-900/40 overflow-x-auto text-xs scrollbar-none shrink-0">
          <span className="text-indigo-300 font-semibold uppercase tracking-wider shrink-0 text-[11px]">
            PDFCraft Tools:
          </span>
          <button
            onClick={() => handleOpenTool('edit-pdf')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700/60 transition-all shrink-0"
          >
            <FileEdit className="w-3.5 h-3.5 text-indigo-400" /> Edit & Annotate
          </button>
          <button
            onClick={() => handleOpenTool('compress-pdf')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700/60 transition-all shrink-0"
          >
            <Minimize2 className="w-3.5 h-3.5 text-emerald-400" /> Compress
          </button>
          <button
            onClick={() => handleOpenTool('sign-pdf')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700/60 transition-all shrink-0"
          >
            <PenTool className="w-3.5 h-3.5 text-purple-400" /> Sign
          </button>
          <button
            onClick={() => handleOpenTool('split-pdf')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700/60 transition-all shrink-0"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" /> Split Pages
          </button>
          <button
            onClick={() => handleOpenTool('ocr-pdf')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700/60 transition-all shrink-0"
          >
            <ScanText className="w-3.5 h-3.5 text-sky-400" /> OCR Text
          </button>
        </div>
      )}

      {/* Visual Filters & Pre-Processing Bar (Feature 6) */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-slate-900/90 border-b border-slate-800 overflow-x-auto text-xs shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] mr-1">
            Visual Filter:
          </span>
          <button
            onClick={() => setVisualFilter('none')}
            className={`px-2.5 py-1 rounded-lg border transition-all ${
              visualFilter === 'none'
                ? 'bg-slate-700 border-slate-500 text-white font-semibold shadow-sm'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Normal
          </button>
          <button
            onClick={() => setVisualFilter('scan-enhance')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all ${
              visualFilter === 'scan-enhance'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold shadow-sm'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
            title="Whiten paper background and enhance ink contrast"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Scan Enhancer
          </button>
          <button
            onClick={() => setVisualFilter('invert')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all ${
              visualFilter === 'invert'
                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-semibold shadow-sm'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
            title="Invert colors for night reading"
          >
            <Moon className="w-3.5 h-3.5 text-indigo-400" /> Dark Mode
          </button>
          <button
            onClick={() => setVisualFilter('dither')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all ${
              visualFilter === 'dither'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold shadow-sm'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
            title="1-bit Floyd-Steinberg legal document dithering"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" /> 1-Bit Dither
          </button>
        </div>

        {visualFilter !== 'none' && (
          <button
            onClick={handleExportFilteredPdf}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 transition-all shrink-0 ml-auto"
          >
            <Download className="w-3.5 h-3.5" /> Save Filtered PDF
          </button>
        )}
      </div>

      {/* Conversion / Processing Status Alert */}
      {convertingStatus && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold shadow-inner animate-pulse shrink-0">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{convertingStatus}</span>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 flex overflow-hidden min-h-[500px] relative">
        {/* Thumbnails Sidebar */}
        {showThumbnails && (
          <div className="w-36 sm:w-44 bg-slate-950/70 border-r border-slate-800 p-3 overflow-y-auto space-y-3 shrink-0 scrollbar-thin">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Page Thumbnails
            </div>
            {thumbnails.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-indigo-400" />
                Loading...
              </div>
            ) : (
              thumbnails.map((thumb, idx) => {
                const p = idx + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPageNum(p)}
                    className={`w-full group text-left rounded-xl overflow-hidden border-2 transition-all p-1 ${
                      pageNum === p
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20'
                        : 'border-slate-800 hover:border-slate-600 bg-slate-900/60'
                    }`}
                  >
                    <img src={thumb} alt={`Page ${p}`} className="w-full h-auto rounded-lg shadow-sm" />
                    <div className="text-center text-[11px] font-semibold text-slate-400 group-hover:text-white mt-1">
                      Page {p}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Canvas Display - Fixed height overflow:auto with m-auto centering without clipping (Issue 3) */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-950/40 relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400 py-20 min-h-full">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              <span className="text-sm font-medium">Opening PDF Document...</span>
            </div>
          ) : error ? (
            <div className="p-6 max-w-md bg-red-950/50 border border-red-800/80 rounded-2xl text-red-200 text-center m-auto">
              <p className="font-bold mb-1">Failed to Open PDF</p>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : (
            <div className="min-w-full min-h-full flex p-2 m-auto w-max h-max">
              <div className="shadow-2xl rounded-xl overflow-hidden border border-slate-700/50 bg-white m-auto">
                <canvas ref={canvasRef} className="block max-w-none" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PDF Resize / Scale / Target File Size Modal */}
      {showResizeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Scaling className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">Resize, Enlarge & Compress PDF</h3>
              </div>
              <button
                onClick={() => setShowResizeModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {pdfProcessedResult ? (
              <div className="space-y-4 animate-pop-in">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold">PDF Ready for Verification</span>
                  </div>
                  <span className="font-mono font-bold">{formatBytes(pdfProcessedResult.size)}</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center space-y-1.5">
                  <div className="text-sm font-semibold text-white truncate">{pdfProcessedResult.filename}</div>
                  <div className="text-xs text-slate-400 font-mono">
                    Original: {formatBytes(file.size)} → Output: {formatBytes(pdfProcessedResult.size)}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => setPdfProcessedResult(null)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    ← Adjust Options
                  </button>
                  <button
                    onClick={() => {
                      const url = URL.createObjectURL(pdfProcessedResult.blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = pdfProcessedResult.filename;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download ({formatBytes(pdfProcessedResult.size)})</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
            {/* Current Document Size */}
            <div className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <span>Current PDF Document:</span>
              <span className="font-mono text-slate-200 font-semibold">
                {formatBytes(file.size)} ({file.size.toLocaleString()} bytes)
              </span>
            </div>

            {/* Mode Selector: Exact File Size vs Paper Format vs Scale Factor */}
            <div className="flex rounded-xl bg-slate-800 p-1 border border-slate-700 text-xs">
              <button
                onClick={() => setResizeMode('file-size')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                  resizeMode === 'file-size' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Target File Size (KB/MB)
              </button>
              <button
                onClick={() => setResizeMode('scale')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                  resizeMode === 'scale' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Scale Factor (%)
              </button>
              <button
                onClick={() => setResizeMode('paper')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                  resizeMode === 'paper' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Paper Size
              </button>
            </div>

            {resizeMode === 'file-size' ? (
              <div className="space-y-3">
                {/* Target Size Presets */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
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
                      const isSel = targetSizeVal === p.val && targetSizeUnit === p.unit;
                      return (
                        <button
                          key={`${p.val}${p.unit}`}
                          onClick={() => {
                            setTargetSizeVal(p.val);
                            setTargetSizeUnit(p.unit as any);
                          }}
                          className={`py-1.5 rounded-lg border font-mono transition-all text-center ${
                            isSel
                              ? 'bg-indigo-600 text-white font-bold border-indigo-400 shadow-sm'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {p.val} {p.unit}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Target Input */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">
                    Custom Target PDF Size:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      value={targetSizeVal}
                      onChange={(e) => setTargetSizeVal(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
                    />
                    <select
                      value={targetSizeUnit}
                      onChange={(e) => setTargetSizeUnit(e.target.value as any)}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-sm font-bold focus:outline-none focus:border-indigo-500"
                    >
                      <option value="KB">KB</option>
                      <option value="MB">MB</option>
                    </select>
                  </div>
                </div>

                {/* Status Pill: Compress vs Enlarge */}
                {(() => {
                  const curBytes = file.size;
                  const targetBytes = parseSizeToBytes(targetSizeVal, targetSizeUnit);
                  const isEnlarge = targetBytes > curBytes;
                  return (
                    <div
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        isEnlarge
                          ? 'bg-purple-950/40 border-purple-800/60 text-purple-300'
                          : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      }`}
                    >
                      <span>
                        {isEnlarge ? '📈 Enlarge PDF file size to' : '🗜️ Compress PDF file size to'}:
                      </span>
                      <span className="font-mono font-bold">
                        {targetSizeVal} {targetSizeUnit} ({isEnlarge ? `+${formatBytes(targetBytes - curBytes)}` : `-${formatBytes(curBytes - targetBytes)}`})
                      </span>
                    </div>
                  );
                })()}

                <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  💡 <b>Portal Requirements:</b> If an application portal requires a minimum size (e.g. 500 KB), entering 500 KB safely pads the PDF. If it requires a maximum size, it compresses the document.
                </div>
              </div>
            ) : resizeMode === 'paper' ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">Choose Paper Format:</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                  {([
                    { id: 'A4', label: 'A4', sub: '210×297mm' },
                    { id: 'Letter', label: 'Letter', sub: '8.5×11"' },
                    { id: 'Legal', label: 'Legal', sub: '8.5×14"' },
                    { id: 'A3', label: 'A3 (2x A4)', sub: '297×420mm' },
                    { id: 'Tabloid', label: 'Tabloid', sub: '11×17"' }
                  ] as const).map((paper) => (
                    <button
                      key={paper.id}
                      onClick={() => setResizePaper(paper.id)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        resizePaper === paper.id
                          ? 'border-indigo-500 bg-indigo-500/20 text-white font-bold shadow-sm'
                          : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-semibold">{paper.label}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{paper.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Scale & Enlarge Factor (%):
                </label>
                <div className="grid grid-cols-6 gap-1.5 text-xs font-mono">
                  {[0.5, 0.75, 1.25, 1.5, 2.0, 3.0].map((sf) => (
                    <button
                      key={sf}
                      onClick={() => setResizeScale(sf)}
                      className={`py-2 rounded-xl border text-center transition-all ${
                        resizeScale === sf
                          ? 'border-indigo-500 bg-indigo-500/20 text-white font-bold'
                          : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600'
                      }`}
                      title={sf > 1 ? `Enlarge pages to ${Math.round(sf * 100)}%` : `Shrink pages to ${Math.round(sf * 100)}%`}
                    >
                      {Math.round(sf * 100)}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowResizeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteResizePdf}
                disabled={resizingPdf}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all"
              >
                {resizingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {resizeMode === 'file-size'
                  ? parseSizeToBytes(targetSizeVal, targetSizeUnit) > file.size
                    ? `Enlarge PDF to ${targetSizeVal} ${targetSizeUnit}`
                    : `Compress PDF to ≤ ${targetSizeVal} ${targetSizeUnit}`
                  : 'Download Resized PDF'}
              </button>
            </div>
          </>
        )}
          </div>
        </div>
      )}
    </div>
  );
};
