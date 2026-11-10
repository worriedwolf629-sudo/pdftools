import React, { useState } from 'react';
import {
  Search,
    ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { TOOLS, CATEGORIES, searchTools } from '../registry/tools';
import type { PDFTool } from '../registry/tools';
import { AdSlot } from '../components/AdSlot';
import { MetaTags } from '../components/MetaTags';
import { ToolIcon } from '../components/ToolIcon';
import { useReveal, spotlight } from '../hooks/useReveal';

import { HeroNetwork } from '../components/HeroNetwork';
import { InstantFileOpenerCard } from '../components/FileViewer/InstantFileOpenerCard';

interface HomePageProps {
  onSelectTool: (slug: string) => void;
  onOpenSearch: () => void;
  activeCategory: string;
  onSelectCategory: (catId: string) => void;
  onOpenFile: (file: File) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSelectTool,
  onOpenSearch,
  activeCategory,
  onSelectCategory,
  onOpenFile
}) => {
  const [searchQuery] = useState('');
  const popularRef = useReveal<HTMLElement>();
  const allRef = useReveal<HTMLElement>();
  const privacyRef = useReveal<HTMLElement>();

  const displayedTools = activeCategory && activeCategory !== 'all'
    ? TOOLS.filter((t) => t.category === activeCategory)
    : searchQuery
    ? searchTools(searchQuery)
    : TOOLS;

  const popularTools = TOOLS.filter((t) => t.popular);

  return (
    <div className="space-y-12 pb-12 animate-fade-in">
      <MetaTags
        title="PDFCraft – All Your PDF Tools in One Place"
        description="Free online PDF tools platform. Compress, merge, split, convert, edit, sign, watermark, and OCR PDF files in your browser."
      />

      <HeroNetwork
        title="All Your PDF Tools in One Place"
        subtitle="Compress, merge, split, convert, edit, sign, and manage PDF documents online with 100% privacy & zero server uploads."
        buttonText="Explore PDF Tools"
        buttonLink="#tools-section"
        onButtonClick={() => {
          const el = document.getElementById('tools-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Universal Instant File Opener Dropzone & Viewer Card */}
      <InstantFileOpenerCard onFileSelected={onOpenFile} />

      <div className="max-w-xl mx-auto pt-2">
        <div
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between p-3 sm:p-4 bg-white dark:bg-slate-900 border-2 border-indigo-500/30 dark:border-indigo-500/40 rounded-2xl shadow-2xl hover:border-indigo-500 cursor-pointer transition-all group"
        >
          <div className="flex items-center gap-3 text-slate-400">
            <Search className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
            <span className="text-slate-500 dark:text-slate-400 text-sm sm:text-base font-sans">
              Search tools (e.g. Merge, Compress, OCR, Rotate)...
            </span>
          </div>
          <kbd className="hidden sm:inline-block px-2.5 py-1 text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
            Ctrl + K
          </kbd>
        </div>
      </div>

      <AdSlot type="top-banner" />

      <section id="tools-section" ref={popularRef} className="reveal max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500 fill-amber-500" /> Popular PDF Tools
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 stagger">
          {popularTools.map((tool: PDFTool, i: number) => (
            <div
              key={tool.id}
              style={{ ['--i' as string]: i }}
              onMouseMove={spotlight}
              onClick={() => onSelectTool(tool.slug)}
              className="tool-card group cursor-pointer"
            >
              <div className="tool-icon w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center mb-4 shadow-md shadow-indigo-500/20">
                <ToolIcon name={tool.iconName} className="w-6 h-6" />
              </div>

              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                {tool.categoryName}
              </span>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 font-heading group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {tool.name}
              </h3>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 flex-1">
                {tool.shortDescription}
              </p>

              <div className="flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                Open Tool <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section ref={allRef} className="reveal max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pt-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-heading">
              Explore All PDF Tools ({TOOLS.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Filter by category or search specific PDF functionality
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-2 sm:pb-0 [scrollbar-width:none]">
            <button
              onClick={() => onSelectCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                !activeCategory || activeCategory === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All Tools
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div key={activeCategory} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger">
          {displayedTools.map((tool: PDFTool, i: number) => (
            <div
              key={tool.id}
              style={{ ['--i' as string]: i }}
              onMouseMove={spotlight}
              onClick={() => onSelectTool(tool.slug)}
              className="tool-card group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="tool-icon w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ToolIcon name={tool.iconName} className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {tool.categoryName}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5 font-heading group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {tool.name}
              </h3>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 flex-1">
                {tool.description}
              </p>

              <div className="flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                Launch Tool <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <AdSlot type="in-content" />

      <section ref={privacyRef} className="reveal max-w-5xl mx-auto px-4 py-12">
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-2xl space-y-6 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-2xl font-bold font-heading">
                100% Privacy Guarantee
              </h3>
              <p className="text-xs text-slate-300">
                Zero Cloud Uploads • Zero Data Retention
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            Unlike traditional PDF websites that upload your financial contracts, legal forms, and private scans to unknown third-party servers, PDFCraft uses modern browser WebAssembly and JavaScript engines to process everything on your local device.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Browser-Only Memory Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Instant Local Processing Speed</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Your Files Never Leave Your Device</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
