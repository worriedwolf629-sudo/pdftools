import React, { useEffect, useState, useRef } from 'react';
import {
  Image as ImageIcon, ZoomIn, ZoomOut, RotateCw, FlipHorizontal, FlipVertical,
  Download, Copy, Check, RefreshCw, FileText, Wand2, FileCode, Loader2, Scaling, Minimize2, CheckCircle2
} from 'lucide-react';
import { traceImageToSvg, convertSvgToPdf } from '../../utils/vectorConverters';
import { applyScanEnhancer, apply1BitDither } from '../../utils/visualFilters';
import { padImageToTargetSize, compressImageToTargetBlob, parseSizeToBytes, formatBytes } from '../../utils/fileSizeTarget';

interface ImageViewerProps {
  file: File | Blob;
  fileName: string;
  onOpenWithTool?: (toolSlug: string, file: File) => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ file, fileName, onOpenWithTool }) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [filteredUrl, setFilteredUrl] = useState<string>('');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<
    'normal' | 'invert' | 'contrast' | 'grayscale' | 'scan-enhance' | 'dither'
  >('normal');
  const [copied, setCopied] = useState<boolean>(false);
  const [tracing, setTracing] = useState<boolean>(false);
  const [vectorPdfLoading, setVectorPdfLoading] = useState<boolean>(false);
  const [showResizeModal, setShowResizeModal] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'resize' | 'compress'>('resize');
  const [resizeWidth, setResizeWidth] = useState<number>(0);
  const [resizeHeight, setResizeHeight] = useState<number>(0);
  const [lockRatio, setLockRatio] = useState<boolean>(true);
  const [resizeFormat, setResizeFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [compressQuality, setCompressQuality] = useState<number>(0.75);
  const [compressMode, setCompressMode] = useState<'target' | 'quality'>('target');
  const [targetSizeVal, setTargetSizeVal] = useState<number>(50);
  const [targetSizeUnit, setTargetSizeUnit] = useState<'KB' | 'MB'>('KB');
  const [resizing, setResizing] = useState<boolean>(false);
  const [imageProcessedResult, setImageProcessedResult] = useState<{
    url: string;
    blob: Blob;
    filename: string;
    size: number;
    width: number;
    height: number;
  } | null>(null);

  const isSvg = fileName.toLowerCase().endsWith('.svg');

  useEffect(() => {
    // Set a sensible default target size (e.g. 50 KB or half file size)
    const curKb = Math.round(file.size / 1024);
    if (curKb > 1024) {
      setTargetSizeVal(1);
      setTargetSizeUnit('MB');
    } else {
      setTargetSizeVal(curKb <= 30 ? 20 : curKb <= 70 ? 50 : curKb <= 150 ? 100 : Math.round(curKb * 0.7));
      setTargetSizeUnit('KB');
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const img = new Image();
    img.src = url;
    img.onload = () => {
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setResizeWidth(img.naturalWidth);
      setResizeHeight(img.naturalHeight);
    };

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Handle Scan Enhancer and 1-Bit Dither pixel filters
  useEffect(() => {
    if (!imageUrl || (filterMode !== 'scan-enhance' && filterMode !== 'dither')) {
      setFilteredUrl('');
      return;
    }

    let isCancelled = false;
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      if (isCancelled) return;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (filterMode === 'scan-enhance') {
        applyScanEnhancer(imgData);
      } else if (filterMode === 'dither') {
        apply1BitDither(imgData);
      }
      ctx.putImageData(imgData, 0, 0);
      if (!isCancelled) {
        setFilteredUrl(canvas.toDataURL(filterMode === 'dither' ? 'image/png' : 'image/jpeg', 0.92));
      }
    };

    return () => {
      isCancelled = true;
    };
  }, [imageUrl, filterMode]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = filteredUrl || imageUrl;
    a.download = filteredUrl
      ? fileName.replace(/\.[^/.]+$/, '') + `_${filterMode}.${filterMode === 'dither' ? 'png' : 'jpg'}`
      : fileName;
    a.click();
  };

  const handleTraceToSvg = async () => {
    try {
      setTracing(true);
      const svgString = await traceImageToSvg(file);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace(/\.[^/.]+$/, '') + '_vector.svg';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Vector tracing failed:', err);
      alert('Failed to trace vector SVG: ' + (err?.message || err));
    } finally {
      setTracing(false);
    }
  };

  const handleConvertSvgToPdf = async () => {
    try {
      setVectorPdfLoading(true);
      let svgText = '';
      if (isSvg) {
        svgText = await file.text();
      } else {
        svgText = await traceImageToSvg(file);
      }
      const pdfBytes = await convertSvgToPdf(svgText);
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace(/\.[^/.]+$/, '') + '_vector.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Vector PDF conversion failed:', err);
      alert('Failed to convert SVG to Vector PDF: ' + (err?.message || err));
    } finally {
      setVectorPdfLoading(false);
    }
  };

  const handleScalePercent = (pct: number) => {
    if (!dimensions) return;
    const w = Math.max(1, Math.round((dimensions.width * pct) / 100));
    const h = Math.max(1, Math.round((dimensions.height * pct) / 100));
    setResizeWidth(w);
    setResizeHeight(h);
  };

  const handleWidthChange = (val: number) => {
    setResizeWidth(val);
    if (lockRatio && dimensions && dimensions.width > 0) {
      setResizeHeight(Math.max(1, Math.round(val * (dimensions.height / dimensions.width))));
    }
  };

  const handleHeightChange = (val: number) => {
    setResizeHeight(val);
    if (lockRatio && dimensions && dimensions.height > 0) {
      setResizeWidth(Math.max(1, Math.round(val * (dimensions.width / dimensions.height))));
    }
  };

  const handleDownloadResized = async () => {
    if (!imageUrl || resizeWidth <= 0 || resizeHeight <= 0) return;
    try {
      setResizing(true);
      const img = new Image();
      img.src = filteredUrl || imageUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = resizeWidth;
      canvas.height = resizeHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, resizeWidth, resizeHeight);

      const ext = resizeFormat === 'image/png' ? 'png' : resizeFormat === 'image/webp' ? 'webp' : 'jpg';

      let outBlob: Blob;
      let outName: string;

      if (modalTab === 'compress' && compressMode === 'target') {
        const targetBytes = parseSizeToBytes(targetSizeVal, targetSizeUnit);
        if (targetBytes >= file.size) {
          // Enlarge file size to target KB/MB
          const rawBlob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b || new Blob()), resizeFormat, 0.92)
          );
          const rawBytes = new Uint8Array(await rawBlob.arrayBuffer());
          const paddedBytes = padImageToTargetSize(rawBytes, targetBytes, resizeFormat);
          outBlob = new Blob([paddedBytes as any], { type: resizeFormat });
          outName = `${fileName.replace(/\.[^/.]+$/, '')}_enlarged_${targetSizeVal}${targetSizeUnit}.${ext}`;
        } else {
          // Compress to fit within target KB/MB
          const res = await compressImageToTargetBlob(canvas, targetBytes, resizeFormat);
          outBlob = res.blob;
          outName = `${fileName.replace(/\.[^/.]+$/, '')}_target_${targetSizeVal}${targetSizeUnit}.${ext}`;
        }
      } else {
        const quality = modalTab === 'compress' ? compressQuality : 0.92;
        outBlob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b || new Blob()), resizeFormat, quality)
        );
        const prefix =
          modalTab === 'compress'
            ? 'compressed'
            : resizeWidth > (dimensions?.width || 0)
            ? 'enlarged'
            : 'resized';
        outName = `${fileName.replace(/\.[^/.]+$/, '')}_${prefix}_${resizeWidth}x${resizeHeight}.${ext}`;
      }

      const outUrl = URL.createObjectURL(outBlob);
      setImageProcessedResult({
        url: outUrl,
        blob: outBlob,
        filename: outName,
        size: outBlob.size,
        width: resizeWidth,
        height: resizeHeight
      });
    } catch (err: any) {
      console.error('Image resize failed:', err);
      alert('Failed to resize image: ' + (err?.message || err));
    } finally {
      setResizing(false);
    }
  };

  const handleCopy = async () => {
    try {
      if (file.type.startsWith('image/png')) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': file })
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Render to canvas to copy as PNG
        const img = new Image();
        img.src = imageUrl;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(async (blob) => {
            if (blob) {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ]);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }, 'image/png');
        }
      }
    } catch (e) {
      console.error('Clipboard copy failed:', e);
    }
  };

  const getFilterStyle = () => {
    switch (filterMode) {
      case 'invert':
        return 'invert(1) hue-rotate(180deg)';
      case 'contrast':
        return 'contrast(1.6) brightness(1.1)';
      case 'grayscale':
        return 'grayscale(1)';
      default:
        return 'none';
    }
  };

  const handleConvertToPdf = () => {
    if (onOpenWithTool) {
      const realFile = file instanceof File ? file : new File([file], fileName, { type: file.type || 'image/jpeg' });
      onOpenWithTool('jpg-to-pdf', realFile);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y
    };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    setPan({
      x: dragStartRef.current.initialPanX + dx,
      y: dragStartRef.current.initialPanY + dy
    });
  };

  const handleMouseUp = () => {
    dragStartRef.current = null;
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      dragStartRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        initialPanX: pan.x,
        initialPanY: pan.y
      };
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragStartRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.startX;
    const dy = touch.clientY - dragStartRef.current.startY;
    setPan({
      x: dragStartRef.current.initialPanX + dx,
      y: dragStartRef.current.initialPanY + dy
    });
  };

  const handleTouchEnd = () => {
    dragStartRef.current = null;
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.2 : -0.2;
      setScale((s) => {
        const next = Math.min(5, Math.max(0.2, Math.round((s + delta) * 10) / 10));
        if (next <= 1) setPan({ x: 0, y: 0 });
        return next;
      });
    } else {
      // Natural pan on wheel scroll
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const handleResetZoomAndPan = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setFilterMode('normal');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 text-white rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl backdrop-blur-md">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white shadow-md">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
              {fileName}
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Image
              </span>
            </h3>
            {dimensions && (
              <p className="text-xs text-slate-400">
                {dimensions.width} × {dimensions.height} px • {(dimensions.width * dimensions.height / 1000000).toFixed(1)} MP
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-800/90 rounded-xl p-1 border border-slate-700/80">
            <button
              onClick={() => {
                setScale((s) => {
                  const next = Math.max(0.2, Math.round((s - 0.2) * 10) / 10);
                  if (next <= 1) setPan({ x: 0, y: 0 });
                  return next;
                });
              }}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (scale === 1) {
                  setScale(2);
                } else {
                  setScale(1);
                  setPan({ x: 0, y: 0 });
                }
              }}
              className="px-2 py-0.5 text-xs font-semibold text-slate-300 hover:text-white rounded hover:bg-slate-700 min-w-12 text-center transition-colors cursor-pointer select-none"
              title="Click to toggle 100% / 200%"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={() => setScale((s) => Math.min(5, Math.round((s + 0.2) * 10) / 10))}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoomAndPan}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Reset View (100% Fit)"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Transformations */}
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFlipH((f) => !f)}
            className={`p-2 rounded-xl border text-slate-200 ${
              flipH ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'
            }`}
            title="Flip Horizontal"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFlipV((f) => !f)}
            className={`p-2 rounded-xl border text-slate-200 ${
              flipV ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'
            }`}
            title="Flip Vertical"
          >
            <FlipVertical className="w-4 h-4" />
          </button>

          {/* Filter Mode Selector */}
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="normal">Filter: Normal</option>
            <option value="scan-enhance">Filter: ✨ Scan Enhancer</option>
            <option value="dither">Filter: 🏁 1-Bit Dither</option>
            <option value="invert">Filter: Invert</option>
            <option value="contrast">Filter: High Contrast</option>
            <option value="grayscale">Filter: Grayscale</option>
          </select>

          {/* Trace to Vector SVG */}
          <button
            onClick={handleTraceToSvg}
            disabled={tracing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-semibold text-white shadow-md shadow-purple-600/30 transition-all"
            title="Trace raster bitmap into scalable SVG vector"
          >
            {tracing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Trace to SVG
          </button>

          {/* Convert to Vector PDF */}
          <button
            onClick={handleConvertSvgToPdf}
            disabled={vectorPdfLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-xs font-semibold text-white shadow-md shadow-sky-600/30 transition-all"
            title="Convert SVG or traced image directly into Vector PDF"
          >
            {vectorPdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode className="w-4 h-4" />}
            Vector PDF
          </button>

          {/* Resize / Enlarge Image Option */}
          <button
            onClick={() => {
              setModalTab('resize');
              setShowResizeModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all"
            title="Resize or Enlarge Image Dimensions (25% to 400%)"
          >
            <Scaling className="w-4 h-4 text-amber-400" />
            Resize / Enlarge
          </button>

          {/* Compress Image Option */}
          <button
            onClick={() => {
              setModalTab('compress');
              setShowResizeModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all"
            title="Compress Image to Reduce File Size"
          >
            <Minimize2 className="w-4 h-4 text-emerald-400" />
            Compress
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200"
            title="Copy Image"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          {onOpenWithTool && (
            <button
              onClick={handleConvertToPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/30"
              title="Convert this image to PDF"
            >
              <FileText className="w-4 h-4" /> Convert to PDF
            </button>
          )}

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 font-semibold text-xs text-white shadow-md shadow-pink-600/30"
          >
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      {/* Main Image Canvas Viewport */}
      <div
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-950/60 relative select-none"
        style={{ cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default' }}
      >
        {imageUrl ? (
          <div className="min-w-full min-h-full flex p-2 m-auto w-max h-max">
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                transformOrigin: rotation !== 0 ? 'center center' : scale > 1 ? 'top center' : 'center center',
                transition: isDragging ? 'none' : 'transform 0.12s ease-out'
              }}
              className="m-auto inline-block"
            >
              <img
                src={filteredUrl || imageUrl}
                alt={fileName}
                draggable={false}
                style={{ filter: filteredUrl ? 'none' : getFilterStyle() }}
                className="max-h-[75vh] max-w-full rounded-xl shadow-2xl object-contain border border-slate-800 pointer-events-none"
              />
            </div>
          </div>
        ) : null}

        {/* Floating Pan/Zoom Indicator when Zoomed In */}
        {scale > 1 && (
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-[11px] text-slate-300 shadow-xl backdrop-blur-sm animate-pop-in pointer-events-auto">
            <span>✋ Drag or scroll to pan</span>
            <button
              type="button"
              onClick={handleResetZoomAndPan}
              className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Image Resize & Compress Modal */}
      {showResizeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-white space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                {modalTab === 'resize' ? (
                  <Scaling className="w-5 h-5 text-amber-400" />
                ) : (
                  <Minimize2 className="w-5 h-5 text-emerald-400" />
                )}
                <h3 className="font-bold text-base">
                  {modalTab === 'resize' ? 'Resize & Enlarge Image' : 'Compress Image Size'}
                </h3>
              </div>
              <button
                onClick={() => setShowResizeModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {imageProcessedResult ? (
              <div className="space-y-4 animate-pop-in">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold">Image Ready for Verification</span>
                  </div>
                  <span className="font-mono font-bold">{formatBytes(imageProcessedResult.size)}</span>
                </div>

                {/* Verification image preview */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
                  <img
                    src={imageProcessedResult.url}
                    alt="Processed preview"
                    className="max-h-56 max-w-full rounded-lg object-contain shadow-lg"
                  />
                  <div className="mt-2 text-[11px] font-mono text-slate-400 text-center">
                    {imageProcessedResult.width} × {imageProcessedResult.height} px • {formatBytes(file.size)} → {formatBytes(imageProcessedResult.size)}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => setImageProcessedResult(null)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    ← Adjust Options
                  </button>
                  <button
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = imageProcessedResult.url;
                      a.download = imageProcessedResult.filename;
                      a.click();
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download ({formatBytes(imageProcessedResult.size)})</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
            {/* Mode Switcher Tabs */}
            <div className="flex rounded-xl bg-slate-800 p-1 border border-slate-700 text-xs">
              <button
                onClick={() => setModalTab('resize')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                  modalTab === 'resize'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Resize & Enlarge (Dimensions)
              </button>
              <button
                onClick={() => {
                  setModalTab('compress');
                  setResizeFormat('image/webp');
                }}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                  modalTab === 'compress'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Compress (Reduce File Size)
              </button>
            </div>

            {dimensions && (
              <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
                <span>
                  Resolution: <b className="text-slate-200">{dimensions.width} × {dimensions.height} px</b>
                </span>
                <span>
                  Size: <b className="text-slate-200">{(file.size / 1024).toFixed(1)} KB</b>
                </span>
              </div>
            )}

            {modalTab === 'resize' ? (
              <>
                {/* Scale & Enlarge Presets */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-2 block">
                    Scale & Enlarge Presets:
                  </label>
                  <div className="grid grid-cols-7 gap-1.5 text-xs font-mono">
                    {[25, 50, 75, 100, 150, 200, 400].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => handleScalePercent(pct)}
                        className={`py-1.5 rounded-lg border font-mono transition-all text-center ${
                          dimensions && Math.round((resizeWidth / dimensions.width) * 100) === pct
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                        title={pct > 100 ? `Enlarge to ${pct}%` : `Shrink to ${pct}%`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Width & Height Inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">Width (px)</label>
                    <input
                      type="number"
                      value={resizeWidth}
                      onChange={(e) => handleWidthChange(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">Height (px)</label>
                    <input
                      type="number"
                      value={resizeHeight}
                      onChange={(e) => handleHeightChange(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Aspect Ratio Lock & Format */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                    <input
                      type="checkbox"
                      checked={lockRatio}
                      onChange={(e) => setLockRatio(e.target.checked)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-800"
                    />
                    Maintain aspect ratio
                  </label>

                  <select
                    value={resizeFormat}
                    onChange={(e) => setResizeFormat(e.target.value as any)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none"
                  >
                    <option value="image/jpeg">Format: JPEG</option>
                    <option value="image/png">Format: PNG</option>
                    <option value="image/webp">Format: WebP</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                {/* Compress / Enlarge Mode Switcher: Exact Target Size vs Manual Quality % */}
                <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-xs">
                  <button
                    onClick={() => setCompressMode('target')}
                    className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                      compressMode === 'target'
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Target File Size (KB / MB)
                  </button>
                  <button
                    onClick={() => setCompressMode('quality')}
                    className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                      compressMode === 'quality'
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Manual Quality (%)
                  </button>
                </div>

                {compressMode === 'target' ? (
                  <div className="space-y-3">
                    {/* Target Size Presets */}
                    <div>
                      <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                        Quick Target Size Presets:
                      </label>
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-xs font-mono">
                        {[
                          { val: 20, unit: 'KB' },
                          { val: 50, unit: 'KB' },
                          { val: 100, unit: 'KB' },
                          { val: 200, unit: 'KB' },
                          { val: 500, unit: 'KB' },
                          { val: 1, unit: 'MB' },
                          { val: 2, unit: 'MB' }
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
                                  ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                            >
                              {p.val} {p.unit}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Input */}
                    <div>
                      <label className="text-xs font-semibold text-slate-300 mb-1 block">
                        Custom Target File Size:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="9999"
                          value={targetSizeVal}
                          onChange={(e) => setTargetSizeVal(Math.max(1, parseInt(e.target.value) || 1))}
                          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                        />
                        <select
                          value={targetSizeUnit}
                          onChange={(e) => setTargetSizeUnit(e.target.value as any)}
                          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-sm font-bold focus:outline-none focus:border-emerald-500"
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
                            {isEnlarge ? '📈 Enlarge file size to' : '🗜️ Compress file size to'}:
                          </span>
                          <span className="font-mono font-bold">
                            {targetSizeVal} {targetSizeUnit} ({isEnlarge ? `+${formatBytes(targetBytes - curBytes)}` : `-${formatBytes(curBytes - targetBytes)}`})
                          </span>
                        </div>
                      );
                    })()}

                    {/* Output Format */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-400">Target Output Format:</span>
                      <select
                        value={resizeFormat}
                        onChange={(e) => setResizeFormat(e.target.value as any)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none"
                      >
                        <option value="image/jpeg">JPEG (Standard compatible)</option>
                        <option value="image/webp">WebP (Smallest file size)</option>
                        <option value="image/png">PNG (Lossless)</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
                        <span>Compression Quality:</span>
                        <span className="text-emerald-400 font-mono">{Math.round(compressQuality * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.95"
                        step="0.05"
                        value={compressQuality}
                        onChange={(e) => setCompressQuality(parseFloat(e.target.value))}
                        className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <button
                        onClick={() => {
                          setCompressQuality(0.5);
                          setResizeFormat('image/webp');
                        }}
                        className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-emerald-500 text-center"
                      >
                        <div className="font-semibold text-emerald-400">Extreme</div>
                        <div className="text-[10px] text-slate-400">~75% smaller</div>
                      </button>
                      <button
                        onClick={() => {
                          setCompressQuality(0.75);
                          setResizeFormat('image/webp');
                        }}
                        className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-emerald-500 text-center"
                      >
                        <div className="font-semibold text-emerald-400">Balanced</div>
                        <div className="text-[10px] text-slate-400">~50% smaller</div>
                      </button>
                      <button
                        onClick={() => {
                          setCompressQuality(0.9);
                          setResizeFormat('image/jpeg');
                        }}
                        className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-emerald-500 text-center"
                      >
                        <div className="font-semibold text-emerald-400">High Quality</div>
                        <div className="text-[10px] text-slate-400">Crisp photos</div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-400">Target Output Format:</span>
                      <select
                        value={resizeFormat}
                        onChange={(e) => setResizeFormat(e.target.value as any)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none"
                      >
                        <option value="image/webp">WebP (Smallest file size)</option>
                        <option value="image/jpeg">JPEG (Standard compatible)</option>
                      </select>
                    </div>
                  </div>
                )}
              </>
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
                onClick={handleDownloadResized}
                disabled={resizing}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow-lg disabled:opacity-50 transition-all ${
                  modalTab === 'compress'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                }`}
              >
                {resizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {modalTab === 'compress'
                  ? compressMode === 'target'
                    ? parseSizeToBytes(targetSizeVal, targetSizeUnit) > file.size
                      ? `Enlarge File Size to ${targetSizeVal} ${targetSizeUnit}`
                      : `Compress to ≤ ${targetSizeVal} ${targetSizeUnit}`
                    : 'Download Compressed Image'
                  : 'Download Resized Image'}
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
