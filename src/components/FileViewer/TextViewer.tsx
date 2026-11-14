import React, { useEffect, useState, useMemo } from 'react';
import {
  FileCode, Download, Copy, Check, Search, WrapText, Eye, Code, Loader2
} from 'lucide-react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

interface TextViewerProps {
  file: File | Blob;
  fileName: string;
  isMarkdown?: boolean;
  isJson?: boolean;
}

const EXT_TO_LANG: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'typescript',
  java: 'java',
  json: 'json',
  html: 'xml',
  htm: 'xml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  py: 'python',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  rs: 'rust',
  go: 'go',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  md: 'markdown',
  markdown: 'markdown'
};

export const TextViewer: React.FC<TextViewerProps> = ({
  file,
  fileName,
  isMarkdown = false,
  isJson = false
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [wrapLines, setWrapLines] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'source' | 'rendered'>(isMarkdown ? 'rendered' : 'source');
  const [copied, setCopied] = useState<boolean>(false);

  const extension = useMemo(() => {
    return (fileName.split('.').pop() || '').toLowerCase();
  }, [fileName]);

  const detectedLanguage = useMemo(() => {
    if (isJson) return 'json';
    if (isMarkdown) return 'markdown';
    return EXT_TO_LANG[extension] || '';
  }, [extension, isJson, isMarkdown]);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    (async () => {
      try {
        const text = await file.text();
        if (isCancelled) return;

        if (isJson || extension === 'json') {
          try {
            const parsed = JSON.parse(text);
            setContent(JSON.stringify(parsed, null, 2));
          } catch {
            setContent(text);
          }
        } else {
          setContent(text);
        }
      } catch (err) {
        console.error('Failed to read text file:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [file, isJson, extension]);

  const highlightedHtml = useMemo(() => {
    if (!content) return '';
    try {
      if (detectedLanguage && hljs.getLanguage(detectedLanguage)) {
        return hljs.highlight(content, { language: detectedLanguage }).value;
      }
      return hljs.highlightAuto(content).value;
    } catch {
      // Fallback escape
      return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }, [content, detectedLanguage]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lines = useMemo(() => content.split('\n'), [content]);
  const wordCount = useMemo(() => (content.trim() ? content.trim().split(/\s+/).length : 0), [content]);
  const charCount = content.length;

  return (
    <div className="flex flex-col h-full bg-slate-900/90 text-white rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl backdrop-blur-md">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-md">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
              {fileName}
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {detectedLanguage || extension.toUpperCase() || 'TEXT'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {lines.length} lines • {wordCount} words • {charCount} characters
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative w-40 sm:w-52">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find in text..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Markdown toggle */}
          {isMarkdown && (
            <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
              <button
                onClick={() => setViewMode('rendered')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 ${
                  viewMode === 'rendered'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button
                onClick={() => setViewMode('source')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 ${
                  viewMode === 'source'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Code className="w-3.5 h-3.5" /> Code
              </button>
            </div>
          )}

          {/* Wrap text toggle */}
          <button
            onClick={() => setWrapLines(!wrapLines)}
            className={`p-2 rounded-xl border text-slate-200 transition-colors ${
              wrapLines ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300' : 'bg-slate-800 border-slate-700'
            }`}
            title="Toggle Word Wrap"
          >
            <WrapText className="w-4 h-4" />
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-semibold text-xs text-white shadow-md shadow-cyan-600/30 transition-all hover:scale-105 active:scale-95"
          >
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-950/70">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
            <span className="text-sm font-medium">Reading code & syntax highlighting with highlight.js...</span>
          </div>
        ) : isMarkdown && viewMode === 'rendered' ? (
          <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 text-slate-200 leading-relaxed font-sans space-y-4 shadow-xl">
            {lines.map((line, idx) => {
              if (line.startsWith('# ')) {
                return <h1 key={idx} className="text-3xl font-extrabold text-white border-b border-slate-800 pb-2">{line.replace('# ', '')}</h1>;
              }
              if (line.startsWith('## ')) {
                return <h2 key={idx} className="text-2xl font-bold text-white mt-4">{line.replace('## ', '')}</h2>;
              }
              if (line.startsWith('### ')) {
                return <h3 key={idx} className="text-xl font-semibold text-cyan-300 mt-3">{line.replace('### ', '')}</h3>;
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return (
                  <div key={idx} className="flex items-start gap-2 text-slate-300 ml-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                    <span>{line.replace(/^[-*]\s+/, '')}</span>
                  </div>
                );
              }
              if (line.startsWith('> ')) {
                return (
                  <blockquote key={idx} className="border-l-4 border-cyan-500 pl-4 py-1 text-slate-400 italic">
                    {line.replace('> ', '')}
                  </blockquote>
                );
              }
              if (!line.trim()) {
                return <div key={idx} className="h-2" />;
              }
              return <p key={idx} className="text-slate-300">{line}</p>;
            })}
          </div>
        ) : (
          <div className="flex font-mono text-xs select-text">
            {/* Line numbers gutter */}
            <div className="select-none pr-4 text-slate-600 text-right shrink-0 border-r border-slate-800/80 mr-4">
              {lines.map((_, i) => (
                <div key={i} className="leading-6">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Syntax Highlighted Code via highlight.js */}
            <div className={`flex-1 ${wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
              <pre className="!bg-transparent !p-0 !m-0 font-mono text-xs leading-6">
                <code
                  className={`hljs ${detectedLanguage ? `language-${detectedLanguage}` : ''}`}
                  dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                />
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
