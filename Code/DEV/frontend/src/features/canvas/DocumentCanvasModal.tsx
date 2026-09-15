import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getStroke } from 'perfect-freehand';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  X,
  Minus,
  Maximize2,
  Minimize2,
  PenTool,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Save,
  Check,
  Eye,
  Edit3,
  Loader2
} from 'lucide-react';
import { useEduOSStore } from '../../store/store';
import type { CanvasObject } from '../../lib/api';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface DocumentAnnotationData {
  id: string;
  name: string;
  fileType: string;
  src?: string;
  htmlContent?: string;
  textContent?: string;
  initialStrokes?: Array<{
    id: string;
    points: Array<{ x: number; y: number; pressure?: number }>;
    color: string;
    width: number;
    isHighlighter?: boolean;
  }>;
}

interface DocumentCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentData: DocumentAnnotationData | null;
  onSaveToMainCanvas?: (docObject: CanvasObject) => void;
}

interface StrokeItem {
  id: string;
  points: Array<{ x: number; y: number; pressure?: number }>;
  color: string;
  width: number;
  isHighlighter?: boolean;
}

const PALETTE = [
  { name: 'Thistle', color: '#D6C8DF' },
  { name: 'Sky', color: '#38BDF8' },
  { name: 'Yellow', color: '#FBBF24' },
  { name: 'Emerald', color: '#34D399' },
  { name: 'Pink', color: '#F472B6' },
  { name: 'Red', color: '#F87171' },
  { name: 'White', color: '#FFFFFF' }
];

