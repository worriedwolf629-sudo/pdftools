import React, { useState } from 'react';
import {
  FileText, FileSpreadsheet, Loader2, Download, AlertCircle,
  CheckCircle2, RefreshCw
} from 'lucide-react';
import {
  convertPdfToDocx, convertPdfToExcel, type PdfToDocxResult, type PdfToExcelResult
} from '../../utils/pdfToOffice';

interface PdfToOfficeToolProps {
  file: File;
  onError: (msg: string) => void;
}

export const PdfToOfficeTool: React.FC<PdfToOfficeToolProps> = ({ file, onError }) => {
  const [targetFormat, setTargetFormat] = useState<'docx' | 'xlsx'>('docx');
  const [converting, setConverting] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [convertedResult, setConvertedResult] = useState<{
    blob: Blob;
    filename: string;
    stats: string;
    isScanned: boolean;
  } | null>(null);

  const handleConvert = async () => {
    try {
      setConverting(true);
      setProgressMsg('Extracting layout and text streams from PDF...');
      const base = file.name.replace(/\.pdf$/i, '');

      if (targetFormat === 'docx') {
        const res: PdfToDocxResult = await convertPdfToDocx(file, (_pct, label) => {
          if (label) setProgressMsg(label);
        });
        setConvertedResult({
          blob: res.blob,
          filename: `${base}.docx`,
          stats: `${res.pageCount} Pages • ${res.charCount.toLocaleString()} Characters`,
          isScanned: res.isScanned
        });
      } else {
        const res: PdfToExcelResult = await convertPdfToExcel(file, (_pct, label) => {
          if (label) setProgressMsg(label);
        });
        setConvertedResult({
          blob: res.blob,
          filename: `${base}.xlsx`,
          stats: `${res.sheetCount} Worksheets • ${res.rowCount} Table Rows`,
          isScanned: res.isScanned
        });
      }
    } catch (e: any) {
      onError(e?.message || 'Failed to convert PDF to Office document.');
    } finally {
      setConverting(false);
    }
  };

  const handleDownload = () => {
    if (!convertedResult) return;
    const url = URL.createObjectURL(convertedResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = convertedResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Honest Notice */}
      <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 flex items-start space-x-3 text-xs text-amber-200">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="block text-amber-300 font-bold mb-0.5">
            Digital PDF Structure Extraction
          </strong>
          Headings, paragraphs, bullet lists, and coordinate-aligned tables are converted directly into editable Microsoft Word (.docx) and Excel (.xlsx) formats. Highly complex multi-column brochure art and scanned paper photos require OCR first for text recovery.
        </div>
      </div>

      {/* Format Selector & Convert Panel */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
            Choose Output Office Format
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setTargetFormat('docx');
                setConvertedResult(null);
              }}
              className={`p-4 rounded-xl border transition-all text-left flex items-start space-x-3 ${
                targetFormat === 'docx'
                  ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 shrink-0 mt-0.5">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">Word Document (.docx)</span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Reconstructs headings, paragraphs, bullet points, and tables into an editable OpenXML document.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetFormat('xlsx');
                setConvertedResult(null);
              }}
              className={`p-4 rounded-xl border transition-all text-left flex items-start space-x-3 ${
                targetFormat === 'xlsx'
                  ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-500/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 shrink-0 mt-0.5">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">Excel Spreadsheet (.xlsx)</span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Detects table coordinate matrices from each page and maps them into worksheets.
                </span>
              </div>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleConvert}
          disabled={converting}
          className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          {converting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{progressMsg || 'Converting PDF...'}</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Convert to {targetFormat === 'docx' ? 'Microsoft Word (.docx)' : 'Microsoft Excel (.xlsx)'}</span>
            </>
          )}
        </button>
      </div>

      {/* Result Card */}
      {convertedResult && (
        <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <span className="text-sm font-bold text-white block">{convertedResult.filename}</span>
                <span className="text-xs text-slate-400 block font-mono">{convertedResult.stats}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download {convertedResult.filename}</span>
            </button>
          </div>

          {convertedResult.isScanned && (
            <div className="bg-amber-950/40 p-3 rounded-xl border border-amber-600/30 text-amber-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                Note: This PDF contained very little selectable digital text (likely scanned). For full text accuracy, run the OCR tool first.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
