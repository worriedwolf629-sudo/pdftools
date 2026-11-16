import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert, Search, MousePointer, ChevronLeft, ChevronRight,
  Loader2, X
} from 'lucide-react';
import {
  openPdfjs, searchPdfForRedactions, applyPdfRedactions,
  type RedactionTargetBox
} from '../../utils/pdfEngine';

interface RedactPdfToolProps {
  file: File;
  onRedactComplete: (blob: Blob, filename: string) => void;
  onError: (msg: string) => void;
}

export const RedactPdfTool: React.FC<RedactPdfToolProps> = ({
  file,
  onRedactComplete,
  onError
}) => {
  const [numPages, setNumPages] = useState<number>(1);
  const [curPage, setCurPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [searching, setSearching] = useState<boolean>(false);
  const [sanitizing, setSanitizing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Mode: 'search' vs 'draw'
  const [mode, setMode] = useState<'search' | 'draw'>('search');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRegex, setIsRegex] = useState<boolean>(false);

  // Redaction boxes across document
  const [redactions, setRedactions] = useState<RedactionTargetBox[]>([]);

  // Manual drawing state
  const [drawing, setDrawing] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const doc = await openPdfjs(file);
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        await renderPage(doc, 1);
      } catch (e: any) {
        if (!cancelled) onError(e?.message || 'Failed to load PDF for redaction');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (pdfDocRef.current?.loadingTask?.destroy) {
        void pdfDocRef.current.loadingTask.destroy();
      }
    };
  }, [file]);

  const renderPage = async (doc: any, pageNum: number) => {
    if (!doc || !canvasRef.current) return;
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    } catch (e) {
      console.error('Failed to render page for redaction:', e);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > numPages || !pdfDocRef.current) return;
    setCurPage(newPage);
    await renderPage(pdfDocRef.current, newPage);
  };

  // Search execution
  const handleSearchAndMark = async (customQuery?: string, customRegex?: boolean) => {
    const q = customQuery !== undefined ? customQuery : searchQuery;
    const rgx = customRegex !== undefined ? customRegex : isRegex;
    if (!q.trim()) return;

    try {
      setSearching(true);
      const matches = await searchPdfForRedactions(file, q, rgx);
      if (matches.length === 0) {
        onError(`No matches found for "${q}".`);
        return;
      }
      setRedactions((prev) => [...prev, ...matches]);
    } catch (e: any) {
      onError(e?.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  // Preset searches
  const applyPreset = (type: 'email' | 'phone' | 'ssn') => {
    let q = '';
    if (type === 'email') q = '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}';
    if (type === 'phone') q = '(\\+?\\d{1,3}[-.\\s]?)?(\\(?\\d{3}\\)?[-.\\s]?)?\\d{3}[-.\\s]?\\d{4}';
    if (type === 'ssn') q = '\\b\\d{3}-\\d{2}-\\d{4}\\b|\\b[A-Z]{5}[0-9]{4}[A-Z]{1}\\b';

    setSearchQuery(q);
    setIsRegex(true);
    handleSearchAndMark(q, true);
  };

  // Mouse event handlers for manual drawing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'draw' || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setDrawing(true);
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setDrawCurrent({ x, y });
  };

  const handleMouseUp = () => {
    if (!drawing || !drawStart || !drawCurrent) {
      setDrawing(false);
      return;
    }
    setDrawing(false);

    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawCurrent.x - drawStart.x);
    const h = Math.abs(drawCurrent.y - drawStart.y);

    if (w > 0.01 && h > 0.01) {
      const newBox: RedactionTargetBox = {
        id: `draw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        pageIndex: curPage - 1,
        xRatio: Math.max(0, Math.min(1, x)),
        yRatio: Math.max(0, Math.min(1, y)),
        widthRatio: Math.max(0.01, Math.min(1 - x, w)),
        heightRatio: Math.max(0.01, Math.min(1 - y, h)),
        label: `Box on Page ${curPage}`
      };
      setRedactions((prev) => [...prev, newBox]);
    }

    setDrawStart(null);
    setDrawCurrent(null);
  };

  const handleDeleteRedaction = (id: string) => {
    setRedactions((prev) => prev.filter((r) => r.id !== id));
  };

  const handleApplySanitization = async () => {
    if (redactions.length === 0) {
      onError('Please mark at least one redaction box or search term first.');
      return;
    }

    try {
      setSanitizing(true);
      setStatusMsg('Forensically sanitizing PDF stream and purging sensitive tokens...');
      const result = await applyPdfRedactions(file, redactions, (_pct, label) => {
        if (label) setStatusMsg(label);
      });

      const base = file.name.replace(/\.pdf$/i, '');
      const blob = new Blob([new Uint8Array(result.pdfBytes) as any], { type: 'application/pdf' });
      onRedactComplete(blob, `${base}_redacted.pdf`);
    } catch (e: any) {
      onError(e?.message || 'Failed to sanitize PDF.');
    } finally {
      setSanitizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Real Redaction Guarantee */}
      <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-4 flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="text-xs text-rose-200 leading-relaxed">
          <strong className="block text-rose-300 font-bold mb-0.5">
            Forensic-Grade Stream Sanitization
          </strong>
          Unlike superficial editors that merely overlay black shapes on top of live text, PDFCraft completely wipes and rasterizes redacted pages so sensitive data cannot be highlighted, inspected in source code, or recovered.
        </div>
      </div>

      {/* Control Tabs & Action Buttons */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setMode('search')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                mode === 'search'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search & Auto-Redact</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('draw')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                mode === 'draw'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Manual Box Drawing</span>
            </button>
          </div>

          {/* Apply Redaction Button */}
          <button
            type="button"
            onClick={handleApplySanitization}
            disabled={sanitizing || redactions.length === 0}
            className="py-2.5 px-5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/20 transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            {sanitizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sanitizing ({statusMsg || 'Purging...'})</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>Apply & Sanitize ({redactions.length} Redactions)</span>
              </>
            )}
          </button>
        </div>

        {/* Search Mode Panel */}
        {mode === 'search' ? (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search word, phrase, name, or regex to redact..."
                className="flex-1 min-w-[240px] text-xs bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-indigo-500"
              />

              <label className="flex items-center space-x-1.5 text-xs text-slate-300 px-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRegex}
                  onChange={(e) => setIsRegex(e.target.checked)}
                  className="accent-indigo-600 rounded"
                />
                <span>Regex</span>
              </label>

              <button
                type="button"
                onClick={() => handleSearchAndMark()}
                disabled={searching || !searchQuery.trim()}
                className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              >
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Find & Mark</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
              <span className="text-[11px] text-slate-400 font-semibold mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset('email')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
              >
                📧 Email Addresses
              </button>
              <button
                type="button"
                onClick={() => applyPreset('phone')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
              >
                📞 Phone Numbers
              </button>
              <button
                type="button"
                onClick={() => applyPreset('ssn')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
              >
                🔒 SSN / Tax IDs
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 p-2 bg-slate-950/40 rounded-xl border border-slate-800/60">
            🖱️ <strong>Manual Draw Mode Active:</strong> Click and drag anywhere on the document preview below to draw blackout redaction boxes.
          </div>
        )}

        {/* Marked Redactions Pill List */}
        {redactions.length > 0 && (
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                Marked for Sanitization ({redactions.length})
              </span>
              <button
                type="button"
                onClick={() => setRedactions([])}
                className="text-[11px] text-rose-400 hover:underline"
              >
                Clear All
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {redactions.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px]"
                >
                  <span className="font-mono text-[9px] text-rose-400">P.{r.pageIndex + 1}</span>
                  <span className="truncate max-w-[120px]">{r.label || 'Box'}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteRedaction(r.id)}
                    className="hover:text-white p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Page View & Redaction Overlay */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 flex flex-col items-center">
        {/* Page Switcher */}
        <div className="flex items-center space-x-4 mb-4">
          <button
            type="button"
            onClick={() => handlePageChange(curPage - 1)}
            disabled={curPage <= 1 || loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 border border-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-slate-300">
            Page {curPage} of {numPages}
          </span>
          <button
            type="button"
            onClick={() => handlePageChange(curPage + 1)}
            disabled={curPage >= numPages || loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 border border-slate-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas + Overlaid Redaction Boxes */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`relative inline-block border border-slate-700 rounded-lg overflow-hidden shadow-2xl select-none ${
            mode === 'draw' ? 'cursor-crosshair' : 'cursor-default'
          }`}
          style={{ maxWidth: '100%', maxHeight: '70vh' }}
        >
          <canvas ref={canvasRef} className="block max-w-full h-auto bg-white" />

          {/* Render Marked Redaction Boxes for current page */}
          {redactions
            .filter((r) => r.pageIndex === curPage - 1)
            .map((r) => (
              <div
                key={r.id}
                style={{
                  left: `${r.xRatio * 100}%`,
                  top: `${r.yRatio * 100}%`,
                  width: `${r.widthRatio * 100}%`,
                  height: `${r.heightRatio * 100}%`
                }}
                className="absolute bg-rose-600/70 border-2 border-black flex items-center justify-center pointer-events-auto group"
              >
                <span className="text-[9px] font-mono text-white font-bold bg-black/60 px-1 rounded truncate pointer-events-none">
                  REDACT
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteRedaction(r.id)}
                  className="hidden group-hover:inline-flex absolute -top-2 -right-2 p-0.5 bg-rose-700 text-white rounded-full shadow"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

          {/* Active Drawing Preview Box */}
          {drawing && drawStart && drawCurrent && (
            <div
              style={{
                left: `${Math.min(drawStart.x, drawCurrent.x) * 100}%`,
                top: `${Math.min(drawStart.y, drawCurrent.y) * 100}%`,
                width: `${Math.abs(drawCurrent.x - drawStart.x) * 100}%`,
                height: `${Math.abs(drawCurrent.y - drawStart.y) * 100}%`
              }}
              className="absolute bg-rose-500/40 border-2 border-dashed border-rose-400 pointer-events-none"
            />
          )}
        </div>
      </div>
    </div>
  );
};
