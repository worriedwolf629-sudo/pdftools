import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Search, X, CornerDownLeft, Scaling, Minimize2, Maximize2 } from 'lucide-react';
import { searchTools } from '../registry/tools';
import { ToolIcon } from './ToolIcon';
import { pickSingleFile } from '../utils/filePicker';
import type { PDFTool } from '../registry/tools';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (slug: string) => void;
  onOpenFile?: (file: File) => void;
}

interface UnifiedSearchItem {
  id: string;
  name: string;
  categoryName: string;
  shortDescription: string;
  iconNode: React.ReactNode;
  isQuickAction?: boolean;
  badge?: string;
  onSelect: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectTool,
  onOpenFile
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  const handleQuery = (v: string) => {
    setQuery(v);
    setSelectedIndex(0);
  };

  const close = () => {
    setQuery('');
    setSelectedIndex(0);
    onClose();
  };

  const handlePickImage = async () => {
    if (Capacitor.isNativePlatform()) {
      const file = await pickSingleFile();
      if (file && onOpenFile) {
        onOpenFile(file);
        close();
        return;
      }
    }
    imageInputRef.current?.click();
  };

  const handlePickPdf = async () => {
    if (Capacitor.isNativePlatform()) {
      const file = await pickSingleFile();
      if (file && onOpenFile) {
        onOpenFile(file);
        close();
        return;
      }
    }
    pdfInputRef.current?.click();
  };

  // Quick Action Items for Image & PDF Compress / Resize / Enlarge
  const quickActions = [
    {
      id: 'qa-compress-image',
      name: 'Compress Image (WebP, JPEG, PNG)',
      categoryName: 'Image Optimization',
      shortDescription: 'Reduce image file size with quality slider & WebP presets in browser',
      badge: 'Quick Action',
      iconNode: <Minimize2 className="w-4 h-4 text-emerald-400" />,
      keywords: ['compress', 'compress image', 'shrink image', 'reduce image size', 'image compressor', 'photo compress', 'com'],
      onSelect: () => {
        if (onOpenFile) {
          handlePickImage();
        } else {
          onSelectTool('open-file');
          close();
        }
      }
    },
    {
      id: 'qa-enlarge-image',
      name: 'Resize & Enlarge Image',
      categoryName: 'Image Transform',
      shortDescription: 'Enlarge images up to 400% or scale down with aspect ratio lock',
      badge: 'Quick Action',
      iconNode: <Scaling className="w-4 h-4 text-purple-400" />,
      keywords: ['resize', 'enlarge', 'resize image', 'enlarge image', 'upscale image', 'image size', 'photo resize', 'enlarge photo', 'scale'],
      onSelect: () => {
        if (onOpenFile) {
          handlePickImage();
        } else {
          onSelectTool('open-file');
          close();
        }
      }
    },
    {
      id: 'qa-enlarge-pdf',
      name: 'Resize & Enlarge PDF Pages',
      categoryName: 'PDF Scaling',
      shortDescription: 'Scale PDF pages up to 300% or resize to A3, Tabloid, Legal formats',
      badge: 'Quick Action',
      iconNode: <Maximize2 className="w-4 h-4 text-indigo-400" />,
      keywords: ['resize', 'enlarge', 'resize pdf', 'enlarge pdf', 'scale pdf', 'pdf scaler', 'pdf page size', 'scale'],
      onSelect: () => {
        if (onOpenFile) {
          handlePickPdf();
        } else {
          onSelectTool('open-file');
          close();
        }
      }
    }
  ];

  // Match quick actions against query
  const qLower = query.toLowerCase().trim();
  const matchingQuickActions = !qLower
    ? quickActions
    : quickActions.filter((qa) =>
        qa.name.toLowerCase().includes(qLower) ||
        qa.shortDescription.toLowerCase().includes(qLower) ||
        qa.keywords.some((k) => k.toLowerCase().includes(qLower))
      );

  const rawTools = searchTools(query);
  const matchingTools: UnifiedSearchItem[] = rawTools.map((tool: PDFTool) => ({
    id: tool.id,
    name: tool.name,
    categoryName: tool.categoryName,
    shortDescription: tool.shortDescription,
    iconNode: <ToolIcon name={tool.iconName} className="w-4 h-4" />,
    isQuickAction: false,
    onSelect: () => {
      onSelectTool(tool.slug);
      close();
    }
  }));

  // Build unified items: if searching for compress or enlarge/resize, boost matching quick actions
  const qaUnified: UnifiedSearchItem[] = matchingQuickActions.map((qa) => ({
    id: qa.id,
    name: qa.name,
    categoryName: qa.categoryName,
    shortDescription: qa.shortDescription,
    iconNode: qa.iconNode,
    isQuickAction: true,
    badge: qa.badge,
    onSelect: qa.onSelect
  }));

  const allItems: UnifiedSearchItem[] = qLower
    ? [...qaUnified, ...matchingTools]
    : [...matchingTools, ...qaUnified];

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, allItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-md animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {/* Hidden file pickers for direct 1-click Quick Actions */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0] && onOpenFile) {
            onOpenFile(e.target.files[0]);
            close();
          }
          e.target.value = '';
        }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0] && onOpenFile) {
            onOpenFile(e.target.files[0]);
            close();
          }
          e.target.value = '';
        }}
      />

      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-pop-in"
        onKeyDown={handleKeyDown}
      >
        <div className="relative p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            placeholder="Search PDF or Image tools (e.g. Compress, Enlarge, Resize, Merge, OCR)..."
            className="w-full bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base focus:outline-none font-sans"
          />
          <button
            onClick={close}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-2 flex-1 space-y-1">
          {allItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              No tool found matching "<span className="font-semibold">{query}</span>"
            </div>
          ) : (
            allItems.map((item, index: number) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => item.onSelect()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                        item.isQuickAction
                          ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
                          : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      {item.iconNode}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm font-heading">
                          {item.name}
                        </span>
                        {item.badge ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-300">
                            {item.badge}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            {item.categoryName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.shortDescription}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">
                      <span>{item.isQuickAction ? 'Action' : 'Open'}</span>
                      <CornerDownLeft className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Use <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">↑</kbd>{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">↓</kbd> to navigate
          </span>
          <span>
            Press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">ESC</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
};
