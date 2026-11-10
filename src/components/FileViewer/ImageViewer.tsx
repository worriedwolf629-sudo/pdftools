import React, { useEffect, useState } from 'react';
import {
  Image as ImageIcon, ZoomIn, ZoomOut, RotateCw, FlipHorizontal, FlipVertical,
  Download, Copy, Check, RefreshCw, FileText
} from 'lucide-react';

interface ImageViewerProps {
  file: File | Blob;
  fileName: string;
  onOpenWithTool?: (toolSlug: string, file: File) => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ file, fileName, onOpenWithTool }) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'normal' | 'invert' | 'contrast' | 'grayscale'>('normal');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const img = new Image();
    img.src = url;
    img.onload = () => {
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = fileName;
    a.click();
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
              onClick={() => setScale((s) => Math.max(0.2, s - 0.2))}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-semibold text-slate-300 min-w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(4, s + 0.2))}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setScale(1);
                setRotation(0);
                setFlipH(false);
                setFlipV(false);
                setFilterMode('normal');
              }}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"
              title="Reset View"
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
            <option value="invert">Filter: Invert</option>
            <option value="contrast">Filter: High Contrast</option>
            <option value="grayscale">Filter: Grayscale</option>
          </select>

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
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-slate-950/60 relative">
        {imageUrl ? (
          <div
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
              transition: 'transform 0.15s ease-out'
            }}
            className="inline-block"
          >
            <img
              src={imageUrl}
              alt={fileName}
              style={{ filter: getFilterStyle() }}
              className="max-h-[70vh] max-w-full rounded-xl shadow-2xl object-contain border border-slate-800"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
