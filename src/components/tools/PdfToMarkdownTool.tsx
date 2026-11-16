import React, { useState, useEffect } from 'react';
import {
  Copy, Check, Download, AlertCircle, Loader2,
  ScanText, Eye, Code2
} from 'lucide-react';
import {
  pdfToMarkdown, pdfOcrToMarkdown, type MarkdownExtractionResult
} from '../../utils/pdfEngine';

interface PdfToMarkdownToolProps {
  file: File;
  onError: (msg: string) => void;
}

export const PdfToMarkdownTool: React.FC<PdfToMarkdownToolProps> = ({ file, onError }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [progressMsg, setProgressMsg] = useState<string>('Extracting text and analyzing font hierarchy...');
  const [markdown, setMarkdown] = useState<string>('');
  const [stats, setStats] = useState<{ pages: number; chars: number; isScanned: boolean }>({
    pages: 1,
    chars: 0,
    isScanned: false
  });

  const [activeTab, setActiveTab] = useState<'preview' | 'raw'>('preview');
  const [copied, setCopied] = useState<boolean>(false);
  const [runningOcr, setRunningOcr] = useState<boolean>(false);
  const [ocrMsg, setOcrMsg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res: MarkdownExtractionResult = await pdfToMarkdown(file, (_pct, label) => {
          if (label) setProgressMsg(label);
        });
        if (cancelled) return;
        setMarkdown(res.markdown);
        setStats({ pages: res.pageCount, chars: res.charCount, isScanned: res.isScanned });
      } catch (e: any) {
        if (!cancelled) onError(e?.message || 'Failed to convert PDF to Markdown.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const base = file.name.replace(/\.pdf$/i, '');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRunOcr = async () => {
    try {
      setRunningOcr(true);
      setOcrMsg('Initializing Tesseract OCR engine...');
      const ocrMd = await pdfOcrToMarkdown(file, 'eng', (_pct, label) => {
        if (label) setOcrMsg(label);
      });
      setMarkdown(ocrMd);
      setStats((prev) => ({ ...prev, isScanned: false, chars: ocrMd.length }));
    } catch (e: any) {
      onError(e?.message || 'OCR failed.');
    } finally {
      setRunningOcr(false);
    }
  };

  // Simple Markdown-to-HTML parser for rendered preview tab
  const renderSimpleMarkdown = (md: string) => {
    if (!md) return <p className="text-slate-500 italic">No text extracted.</p>;

    const lines = md.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="text-2xl font-extrabold text-white mt-4 mb-2 pb-1 border-b border-slate-800">{line.slice(2)}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-xl font-bold text-indigo-300 mt-3 mb-1.5">{line.slice(3)}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-base font-semibold text-slate-200 mt-2 mb-1">{line.slice(4)}</h3>;
      }
      if (line.startsWith('- ')) {
        return <li key={idx} className="ml-5 list-disc text-slate-300 text-xs py-0.5">{line.slice(2)}</li>;
      }
      if (line.startsWith('|')) {
        return (
          <div key={idx} className="font-mono text-[11px] text-indigo-200 bg-slate-950/70 px-2 py-0.5 rounded border border-slate-800 overflow-x-auto whitespace-pre">
            {line}
          </div>
        );
      }
      if (line.startsWith('---')) {
        return <hr key={idx} className="my-4 border-slate-800" />;
      }
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }
      return <p key={idx} className="text-slate-300 text-xs leading-relaxed">{line}</p>;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-xs font-medium">{progressMsg}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner if scanned document */}
      {stats.isScanned && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <strong className="block font-bold text-amber-300">Scanned Document Detected</strong>
              This PDF contains scanned images or photos with very little digital selectable text.
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunOcr}
            disabled={runningOcr}
            className="py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow transition-colors flex items-center space-x-1.5 disabled:opacity-50"
          >
            {runningOcr ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{ocrMsg || 'Running OCR...'}</span>
              </>
            ) : (
              <>
                <ScanText className="w-3.5 h-3.5" />
                <span>Run Browser OCR (Tesseract.js)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Header Bar: Stats, Tabs & Actions */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Tabs & Stats */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'preview'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Rendered Preview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'raw'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Markdown Source</span>
          </button>

          <span className="text-[11px] font-mono text-slate-400 pl-2">
            {stats.pages} Pages • {stats.chars.toLocaleString()} Characters
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopy}
            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors flex items-center space-x-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Markdown'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-500/20 transition-all flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .md</span>
          </button>
        </div>
      </div>

      {/* Content Display */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 min-h-[400px] max-h-[65vh] overflow-y-auto">
        {activeTab === 'preview' ? (
          <div className="space-y-1 max-w-3xl">
            {renderSimpleMarkdown(markdown)}
          </div>
        ) : (
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="w-full h-[55vh] bg-transparent text-slate-200 font-mono text-xs leading-relaxed outline-none resize-none"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
};
