import React, { useEffect, useRef, useState } from 'react';
import { FileText, Download, Printer, ZoomIn, ZoomOut, Loader2, AlertCircle } from 'lucide-react';
import { renderAsync } from 'docx-preview';

interface DocumentViewerProps {
  file: File | Blob;
  fileName: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ file, fileName }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [scale, setScale] = useState<number>(1);
  const [isLegacyDoc, setIsLegacyDoc] = useState<boolean>(false);
  const [fallbackText, setFallbackText] = useState<string>('');

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError('');
    setIsLegacyDoc(false);
    setFallbackText('');

    (async () => {
      try {
        const buffer = await file.arrayBuffer();
        if (isCancelled) return;

        const isDoc = fileName.toLowerCase().endsWith('.doc');

        if (isDoc) {
          // Legacy .doc format (binary CFBF, not docx zip)
          setIsLegacyDoc(true);
          // Extract ascii/utf-16 text chunks
          const dec = new TextDecoder('utf-8', { fatal: false });
          const raw = dec.decode(buffer);
          // filter printable chars
          const cleaned = raw
            .replace(/[^\x20-\x7E\t\n\r]/g, ' ')
            .replace(/\s{2,}/g, '\n')
            .trim();
          setFallbackText(cleaned || 'Could not extract plain text from legacy .doc file.');
          setLoading(false);
          return;
        }

        // Render DOCX with docx-preview
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          await renderAsync(buffer, containerRef.current, undefined, {
            className: 'docx-preview-doc',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true
          });
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Docx render error:', err);
          setError(err?.message || 'Failed to render Word document.');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [file, fileName]);

  const handleDownload = () => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (isLegacyDoc) {
      window.print();
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${fileName}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
            .docx-preview-doc { width: 100% !important; margin: 0 auto; }
          </style>
        </head>
        <body>
          ${container.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 text-white rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl backdrop-blur-md">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
              {fileName}
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {isLegacyDoc ? 'Word .doc' : 'Word .docx'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {isLegacyDoc ? 'Legacy Binary Format' : 'Microsoft Word Document'}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          {!isLegacyDoc && (
            <div className="flex items-center gap-1 bg-slate-800/90 rounded-xl p-1 border border-slate-700/80">
              <button
                onClick={() => setScale((s) => Math.max(0.6, s - 0.1))}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-semibold text-slate-300 min-w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(1.8, s + 0.1))}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200"
            title="Print Document"
          >
            <Printer className="w-4 h-4" /> Print
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-xs text-white shadow-md shadow-blue-600/30"
            title="Download Word Document"
          >
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      {/* Main Document Body */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center bg-slate-950/50">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            <span className="text-sm font-medium">Rendering Word document...</span>
          </div>
        ) : error ? (
          <div className="p-6 max-w-md mx-auto my-12 bg-red-950/60 border border-red-800 rounded-2xl text-center text-red-200">
            <p className="font-bold mb-1">Document Load Error</p>
            <p className="text-xs text-red-300 mb-3">{error}</p>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Download file instead
            </button>
          </div>
        ) : isLegacyDoc ? (
          <div className="max-w-3xl w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                This is a legacy binary Word .doc format. Text content has been extracted below:
              </span>
            </div>
            <pre className="font-sans text-sm text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
              {fallbackText}
            </pre>
          </div>
        ) : (
          <div
            style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
            className="transition-transform duration-150 ease-out mb-12 shadow-2xl rounded-xl bg-white text-slate-900 p-8 max-w-4xl w-full overflow-hidden"
          >
            <div ref={containerRef} className="docx-render-container" />
          </div>
        )}
      </div>
    </div>
  );
};

