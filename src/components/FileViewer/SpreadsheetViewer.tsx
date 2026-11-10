import React, { useEffect, useState } from 'react';
import {
  Table, Download, Search, Loader2, Layers, Copy, Check
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface SpreadsheetViewerProps {
  file: File | Blob;
  fileName: string;
}

export const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({ file, fileName }) => {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [data, setData] = useState<any[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        if (isCancelled) return;

        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        if (wb.SheetNames.length > 0) {
          const initialSheet = wb.SheetNames[0];
          setActiveSheet(initialSheet);
          loadSheetData(wb, initialSheet);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Spreadsheet load error:', err);
          setError(err?.message || 'Failed to parse spreadsheet.');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [file]);

  const loadSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      setData([]);
      return;
    }
    const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    setData(rawData);
  };

  const handleSelectSheet = (name: string) => {
    setActiveSheet(name);
    if (workbook) {
      loadSheetData(workbook, name);
    }
  };

  const handleDownloadCsv = () => {
    if (!workbook || !activeSheet) return;
    const ws = workbook.Sheets[activeSheet];
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\.[^/.]+$/, '')}-${activeSheet}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadOriginal = () => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTable = () => {
    if (!data.length) return;
    const tsv = data.map((row) => row.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Convert column index to Excel column header letter (0 -> A, 25 -> Z, 26 -> AA)
  const getColLetter = (idx: number): string => {
    let result = '';
    let temp = idx;
    while (temp >= 0) {
      result = String.fromCharCode((temp % 26) + 65) + result;
      temp = Math.floor(temp / 26) - 1;
    }
    return result;
  };

  const filteredData = data.filter((row) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return row.some((cell) => String(cell || '').toLowerCase().includes(q));
  });

  const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);

  return (
    <div className="flex flex-col h-full bg-slate-900/90 text-white rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl backdrop-blur-md">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
            <Table className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
              {fileName}
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Spreadsheet
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {data.length} rows • {maxCols} columns • {sheetNames.length} sheet(s)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-48 sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter cell text..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={handleCopyTable}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-all"
            title="Copy all rows to clipboard (TSV)"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-xs font-semibold text-white shadow-md shadow-emerald-700/20"
            title="Download active sheet as CSV"
          >
            <Download className="w-4 h-4" /> CSV
          </button>

          <button
            onClick={handleDownloadOriginal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200"
            title="Download original file"
          >
            <Download className="w-4 h-4" /> File
          </button>
        </div>
      </div>

      {/* Sheet Tabs */}
      {sheetNames.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-950/60 border-b border-slate-800 overflow-x-auto scrollbar-none">
          <Layers className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          {sheetNames.map((name) => (
            <button
              key={name}
              onClick={() => handleSelectSheet(name)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all shrink-0 border ${
                activeSheet === name
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                  : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Spreadsheet Data Grid */}
      <div className="flex-1 overflow-auto bg-slate-950/40 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            <span className="text-sm font-medium">Parsing spreadsheet data...</span>
          </div>
        ) : error ? (
          <div className="p-6 max-w-md mx-auto my-12 bg-red-950/60 border border-red-800 rounded-2xl text-center text-red-200">
            <p className="font-bold mb-1">Spreadsheet Error</p>
            <p className="text-xs text-red-300">{error}</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-sm">
            No rows found matching search query.
          </div>
        ) : (
          <table className="min-w-full border-collapse text-left font-mono text-xs">
            {/* Header row with A, B, C... */}
            <thead className="sticky top-0 z-10 bg-slate-900 border-b-2 border-slate-700 shadow-sm">
              <tr>
                <th className="w-12 px-3 py-2 bg-slate-950 text-slate-500 text-center font-bold border-r border-slate-800 select-none">
                  #
                </th>
                {Array.from({ length: maxCols }).map((_, cIdx) => (
                  <th
                    key={cIdx}
                    className="px-4 py-2 text-slate-300 font-bold border-r border-slate-800 uppercase tracking-wider min-w-[120px]"
                  >
                    {getColLetter(cIdx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredData.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-3 py-2 bg-slate-950/80 text-slate-500 text-center font-bold border-r border-slate-800 select-none">
                    {rIdx + 1}
                  </td>
                  {Array.from({ length: maxCols }).map((_, cIdx) => {
                    const cellVal = row[cIdx] !== undefined ? String(row[cIdx]) : '';
                    const isMatched = search && cellVal.toLowerCase().includes(search.toLowerCase());

                    return (
                      <td
                        key={cIdx}
                        className={`px-4 py-2 border-r border-slate-800/60 truncate max-w-xs ${
                          isMatched ? 'bg-amber-500/20 text-amber-200 font-bold' : 'text-slate-200'
                        }`}
                        title={cellVal}
                      >
                        {cellVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
