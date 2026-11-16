import React, { useState, useEffect, useRef } from 'react';
import {
  Crop, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import { cropPDF, openPdfjs, type CropOptions } from '../../utils/pdfEngine';

interface CropPdfToolProps {
  file: File;
  onCropComplete: (blob: Blob, filename: string) => void;
  onError: (msg: string) => void;
}

export const CropPdfTool: React.FC<CropPdfToolProps> = ({ file, onCropComplete, onError }) => {
  const [numPages, setNumPages] = useState<number>(1);
  const [curPage, setCurPage] = useState<number>(1);
  const [rendering, setRendering] = useState<boolean>(true);
  const [applying, setApplying] = useState<boolean>(false);

  // Scope: 'all' | 'current' | 'custom'
  const [scope, setScope] = useState<'all' | 'current' | 'custom'>('all');
  const [pagesSpec, setPagesSpec] = useState<string>('1');

  // Crop box in normalized ratio [0..1] relative to preview dimensions
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0.05,
    y: 0.05,
    w: 0.90,
    h: 0.90
  });

  // Numeric margins in millimeters (assuming standard A4 ~210x297mm as baseline ratio)
  const [marginsMm, setMarginsMm] = useState<{ top: number; right: number; bottom: number; left: number }>({
    top: 15,
    right: 15,
    bottom: 15,
    left: 15
  });

  const [useVisualBox] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<any>(null);

  // Dragging state
  const dragRef = useRef<{
    active: boolean;
    type: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';
    startX: number;
    startY: number;
    startBox: { x: number; y: number; w: number; h: number };
  }>({
    active: false,
    type: 'move',
    startX: 0,
    startY: 0,
    startBox: { x: 0, y: 0, w: 0, h: 0 }
  });

  // Load PDF and render initial page
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setRendering(true);
        const doc = await openPdfjs(file);
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setPagesSpec(`1-${doc.numPages}`);
        await renderPage(doc, 1);
      } catch (e: any) {
        if (!cancelled) onError(e?.message || 'Failed to load PDF for cropping');
      } finally {
        if (!cancelled) setRendering(false);
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
      setRendering(true);
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
    } catch (e: any) {
      console.error('Error rendering page for crop preview:', e);
    } finally {
      setRendering(false);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > numPages || !pdfDocRef.current) return;
    setCurPage(newPage);
    await renderPage(pdfDocRef.current, newPage);
  };

  // Convert box ratios to mm and vice versa
  const updateBoxFromMargins = (top: number, right: number, bottom: number, left: number) => {
    const pageW = 210;
    const pageH = 297;
    const nx = Math.max(0, Math.min(0.45, left / pageW));
    const ny = Math.max(0, Math.min(0.45, top / pageH));
    const nw = Math.max(0.1, 1 - nx - right / pageW);
    const nh = Math.max(0.1, 1 - ny - bottom / pageH);
    setBox({ x: nx, y: ny, w: nw, h: nh });
    setMarginsMm({ top, right, bottom, left });
  };

  const updateMarginsFromBox = (newBox: { x: number; y: number; w: number; h: number }) => {
    const pageW = 210;
    const pageH = 297;
    const left = Math.round(newBox.x * pageW);
    const top = Math.round(newBox.y * pageH);
    const right = Math.round((1 - (newBox.x + newBox.w)) * pageW);
    const bottom = Math.round((1 - (newBox.y + newBox.h)) * pageH);
    setMarginsMm({
      top: Math.max(0, top),
      right: Math.max(0, right),
      bottom: Math.max(0, bottom),
      left: Math.max(0, left)
    });
  };

  // Drag and Resize handlers
  const handleMouseDown = (e: React.MouseEvent, handle: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w') => {
    e.preventDefault();
    dragRef.current = {
      active: true,
      type: handle,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...box }
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current.active || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = (moveEvent.clientX - dragRef.current.startX) / rect.width;
      const dy = (moveEvent.clientY - dragRef.current.startY) / rect.height;
      const sb = dragRef.current.startBox;

      let nx = sb.x;
      let ny = sb.y;
      let nw = sb.w;
      let nh = sb.h;

      switch (dragRef.current.type) {
        case 'move':
          nx = Math.max(0, Math.min(1 - sb.w, sb.x + dx));
          ny = Math.max(0, Math.min(1 - sb.h, sb.y + dy));
          break;
        case 'nw':
          nx = Math.max(0, Math.min(sb.x + sb.w - 0.05, sb.x + dx));
          ny = Math.max(0, Math.min(sb.y + sb.h - 0.05, sb.y + dy));
          nw = sb.w - (nx - sb.x);
          nh = sb.h - (ny - sb.y);
          break;
        case 'ne':
          ny = Math.max(0, Math.min(sb.y + sb.h - 0.05, sb.y + dy));
          nw = Math.max(0.05, Math.min(1 - sb.x, sb.w + dx));
          nh = sb.h - (ny - sb.y);
          break;
        case 'se':
          nw = Math.max(0.05, Math.min(1 - sb.x, sb.w + dx));
          nh = Math.max(0.05, Math.min(1 - sb.y, sb.h + dy));
          break;
        case 'sw':
          nx = Math.max(0, Math.min(sb.x + sb.w - 0.05, sb.x + dx));
          nw = sb.w - (nx - sb.x);
          nh = Math.max(0.05, Math.min(1 - sb.y, sb.h + dy));
          break;
        case 'n':
          ny = Math.max(0, Math.min(sb.y + sb.h - 0.05, sb.y + dy));
          nh = sb.h - (ny - sb.y);
          break;
        case 's':
          nh = Math.max(0.05, Math.min(1 - sb.y, sb.h + dy));
          break;
        case 'w':
          nx = Math.max(0, Math.min(sb.x + sb.w - 0.05, sb.x + dx));
          nw = sb.w - (nx - sb.x);
          break;
        case 'e':
          nw = Math.max(0.05, Math.min(1 - sb.x, sb.w + dx));
          break;
      }

      const updated = {
        x: Math.max(0, Math.min(0.95, nx)),
        y: Math.max(0, Math.min(0.95, ny)),
        w: Math.max(0.05, Math.min(1 - nx, nw)),
        h: Math.max(0.05, Math.min(1 - ny, nh))
      };
      setBox(updated);
      updateMarginsFromBox(updated);
    };

    const handleMouseUp = () => {
      dragRef.current.active = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleApplyCrop = async () => {
    try {
      setApplying(true);
      const options: CropOptions = {
        scope,
        currentPage: curPage,
        pagesSpec,
        unit: 'mm',
        margins: marginsMm,
        customBoxRatio: useVisualBox
          ? { x: box.x, y: box.y, width: box.w, height: box.h }
          : undefined
      };

      const croppedBytes = await cropPDF(file, options);
      const base = file.name.replace(/\.pdf$/i, '');
      const blob = new Blob([new Uint8Array(croppedBytes) as any], { type: 'application/pdf' });
      onCropComplete(blob, `${base}_cropped.pdf`);
    } catch (e: any) {
      onError(e?.message || 'Failed to crop PDF.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls & Margin Inputs Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
        {/* Scope selector */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
            1. Apply Crop Scope
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'all', label: 'All Pages' },
              { id: 'current', label: `Page ${curPage}` },
              { id: 'custom', label: 'Range' }
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScope(s.id as any)}
                className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all text-center ${
                  scope === s.id
                    ? 'bg-indigo-600 text-white border-indigo-500 font-bold shadow-md shadow-indigo-500/20'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700/80'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {scope === 'custom' && (
            <div className="pt-1">
              <input
                type="text"
                value={pagesSpec}
                onChange={(e) => setPagesSpec(e.target.value)}
                placeholder="e.g. 1-3, 5, 8"
                className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-indigo-500 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Specify page numbers or ranges (1-{numPages})</span>
            </div>
          )}
        </div>

        {/* Numeric Margins (mm) */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
            2. Numeric Margins (mm)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Top</span>
              <input
                type="number"
                min="0"
                max="100"
                value={marginsMm.top}
                onChange={(e) => updateBoxFromMargins(Number(e.target.value), marginsMm.right, marginsMm.bottom, marginsMm.left)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Bottom</span>
              <input
                type="number"
                min="0"
                max="100"
                value={marginsMm.bottom}
                onChange={(e) => updateBoxFromMargins(marginsMm.top, marginsMm.right, Number(e.target.value), marginsMm.left)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Left</span>
              <input
                type="number"
                min="0"
                max="100"
                value={marginsMm.left}
                onChange={(e) => updateBoxFromMargins(marginsMm.top, marginsMm.right, marginsMm.bottom, Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Right</span>
              <input
                type="number"
                min="0"
                max="100"
                value={marginsMm.right}
                onChange={(e) => updateBoxFromMargins(marginsMm.top, Number(e.target.value), marginsMm.bottom, marginsMm.left)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => updateBoxFromMargins(0, 0, 0, 0)}
              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700"
            >
              Full Page (0mm)
            </button>
            <button
              type="button"
              onClick={() => updateBoxFromMargins(10, 10, 10, 10)}
              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700"
            >
              Trim 10mm
            </button>
            <button
              type="button"
              onClick={() => updateBoxFromMargins(20, 20, 20, 20)}
              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700"
            >
              Trim 20mm
            </button>
          </div>
        </div>

        {/* Action Button & Vector Guarantee */}
        <div className="flex flex-col justify-between space-y-3">
          <div className="bg-emerald-950/30 border border-emerald-500/20 p-3 rounded-xl text-emerald-400 text-xs">
            <span className="font-semibold block mb-0.5">✓ 100% Vector Sharp Output</span>
            Adjusts PDF CropBox coordinates directly. Text, forms, and vector curves stay completely loss-free.
          </div>

          <button
            type="button"
            onClick={handleApplyCrop}
            disabled={applying || rendering}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {applying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Cropping Vector PDF...</span>
              </>
            ) : (
              <>
                <Crop className="w-4 h-4" />
                <span>Crop PDF Document</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Visual Crop Workspace with Draggable Box */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 flex flex-col items-center">
        {/* Page Switcher */}
        <div className="flex items-center space-x-4 mb-4">
          <button
            type="button"
            onClick={() => handlePageChange(curPage - 1)}
            disabled={curPage <= 1 || rendering}
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
            disabled={curPage >= numPages || rendering}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 border border-slate-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Live Canvas + Interactive Crop Bounding Box */}
        <div
          ref={containerRef}
          className="relative inline-block border border-slate-700 rounded-lg overflow-hidden shadow-2xl select-none"
          style={{ maxWidth: '100%', maxHeight: '70vh' }}
        >
          <canvas ref={canvasRef} className="block max-w-full h-auto bg-white" />

          {/* Semi-transparent dark overlay outside crop box */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `rgba(0, 0, 0, 0.45)`,
              clipPath: `polygon(
                0% 0%, 0% 100%, 100% 100%, 100% 0%,
                0% 0%,
                ${box.x * 100}% ${box.y * 100}%,
                ${(box.x + box.w) * 100}% ${box.y * 100}%,
                ${(box.x + box.w) * 100}% ${(box.y + box.h) * 100}%,
                ${box.x * 100}% ${(box.y + box.h) * 100}%,
                ${box.x * 100}% ${box.y * 100}%
              )`
            }}
          />

          {/* Interactive Crop Box with Handles */}
          <div
            className="absolute border-2 border-indigo-400 border-dashed cursor-move shadow-sm"
            style={{
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.w * 100}%`,
              height: `${box.h * 100}%`
            }}
            onMouseDown={(e) => handleMouseDown(e, 'move')}
          >
            {/* Center label */}
            <div className="absolute top-2 left-2 bg-indigo-900/90 text-indigo-100 text-[10px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none">
              {Math.round(box.w * 100)}% × {Math.round(box.h * 100)}%
            </div>

            {/* Corner Handles */}
            <div
              className="absolute -top-2 -left-2 w-4 h-4 bg-indigo-500 border-2 border-white rounded-full cursor-nwse-resize shadow"
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'nw'); }}
            />
            <div
              className="absolute -top-2 -right-2 w-4 h-4 bg-indigo-500 border-2 border-white rounded-full cursor-nesw-resize shadow"
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'ne'); }}
            />
            <div
              className="absolute -bottom-2 -left-2 w-4 h-4 bg-indigo-500 border-2 border-white rounded-full cursor-nesw-resize shadow"
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'sw'); }}
            />
            <div
              className="absolute -bottom-2 -right-2 w-4 h-4 bg-indigo-500 border-2 border-white rounded-full cursor-nwse-resize shadow"
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'se'); }}
            />

            {/* Edge Handles */}
            <div
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-indigo-400 border border-white rounded cursor-ns-resize"
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'n'); }}
            />
            <div
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-indigo-400 border border-white rounded cursor-ns-resize"
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 's'); }}
            />
            <div
              className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-8 bg-indigo-400 border border-white rounded cursor-ew-resize"
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'w'); }}
            />
            <div
              className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-8 bg-indigo-400 border border-white rounded cursor-ew-resize"
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'e'); }}
            />
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-4 text-center">
          💡 Drag the handles or box to visually crop margins. Changes sync with the numeric margin fields above.
        </p>
      </div>
    </div>
  );
};
