import React, { useState, useEffect, useRef } from 'react';
import {
  Download, RotateCcw, Maximize2, Minimize2, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, CheckCircle2, FileText, Archive, Image as ImageIcon,
  Copy, Check, Loader2, ExternalLink
} from 'lucide-react';
import JSZip from 'jszip';
import { renderPdfPage, formatBytes, downloadBlob } from '../utils/pdfEngine';

export interface ResultVerificationCardProps {
  result: { blob: Blob; filename: string };
  onReset: () => void;
  onOpenInViewer?: (file: File) => void;
  compressStats?: { orig: number; now: number; method: string } | null;
  successMessage?: string;
}

interface ZipEntryInfo {
  name: string;
  size: number;
}

export const ResultVerificationCard: React.FC<ResultVerificationCardProps> = ({
  result,
  onReset,
  onOpenInViewer,
  compressStats,
  successMessage
}) => {
  const isPdf =
    result.blob.type === 'application/pdf' ||
    result.filename.toLowerCase().endsWith('.pdf');
  const isImage =
    result.blob.type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(result.filename);
  const isZip =
    result.filename.toLowerCase().endsWith('.zip') ||
    result.blob.type.includes('zip');
  const isText =
    result.blob.type.startsWith('text/') ||
    /\.(txt|json|csv|yaml|yml|xml|md)$/i.test(result.filename);

  // PDF Preview State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageDim, setPageDim] = useState<{ widthPt: number; heightPt: number } | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [loadingPage, setLoadingPage] = useState<boolean>(false);
  const [thumbnails, setThumbnails] = useState<Array<{ page: number; url: string }>>([]);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenCanvasRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Image Preview State
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imgDim, setImgDim] = useState<{ width: number; height: number } | null>(null);

  // Text Preview State
  const [textContent, setTextContent] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // ZIP Preview State
  const [zipFiles, setZipFiles] = useState<ZipEntryInfo[]>([]);
  const [loadingZip, setLoadingZip] = useState<boolean>(false);

  // 1. Setup PDF Page 1 and Total Pages
  useEffect(() => {
    if (!isPdf) return;

    let cancelled = false;
    setLoadingPage(true);

    const loadInitialPdf = async () => {
      try {
        const renderWidth = Math.round(620 * zoom);
        const res = await renderPdfPage(result.blob, currentPage, renderWidth);
        if (cancelled) return;

        setTotalPages(res.numPages);
        setPageDim({ widthPt: Math.round(res.widthPt), heightPt: Math.round(res.heightPt) });

        if (canvasContainerRef.current) {
          canvasContainerRef.current.innerHTML = '';
          res.canvas.style.width = '100%';
          res.canvas.style.maxWidth = `${renderWidth}px`;
          res.canvas.style.height = 'auto';
          res.canvas.style.display = 'block';
          res.canvas.style.borderRadius = '8px';
          res.canvas.style.boxShadow = '0 12px 30px -6px rgba(0, 0, 0, 0.35)';
          canvasContainerRef.current.appendChild(res.canvas);
        }

        if (isFullscreen && fullscreenCanvasRef.current) {
          fullscreenCanvasRef.current.innerHTML = '';
          const fullRes = await renderPdfPage(result.blob, currentPage, Math.round(920 * zoom));
          if (!cancelled && fullscreenCanvasRef.current) {
            fullRes.canvas.style.maxWidth = '100%';
            fullRes.canvas.style.height = 'auto';
            fullRes.canvas.style.borderRadius = '8px';
            fullscreenCanvasRef.current.appendChild(fullRes.canvas);
          }
        }
      } catch (err) {
        console.error('Failed to render PDF page for verification:', err);
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    };

    loadInitialPdf();

    return () => {
      cancelled = true;
    };
  }, [result.blob, isPdf, currentPage, zoom, isFullscreen]);

  // Generate lightweight thumbnails for quick jumping
  useEffect(() => {
    if (!isPdf || totalPages <= 1) return;

    let cancelled = false;
    const generateThumbs = async () => {
      const thumbs: Array<{ page: number; url: string }> = [];
      const count = Math.min(totalPages, 16);
      for (let p = 1; p <= count; p++) {
        if (cancelled) return;
        try {
          const res = await renderPdfPage(result.blob, p, 90);
          const blob = await new Promise<Blob | null>((r) => res.canvas.toBlob((b) => r(b), 'image/jpeg', 0.65));
          if (blob && !cancelled) {
            thumbs.push({ page: p, url: URL.createObjectURL(blob) });
          }
        } catch {
          // ignore single thumbnail failure
        }
      }
      if (!cancelled) setThumbnails(thumbs);
    };

    generateThumbs();

    return () => {
      cancelled = true;
      thumbnails.forEach((t) => URL.revokeObjectURL(t.url));
    };
  }, [result.blob, isPdf, totalPages]);

  // 2. Setup Image Preview
  useEffect(() => {
    if (!isImage) return;

    const url = URL.createObjectURL(result.blob);
    setImageUrl(url);

    const img = new Image();
    img.src = url;
    img.onload = () => {
      setImgDim({ width: img.naturalWidth, height: img.naturalHeight });
    };

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [result.blob, isImage]);

  // 3. Setup Text Content
  useEffect(() => {
    if (!isText) return;

    let cancelled = false;
    result.blob.text().then((txt) => {
      if (!cancelled) setTextContent(txt);
    });

    return () => {
      cancelled = true;
    };
  }, [result.blob, isText]);

  // 4. Setup ZIP archive preview
  useEffect(() => {
    if (!isZip) return;

    let cancelled = false;
    setLoadingZip(true);
    JSZip.loadAsync(result.blob)
      .then((zip) => {
        if (cancelled) return;
        const list: ZipEntryInfo[] = [];
        zip.forEach((path, entry) => {
          if (!entry.dir) {
            list.push({
              name: path,
              size: (entry as any)._data?.uncompressedSize || 0
            });
          }
        });
        setZipFiles(list);
      })
      .catch((e) => console.error('Failed to inspect zip:', e))
      .finally(() => {
        if (!cancelled) setLoadingZip(false);
      });

    return () => {
      cancelled = true;
    };
  }, [result.blob, isZip]);

  const handleDownload = () => {
    downloadBlob(result.blob, result.filename);
  };

  const handleOpenViewer = () => {
    if (onOpenInViewer) {
      const f = new File([result.blob], result.filename, { type: result.blob.type });
      onOpenInViewer(f);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const handleDownloadSingleZipFile = async (name: string) => {
    try {
      const zip = await JSZip.loadAsync(result.blob);
      const entry = zip.file(name);
      if (entry) {
        const bytes = await entry.async('uint8array');
        const b = new Blob([bytes as any]);
        downloadBlob(b, name.split('/').pop() || name);
      }
    } catch (e) {
      console.error('Failed to extract single file from zip:', e);
    }
  };

  return (
    <div className="space-y-5 animate-pop-in">
      {/* Verification Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-purple-500/10 border border-emerald-500/30 dark:border-emerald-500/20 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-500/40">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading">
                Ready to Verify &amp; Download
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {successMessage || 'Processing finished successfully. Review your output before downloading.'}
            </p>
          </div>

          {/* Primary Top Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleDownload}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              <span>Download File</span>
              <span className="text-xs font-mono font-medium opacity-90 px-1.5 py-0.5 rounded bg-emerald-700/60">
                {formatBytes(result.blob.size)}
              </span>
            </button>
            <button
              onClick={onReset}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Adjust options and re-run tool"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Adjust &amp; Re-run</span>
            </button>
          </div>
        </div>

        {/* Compression Statistics pill if applicable */}
        {compressStats && (
          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-3 text-xs flex-wrap font-sans">
            <div className="text-slate-600 dark:text-slate-300">
              File Size: <b>{formatBytes(compressStats.orig)}</b> → <b className="text-emerald-600 dark:text-emerald-400">{formatBytes(compressStats.now)}</b>
            </div>
            <div className="font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              {compressStats.orig > compressStats.now
                ? `Saved ${Math.max(0, Math.round((1 - compressStats.now / compressStats.orig) * 100))}%`
                : compressStats.now > compressStats.orig
                ? `Enlarged +${formatBytes(compressStats.now - compressStats.orig)}`
                : 'Optimal Size Kept'}
            </div>
          </div>
        )}
      </div>

      {/* Main Interactive Verification Stage */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900/60 dark:bg-slate-950/80 shadow-xl overflow-hidden">
        {/* Verification Stage Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 border-b border-slate-800 text-slate-200 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {isPdf ? (
              <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
            ) : isImage ? (
              <ImageIcon className="w-4 h-4 text-pink-400 shrink-0" />
            ) : isZip ? (
              <Archive className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="font-semibold truncate max-w-[14rem] sm:max-w-xs text-white" title={result.filename}>
              {result.filename}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono shrink-0">
              {formatBytes(result.blob.size)}
            </span>
          </div>

          {/* Interactive Page / Zoom Controls for PDF */}
          {isPdf && (
            <div className="flex items-center gap-2">
              {/* Page Navigator */}
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  type="button"
                  disabled={currentPage <= 1 || loadingPage}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 font-mono text-[11px] font-semibold text-slate-200 select-none">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages || loadingPage}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  type="button"
                  disabled={zoom <= 0.6}
                  onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.2) * 10) / 10))}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 font-mono text-[11px] font-semibold text-slate-300">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  disabled={zoom >= 2.0}
                  onClick={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.2) * 10) / 10))}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Fullscreen Modal Button */}
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Fullscreen Inspection View"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              {onOpenInViewer && (
                <button
                  type="button"
                  onClick={handleOpenViewer}
                  className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-semibold text-xs shadow-sm transition-all"
                  title="Open file in full-featured reader"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Full Viewer</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 1. PDF Verification Viewport */}
        {isPdf && (
          <div className="p-4 sm:p-6 bg-slate-950/60 flex flex-col items-center justify-center min-h-[360px] relative overflow-hidden">
            {loadingPage && (
              <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center z-10 text-white gap-2 text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                <span>Rendering Page {currentPage}…</span>
              </div>
            )}

            {/* Rendered Page Canvas Container */}
            <div
              ref={canvasContainerRef}
              className="transition-transform duration-200 flex items-center justify-center max-w-full overflow-x-auto p-1"
            />

            {pageDim && (
              <div className="mt-3 text-[11px] font-mono text-slate-400 flex items-center gap-3">
                <span>Page Size: {pageDim.widthPt} × {pageDim.heightPt} pt</span>
                <span>•</span>
                <span>Aspect: {(pageDim.heightPt / pageDim.widthPt).toFixed(2)}</span>
              </div>
            )}

            {/* Thumbnail Strip for fast navigation */}
            {thumbnails.length > 1 && (
              <div className="w-full mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {thumbnails.map((t) => (
                  <button
                    key={t.page}
                    type="button"
                    onClick={() => setCurrentPage(t.page)}
                    className={`relative shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                      currentPage === t.page
                        ? 'border-indigo-500 scale-105 shadow-md shadow-indigo-500/30'
                        : 'border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-600'
                    }`}
                  >
                    <img src={t.url} alt={`Thumbnail page ${t.page}`} className="h-16 w-auto object-contain bg-white" />
                    <span className="absolute bottom-0 inset-x-0 bg-slate-900/90 text-[9px] font-mono text-center text-white py-0.5">
                      {t.page}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. Image Verification Viewport */}
        {isImage && imageUrl && (
          <div className="p-4 sm:p-6 bg-slate-950/60 flex flex-col items-center justify-center min-h-[320px]">
            <img
              src={imageUrl}
              alt="Result Preview"
              className="max-h-[460px] max-w-full rounded-xl shadow-2xl border border-slate-700/80 object-contain bg-black/20"
            />
            {imgDim && (
              <div className="mt-3 text-xs font-mono text-slate-400 flex items-center gap-2">
                <span>Resolution: <b className="text-slate-200">{imgDim.width} × {imgDim.height} px</b></span>
                <span>•</span>
                <span>Size: <b className="text-slate-200">{formatBytes(result.blob.size)}</b></span>
              </div>
            )}
          </div>
        )}

        {/* 3. ZIP Archive Contents Viewport */}
        {isZip && (
          <div className="p-4 sm:p-6 bg-slate-950/60 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
              <span>Files Inside Archive ({zipFiles.length})</span>
              <span>Individual Size</span>
            </div>
            {loadingZip ? (
              <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Reading archive contents…</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {zipFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate mr-3">
                      <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="font-mono text-slate-200 truncate">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-slate-400 font-mono text-[11px]">{formatBytes(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => handleDownloadSingleZipFile(f.name)}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold text-[11px] underline"
                      >
                        Extract
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Text Verification Viewport */}
        {isText && textContent && (
          <div className="p-4 sm:p-6 bg-slate-950/60 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 uppercase tracking-wider">
                Document Text Content ({textContent.length} chars)
              </span>
              <button
                type="button"
                onClick={handleCopyText}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy All'}
              </button>
            </div>
            <textarea
              readOnly
              rows={12}
              value={textContent}
              className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 focus:outline-none resize-none leading-relaxed"
            />
          </div>
        )}

        {/* Bottom Prominent Download Section */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            <span>Verified output file is stored safely locally in memory. Click download to save to your device.</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleDownload}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              <span>Download {result.filename}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Inspection Modal for Detailed Verification */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-fade-in">
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-white">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span className="font-bold text-sm truncate max-w-sm">{result.filename}</span>
              <span className="text-xs text-slate-400 font-mono">({formatBytes(result.blob.size)})</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Page navigation */}
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono text-xs font-semibold text-slate-200">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>

              <button
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                title="Exit Fullscreen"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Fullscreen Page Stage */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <div ref={fullscreenCanvasRef} className="shadow-2xl max-w-full flex justify-center" />
          </div>
        </div>
      )}
    </div>
  );
};
