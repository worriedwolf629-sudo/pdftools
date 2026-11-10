import React, { useEffect, useState } from 'react';
import {
  Folder, FileText, Image as ImageIcon, FileCode, Archive, Download, Eye,
  Search, Lock, Unlock, Loader2, RefreshCw, X
} from 'lucide-react';
import type { ArchiveData, ArchiveEntry } from '../../utils/archiveViewer';
import { parseZipArchive, parseRarArchive } from '../../utils/archiveViewer';

interface ArchiveViewerProps {
  file: File | Blob;
  fileName: string;
  isRar?: boolean;
  onPreviewSubFile?: (file: File) => void;
}

export const ArchiveViewer: React.FC<ArchiveViewerProps> = ({
  file,
  fileName,
  isRar = false,
  onPreviewSubFile
}) => {
  const [data, setData] = useState<ArchiveData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [needsPassword, setNeedsPassword] = useState<boolean>(false);
  
  // Inline preview of a selected file inside the archive
  const [previewEntry, setPreviewEntry] = useState<{ entry: ArchiveEntry; url: string; text?: string; type: string } | null>(null);

  const loadArchive = async (pass = '') => {
    setLoading(true);
    setError('');
    setNeedsPassword(false);

    try {
      if (isRar || fileName.toLowerCase().endsWith('.rar')) {
        const rarData = await parseRarArchive(file, fileName, pass);
        setData(rarData);
      } else {
        const zipData = await parseZipArchive(file, fileName);
        setData(zipData);
      }
    } catch (err: any) {
      console.error('Archive extraction error:', err);
      const msg = err?.message || 'Failed to extract archive.';
      if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypted')) {
        setNeedsPassword(true);
        setError('This archive is password-protected. Please enter password below:');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchive();
  }, [file, isRar]);

  const handleDownloadEntry = async (entry: ArchiveEntry) => {
    try {
      const blob = await entry.getBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not download file from archive: ' + (err as any)?.message);
    }
  };

  const handlePreviewEntry = async (entry: ArchiveEntry) => {
    try {
      const blob = await entry.getBlob();
      const ext = entry.extension.toLowerCase();
      const isImg = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext);
      const isTxt = ['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'py', 'csv', 'xml', 'log'].includes(ext);

      if (onPreviewSubFile) {
        const subFile = new File([blob], entry.name, { type: blob.type || '' });
        onPreviewSubFile(subFile);
        return;
      }

      const url = URL.createObjectURL(blob);
      let text: string | undefined = undefined;

      if (isTxt) {
        text = await blob.text();
      }

      setPreviewEntry({
        entry,
        url,
        text,
        type: isImg ? 'image' : isTxt ? 'text' : 'generic'
      });
    } catch (err) {
      alert('Cannot preview this file: ' + (err as any)?.message);
    }
  };

  const filteredEntries = (data?.entries || []).filter((e) => {
    if (!search) return true;
    return e.path.toLowerCase().includes(search.toLowerCase());
  });

  const getEntryIcon = (entry: ArchiveEntry) => {
    if (entry.isDir) return <Folder className="w-5 h-5 text-amber-400 shrink-0" />;
    const ext = entry.extension.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) {
      return <ImageIcon className="w-5 h-5 text-emerald-400 shrink-0" />;
    }
    if (['pdf'].includes(ext)) {
      return <FileText className="w-5 h-5 text-red-400 shrink-0" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <Archive className="w-5 h-5 text-purple-400 shrink-0" />;
    }
    if (['js', 'ts', 'json', 'py', 'html', 'css', 'xml'].includes(ext)) {
      return <FileCode className="w-5 h-5 text-cyan-400 shrink-0" />;
    }
    return <FileText className="w-5 h-5 text-slate-400 shrink-0" />;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 text-white rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl backdrop-blur-md">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
              {fileName}
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {isRar ? 'RAR Archive' : 'ZIP Archive'}
              </span>
            </h3>
            {data && (
              <p className="text-xs text-slate-400">
                {data.totalFiles} files • {data.formattedTotalSize} uncompressed
              </p>
            )}
          </div>
        </div>

        {/* Search inside archive */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files inside archive..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Password Required Overlay for RAR */}
      {needsPassword && (
        <div className="p-6 bg-slate-800/80 border-b border-slate-700 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-base text-white">Encrypted Archive</h4>
            <p className="text-xs text-slate-300 mt-1">
              Enter the password to decrypt and view the contents of this archive:
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadArchive(password);
            }}
            className="flex items-center gap-2 max-w-sm w-full"
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Archive password..."
              className="flex-1 px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
            >
              <Unlock className="w-4 h-4" /> Unlock
            </button>
          </form>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
            <span className="text-sm font-medium">Extracting and reading archive...</span>
          </div>
        ) : error && !needsPassword ? (
          <div className="p-6 max-w-md mx-auto bg-red-950/60 border border-red-800 rounded-2xl text-center text-red-200">
            <p className="font-bold mb-1">Archive Error</p>
            <p className="text-xs text-red-300 mb-4">{error}</p>
            <button
              onClick={() => loadArchive()}
              className="px-4 py-1.5 bg-red-800 hover:bg-red-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try Again
            </button>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-sm">
            No files found matching "{search}"
          </div>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <div className="col-span-7 sm:col-span-8">Name / Path</div>
              <div className="col-span-3 sm:col-span-2 text-right">Size</div>
              <div className="col-span-2 sm:col-span-2 text-right">Actions</div>
            </div>

            <div className="divide-y divide-slate-800/60">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-slate-800/40 transition-colors text-xs"
                >
                  <div className="col-span-7 sm:col-span-8 flex items-center gap-2.5 overflow-hidden">
                    {getEntryIcon(entry)}
                    <span
                      className={`truncate font-mono ${
                        entry.isDir ? 'text-amber-300 font-semibold' : 'text-slate-200'
                      }`}
                      title={entry.path}
                    >
                      {entry.path}
                    </span>
                  </div>

                  <div className="col-span-3 sm:col-span-2 text-right font-mono text-slate-400">
                    {entry.formattedSize}
                  </div>

                  <div className="col-span-2 sm:col-span-2 flex items-center justify-end gap-1.5">
                    {!entry.isDir && (
                      <>
                        <button
                          onClick={() => handlePreviewEntry(entry)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors"
                          title="Preview File"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownloadEntry(entry)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors"
                          title="Download File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inline Preview Modal for Sub-file */}
      {previewEntry && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="max-w-3xl w-full max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
              <span className="font-bold text-sm text-white truncate max-w-md">
                {previewEntry.entry.name}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadEntry(previewEntry.entry)}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button
                  onClick={() => setPreviewEntry(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-auto flex items-center justify-center bg-slate-950/40">
              {previewEntry.type === 'image' ? (
                <img
                  src={previewEntry.url}
                  alt={previewEntry.entry.name}
                  className="max-h-[60vh] max-w-full rounded-xl shadow-lg object-contain"
                />
              ) : previewEntry.type === 'text' && previewEntry.text !== undefined ? (
                <pre className="w-full text-xs font-mono text-slate-200 bg-slate-950 p-4 rounded-xl overflow-x-auto border border-slate-800 max-h-[60vh]">
                  {previewEntry.text}
                </pre>
              ) : (
                <div className="text-center text-slate-400">
                  <p className="text-sm mb-2">No direct inline preview available for this file type.</p>
                  <button
                    onClick={() => handleDownloadEntry(previewEntry.entry)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> Download to open
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
