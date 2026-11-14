import React from 'react';
import { FileQuestion, Download, FolderOpen, AlertTriangle, ShieldCheck } from 'lucide-react';
import { pickSingleFile } from '../../utils/filePicker';

interface UnsupportedViewProps {
  file: File | Blob;
  fileName: string;
  extension: string;
  onSelectAnotherFile?: (newFile: File) => void;
}

export const UnsupportedView: React.FC<UnsupportedViewProps> = ({
  file,
  fileName,
  extension,
  onSelectAnotherFile
}) => {
  const ext = extension.toLowerCase();

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] || 'B'}`;
  };

  const getReason = (): { title: string; explanation: string } => {
    if (ext === 'ppt') {
      return {
        title: 'Legacy PowerPoint (.ppt)',
        explanation:
          'Only modern .pptx presentations are supported for client-side viewing. Legacy binary .ppt files cannot be parsed directly in the browser. Please convert the presentation to .pptx or open it in Microsoft PowerPoint.'
      };
    }
    if (ext === 'rar') {
      return {
        title: 'RAR Compressed Archive (.rar)',
        explanation:
          'RAR format support is skipped. RAR (especially RAR5) uses proprietary compression algorithms. Client-side WebAssembly ports have high failure rates, lack broad browser support, and can cause out-of-memory crashes on mobile WebViews.'
      };
    }
    if (ext === 'xar') {
      return {
        title: 'XAR Archive (.xar)',
        explanation:
          'XAR (eXtensible ARchive) is an Apple-derived XML archive format with no reliable, pure client-side JavaScript engine. It requires native system unpackers or backend processing.'
      };
    }
    return {
      title: ext ? `.${ext.toUpperCase()} File` : 'Unknown File Type',
      explanation:
        'This file type does not have a supported client-side in-browser viewer. You can download the file to open it with your system software.'
    };
  };

  const reason = getReason();

  const handleDownload = () => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenAnother = async () => {
    if (onSelectAnotherFile) {
      const newFile = await pickSingleFile();
      if (newFile) {
        onSelectAnotherFile(newFile);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[480px] h-full p-6 sm:p-10 bg-slate-900/90 text-white rounded-2xl border border-slate-700/60 shadow-2xl backdrop-blur-md">
      <div className="max-w-lg w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-5 shadow-lg shadow-amber-500/10">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-3">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Unsupported File Type</span>
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-white mb-2 break-all">
          {fileName}
        </h3>

        <div className="flex items-center gap-2 text-xs text-slate-400 mb-5 font-mono">
          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 uppercase">
            .{ext || 'unknown'}
          </span>
          <span>•</span>
          <span>{formatFileSize(file.size)}</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-left w-full mb-6">
          <h4 className="text-xs font-bold text-slate-200 mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {reason.title}
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            {reason.explanation}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <button
            onClick={handleDownload}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download File</span>
          </button>

          {onSelectAnotherFile && (
            <button
              onClick={handleOpenAnother}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-semibold text-xs text-slate-200 transition-all hover:scale-105 active:scale-95"
            >
              <FolderOpen className="w-4 h-4 text-indigo-400" />
              <span>Open Another File</span>
            </button>
          )}
        </div>

        <div className="mt-5 text-[11px] text-slate-500 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Files remain 100% private in local device memory</span>
        </div>
      </div>
    </div>
  );
};

