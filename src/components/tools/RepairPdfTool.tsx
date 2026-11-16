import React, { useState } from 'react';
import {
  Wrench, CheckCircle2, Loader2, Download,
  Terminal
} from 'lucide-react';
import { repairPdf, formatBytes, type RepairResult } from '../../utils/pdfEngine';

interface RepairPdfToolProps {
  file: File;
  onRepairComplete: (blob: Blob, filename: string) => void;
  onError: (msg: string) => void;
}

export const RepairPdfTool: React.FC<RepairPdfToolProps> = ({
  file,
  onRepairComplete,
  onError
}) => {
  const [running, setRunning] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [result, setResult] = useState<RepairResult | null>(null);

  const handleStartRepair = async () => {
    try {
      setRunning(true);
      setProgressMsg('Starting deep binary analysis...');
      const rep = await repairPdf(file, (_pct, label) => {
        if (label) setProgressMsg(label);
      });
      setResult(rep);
    } catch (e: any) {
      onError(e?.message || 'PDF could not be repaired.');
    } finally {
      setRunning(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const base = file.name.replace(/\.pdf$/i, '');
    const blob = new Blob([new Uint8Array(result.pdfBytes) as any], { type: 'application/pdf' });
    onRepairComplete(blob, `${base}_repaired.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* File Info & Engine Overview */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
              Target Document for Repair
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white truncate max-w-sm">{file.name}</span>
              <span className="text-xs font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-800">
                {formatBytes(file.size)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartRepair}
            disabled={running}
            className="py-2.5 px-5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{progressMsg || 'Repairing PDF...'}</span>
              </>
            ) : (
              <>
                <Wrench className="w-4 h-4" />
                <span>Run Diagnostic & Repair</span>
              </>
            )}
          </button>
        </div>

        {/* License & Privacy Notice */}
        <div className="text-[11px] text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 flex items-center justify-between">
          <span>
            🛡️ <strong>100% Commercial-Safe Client Engine:</strong> Powered by MIT-licensed pdf-lib & Apache 2.0 pdfjs recovery algorithms. Zero copyleft AGPL dependencies. Zero uploads.
          </span>
        </div>
      </div>

      {/* Repair Result & Diagnostic Log */}
      {result && (
        <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-5 animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-white">Repair Successful</h3>
                <p className="text-xs text-slate-300">{result.details}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Repaired PDF</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Recovered Pages</span>
              <span className="text-lg font-bold font-mono text-emerald-400">{result.recoveredPages}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Output File Size</span>
              <span className="text-lg font-bold font-mono text-indigo-400">{formatBytes(result.pdfBytes.byteLength)}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Status Mode</span>
              <span className="text-xs font-bold uppercase font-mono text-slate-200">{result.status}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Specification</span>
              <span className="text-xs font-bold font-mono text-slate-200">ISO 32000-1</span>
            </div>
          </div>

          {/* Terminal-style Diagnostic Log */}
          <div className="space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Forensic Repair Audit Log:</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-slate-300 space-y-1.5 max-h-48 overflow-y-auto">
              {result.diagnosticLog.map((line, idx) => (
                <div key={idx} className="flex items-start space-x-2">
                  <span className="text-slate-500 select-none">[{idx + 1}]</span>
                  <span className={line.includes('warning') || line.includes('Missing') ? 'text-amber-300' : 'text-slate-200'}>
                    {line}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
