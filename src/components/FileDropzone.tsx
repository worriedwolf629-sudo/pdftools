import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { UploadCloud, File as FileIcon, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { pickFiles } from '../utils/filePicker';

interface FileDropzoneProps {
  accept?: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  files?: File[];
  onRemoveFile?: (index: number) => void;
  onMoveFile?: (from: number, to: number) => void;
  /** Small badge per file (e.g. "A" / "B" for Compare). */
  badges?: string[];
  label?: string;
  subtitle?: string;
}

const formatSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const Thumb: React.FC<{ file: File }> = ({ file }) => {
  const isImage = file.type.startsWith('image/');
  const url = useMemo(() => (isImage ? URL.createObjectURL(file) : ''), [file, isImage]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!isImage) {
    return (
      <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
        <FileIcon className="w-5 h-5" />
      </div>
    );
  }
  return <img src={url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700" />;
};

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  accept = '.pdf,application/pdf',
  multiple = false,
  onFilesSelected,
  files = [],
  onRemoveFile,
  onMoveFile,
  badges,
  label = 'Choose or Drag & Drop PDF files',
  subtitle = 'Files stay 100% private in your browser memory'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const deliver = (list: FileList | File[] | null) => {
    if (!list || list.length === 0) return;
    let selected = Array.from(list);
    // Respect `accept` for drag & drop too (the file dialog already filters, drop does not).
    const rules = accept.split(',').map((s) => s.trim().toLowerCase());
    selected = selected.filter((f) =>
      rules.some((r) => (r.startsWith('.') ? f.name.toLowerCase().endsWith(r) : r.endsWith('/*') ? f.type.startsWith(r.slice(0, -1)) : f.type === r))
    );
    if (selected.length) onFilesSelected(selected);
  };

  const handleZoneClick = async () => {
    if (Capacitor.isNativePlatform()) {
      const picked = await pickFiles({ accept, multiple });
      if (picked.length > 0) {
        deliver(picked);
      }
    } else {
      inputRef.current?.click();
    }
  };

  return (
    <div className="w-full space-y-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleZoneClick()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); deliver(e.dataTransfer.files); }}
        onClick={handleZoneClick}
        className={`relative rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 group outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          isDragging
            ? 'dropzone-active bg-indigo-50/80 dark:bg-indigo-950/40 shadow-xl scale-[1.015]'
            : 'border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 hover:border-indigo-500/70 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => { deliver(e.target.files); e.target.value = ''; }}
          className="hidden"
        />
        <div className={`w-16 h-16 mx-auto rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-md shadow-indigo-500/10 transition-transform duration-300 ${isDragging ? '-translate-y-2 scale-110' : 'group-hover:scale-110 group-hover:-translate-y-1'}`}>
          <UploadCloud className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading mb-1">{isDragging ? 'Drop to upload' : label}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{subtitle}</p>
        <div className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 group-hover:bg-indigo-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition-colors">
          Select {multiple ? 'Files' : 'File'}
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            Selected Files ({files.length}){onMoveFile && files.length > 1 ? ' · use arrows to reorder' : ''}
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {files.map((file, idx) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}-${idx}`}
                className="animate-slide-in flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {badges?.[idx] ? (
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-bold flex items-center justify-center">{badges[idx]}</span>
                  ) : (
                    <Thumb file={file} />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {onMoveFile && files.length > 1 && (
                    <>
                      <button type="button" aria-label="Move up" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); onMoveFile(idx, idx - 1); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button type="button" aria-label="Move down" disabled={idx === files.length - 1} onClick={(e) => { e.stopPropagation(); onMoveFile(idx, idx + 1); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {onRemoveFile && (
                    <button type="button" aria-label="Remove file" onClick={(e) => { e.stopPropagation(); onRemoveFile(idx); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
