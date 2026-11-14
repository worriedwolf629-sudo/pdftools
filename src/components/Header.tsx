import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Search, Moon, Sun, ShieldCheck, ChevronDown, Layers, FileText, Menu, X, FolderOpen } from 'lucide-react';
import { CATEGORIES } from '../registry/tools';
import { pickSingleFile } from '../utils/filePicker';

interface HeaderProps {
  onOpenSearch: () => void;
  activeCategory?: string;
  onSelectCategory: (catId: string) => void;
  onNavigateHome: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onOpenFile?: (file: File) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  activeCategory,
  onSelectCategory,
  onNavigateHome,
  darkMode,
  setDarkMode,
  onOpenFile
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerFileRef = useRef<HTMLInputElement | null>(null);

  const handleHeaderOpenFile = async () => {
    if (Capacitor.isNativePlatform()) {
      const file = await pickSingleFile();
      if (file && onOpenFile) {
        onOpenFile(file);
      }
    } else {
      headerFileRef.current?.click();
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenSearch();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onOpenSearch]);

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none" onClick={onNavigateHome}>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white shrink-0 transition-transform duration-300 hover:rotate-6 hover:scale-105">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-1 font-heading">
              PDF<span className="gradient-text">Craft</span>
            </span>
            <span className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Private Engine
            </span>
          </div>
        </div>

        {/* Desktop Search Bar Trigger */}
        <div className="hidden md:flex flex-1 max-w-md mx-6 lg:mx-8">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/70 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl transition-all shadow-inner"
          >
            <span className="flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-500" />
              <span>Search PDF tools (e.g. Merge, Compress, OCR)...</span>
            </span>
            <kbd className="px-2 py-0.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-xs font-mono">
              ⌘K / Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Instant Open Any File Action */}
          {onOpenFile && (
            <>
              <input
                ref={headerFileRef}
                type="file"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onOpenFile(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />
              <button
                onClick={handleHeaderOpenFile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/30 cursor-pointer transition-all hover:scale-105 active:scale-95 shrink-0"
              >
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Open Any File</span>
                <span className="sm:hidden text-xs">Open</span>
              </button>
            </>
          )}
          
          {/* Mobile Search Button */}
          <button
            onClick={onOpenSearch}
            className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
            aria-label="Search Tools"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Desktop Categories Dropdown */}
          <div className="hidden sm:block relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Layers className="w-4 h-4 text-indigo-500" />
              <span>Categories</span>
              <ChevronDown className={`w-4 h-4 opacity-70 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} aria-hidden="true" />
            )}
            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 animate-pop-in origin-top-right"
              >
                <div className="px-3 py-1 text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                  PDF Categories
                </div>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                <button
                  onClick={() => {
                    onSelectCategory('all');
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${
                    !activeCategory || activeCategory === 'all'
                      ? 'text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/40'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  All PDF Tools
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      onSelectCategory(cat.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${
                      activeCategory === cat.id
                        ? 'text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/40'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
            aria-label="Toggle Theme"
          >
            <span key={String(darkMode)} className="block animate-pop-in">{darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}</span>
          </button>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
            aria-label="Open Mobile Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 animate-fade-in">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Categories
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onSelectCategory('all');
                setMobileMenuOpen(false);
              }}
              className={`p-2.5 rounded-xl text-xs font-semibold text-left border ${
                !activeCategory || activeCategory === 'all'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                  : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              All Tools
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  onSelectCategory(cat.id);
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-xl text-xs font-semibold text-left border truncate ${
                  activeCategory === cat.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
