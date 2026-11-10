import React, { useEffect, useState } from 'react';
import { FileUp, Zap } from 'lucide-react';

interface GlobalDropzoneOverlayProps {
  onFileReceived: (file: File) => void;
}

export const GlobalDropzoneOverlay: React.FC<GlobalDropzoneOverlayProps> = ({ onFileReceived }) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        setIsDragging(false);
        dragCounter = 0;
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        onFileReceived(file);
      }
    };

    // Paste handler for screenshots or copied files
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      // If active element is an input or textarea, let default paste work
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        onFileReceived(file);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('paste', handlePaste);
    };
  }, [onFileReceived]);

  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
      <div className="max-w-lg w-full p-8 rounded-3xl border-3 border-dashed border-indigo-500 bg-indigo-950/40 shadow-2xl shadow-indigo-500/30 text-center flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-xl animate-bounce">
          <FileUp className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center justify-center gap-2">
            Drop to Open Instantly <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
          </h2>
          <p className="text-sm text-slate-300 mt-2">
            PDF, ZIP, RAR, Word (DOCX), Excel (XLSX), PowerPoint (PPTX), Images & Code files.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-semibold text-indigo-300">
          <span className="px-2 py-0.5 rounded-md bg-indigo-900/60 border border-indigo-700/60">PDF</span>
          <span className="px-2 py-0.5 rounded-md bg-indigo-900/60 border border-indigo-700/60">ZIP</span>
          <span className="px-2 py-0.5 rounded-md bg-indigo-900/60 border border-indigo-700/60">RAR</span>
          <span className="px-2 py-0.5 rounded-md bg-indigo-900/60 border border-indigo-700/60">DOCX</span>
          <span className="px-2 py-0.5 rounded-md bg-indigo-900/60 border border-indigo-700/60">XLSX</span>
          <span className="px-2 py-0.5 rounded-md bg-indigo-900/60 border border-indigo-700/60">PPTX</span>
          <span className="px-2 py-0.5 rounded-md bg-indigo-900/60 border border-indigo-700/60">PNG / JPG</span>
        </div>
      </div>
    </div>
  );
};
