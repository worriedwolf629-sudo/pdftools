import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X, CheckCircle, Share, PlusSquare } from 'lucide-react';

export const InstallPromptBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    // Check if already installed / running in standalone PWA mode
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(inStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIosDevice);

    if (inStandalone) return;

    // Listen for beforeinstallprompt event (Android / Chromium)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If on iOS or mobile device, show install option
    if (isIosDevice || /android/.test(ua)) {
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstructions(true);
    }
  };

  if (isStandalone || !showBanner) return null;

  return (
    <>
      {/* Top Floating Mobile App Install Bar */}
      <div className="w-full bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-pink-900/90 border-b border-indigo-500/40 px-4 py-2.5 text-white flex items-center justify-between gap-3 shadow-lg backdrop-blur-md animate-fade-in z-30">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="text-xs font-bold leading-tight truncate">
              Install PDFCraft App on Your Phone
            </p>
            <p className="text-[10px] text-indigo-200 truncate">
              Instant offline file opener for WhatsApp & Files
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/pdfcraft.apk"
            download="PDFCraft.apk"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all hover:scale-105 active:scale-95"
            title="Download direct Android APK"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download APK</span>
          </a>

          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 font-extrabold text-xs shadow-md transition-all hover:scale-105 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
          <button
            onClick={() => setShowBanner(false)}
            className="p-1 rounded-lg text-indigo-300 hover:text-white"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Manual Instructions Modal (For iOS or when browser prompt isn't directly triggered) */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">Install App on Phone</h3>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-300">
                <p className="font-semibold text-white">To install on iPhone / iPad:</p>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <Share className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>1. Tap the <strong>Share</strong> button at the bottom of Safari.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <PlusSquare className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>2. Scroll down and tap <strong>"Add to Home Screen"</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>3. Tap <strong>Add</strong>. PDFCraft will appear on your home screen!</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-300">
                <p className="font-semibold text-white">To install on Android:</p>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="font-bold text-indigo-400">1.</span>
                  <span>Tap the <strong>three dots menu (`⋮`)</strong> in the top right corner of Chrome.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <Download className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>2. Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>3. Tap <strong>Install</strong>. PDFCraft will install directly as a native Android app!</span>
                </div>

                <div className="pt-2 border-t border-slate-700/80">
                  <p className="font-semibold text-white mb-2">Or download standalone Android APK:</p>
                  <a
                    href="/pdfcraft.apk"
                    download="PDFCraft.apk"
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Download className="w-4 h-4" /> Download PDFCraft.apk (12 MB)
                  </a>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowInstructions(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
