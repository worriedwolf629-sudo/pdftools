import { useState, useEffect, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { SearchModal } from './components/SearchModal';
import { HomePage } from './pages/HomePage';
// The PDF engine (pdf-lib, pdf.js, jsPDF...) is large: only load it when a tool page is opened.
const ToolWorkstation = lazy(() => import('./components/ToolWorkstation').then((m) => ({ default: m.ToolWorkstation })));
import { RelatedTools } from './components/RelatedTools';
import { LegalPage } from './pages/LegalPage';
import { getToolBySlug } from './registry/tools';
import { MetaTags } from './components/MetaTags';
import { NetworkBackground } from './components/NetworkBackground';
import { UniversalFileViewer } from './components/FileViewer/UniversalFileViewer';
import { GlobalDropzoneOverlay } from './components/FileViewer/GlobalDropzoneOverlay';
import { InstantFileOpenerCard } from './components/FileViewer/InstantFileOpenerCard';
import { InstallPromptBanner } from './components/InstallPromptBanner';

export function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('pdfcraft_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [activeSlug, setActiveSlug] = useState<string>('home');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Universal File Opener active file state
  const [openedFile, setOpenedFile] = useState<{ file: File; name: string } | null>(null);
  const [toolInitialFiles, setToolInitialFiles] = useState<File[]>([]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('pdfcraft_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('pdfcraft_theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (!path) {
        setActiveSlug('home');
      } else {
        setActiveSlug(path);
      }
    };

    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Listen to PWA Launch Queue (e.g. WhatsApp "Open with", Android Intent, OS File Handling)
  useEffect(() => {
    if ('launchQueue' in window && 'files' in (window as any).LaunchParams?.prototype) {
      (window as any).launchQueue.setConsumer(async (launchParams: any) => {
        if (!launchParams.files || launchParams.files.length === 0) return;
        try {
          const fileHandle = launchParams.files[0];
          const file = await fileHandle.getFile();
          setOpenedFile({ file, name: file.name });
        } catch (e) {
          console.error('Error handling launchQueue file:', e);
        }
      });
    }

    // Check if opened via PWA Share Target (?shared=true redirected by sw.js)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('shared') === 'true' && 'caches' in window) {
      (async () => {
        try {
          const cache = await caches.open('pwa-shared-files');
          const response = await cache.match('/shared-file');
          if (response) {
            const blob = await response.blob();
            const filenameHeader = response.headers.get('x-filename');
            const fileName = filenameHeader ? decodeURIComponent(filenameHeader) : 'shared-document';
            const file = new File([blob], fileName, { type: blob.type });
            setOpenedFile({ file, name: fileName });
            await cache.delete('/shared-file');
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch (e) {
          console.error('Error retrieving shared file from cache:', e);
        }
      })();
    }
  }, []);

  const navigateTo = (slug: string) => {
    setActiveSlug(slug);
    window.history.pushState({}, '', slug === 'home' ? '/' : `/${slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileReceived = (file: File) => {
    setOpenedFile({ file, name: file.name });
  };

  useEffect(() => {
    (window as any).__PDFCRAFT_OPEN_FILE = handleFileReceived;
    return () => {
      delete (window as any).__PDFCRAFT_OPEN_FILE;
    };
  }, []);

  const handleOpenWithPdfCraftTool = (slug: string, file: File) => {
    setToolInitialFiles([file]);
    setOpenedFile(null);
    navigateTo(slug);
  };

  const selectedTool = getToolBySlug(activeSlug);
  const isLegalPage = ['about', 'privacy', 'terms', 'cookie-policy', 'disclaimer', 'licenses', 'contact'].includes(
    activeSlug
  );

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col font-sans transition-colors duration-250">
      <NetworkBackground />
      {/* Global Drag and Drop Overlay for Instant File Opening anywhere */}
      <GlobalDropzoneOverlay onFileReceived={handleFileReceived} />

      {/* 1-Click Install App on Phone Banner */}
      <InstallPromptBanner />

      <Header
        onOpenSearch={() => setIsSearchOpen(true)}
        activeCategory={activeCategory}
        onSelectCategory={(catId) => {
          setActiveCategory(catId);
          navigateTo('home');
        }}
        onNavigateHome={() => {
          setOpenedFile(null);
          navigateTo('home');
        }}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenFile={handleFileReceived}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative">
        {/* If a file is opened (from drop, picker, WhatsApp PWA intent, or share target), show Universal File Viewer */}
        {openedFile ? (
          <UniversalFileViewer
            file={openedFile.file}
            fileName={openedFile.name}
            onClose={() => setOpenedFile(null)}
            onSelectAnotherFile={(newFile) => setOpenedFile({ file: newFile, name: newFile.name })}
            onOpenWithPdfCraftTool={handleOpenWithPdfCraftTool}
          />
        ) : selectedTool && selectedTool.id === 'open-file' ? (
          /* Dedicated Universal File Opener Route */
          <div className="space-y-8 sm:space-y-12">
            <MetaTags
              title={selectedTool.seo.title}
              description={selectedTool.seo.metaDescription}
              tool={selectedTool}
              faqs={selectedTool.seo.faqs}
            />
            <InstantFileOpenerCard onFileSelected={handleFileReceived} />
            <RelatedTools currentToolId={selectedTool.id} onSelectTool={(slug) => navigateTo(slug)} />
          </div>
        ) : selectedTool ? (
          /* Existing PDFCraft Tool (100% untouched) */
          <div key={selectedTool.id} className="space-y-8 sm:space-y-12">
            <MetaTags title={selectedTool.seo.title} description={selectedTool.seo.metaDescription} tool={selectedTool} faqs={selectedTool.seo.faqs} />
            {/* key => each tool starts with a clean state (files/results used to leak between tools) */}
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center gap-3 py-32 text-slate-500 animate-fade-in">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <span className="text-sm">Loading tool…</span>
                </div>
              }
            >
              <ToolWorkstation
                key={selectedTool.id}
                tool={selectedTool}
                initialFiles={toolInitialFiles.length > 0 ? toolInitialFiles : undefined}
                onOpenFile={(f) => setOpenedFile({ file: f, name: f.name })}
              />
            </Suspense>
            <RelatedTools currentToolId={selectedTool.id} onSelectTool={(slug) => navigateTo(slug)} />
          </div>
        ) : isLegalPage ? (
          <LegalPage key={activeSlug} type={activeSlug as any} onNavigateHome={() => navigateTo('home')} />
        ) : (
          <HomePage
            onSelectTool={(slug) => navigateTo(slug)}
            onOpenSearch={() => setIsSearchOpen(true)}
            activeCategory={activeCategory}
            onSelectCategory={(catId) => setActiveCategory(catId)}
            onOpenFile={handleFileReceived}
          />
        )}
      </main>

      <Footer
        onSelectTool={(slug) => navigateTo(slug)}
        onSelectCategory={(catId) => {
          setActiveCategory(catId);
          navigateTo('home');
        }}
        onNavigatePage={(page) => navigateTo(page)}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectTool={(slug) => navigateTo(slug)}
        onOpenFile={handleFileReceived}
      />
    </div>
  );
}

export default App;
