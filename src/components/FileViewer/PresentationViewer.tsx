import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Presentation, ChevronLeft, ChevronRight, Download, Loader2,
  AlertTriangle, FileText, ZoomIn, ZoomOut, Maximize2, Minimize2,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { init } from 'pptx-preview';
import { extractPPTXTextFallback, sanitizePptxArchive, type PPTXSlideText } from '../../utils/pptxViewer';

interface PresentationViewerProps {
  file: File | Blob;
  fileName: string;
}

export const PresentationViewer: React.FC<PresentationViewerProps> = ({ file, fileName }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previewerRef = useRef<any>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [renderError, setRenderError] = useState<string>('');
  const [showErrorDetails, setShowErrorDetails] = useState<boolean>(false);
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [fallbackSlides, setFallbackSlides] = useState<PPTXSlideText[]>([]);

  const [currentSlideIdx, setCurrentSlideIdx] = useState<number>(0);
  const [totalSlides, setTotalSlides] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [slideDimensions, setSlideDimensions] = useState<{ width: number; height: number }>({
    width: 960,
    height: 540
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Fullscreen event listener to sync Esc key and external exit
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

  // Initialize and render PPTX using pptx-preview with text-only fallback
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError('');
    setRenderError('');
    setIsFallback(false);
    setFallbackSlides([]);
    setCurrentSlideIdx(0);

    const loadPptx = async () => {
      try {
        const rawBuffer = await file.arrayBuffer();
        if (isCancelled) return;

        // Automatically sanitize dead XML overrides from PowerPoint/Keynote/Canva exports
        const buffer = await sanitizePptxArchive(rawBuffer);
        if (isCancelled) return;

        // Container is guaranteed mounted in DOM
        if (containerRef.current) {
          containerRef.current.innerHTML = '';

          // Determine responsive width and height (16:9 aspect ratio)
          const availableWidth = containerRef.current.parentElement?.clientWidth || window.innerWidth;
          const slideWidth = Math.max(300, Math.min(availableWidth - 32, 960));
          const slideHeight = Math.round(slideWidth * (9 / 16));
          setSlideDimensions({ width: slideWidth, height: slideHeight });

          try {
            const previewer = init(containerRef.current, {
              mode: 'slide',
              width: slideWidth,
              height: slideHeight
            });

            await previewer.preview(buffer);
            if (isCancelled) return;

            const count = previewer.slideCount || 0;
            if (count === 0) {
              throw new Error('No valid slides could be parsed by pptx-preview.');
            }

            previewerRef.current = previewer;
            setTotalSlides(count);
            setCurrentSlideIdx(previewer.currentIndex || 0);
            setLoading(false);
            return;
          } catch (renderErr: any) {
            console.error('PPTX pptx-preview visual rendering failed:', renderErr);
            const errString = renderErr?.stack || renderErr?.message || String(renderErr);
            setRenderError(errString);
          }
        }

        // Fallback: If pptx-preview fails or throws, fall back to text-only view using JSZip
        const extracted = await extractPPTXTextFallback(buffer);
        if (isCancelled) return;

        if (extracted.length > 0) {
          setIsFallback(true);
          setFallbackSlides(extracted);
          setTotalSlides(extracted.length);
          setCurrentSlideIdx(0);
        } else {
          setError('Could not extract slides from presentation file.');
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('PPTX presentation file load error:', err);
          try {
            const extracted = await extractPPTXTextFallback(file);
            if (extracted.length > 0) {
              setIsFallback(true);
              setFallbackSlides(extracted);
              setTotalSlides(extracted.length);
              setCurrentSlideIdx(0);
              return;
            }
          } catch {
            // ignore
          }
          setError(err?.message || 'Failed to load PowerPoint presentation.');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadPptx();

    return () => {
      isCancelled = true;
      if (previewerRef.current && typeof previewerRef.current.destroy === 'function') {
        try {
          previewerRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [file]);

  const handleNextSlide = () => {
    if (isFallback) {
      setCurrentSlideIdx((prev) => Math.min(fallbackSlides.length - 1, prev + 1));
    } else if (previewerRef.current) {
      previewerRef.current.renderNextSlide();
      setCurrentSlideIdx(previewerRef.current.currentIndex || 0);
    }
  };

  const handlePrevSlide = () => {
    if (isFallback) {
      setCurrentSlideIdx((prev) => Math.max(0, prev - 1));
    } else if (previewerRef.current) {
      previewerRef.current.renderPreSlide();
      setCurrentSlideIdx(previewerRef.current.currentIndex || 0);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleDownload = () => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentFallbackSlide = fallbackSlides[currentSlideIdx];

  // Specific zoom step helper (50%, 100%, 140%, 200%)
  const zoomSteps = [0.5, 0.75, 1.0, 1.2, 1.4, 1.6, 2.0];
  const handleZoomIn = () => {
    setScale((curr) => {
      const next = zoomSteps.find((s) => s > curr + 0.05);
      return next !== undefined ? next : Math.min(2.5, Number((curr + 0.2).toFixed(1)));
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
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-slate-950/80 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-600 flex items-center justify-center text-white shadow-md shrink-0">
            <Presentation className="w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2 truncate">
              <span className="truncate">{fileName}</span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 shrink-0">
                {isFallback ? 'PPTX (Text View)' : 'PPTX Preview'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Slide {currentSlideIdx + 1} of {totalSlides}
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Slide Navigation & Counter */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 rounded-xl px-2 py-1">
            <button
              onClick={handlePrevSlide}
              disabled={currentSlideIdx <= 0}
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous Slide (←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono font-semibold px-2 text-slate-200 min-w-[50px] text-center select-none">
              {currentSlideIdx + 1} / {totalSlides}
            </span>

            <button
              onClick={handleNextSlide}
              disabled={currentSlideIdx >= totalSlides - 1}
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next Slide (→)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom controls (Issue 3: supporting 50%, 100%, 140%, 200%) */}
          {!isFallback && (
            <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700/80 rounded-xl p-1">
              <button
                onClick={handleZoomOut}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1.5 text-slate-300 min-w-[42px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 font-semibold text-xs text-white shadow-md shadow-orange-600/30 transition-all hover:scale-105 active:scale-95 shrink-0"
            title="Download PowerPoint Presentation"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
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

      {/* Main Slides Viewport Area - Fixed height with overflow:auto and top-left alignment */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-950/60 relative">
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 gap-3 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
            <span className="text-sm font-medium">Loading and rendering PowerPoint slides visually...</span>
          </div>
        )}

        {error ? (
          <div className="p-6 max-w-md mx-auto my-12 bg-red-950/60 border border-red-800 rounded-2xl text-center text-red-200">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-2" />
            <p className="font-bold mb-1">Presentation Error</p>
            <p className="text-xs text-red-300 mb-4">{error}</p>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Download file instead
            </button>
          </div>
        ) : isFallback ? (
          /* Text-only Fallback View with collapsible details box */
          <div className="max-w-2xl w-full mx-auto my-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col gap-4 animate-fade-in">
            <div className="flex flex-col gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="font-semibold">
                  Visual slide preview was not possible. Showing text-only extraction from slide XML:
                </span>
              </div>

              {/* Collapsible Error Details Box (Issue 1) */}
              {renderError && (
                <div className="mt-1 pt-2 border-t border-amber-500/20">
                  <button
                    type="button"
                    onClick={() => setShowErrorDetails((v) => !v)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline"
                  >
                    <span>{showErrorDetails ? 'Hide Error Details' : 'View Error Details'}</span>
                    {showErrorDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {showErrorDetails && (
                    <pre className="mt-2 p-2.5 bg-black/80 rounded-lg text-slate-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap max-h-48 border border-slate-800 select-text">
                      {renderError}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {currentFallbackSlide ? (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold uppercase text-orange-400 tracking-wider">
                    Slide {currentFallbackSlide.slideNumber} of {totalSlides}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                    {currentFallbackSlide.title}
                  </h2>
                </div>

                <div className="space-y-2.5 text-sm text-slate-200 leading-relaxed font-sans select-text">
                  {currentFallbackSlide.paragraphs.map((p, idx) => (
                    <p key={idx} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No content available for this slide.</p>
            )}

            {/* Bottom slide switcher */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-2">
              <button
                onClick={handlePrevSlide}
                disabled={currentSlideIdx <= 0}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-slate-200 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <span className="text-xs text-slate-400 font-mono">
                {currentSlideIdx + 1} / {totalSlides}
              </span>

              <button
                onClick={handleNextSlide}
                disabled={currentSlideIdx >= totalSlides - 1}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium text-slate-200 flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Primary Visual pptx-preview Container (Zoom & Scroll Bug Fixed via m-auto and top-left origin) */
          <div className="min-w-full min-h-full flex p-2 m-auto w-max h-max">
            <div
              style={{
                width: `${Math.round(slideDimensions.width * scale)}px`,
                height: `${Math.round(slideDimensions.height * scale)}px`,
                position: 'relative'
              }}
              className="m-auto transition-[width,height] duration-150"
            >
              <div
                style={{
                  width: `${slideDimensions.width}px`,
                  height: `${slideDimensions.height}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transition: 'transform 150ms ease-out'
                }}
                className="pptx-container rounded-2xl shadow-2xl overflow-hidden [&_.pptx-preview-wrapper]:!max-w-full [&_.pptx-preview-wrapper]:!rounded-xl [&_.pptx-preview-wrapper]:!shadow-2xl [&_.pptx-preview-wrapper-next]:!hidden [&_.pptx-preview-wrapper-pagination]:!hidden"
              >
                <div ref={containerRef} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
