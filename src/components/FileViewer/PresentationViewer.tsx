import React, { useEffect, useState } from 'react';
import {
  Presentation, ChevronLeft, ChevronRight, Download, Play, Pause,
  Image as ImageIcon, Loader2, Layers, MessageSquare
} from 'lucide-react';
import { parsePPTX } from '../../utils/pptxViewer';
import type { PPTXPresentation, PPTXSlide } from '../../utils/pptxViewer';

interface PresentationViewerProps {
  file: File | Blob;
  fileName: string;
}

export const PresentationViewer: React.FC<PresentationViewerProps> = ({ file, fileName }) => {
  const [presentation, setPresentation] = useState<PPTXPresentation | null>(null);
  const [currentSlideIdx, setCurrentSlideIdx] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showNotes, setShowNotes] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const parsed = await parsePPTX(file, fileName);
        if (isCancelled) return;
        setPresentation(parsed);
        setCurrentSlideIdx(0);
      } catch (err: any) {
        if (!isCancelled) {
          console.error('PPTX parse error:', err);
          setError(err?.message || 'Failed to parse PowerPoint presentation.');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [file, fileName]);

  // Slideshow auto-advance timer
  useEffect(() => {
    if (!isPlaying || !presentation || presentation.slides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlideIdx((curr) => (curr + 1) % presentation.slides.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isPlaying, presentation]);

  // Keyboard navigation (ArrowLeft / ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!presentation) return;
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        e.preventDefault();
        setCurrentSlideIdx((curr) => Math.min(presentation.slides.length - 1, curr + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlideIdx((curr) => Math.max(0, curr - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentation]);

  const handleDownload = () => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentSlide: PPTXSlide | undefined = presentation?.slides[currentSlideIdx];

  return (
    <div className="flex flex-col h-full bg-slate-900/90 text-white rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl backdrop-blur-md">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-red-600 flex items-center justify-center text-white shadow-md">
            <Presentation className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
              {fileName}
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                PowerPoint
              </span>
            </h3>
            {presentation && (
              <p className="text-xs text-slate-400">
                {presentation.slideCount} slides • Slide {currentSlideIdx + 1} of {presentation.slideCount}
              </p>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          {presentation && (
            <>
              {/* Slide Nav */}
              <div className="flex items-center gap-1 bg-slate-800/90 rounded-xl p-1 border border-slate-700/80">
                <button
                  onClick={() => setCurrentSlideIdx((curr) => Math.max(0, curr - 1))}
                  disabled={currentSlideIdx <= 0}
                  className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                  title="Previous Slide"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-xs font-semibold text-slate-300 min-w-16 text-center">
                  {currentSlideIdx + 1} / {presentation.slideCount}
                </span>
                <button
                  onClick={() =>
                    setCurrentSlideIdx((curr) => Math.min(presentation.slideCount - 1, curr + 1))
                  }
                  disabled={currentSlideIdx >= presentation.slideCount - 1}
                  className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                  title="Next Slide"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Slideshow button */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  isPlaying
                    ? 'bg-amber-600 border-amber-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </>
          )}

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 font-semibold text-xs text-white shadow-md shadow-orange-600/30"
          >
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 flex overflow-hidden min-h-[500px]">
        {/* Slide Rail */}
        {presentation && presentation.slides.length > 0 && (
          <div className="w-48 sm:w-56 bg-slate-950/70 border-r border-slate-800 p-3 overflow-y-auto space-y-2.5 shrink-0">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Slides ({presentation.slideCount})
            </div>
            {presentation.slides.map((s, idx) => (
              <button
                key={s.slideNumber}
                onClick={() => {
                  setCurrentSlideIdx(idx);
                  setIsPlaying(false);
                }}
                className={`w-full text-left p-2.5 rounded-xl border-2 transition-all group ${
                  currentSlideIdx === idx
                    ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/20'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                  <span className="text-orange-400">Slide {s.slideNumber}</span>
                  {s.images.length > 0 && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> {s.images.length}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300 font-medium truncate group-hover:text-white">
                  {s.title}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Current Slide Display Canvas */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-slate-950/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
              <span className="text-sm font-medium">Loading presentation slides...</span>
            </div>
          ) : error ? (
            <div className="p-6 max-w-md bg-red-950/60 border border-red-800 rounded-2xl text-center text-red-200">
              <p className="font-bold mb-1">Presentation Error</p>
              <p className="text-xs text-red-300">{error}</p>
            </div>
          ) : currentSlide ? (
            <div className="max-w-4xl w-full bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700/80 rounded-2xl p-6 sm:p-10 shadow-2xl relative flex flex-col min-h-[420px] justify-between">
              <div>
                {/* Slide Number Badge */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4" /> Slide {currentSlide.slideNumber} of{' '}
                    {presentation?.slideCount}
                  </span>
                  {currentSlide.notes && (
                    <button
                      onClick={() => setShowNotes(!showNotes)}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Notes
                    </button>
                  )}
                </div>

                {/* Slide Title */}
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-6 leading-tight">
                  {currentSlide.title}
                </h2>

                {/* Slide Paragraphs & Bullets */}
                <div className="space-y-3 mb-8">
                  {currentSlide.paragraphs.slice(1).map((para, pIdx) => (
                    <div key={pIdx} className="flex items-start gap-3 text-slate-200 text-sm sm:text-base">
                      <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 shrink-0" />
                      <span className="leading-relaxed">{para}</span>
                    </div>
                  ))}
                </div>

                {/* Embedded Slide Images */}
                {currentSlide.images.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    {currentSlide.images.map((img) => (
                      <div
                        key={img.id}
                        className="rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 p-2 shadow-lg"
                      >
                        <img
                          src={img.url}
                          alt={img.name}
                          className="w-full h-44 object-contain rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Speaker Notes Drawer */}
              {showNotes && currentSlide.notes && (
                <div className="mt-6 p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                  <span className="font-bold text-orange-300 block mb-1">Speaker Notes:</span>
                  {currentSlide.notes}
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-400 text-sm">No slides detected in this file.</div>
          )}
        </div>
      </div>
    </div>
  );
};
