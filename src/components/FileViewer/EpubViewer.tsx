import React, { useEffect, useState, useRef } from 'react';
import {
  BookOpen, ChevronLeft, ChevronRight, Loader2,
  FileText, Maximize2, Minimize2, ZoomIn, ZoomOut
} from 'lucide-react';
import { parseEpub, convertEpubToPdf, type EpubBook } from '../../utils/epubConverter';

interface EpubViewerProps {
  file: File | Blob;
  fileName: string;
}

export const EpubViewer: React.FC<EpubViewerProps> = ({ file, fileName }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [book, setBook] = useState<EpubBook | null>(null);
  const [currentChapterIdx, setCurrentChapterIdx] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [converting, setConverting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [fontSize, setFontSize] = useState<number>(16);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const parsed = await parseEpub(file);
        if (isCancelled) return;
        setBook(parsed);
        setCurrentChapterIdx(0);
      } catch (err: any) {
        if (!isCancelled) {
          console.error('EPUB parse error:', err);
          setError(err?.message || 'Failed to load EPUB file.');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [file]);

  const handleNextChapter = () => {
    if (!book) return;
    setCurrentChapterIdx((prev) => Math.min(book.chapters.length - 1, prev + 1));
  };

  const handlePrevChapter = () => {
    setCurrentChapterIdx((prev) => Math.max(0, prev - 1));
  };

  const handleConvertToPdf = async () => {
    try {
      setConverting(true);
      const pdfBytes = await convertEpubToPdf(file);
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.replace(/\.epub$/i, '')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`EPUB to PDF conversion failed: ${err?.message || err}`);
    } finally {
      setConverting(false);
    }
  };

  const toggleFullscreen = () => {
    if (!rootRef.current) return;
    if (!document.fullscreenElement) {
      rootRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentChapter = book?.chapters[currentChapterIdx];

  return (
    <div
      ref={rootRef}
      className={`flex flex-col h-full bg-slate-900/90 text-white rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl backdrop-blur-md relative ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none w-screen h-screen' : ''
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-slate-950/80 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-100 truncate text-sm sm:text-base">
                {book?.title || fileName}
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                E-BOOK
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {book ? `By ${book.author} • Chapter ${currentChapterIdx + 1} of ${book.chapters.length}` : fileName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Chapter Navigation */}
          {book && book.chapters.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700/80 rounded-xl p-1">
              <button
                onClick={handlePrevChapter}
                disabled={currentChapterIdx <= 0}
                className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 transition-colors"
                title="Previous Chapter"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono px-2 text-slate-300 min-w-[50px] text-center">
                {currentChapterIdx + 1} / {book.chapters.length}
              </span>
              <button
                onClick={handleNextChapter}
                disabled={currentChapterIdx >= book.chapters.length - 1}
                className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 transition-colors"
                title="Next Chapter"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Font Size */}
          <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700/80 rounded-xl p-1">
            <button
              onClick={() => setFontSize((f) => Math.max(12, f - 2))}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200"
              title="Decrease Font Size"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-slate-300">{fontSize}px</span>
            <button
              onClick={() => setFontSize((f) => Math.min(28, f + 2))}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200"
              title="Increase Font Size"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Convert to PDF Button */}
          <button
            onClick={handleConvertToPdf}
            disabled={converting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-xs text-white shadow-md shadow-purple-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            title="Convert this EPUB e-book to a formatted PDF"
          >
            {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <span className="hidden sm:inline">{converting ? 'Converting...' : 'Convert to PDF'}</span>
          </button>

          {/* Fullscreen Button */}
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

      {/* Reader Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-12 bg-slate-950/60">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-sm">Unpacking and rendering EPUB e-book...</span>
          </div>
        ) : error ? (
          <div className="p-6 max-w-md mx-auto my-12 bg-red-950/60 border border-red-800 rounded-2xl text-center text-red-200">
            <p className="font-bold mb-1">E-Book Error</p>
            <p className="text-xs text-red-300">{error}</p>
          </div>
        ) : currentChapter ? (
          <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-12 shadow-2xl leading-relaxed text-slate-200">
            <h2 className="text-2xl font-black text-white mb-6 pb-3 border-b border-slate-800">
              {currentChapter.title}
            </h2>
            <div
              style={{ fontSize: `${fontSize}px` }}
              className="prose prose-invert max-w-none space-y-4 whitespace-pre-wrap font-serif"
            >
              {currentChapter.plainText}
            </div>

            {/* Bottom chapter navigation */}
            <div className="flex items-center justify-between pt-8 border-t border-slate-800 mt-12">
              <button
                onClick={handlePrevChapter}
                disabled={currentChapterIdx <= 0}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold text-slate-200 flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Previous Chapter
              </button>

              <span className="text-xs text-slate-400 font-mono">
                {currentChapterIdx + 1} / {book?.chapters.length}
              </span>

              <button
                onClick={handleNextChapter}
                disabled={!book || currentChapterIdx >= book.chapters.length - 1}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold text-slate-200 flex items-center gap-1.5"
              >
                Next Chapter <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-slate-400">No chapters found in this e-book.</p>
        )}
      </div>
    </div>
  );
};
