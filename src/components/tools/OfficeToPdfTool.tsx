import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet, FileText, Presentation, Code, Loader2,
  AlertCircle, RefreshCw
} from 'lucide-react';
import { convertOfficeFileToPdf, type OfficeConversionResult } from '../../utils/officeToPdf';

interface OfficeToPdfToolProps {
  initialFile?: File;
  onConvertComplete: (blob: Blob, filename: string) => void;
  onError: (msg: string) => void;
}

export const OfficeToPdfTool: React.FC<OfficeToPdfToolProps> = ({
  initialFile,
  onConvertComplete,
  onError
}) => {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [converting, setConverting] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  useEffect(() => {
    if (initialFile) setFile(initialFile);
  }, [initialFile]);

  const getFormatBadge = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'docx':
      case 'doc':
        return { label: 'Word Document', color: 'bg-blue-950 text-blue-300 border-blue-800', icon: FileText };
      case 'xlsx':
      case 'xls':
      case 'csv':
        return { label: 'Excel Spreadsheet', color: 'bg-emerald-950 text-emerald-300 border-emerald-800', icon: FileSpreadsheet };
      case 'pptx':
      case 'ppt':
        return { label: 'PowerPoint Slide Deck', color: 'bg-orange-950 text-orange-300 border-orange-800', icon: Presentation };
      case 'html':
      case 'htm':
        return { label: 'HTML Web Page', color: 'bg-purple-950 text-purple-300 border-purple-800', icon: Code };
      default:
        return { label: 'Office Document', color: 'bg-slate-900 text-slate-300 border-slate-700', icon: FileText };
    }
  };

  const handleConvert = async () => {
    if (!file) return;
    try {
      setConverting(true);
      setProgressMsg(`Parsing ${file.name} structure...`);
      const result: OfficeConversionResult = await convertOfficeFileToPdf(file);
      const base = file.name.replace(/\.[^/.]+$/, '');
      const blob = new Blob([new Uint8Array(result.pdfBytes) as any], { type: 'application/pdf' });
      onConvertComplete(blob, `${base}.pdf`);
    } catch (e: any) {
      onError(e?.message || 'Failed to convert document to PDF.');
    } finally {
      setConverting(false);
    }
  };

  const badge = file ? getFormatBadge(file.name) : null;
  const BadgeIcon = badge?.icon || FileText;

  return (
    <div className="space-y-6">
      {/* Honest Layout Notice */}
      <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 flex items-start space-x-3 text-xs text-amber-200">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="block text-amber-300 font-bold mb-0.5">
            100% Client-Side Conversion (Approximate Layout)
          </strong>
          Word, Excel, PowerPoint, and HTML documents are converted completely offline in browser memory. Clean documents, tables, lists, and presentation slides convert beautifully. For complex corporate Word macros, proprietary equations, and complex vector art, a headless LibreOffice cloud server is traditionally required. Your files remain 100% confidential.
        </div>
      </div>

      {/* Conversion Workspace */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-5">
        {file ? (
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-slate-800 text-indigo-400">
                <BadgeIcon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block truncate max-w-sm">{file.name}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border inline-block mt-0.5 ${badge?.color}`}>
                  {badge?.label}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConvert}
              disabled={converting}
              className="py-2.5 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {converting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{progressMsg || 'Converting to PDF...'}</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Convert to PDF</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="text-center p-8 text-slate-400 text-xs">
            Drop any Word (.docx), Excel (.xlsx, .csv), PowerPoint (.pptx), or HTML document above to convert to PDF.
          </div>
        )}
      </div>
    </div>
  );
};
