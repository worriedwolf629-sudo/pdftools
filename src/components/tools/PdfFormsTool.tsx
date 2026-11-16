import React, { useState, useEffect, useRef } from 'react';
import {
  FileCheck, ChevronLeft, ChevronRight, Type, Check,
  PenTool, Trash2, Loader2, AlertCircle
} from 'lucide-react';
import {
  openPdfjs, getPdfFormFields, fillPdfFormAndPlacements,
  type DetectedFormField, type FreePlacementItem
} from '../../utils/pdfEngine';
import { SignaturePad } from '../SignaturePad';

interface PdfFormsToolProps {
  file: File;
  onFormComplete: (blob: Blob, filename: string) => void;
  onError: (msg: string) => void;
}

export const PdfFormsTool: React.FC<PdfFormsToolProps> = ({ file, onFormComplete, onError }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [detectedFields, setDetectedFields] = useState<DetectedFormField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [flatten, setFlatten] = useState<boolean>(false);

  // Free placement stamps
  const [activeTab, setActiveTab] = useState<'fields' | 'free'>('fields');
  const [stampType, setStampType] = useState<'text' | 'checkmark' | 'signature'>('text');
  const [freeTextValue, setFreeTextValue] = useState<string>('Approved');
  const [placements, setPlacements] = useState<FreePlacementItem[]>([]);
  const [showSigModal, setShowSigModal] = useState<boolean>(false);
  const [activeSigBase64, setActiveSigBase64] = useState<string>('');

  // Page viewer
  const [numPages, setNumPages] = useState<number>(1);
  const [curPage, setCurPage] = useState<number>(1);
  const [rendering, setRendering] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<any>(null);

  // Initialize: load document and detect form fields
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const fields = await getPdfFormFields(file);
        if (cancelled) return;
        setDetectedFields(fields);
        const initialVals: Record<string, string | boolean> = {};
        fields.forEach((f) => {
          initialVals[f.name] = f.value;
        });
        setFieldValues(initialVals);

        if (fields.length === 0) {
          setActiveTab('free');
        }

        const doc = await openPdfjs(file);
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        await renderPage(doc, 1);
      } catch (e: any) {
        if (!cancelled) onError(e?.message || 'Failed to parse PDF form');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (pdfDocRef.current?.loadingTask?.destroy) {
        void pdfDocRef.current.loadingTask.destroy();
      }
    };
  }, [file]);

  const renderPage = async (doc: any, pageNum: number) => {
    if (!doc || !canvasRef.current) return;
    try {
      setRendering(true);
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    } catch (e) {
      console.error('Failed to render page:', e);
    } finally {
      setRendering(false);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > numPages || !pdfDocRef.current) return;
    setCurPage(newPage);
    await renderPage(pdfDocRef.current, newPage);
  };

  // Canvas click for free placement
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (activeTab !== 'free' || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    if (stampType === 'signature' && !activeSigBase64) {
      setShowSigModal(true);
      return;
    }

    const newItem: FreePlacementItem = {
      id: `stamp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pageIndex: curPage - 1,
      type: stampType,
      xRatio: Math.max(0, Math.min(1, xRatio)),
      yRatio: Math.max(0, Math.min(1, yRatio)),
      text: stampType === 'text' ? freeTextValue : undefined,
      signaturePngBase64: stampType === 'signature' ? activeSigBase64 : undefined
    };

    setPlacements((prev) => [...prev, newItem]);
  };

  const handleDeletePlacement = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlacements((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const outputBytes = await fillPdfFormAndPlacements(file, {
        fieldValues,
        flatten,
        placements
      });
      const blob = new Blob([new Uint8Array(outputBytes) as any], { type: 'application/pdf' });
      const base = file.name.replace(/\.pdf$/i, '');
      onFormComplete(blob, `${base}_filled.pdf`);
    } catch (err: any) {
      onError(err?.message || 'Failed to save completed form.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-xs font-medium">Scanning PDF for AcroForm fields & structure...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Tabs: AcroForm Fields vs Free Placement */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('fields')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'fields'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Form Fields ({detectedFields.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('free')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'free'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Free Text & Signature ({placements.length})</span>
          </button>
        </div>

        {/* Flatten Toggle & Save Button */}
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={flatten}
              onChange={(e) => setFlatten(e.target.checked)}
              className="accent-indigo-600 w-4 h-4 rounded cursor-pointer"
            />
            <span>Flatten Form (make unalterable)</span>
          </label>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="py-2 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving PDF Form...</span>
              </>
            ) : (
              <span>Save & Download PDF</span>
            )}
          </button>
        </div>
      </div>

      {/* Active Tab Panel */}
      {activeTab === 'fields' ? (
        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
          {detectedFields.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto stroke-1" />
              <p className="text-sm font-semibold text-slate-200">No AcroForm Interactive Fields Detected</p>
              <p className="text-xs max-w-md mx-auto text-slate-400">
                This PDF is a flat document or scanned form. You can use the{' '}
                <strong className="text-indigo-400 cursor-pointer" onClick={() => setActiveTab('free')}>
                  Free Text & Signature
                </strong>{' '}
                tab to click anywhere on the page and stamp answers, checkmarks, or signatures!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {detectedFields.map((field) => (
                <div key={field.name} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 truncate max-w-[70%]" title={field.name}>
                      {field.name}
                    </span>
                    <span className="text-[10px] uppercase font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                      {field.type}
                    </span>
                  </div>

                  {field.type === 'text' && (
                    <input
                      type="text"
                      value={String(fieldValues[field.name] ?? '')}
                      onChange={(e) =>
                        setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                      }
                      placeholder="Enter value..."
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:border-indigo-500 outline-none"
                    />
                  )}

                  {field.type === 'checkbox' && (
                    <label className="flex items-center space-x-2 text-xs text-slate-300 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(fieldValues[field.name])}
                        onChange={(e) =>
                          setFieldValues((prev) => ({ ...prev, [field.name]: e.target.checked }))
                        }
                        className="accent-indigo-600 w-4 h-4 rounded cursor-pointer"
                      />
                      <span>{fieldValues[field.name] ? 'Checked (Yes)' : 'Unchecked (No)'}</span>
                    </label>
                  )}

                  {field.type === 'dropdown' && (
                    <select
                      value={String(fieldValues[field.name] ?? '')}
                      onChange={(e) =>
                        setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                      }
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:border-indigo-500 outline-none"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === 'radio' && (
                    <div className="flex flex-wrap gap-2 pt-1 text-xs">
                      {field.options?.map((opt) => (
                        <label key={opt} className="flex items-center space-x-1.5 text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name={field.name}
                            value={opt}
                            checked={fieldValues[field.name] === opt}
                            onChange={(e) =>
                              setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                            }
                            className="accent-indigo-600"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Free Placement Stamp Controls */
        <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-300">Tool:</span>
              <button
                type="button"
                onClick={() => setStampType('text')}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center space-x-1.5 border ${
                  stampType === 'text'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Text</span>
              </button>
              <button
                type="button"
                onClick={() => setStampType('checkmark')}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center space-x-1.5 border ${
                  stampType === 'checkmark'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Checkmark (✓)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStampType('signature');
                  if (!activeSigBase64) setShowSigModal(true);
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center space-x-1.5 border ${
                  stampType === 'signature'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <PenTool className="w-3.5 h-3.5 text-indigo-400" />
                <span>Signature</span>
              </button>
            </div>

            {stampType === 'text' && (
              <div className="flex items-center space-x-2 flex-1 max-w-sm">
                <input
                  type="text"
                  value={freeTextValue}
                  onChange={(e) => setFreeTextValue(e.target.value)}
                  placeholder="Type stamp text..."
                  className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {stampType === 'signature' && activeSigBase64 && (
              <button
                type="button"
                onClick={() => setShowSigModal(true)}
                className="text-xs text-indigo-400 hover:underline"
              >
                Change Signature
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            👉 Click anywhere on the PDF page below to stamp your selected tool.
          </p>
        </div>
      )}

      {/* Live PDF Viewer + Stamp Click Target */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-6 flex flex-col items-center">
        {/* Page Switcher */}
        <div className="flex items-center space-x-4 mb-4">
          <button
            type="button"
            onClick={() => handlePageChange(curPage - 1)}
            disabled={curPage <= 1 || rendering}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 border border-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-slate-300">
            Page {curPage} of {numPages}
          </span>
          <button
            type="button"
            onClick={() => handlePageChange(curPage + 1)}
            disabled={curPage >= numPages || rendering}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 border border-slate-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas Container with Free Stamp Overlays */}
        <div
          ref={containerRef}
          onClick={handleCanvasClick}
          className={`relative inline-block border border-slate-700 rounded-lg overflow-hidden shadow-2xl select-none ${
            activeTab === 'free' ? 'cursor-crosshair' : 'cursor-default'
          }`}
          style={{ maxWidth: '100%', maxHeight: '70vh' }}
        >
          <canvas ref={canvasRef} className="block max-w-full h-auto bg-white" />

          {/* Render Placements on this page */}
          {placements
            .filter((p) => p.pageIndex === curPage - 1)
            .map((pl) => (
              <div
                key={pl.id}
                style={{
                  left: `${pl.xRatio * 100}%`,
                  top: `${pl.yRatio * 100}%`
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 group pointer-events-auto"
              >
                {pl.type === 'text' && (
                  <span className="bg-white/95 text-slate-900 border border-slate-400 px-1.5 py-0.5 rounded text-xs font-sans shadow">
                    {pl.text}
                  </span>
                )}
                {pl.type === 'checkmark' && (
                  <span className="text-blue-600 text-xl font-bold drop-shadow">✓</span>
                )}
                {pl.type === 'signature' && pl.signaturePngBase64 && (
                  <img
                    src={pl.signaturePngBase64}
                    alt="Signature"
                    className="h-8 max-w-[120px] object-contain drop-shadow"
                  />
                )}
                <button
                  type="button"
                  onClick={(e) => handleDeletePlacement(pl.id, e)}
                  className="hidden group-hover:inline-flex absolute -top-2 -right-2 p-0.5 bg-rose-600 text-white rounded-full shadow"
                  title="Remove Stamp"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
        </div>
      </div>

      {/* Signature Pad Modal */}
      {showSigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Draw Signature</h3>
            <div className="bg-white rounded-xl p-2">
              <SignaturePad
                onChange={(dataUrl: string | null) => {
                  if (dataUrl) setActiveSigBase64(dataUrl);
                }}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSigModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow"
              >
                Apply Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