export const DocumentCanvasModal: React.FC<DocumentCanvasModalProps> = ({
  isOpen,
  onClose,
  documentData,
  onSaveToMainCanvas
}) => {
  const { saveCanvasToHistory } = useEduOSStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [interactionMode, setInteractionMode] = useState<'draw' | 'scroll'>('draw');

  // Drawing state
  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [color, setColor] = useState('#FBBF24');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [strokes, setStrokes] = useState<StrokeItem[]>([]);
  const [history, setHistory] = useState<StrokeItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentPoints, setCurrentPoints] = useState<Array<{ x: number; y: number; pressure?: number }>>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // PDF Page rendering state
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  // Notification state
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentCardRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const isPdf = !!(documentData?.name.toLowerCase().endsWith('.pdf') || documentData?.fileType.includes('pdf'));
  const isDocx = !!(documentData?.name.toLowerCase().includes('.doc') || documentData?.fileType.includes('word'));
  const isPpt = !!(documentData?.name.toLowerCase().includes('.ppt') || documentData?.fileType.includes('presentation'));
  const isImage = !!(documentData?.fileType.startsWith('image/') || (documentData?.name && /\.(png|jpe?g|webp|svg|gif)$/i.test(documentData.name)));

  // Load and render PDF pages directly into high-res continuous canvases
  useEffect(() => {
    if (!isOpen || !documentData || !isPdf || !documentData.src) {
      setPdfPages([]);
      return;
    }

    let isCancelled = false;

    const renderPdf = async () => {
      setIsLoadingPdf(true);
      try {
        const loadingTask = pdfjsLib.getDocument({ url: documentData.src! });
        const pdf = await loadingTask.promise;
        const pageDataUrls: string[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          if (isCancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.8 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          if (context) {
            await (page.render as any)({ canvasContext: context, viewport, canvas }).promise;
            pageDataUrls.push(canvas.toDataURL('image/png'));
          }
        }

        if (!isCancelled) {
          setPdfPages(pageDataUrls);
        }
      } catch (err) {
        console.error("PDF rendering error:", err);
      } finally {
        if (!isCancelled) {
          setIsLoadingPdf(false);
        }
      }
    };

    renderPdf();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, documentData?.src, isPdf]);

  // Initialize strokes when documentData changes
  useEffect(() => {
    if (documentData) {
      const initial = documentData.initialStrokes || [];
      setStrokes(initial);
      setHistory([initial]);
      setHistoryIndex(0);
      setIsMinimized(false);
    }
  }, [documentData]);

  if (!isOpen || !documentData) return null;

  // Path generator with perfect-freehand
  const getSvgPathFromStroke = (strokePoints: number[][]) => {
    if (!strokePoints.length) return '';
    const d = strokePoints.reduce(
      (acc, [x, y], i) => {
        if (i === 0) return `M ${x} ${y}`;
        return `${acc} L ${x} ${y}`;
      },
      ''
    );
    return d + ' Z';
  };

  const pushToHistory = (newStrokes: StrokeItem[]) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newStrokes);
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    setStrokes(newStrokes);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setStrokes(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setStrokes(history[historyIndex + 1]);
    }
  };

  const handleClear = () => {
    pushToHistory([]);
  };

  // Pointer event handlers anchored directly to document content coordinates
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (interactionMode !== 'draw') return;
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'eraser') {
      const remaining = strokes.filter(s => {
        const isNear = s.points.some(p => Math.hypot(p.x - x, p.y - y) < 25);
        return !isNear;
      });
      if (remaining.length !== strokes.length) {
        pushToHistory(remaining);
      }
      return;
    }

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch { }

    setIsDrawing(true);
    setCurrentPoints([{ x, y, pressure: e.pressure }]);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || interactionMode !== 'draw') return;
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentPoints(prev => [...prev, { x, y, pressure: e.pressure }]);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { }
    setIsDrawing(false);

    if (currentPoints.length > 1) {
      const isHighlighter = activeTool === 'highlighter';
      const newStroke: StrokeItem = {
        id: `doc-stroke-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        points: currentPoints,
        color: isHighlighter ? color : color,
        width: isHighlighter ? 24 : strokeWidth,
        isHighlighter
      };
      pushToHistory([...strokes, newStroke]);
    }
    setCurrentPoints([]);
  };

  // Build document object containing embedded strokes
  const buildCurrentDocObject = (): CanvasObject => {
    return {
      id: documentData.id || `doc-${Date.now()}`,
      type: isImage ? 'image' : 'document',
      geometry_json: JSON.stringify({
        name: documentData.name,
        file_type: documentData.fileType,
        src: documentData.src,
        html_content: documentData.htmlContent,
        text_content: documentData.textContent,
        strokes: strokes, // Annotations scoped directly to the document
        x: 80,
        y: 60,
        w: isImage ? 540 : 640,
        h: isImage ? 420 : 480
      }),
      order_index: 0
    };
  };

  // Save as a distinct separate Canvas Note session
  const handleSaveSeparateSession = () => {
    const docTitle = `${documentData.name} (Annotated Document)`;
    const docObject = buildCurrentDocObject();

    // Save only the document with embedded annotations (prevents stray global strokes)
    saveCanvasToHistory([docObject], docTitle);

    if (onSaveToMainCanvas) {
      onSaveToMainCanvas(docObject);
    }

    setSavedToast(`Saved "${documentData.name}" with ${strokes.length} annotations!`);
    setTimeout(() => setSavedToast(null), 3500);
  };

  // Safe close handler that synchronizes annotations back to the canvas document
  const handleModalClose = () => {
    if (onSaveToMainCanvas && documentData) {
      const docObject = buildCurrentDocObject();
      onSaveToMainCanvas(docObject);
    }
    onClose();
  };

  // Export merged high-resolution PNG with all markings and document pages
  const handleExportPNG = async () => {
    const contentEl = contentCardRef.current;
    const svgEl = svgRef.current;
    if (!contentEl || !svgEl) return;

    try {
      const rect = contentEl.getBoundingClientRect();
      const exportCanvas = document.createElement('canvas');
      const scale = 2; // 2x sharp Retina export
      exportCanvas.width = Math.max(rect.width * scale, 1200);
      exportCanvas.height = Math.max(rect.height * scale, 900);
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#00272B';
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      // If PDF pages are rendered, draw them in order
      if (pdfPages.length > 0) {
        let currentY = 0;
        const pageHeight = exportCanvas.height / pdfPages.length;
        for (const pageSrc of pdfPages) {
          const pageImg = new Image();
          await new Promise((resolve) => {
            pageImg.onload = resolve;
            pageImg.src = pageSrc;
          });
          ctx.drawImage(pageImg, 0, currentY, exportCanvas.width, pageHeight);
          currentY += pageHeight;
        }
      } else if (documentData.src && isImage) {
        const docImg = new Image();
        await new Promise((resolve) => {
          docImg.onload = resolve;
          docImg.src = documentData.src!;
        });
        ctx.drawImage(docImg, 0, 0, exportCanvas.width, exportCanvas.height);
      }

      // Serialize and overlay SVG markings on top
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgEl);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const blobURL = URL.createObjectURL(svgBlob);

      const markImg = new Image();
      markImg.onload = () => {
        ctx.drawImage(markImg, 0, 0, exportCanvas.width, exportCanvas.height);
        URL.revokeObjectURL(blobURL);

        const dataUrl = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        const safeName = documentData.name.replace(/\.[^/.]+$/, '');
        link.download = `${safeName}_Annotated_Note.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setSavedToast(`Exported "${safeName}_Annotated_Note.png" successfully!`);
        setTimeout(() => setSavedToast(null), 3500);
      };
      markImg.src = blobURL;
    } catch (err) {
      console.error("Failed to export annotated document:", err);
    }
  };

  const badgeColor = isPdf
    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
    : isPpt
    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    : isDocx
    ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
    : isImage
    ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';

  const badgeLabel = isPdf ? 'PDF' : isPpt ? 'PPT' : isDocx ? 'DOCX' : isImage ? 'IMAGE' : 'DOC';

  // MINIMIZED DOCK BAR VIEW
  if (isMinimized) {
    return createPortal(
      <div className="fixed bottom-5 right-5 z-[9999] animate-slide-up">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--card-bg)] backdrop-blur-2xl border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] rounded-2xl shadow-2xl">
          <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase border ${badgeColor}`}>
            {badgeLabel}
          </span>
          <span className="font-bold text-xs text-[var(--text-primary)] truncate max-w-[180px]">
            {documentData.name}
          </span>
          <span className="text-[10px] font-mono text-[var(--accent-primary)] bg-[var(--accent-primary-soft)] px-2 py-0.5 rounded-lg border border-[var(--border-subtle)]">
            {strokes.length} marks
          </span>
          <button
            onClick={() => setIsMinimized(false)}
            className="px-3 py-1 bg-[var(--accent-primary)] text-[var(--text-inverse)] font-bold text-xs rounded-xl hover:opacity-90 transition-all cursor-pointer shadow-sm"
          >
            Open Canvas
          </button>
          <button
            onClick={handleModalClose}
            className="p-1 text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // FULL SEPARATE CANVAS MODAL VIEW
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-5 select-none animate-fade-in">
      <div
        ref={containerRef}
        className={`bg-[var(--glass-bg)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen ? 'w-full h-full rounded-none border-0' : 'w-[96vw] max-w-[1400px] h-[92vh] max-h-[95vh]'
        }`}
      >
        {/* TOP HEADER BAR */}
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--accent-primary-soft)]/95 border-b border-[var(--border-subtle)] select-none shrink-0 gap-3 z-30">
          {/* File Info */}
          <div className="flex items-center gap-2.5 truncate max-w-[40%]">
            <span className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold uppercase border ${badgeColor}`}>
              {badgeLabel}
            </span>
            <span className="font-bold text-sm text-[var(--text-primary)] truncate">
              {documentData.name}
            </span>
            <span className="text-[10px] font-semibold text-[var(--text-secondary)] hidden sm:inline-block">
              ({strokes.length} marks)
            </span>
          </div>

          {/* Mode Switcher & Actions */}
          <div className="flex items-center gap-2">
            {/* Draw vs Scroll Mode Toggle */}
            <div className="flex items-center bg-[var(--card-bg)] p-0.5 rounded-xl border border-[var(--border-subtle)] text-xs">
              <button
                onClick={() => setInteractionMode('draw')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  interactionMode === 'draw'
                    ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Annotate Mode: Draw, highlight and mark over document"
              >
                <Edit3 size={13} />
                <span>Annotate</span>
              </button>
              <button
                onClick={() => setInteractionMode('scroll')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  interactionMode === 'scroll'
                    ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Read / Scroll Mode: Scroll pages and select text"
              >
                <Eye size={13} />
                <span>Scroll / Read</span>
              </button>
            </div>

            {/* Separate Save Buttons */}
            <button
              onClick={handleSaveSeparateSession}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--card-bg)] hover:bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              title="Save as a separate session in Canvas History"
            >
              <Save size={14} />
              <span className="hidden md:inline">Save Note</span>
            </button>

            <button
              onClick={handleExportPNG}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              title="Export high-resolution PNG with all markings"
            >
              <Download size={14} />
              <span className="hidden md:inline">Export PNG</span>
            </button>
          </div>

          {/* Window Controls: [-] Minimize, [+] Fullscreen, [X] Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Minimize Button (-) */}
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--card-bg)] hover:bg-[var(--accent-primary-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center"
              title="Minimize to dock widget (-)"
            >
              <Minus size={14} />
            </button>

            {/* Fullscreen Button (+) */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--card-bg)] hover:bg-[var(--accent-primary-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen (+)"}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            {/* Close Button (X) */}
            <button
              onClick={handleModalClose}
              className="p-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--card-bg)] hover:bg-rose-500/20 text-[var(--text-secondary)] hover:text-rose-400 hover:border-rose-500/40 transition-colors cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center"
              title="Close Canvas (X)"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* NOTIFICATION TOAST */}
        {savedToast && (
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 px-5 py-2.5 bg-emerald-600/95 text-white font-bold text-xs rounded-2xl shadow-2xl border border-emerald-300 flex items-center gap-2 animate-fade-in">
            <Check size={16} />
            <span>{savedToast}</span>
          </div>
        )}

        {/* WORKSPACE AREA: SCROLL CONTAINER WITH SYNCHRONIZED DRAWING OVERLAY */}
        <div className="flex-1 relative w-full h-full overflow-y-auto overflow-x-hidden p-2 sm:p-6 flex justify-center bg-[var(--card-bg)]/80 pb-24">
          {/* Document Content Card (Both background and SVG overlay live inside here, scrolling synchronously) */}
          <div
            ref={contentCardRef}
            className="w-full max-w-[1050px] bg-white dark:bg-[#00272B] rounded-2xl shadow-2xl border border-[var(--border-subtle)] relative overflow-hidden flex flex-col min-h-[600px] h-fit"
          >
            {/* 1. Underlying Document Rendering */}
            {isLoadingPdf ? (
              <div className="w-full h-96 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
                <span className="text-xs font-semibold">Rendering PDF pages in high resolution...</span>
              </div>
            ) : pdfPages.length > 0 ? (
              <div className="w-full flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
                {pdfPages.map((pageDataUrl, idx) => (
                  <div key={idx} className="relative w-full">
                    <img
                      src={pageDataUrl}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-auto block select-none pointer-events-none"
                    />
                    <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/60 text-white font-mono text-[9px] font-bold rounded-md pointer-events-none">
                      Page {idx + 1} of {pdfPages.length}
                    </div>
                  </div>
                ))}
              </div>
            ) : documentData.htmlContent ? (
              <div
                className="w-full p-6 sm:p-12 text-xs text-gray-900 dark:text-gray-100 leading-relaxed select-text word-doc-container"
                dangerouslySetInnerHTML={{ __html: documentData.htmlContent }}
              />
            ) : documentData.src && isImage ? (
              <div className="w-full flex items-center justify-center p-4">
                <img
                  src={documentData.src}
                  alt={documentData.name}
                  className="max-w-full h-auto object-contain rounded-xl block select-none pointer-events-none"
                />
              </div>
            ) : documentData.textContent ? (
              <div className="w-full p-6 sm:p-12 text-xs text-gray-900 dark:text-gray-100 leading-relaxed font-sans whitespace-pre-wrap">
                {documentData.textContent}
              </div>
            ) : (
              <div className="w-full p-16 text-center text-xs text-[var(--text-secondary)]">
                Document content loaded.
              </div>
            )}

            {/* 2. Interactive SVG Drawing Overlay (Locked 1:1 inside the document content card) */}
            <svg
              ref={svgRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className={`absolute inset-0 w-full h-full select-none z-10 ${
                interactionMode === 'draw' ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
              }`}
              style={{ touchAction: 'none' }}
            >
              {/* Existing Saved Strokes */}
              {strokes.map((stroke) => {
                const pts = stroke.points.map(p => [p.x, p.y]);
                const outline = getStroke(pts, {
                  size: stroke.width,
                  thinning: stroke.isHighlighter ? 0 : 0.5,
                  smoothing: 0.5,
                  streamline: 0.5
                });
                const d = getSvgPathFromStroke(outline);
                return (
                  <path
                    key={stroke.id}
                    d={d}
                    fill={stroke.color}
                    opacity={stroke.isHighlighter ? 0.45 : 0.9}
                    className="transition-opacity"
                  />
                );
              })}

              {/* In-progress Active Stroke */}
              {isDrawing && currentPoints.length > 0 && (
                <path
                  d={getSvgPathFromStroke(
                    getStroke(
                      currentPoints.map(p => [p.x, p.y]),
                      {
                        size: activeTool === 'highlighter' ? 24 : strokeWidth,
                        thinning: activeTool === 'highlighter' ? 0 : 0.5,
                        smoothing: 0.5,
                        streamline: 0.5
                      }
                    )
                  )}
                  fill={color}
                  opacity={activeTool === 'highlighter' ? 0.45 : 0.9}
                />
              )}
            </svg>
          </div>

          {/* 3. DEDICATED FLOATING TOOLBAR */}
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 flex items-center gap-1.5 p-1.5 bg-[var(--card-bg)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-2xl shadow-2xl select-none">
            {/* Pen Tool */}
            <button
              onClick={() => {
                setActiveTool('pen');
                setInteractionMode('draw');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTool === 'pen' && interactionMode === 'draw'
                  ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
              }`}
              title="Pen tool"
            >
              <PenTool size={14} />
              <span>Pen</span>
            </button>

            {/* Highlighter Tool */}
            <button
              onClick={() => {
                setActiveTool('highlighter');
                setInteractionMode('draw');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTool === 'highlighter' && interactionMode === 'draw'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
              }`}
              title="Highlighter tool (translucent text markup)"
            >
              <Highlighter size={14} />
              <span>Highlighter</span>
            </button>

            {/* Eraser Tool */}
            <button
              onClick={() => {
                setActiveTool('eraser');
                setInteractionMode('draw');
              }}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                activeTool === 'eraser' && interactionMode === 'draw'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary-soft)]'
              }`}
              title="Eraser tool (click markings to erase)"
            >
              <Eraser size={15} />
            </button>

            <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-1" />

            {/* Color Palette */}
            <div className="flex items-center gap-1">
              {PALETTE.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setColor(p.color)}
                  style={{ backgroundColor: p.color }}
                  className={`w-5 h-5 rounded-full border transition-all cursor-pointer hover:scale-110 ${
                    color === p.color ? 'border-white ring-2 ring-[var(--accent-primary)] scale-110' : 'border-black/40'
                  }`}
                  title={p.name}
                />
              ))}
            </div>

            <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-1" />

            {/* Stroke Width Selector */}
            {activeTool === 'pen' && (
              <div className="flex items-center gap-1">
                {[2, 4, 8].map((w) => (
                  <button
                    key={w}
                    onClick={() => setStrokeWidth(w)}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold border transition-all cursor-pointer ${
                      strokeWidth === w
                        ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] border-[var(--accent-primary)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}

            <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-1" />

            {/* Undo & Redo */}
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className={`p-1.5 rounded-xl transition-all ${
                historyIndex > 0 ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer' : 'text-gray-600 opacity-40 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={15} />
            </button>

            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className={`p-1.5 rounded-xl transition-all ${
                historyIndex < history.length - 1 ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer' : 'text-gray-600 opacity-40 cursor-not-allowed'
              }`}
              title="Redo"
            >
              <Redo2 size={15} />
            </button>

            {/* Clear All Markings */}
            <button
              onClick={handleClear}
              disabled={strokes.length === 0}
              className={`p-1.5 rounded-xl transition-all ${
                strokes.length > 0 ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 cursor-pointer' : 'text-gray-600 opacity-40 cursor-not-allowed'
              }`}
              title="Clear all annotations on this document"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
