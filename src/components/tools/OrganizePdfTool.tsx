import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  RotateCw, RotateCcw, Copy, Trash2, Plus, FilePlus, CheckSquare,
  Square, Loader2, GripVertical, FileText
} from 'lucide-react';
import { openPdfjs, organizePdfPages, type OrganizePageItem } from '../../utils/pdfEngine';

interface PageItem {
  id: string;
  sourceDocIndex: number;
  pageIndex: number; // 0-based index in source PDF
  displayNumber: number;
  rotation: number; // additional rotation in degrees
  isBlank?: boolean;
  sourceFileName?: string;
}

interface SourceDoc {
  name: string;
  bytes: Uint8Array;
  pdfjsDoc: any;
  numPages: number;
}

interface OrganizePdfToolProps {
  initialFile: File;
  onOrganizeComplete: (blob: Blob, filename: string) => void;
  onError: (msg: string) => void;
}

// ---------------------------------------------------------------------------
// Lazy-rendered Sortable Thumbnail Item
// ---------------------------------------------------------------------------
interface SortableThumbnailProps {
  item: PageItem;
  index: number;
  isSelected: boolean;
  sourceDocs: SourceDoc[];
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onRotate: (id: string, delta: number) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

const SortableThumbnail: React.FC<SortableThumbnailProps> = ({
  item,
  index,
  isSelected,
  sourceDocs,
  onToggleSelect,
  onRotate,
  onDuplicate,
  onDelete
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.4 : 1
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rendered, setRendered] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Lazy render with IntersectionObserver
  useEffect(() => {
    if (item.isBlank) {
      setRendered(true);
      setLoading(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !rendered) {
          renderCanvas();
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [item.id, item.sourceDocIndex, item.pageIndex, sourceDocs]);

  const renderCanvas = async () => {
    const src = sourceDocs[item.sourceDocIndex];
    if (!src || !src.pdfjsDoc || !canvasRef.current) return;
    try {
      setLoading(true);
      const page = await src.pdfjsDoc.getPage(item.pageIndex + 1);
      const viewport = page.getViewport({ scale: 0.35 });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
      setRendered(true);
    } catch (e) {
      console.error('Failed to render page thumbnail:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col bg-slate-900 border rounded-2xl p-2.5 transition-all select-none shadow-md ${
        isSelected
          ? 'border-indigo-500 ring-2 ring-indigo-500/50 bg-indigo-950/20 shadow-indigo-500/10'
          : 'border-slate-800 hover:border-slate-700 hover:shadow-lg'
      }`}
    >
      {/* Top Card Bar: Handle + Page Number + Checkbox */}
      <div className="flex items-center justify-between pb-2 text-xs">
        <div
          {...attributes}
          {...listeners}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <span className="font-mono font-bold text-slate-300 text-[11px] bg-slate-800/80 px-2 py-0.5 rounded-full">
          #{index + 1}
        </span>

        <button
          type="button"
          onClick={(e) => onToggleSelect(item.id, e)}
          className={`p-1 rounded hover:bg-slate-800 transition-colors ${
            isSelected ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Select page"
        >
          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        </button>
      </div>

      {/* Thumbnail Viewport */}
      <div
        ref={containerRef}
        onClick={(e) => onToggleSelect(item.id, e)}
        className="relative w-full aspect-[1/1.4] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer border border-slate-800/50"
      >
        {item.isBlank ? (
          <div className="flex flex-col items-center justify-center text-slate-600 space-y-1">
            <FileText className="w-8 h-8 stroke-1" />
            <span className="text-[10px] font-mono uppercase tracking-wider">Blank Page</span>
          </div>
        ) : (
          <div
            className="flex items-center justify-center w-full h-full transition-transform duration-200"
            style={{ transform: `rotate(${item.rotation}deg)` }}
          >
            <canvas ref={canvasRef} className="max-w-[90%] max-h-[90%] object-contain shadow-sm rounded-sm" />
          </div>
        )}

        {loading && !item.isBlank && !rendered && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
          </div>
        )}

        {/* Source file tag if multi-file */}
        {sourceDocs.length > 1 && item.sourceFileName && (
          <div className="absolute top-1 left-1 bg-slate-900/90 text-slate-300 text-[9px] px-1.5 py-0.5 rounded max-w-[85%] truncate pointer-events-none">
            {item.sourceFileName}
          </div>
        )}

        {item.rotation !== 0 && (
          <div className="absolute bottom-1 right-1 bg-indigo-900/90 text-indigo-200 font-mono text-[9px] px-1 py-0.5 rounded pointer-events-none">
            {item.rotation}°
          </div>
        )}
      </div>

      {/* Bottom Tool Buttons */}
      <div className="flex items-center justify-between pt-2 px-1 text-slate-400">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => onRotate(item.id, -90)}
            className="p-1 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors"
            title="Rotate 90° Left"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRotate(item.id, 90)}
            className="p-1 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors"
            title="Rotate 90° Right"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => onDuplicate(item.id)}
            className="p-1 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
            title="Duplicate Page"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="p-1 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
            title="Delete Page"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Organize Tool Workspace
// ---------------------------------------------------------------------------
export const OrganizePdfTool: React.FC<OrganizePdfToolProps> = ({
  initialFile,
  onOrganizeComplete,
  onError
}) => {
  const [sourceDocs, setSourceDocs] = useState<SourceDoc[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Initialize first document
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        const bytes = new Uint8Array(await initialFile.arrayBuffer());
        const pdfjsDoc = await openPdfjs(initialFile);
        if (cancelled) return;

        const doc: SourceDoc = {
          name: initialFile.name,
          bytes,
          pdfjsDoc,
          numPages: pdfjsDoc.numPages
        };
        setSourceDocs([doc]);

        const initialPages: PageItem[] = Array.from({ length: doc.numPages }, (_, i) => ({
          id: `p0_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sourceDocIndex: 0,
          pageIndex: i,
          displayNumber: i + 1,
          rotation: 0,
          sourceFileName: doc.name
        }));
        setPages(initialPages);
      } catch (e: any) {
        if (!cancelled) onError(e?.message || 'Failed to load PDF for organizing');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialFile]);

  // Append pages from another PDF file
  const handleAddExtraFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBusy(true);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdfjsDoc = await openPdfjs(file);
      const newDocIdx = sourceDocs.length;
      const newDoc: SourceDoc = {
        name: file.name,
        bytes,
        pdfjsDoc,
        numPages: pdfjsDoc.numPages
      };
      setSourceDocs((prev) => [...prev, newDoc]);

      const addedPages: PageItem[] = Array.from({ length: newDoc.numPages }, (_, i) => ({
        id: `p${newDocIdx}_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sourceDocIndex: newDocIdx,
        pageIndex: i,
        displayNumber: i + 1,
        rotation: 0,
        sourceFileName: newDoc.name
      }));

      setPages((prev) => [...prev, ...addedPages]);
    } catch (err: any) {
      onError(err?.message || 'Failed to load extra PDF.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Add Blank Page
  const handleAddBlankPage = () => {
    const newId = `blank_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const blank: PageItem = {
      id: newId,
      sourceDocIndex: -1,
      pageIndex: -1,
      displayNumber: pages.length + 1,
      rotation: 0,
      isBlank: true
    };
    setPages((prev) => [...prev, blank]);
  };

  // Drag and drop reordering handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPages((currentPages) => {
        const oldIndex = currentPages.findIndex((p) => p.id === active.id);
        const newIndex = currentPages.findIndex((p) => p.id === over.id);
        return arrayMove(currentPages, oldIndex, newIndex);
      });
    }
  };

  // Selection handlers
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === pages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pages.map((p) => p.id)));
    }
  };

  // Individual Actions
  const handleRotatePage = (id: string, delta: number) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + delta) % 360 } : p))
    );
  };

  const handleDuplicatePage = (id: string) => {
    const idx = pages.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const target = pages[idx];
    const copy: PageItem = {
      ...target,
      id: `${target.id}_copy_${Date.now()}`
    };
    const next = [...pages];
    next.splice(idx + 1, 0, copy);
    setPages(next);
  };

  const handleDeletePage = (id: string) => {
    if (pages.length <= 1) {
      onError('A PDF must contain at least one page.');
      return;
    }
    setPages((prev) => prev.filter((p) => p.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Batch Actions on Selected
  const handleBatchRotate = (delta: number) => {
    const targets = selectedIds.size > 0 ? selectedIds : new Set(pages.map((p) => p.id));
    setPages((prev) =>
      prev.map((p) => (targets.has(p.id) ? { ...p, rotation: (p.rotation + delta) % 360 } : p))
    );
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (pages.length - selectedIds.size < 1) {
      onError('Cannot delete all pages. Leave at least one page.');
      return;
    }
    setPages((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
  };

  const handleBatchDuplicate = () => {
    if (selectedIds.size === 0) return;
    const next: PageItem[] = [];
    pages.forEach((p) => {
      next.push(p);
      if (selectedIds.has(p.id)) {
        next.push({ ...p, id: `${p.id}_dupl_${Date.now()}` });
      }
    });
    setPages(next);
  };

  // Save / Export
  const handleExport = async () => {
    if (pages.length === 0) {
      onError('At least one page is required.');
      return;
    }
    try {
      setExporting(true);
      const items: OrganizePageItem[] = pages.map((p) => ({
        sourceDocIndex: p.sourceDocIndex,
        pageIndex: p.pageIndex,
        rotation: p.rotation,
        isBlank: p.isBlank
      }));

      const bytes = await organizePdfPages(
        items,
        sourceDocs.map((d) => d.bytes)
      );
      const blob = new Blob([new Uint8Array(bytes) as any], { type: 'application/pdf' });
      const base = initialFile.name.replace(/\.pdf$/i, '');
      onOrganizeComplete(blob, `${base}_organized.pdf`);
    } catch (e: any) {
      onError(e?.message || 'Failed to export organized PDF.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Batch Toolbar */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          {/* Select all toggle */}
          <button
            type="button"
            onClick={handleSelectAll}
            className="flex items-center space-x-1.5 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition-colors"
          >
            {selectedIds.size === pages.length && pages.length > 0 ? (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                <span>Deselect All</span>
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5" />
                <span>Select All ({pages.length})</span>
              </>
            )}
          </button>

          {/* Rotate Batch */}
          <button
            type="button"
            onClick={() => handleBatchRotate(-90)}
            className="flex items-center space-x-1 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700"
            title="Rotate Selected -90°"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>-90°</span>
          </button>
          <button
            type="button"
            onClick={() => handleBatchRotate(90)}
            className="flex items-center space-x-1 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700"
            title="Rotate Selected +90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>+90°</span>
          </button>

          {/* Duplicate Batch */}
          <button
            type="button"
            onClick={handleBatchDuplicate}
            disabled={selectedIds.size === 0}
            className="flex items-center space-x-1 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 disabled:opacity-40"
            title="Duplicate Selected"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate ({selectedIds.size})</span>
          </button>

          {/* Delete Batch */}
          <button
            type="button"
            onClick={handleBatchDelete}
            disabled={selectedIds.size === 0}
            className="flex items-center space-x-1 py-1.5 px-2.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs rounded-xl border border-rose-800/40 disabled:opacity-40"
            title="Delete Selected"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete ({selectedIds.size})</span>
          </button>
        </div>

        {/* Add Actions & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Blank Page */}
          <button
            type="button"
            onClick={handleAddBlankPage}
            className="flex items-center space-x-1.5 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Blank Page</span>
          </button>

          {/* Add Another PDF */}
          <label className="flex items-center space-x-1.5 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer">
            <FilePlus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Add PDF...</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleAddExtraFile}
              className="hidden"
            />
          </label>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || busy || pages.length === 0}
            className="py-2 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting PDF...</span>
              </>
            ) : (
              <span>Save Organized PDF ({pages.length} Pages)</span>
            )}
          </button>
        </div>
      </div>

      {/* Grid instructions */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>💡 Drag thumbnails by the grip handle to reorder. Click a card or checkbox to select.</span>
        <span className="font-mono text-slate-400 font-medium">
          {pages.length} Total Page{pages.length === 1 ? '' : 's'}
          {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
        </span>
      </div>

      {/* Sortable Thumbnail Grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {pages.map((item, index) => (
              <SortableThumbnail
                key={item.id}
                item={item}
                index={index}
                isSelected={selectedIds.has(item.id)}
                sourceDocs={sourceDocs}
                onToggleSelect={handleToggleSelect}
                onRotate={handleRotatePage}
                onDuplicate={handleDuplicatePage}
                onDelete={handleDeletePage}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
