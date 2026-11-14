import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download, Printer,
  FileEdit, Minimize2, Maximize2, PenTool, Scissors, ScanText, Loader2
} from 'lucide-react';
import { pdfjsLib } from '../../utils/pdfjs';

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
  }, [pdfDoc, pageNum, scale, rotation]);

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
    </div>
  );
};
