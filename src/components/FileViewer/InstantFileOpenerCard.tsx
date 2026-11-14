import React, { useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Zap, ShieldCheck, FolderOpen, FileText, Archive, Table, Presentation, Image as ImageIcon, Sparkles
} from 'lucide-react';
import { pickSingleFile } from '../../utils/filePicker';

interface InstantFileOpenerCardProps {
  onFileSelected: (file: File) => void;
}

export const InstantFileOpenerCard: React.FC<InstantFileOpenerCardProps> = ({ onFileSelected }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  const handleSelectFile = async () => {
    if (Capacitor.isNativePlatform()) {
      const file = await pickSingleFile();
      if (file) {
        onFileSelected(file);
      }
    } else {
      inputRef.current?.click();
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="relative overflow-hidden rounded-3xl border-2 border-indigo-500/40 bg-gradient-to-b from-slate-900/90 via-indigo-950/20 to-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl group hover:border-indigo-500/80 transition-all"
    >
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left column: Info */}
        <div className="space-y-3 text-center md:text-left max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Instant File Opener</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> 100% Client-Side
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Open & Inspect Any File <span className="gradient-text">Instantly</span>
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Tap or drop any <strong className="text-white">PDF, ZIP, RAR, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), Images</strong> or <strong className="text-white">Code</strong> file. Includes built-in <strong className="text-emerald-400">Image Compressor</strong>, <strong className="text-purple-400">Image Enlarger (up to 400%)</strong>, and <strong className="text-indigo-400">PDF Page Resizer</strong>.
          </p>

          {/* Formats Pills */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 pt-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-[11px] font-semibold">
              <FileText className="w-3 h-3" /> PDF
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-800/60 text-amber-300 text-[11px] font-semibold">
              <Archive className="w-3 h-3" /> ZIP & RAR
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-950/50 border border-blue-800/60 text-blue-300 text-[11px] font-semibold">
              <FileText className="w-3 h-3" /> Word (.docx)
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-[11px] font-semibold">
              <Table className="w-3 h-3" /> Excel (.xlsx)
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-950/50 border border-orange-800/60 text-orange-300 text-[11px] font-semibold">
              <Presentation className="w-3 h-3" /> PowerPoint (.pptx)
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-950/50 border border-pink-800/60 text-pink-300 text-[11px] font-semibold">
              <ImageIcon className="w-3 h-3" /> Images (.png, .jpg)
            </span>
          </div>
        </div>

        {/* Right column: Action Dropzone Button */}
        <div className="w-full md:w-auto shrink-0 flex flex-col items-center">
          <input
            ref={inputRef}
            type="file"
            onChange={handleChange}
            className="hidden"
          />
          <button
            onClick={handleSelectFile}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <FolderOpen className="w-5 h-5" />
            <span>Select File to Open</span>
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          </button>
          <span className="text-[11px] text-slate-400 mt-2 font-medium">
            or drag & drop file anywhere on the screen
          </span>
        </div>
      </div>
    </div>
  );
};
