import React, { useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  ArrowLeft, FolderOpen, Maximize2, Minimize2, Share2
} from 'lucide-react';
import { pickSingleFile } from '../../utils/filePicker';
import { FileRouter, getRouteForExtension } from './FileRouter';

interface UniversalFileViewerProps {
  file: File | Blob;
  fileName?: string;
  onClose: () => void;
  onSelectAnotherFile: (newFile: File) => void;
  onOpenWithPdfCraftTool?: (slug: string, file: File) => void;
}

export const UniversalFileViewer: React.FC<UniversalFileViewerProps> = ({
  file,
  fileName = 'unnamed-file',
  onClose,
  onSelectAnotherFile,
  onOpenWithPdfCraftTool
}) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const actualName = file instanceof File ? file.name : fileName;
  const { extension } = getRouteForExtension(actualName);

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] || 'B'}`;
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleShare = async () => {
    if (navigator.share && file instanceof File) {
      try {
        await navigator.share({
          files: [file],
          title: actualName,
          text: `Opened with PDFCraft Universal File Opener`
        });
      } catch (e) {
        console.log('Share dismissed');
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenAnotherFile = async () => {
    if (Capacitor.isNativePlatform()) {
      const newFile = await pickSingleFile();
      if (newFile) {
        onSelectAnotherFile(newFile);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onSelectAnotherFile(e.target.files[0]);
    }
  };

  return (
    <div
      className={`flex flex-col w-full h-[calc(100vh-100px)] min-h-[620px] transition-all animate-fade-in ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen rounded-none bg-slate-950 p-0' : ''
      }`}
    >
      {/* Master Top Bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 dark:bg-slate-900/90 border border-slate-700/80 rounded-2xl mb-3 shadow-xl backdrop-blur-md">
        {/* Left: Back button + File metadata */}
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all shrink-0 hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-bold text-sm text-white truncate max-w-[200px] sm:max-w-md">
              {actualName}
            </span>
            <span className="hidden sm:inline-block text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
              {extension ? `.${extension.toUpperCase()}` : 'FILE'}
            </span>
            {file.size > 0 && (
              <span className="hidden md:inline-block text-[11px] text-slate-400 font-mono shrink-0">
                ({formatFileSize(file.size)})
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Open Another File Native Picker */}
          <button
            onClick={handleOpenAnotherFile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            <FolderOpen className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Open Another File</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Web Share API */}
          {'share' in navigator && file instanceof File && (
            <button
              onClick={handleShare}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
              title="Share File"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Route to Extension-Based Viewer */}
      <div className="flex-1 w-full overflow-hidden">
        <FileRouter
          file={file}
          fileName={actualName}
          onSelectAnotherFile={onSelectAnotherFile}
          onOpenWithTool={onOpenWithPdfCraftTool}
        />
      </div>
    </div>
  );
};
