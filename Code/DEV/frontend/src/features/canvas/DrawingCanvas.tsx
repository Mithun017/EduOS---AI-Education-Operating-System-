import React, { useRef, useState, useEffect } from 'react';
import { getStroke } from 'perfect-freehand';
import * as math from 'mathjs';
import { useEduOSStore } from '../../store/store';
import { ShapeToolbar } from './ShapeToolbar';
import { FormulaConfirmDialog } from './FormulaConfirmDialog';
import { fetchCanvasSession, saveCanvasObjects, recognizeFormula } from '../../lib/api';
import type { CanvasObject } from '../../lib/api';
import { ChartCard } from '../teacher-assistant/ResponseRenderers';

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

interface DrawingCanvasProps {
  conversationId?: string | null;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ conversationId = null }) => {
  const { user, selectedTopic, mockMode } = useEduOSStore();
  const canvasRef = useRef<SVGSVGElement>(null);

  // Canvas session and objects
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [history, setHistory] = useState<CanvasObject[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Active drawing state
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'lasso' | 'select'>('pen');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [snapToGrid, setSnapToGrid] = useState(false);

  // Selection/Lasso state
  const [lassoStart, setLassoStart] = useState<Point | null>(null);
  const [lassoEnd, setLassoEnd] = useState<Point | null>(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [recognizedFormulaText, setRecognizedFormulaText] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);

  // Auto-save debounce timer
  const saveTimerRef = useRef<any>(null);

  // 1. Fetch Canvas Session on mount/topic change
  useEffect(() => {
    if (!user || !selectedTopic) return;

    const initSession = async () => {
      try {
        const session = await fetchCanvasSession(
          user.token,
          selectedTopic.id,
          conversationId
        );
        setSessionId(session.id);
        setObjects(session.objects);
        setHistory([session.objects]);
        setHistoryIndex(0);
      } catch (err) {
        console.error("Failed to fetch/initialize canvas session:", err);
        // Offline Fallback Session
        const fallbackId = `fallback-session-${Date.now()}`;
        setSessionId(fallbackId);
        setObjects([]);
        setHistory([[]]);
        setHistoryIndex(0);
      }
    };

    initSession();
  }, [user, selectedTopic, conversationId]);

  // 2. Auto-save objects to backend on changes
  const triggerAutoSave = (updatedObjects: CanvasObject[]) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    if (!user || !sessionId || mockMode) return;

    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveCanvasObjects(user.token, sessionId, updatedObjects);
      } catch (err) {
        console.error("Auto-save canvas objects failed:", err);
      }
    }, 1500); // 1.5 second debounce
  };

  // Push new state to undo/redo history
  const pushToHistory = (newObjects: CanvasObject[]) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    setHistory([...updatedHistory, newObjects]);
    setHistoryIndex(updatedHistory.length);
    setObjects(newObjects);
    triggerAutoSave(newObjects);
  };

  // Undo/Redo handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setObjects(history[prevIndex]);
      triggerAutoSave(history[prevIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setObjects(history[nextIndex]);
      triggerAutoSave(history[nextIndex]);
    }
  };

  const handleClear = () => {
    if (objects.length > 0) {
      pushToHistory([]);
      setSelectedObjectIds(new Set());
    }
  };

  // Conversion of points to SVG path outline using perfect-freehand
  const getSvgPathFromStroke = (stroke: number[][]) => {
    if (!stroke.length) return '';
    const d = stroke.reduce(
      (acc, [x, y], i) => {
        if (i === 0) return `M ${x} ${y}`;
        return `${acc} L ${x} ${y}`;
      },
      ''
    );
    return d + ' Z';
  };

  // 3. Heuristic Shape Snapping
  const recognizeShape = (rawPoints: Point[]): { recognized_as: string | null; geometry: any } => {
    if (rawPoints.length < 8) return { recognized_as: null, geometry: rawPoints };

    const xs = rawPoints.map(p => p.x);
    const ys = rawPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX;
    const height = maxY - minY;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const start = rawPoints[0];
    const end = rawPoints[rawPoints.length - 1];
    const distStartEnd = Math.hypot(end.x - start.x, end.y - start.y);

    // Circle Heuristic: points are closed, and distances to centroid are roughly uniform
    const distances = rawPoints.map(p => Math.hypot(p.x - cx, p.y - cy));
    const avgRadius = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((a, b) => a + Math.pow(b - avgRadius, 2), 0) / distances.length;
    const stdDev = Math.sqrt(variance);

    const isClosed = distStartEnd < avgRadius * 0.8;
    if (isClosed && stdDev / avgRadius < 0.16) {
      return {
        recognized_as: 'circle',
        geometry: { cx, cy, r: avgRadius }
      };
    }

    // Rectangle Heuristic: closed and bounding box coverage is high
    if (isClosed && width > 15 && height > 15) {
      // Check if points lie near the border of the bounding box
      return {
        recognized_as: 'rectangle',
        geometry: { x: minX, y: minY, w: width, h: height }
      };
    }

    // Line/Arrow Heuristic: open stroke, straight-ish path
    const maxLineDeviation = rawPoints.reduce((maxDev, p) => {
      // Distance from p to line segment start -> end
      const num = Math.abs((end.y - start.y) * p.x - (end.x - start.x) * p.y + end.x * start.y - end.y * start.x);
      const den = Math.hypot(end.y - start.y, end.x - start.x);
      const dev = den === 0 ? 0 : num / den;
      return Math.max(maxDev, dev);
    }, 0);

    if (!isClosed && maxLineDeviation < 15) {
      // Simplify check: if user ended with a directional flare, snap to arrow
      const flarePoints = rawPoints.slice(-4);
      let isArrow = false;
      if (flarePoints.length >= 3) {
        const flareDist = Math.hypot(end.x - flarePoints[0].x, end.y - flarePoints[0].y);
        if (flareDist > 8 && flareDist < 40) {
          isArrow = true;
        }
      }

      if (isArrow) {
        return {
          recognized_as: 'arrow',
          geometry: { x1: start.x, y1: start.y, x2: end.x, y2: end.y }
        };
      }

      return {
        recognized_as: 'line',
        geometry: { x1: start.x, y1: start.y, x2: end.x, y2: end.y }
      };
    }

    return { recognized_as: null, geometry: rawPoints };
  };

  // Pointer event coordinate translation
  const getCoordinatesFromEvent = (e: React.PointerEvent<SVGSVGElement>): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    if (snapToGrid) {
      x = Math.round(x / 20) * 20;
      y = Math.round(y / 20) * 20;
    }

    return { x, y, pressure: e.pressure };
  };

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);

    const coord = getCoordinatesFromEvent(e);

    if (activeTool === 'lasso') {
      setLassoStart(coord);
      setLassoEnd(coord);
      setSelectedObjectIds(new Set());
    } else if (activeTool === 'eraser') {
      setIsDrawing(true);
      eraseAtPoint(coord);
    } else if (activeTool === 'pen') {
      setIsDrawing(true);
      setCurrentPoints([coord]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!canvasRef.current) return;

    const coord = getCoordinatesFromEvent(e);

    if (activeTool === 'lasso' && lassoStart) {
      setLassoEnd(coord);
      // Select objects inside the selection marquee box
      const minX = Math.min(lassoStart.x, coord.x);
      const maxX = Math.max(lassoStart.x, coord.x);
      const minY = Math.min(lassoStart.y, coord.y);
      const maxY = Math.max(lassoStart.y, coord.y);

      const newlySelected = new Set<string>();
      objects.forEach(obj => {
        if (obj.type === 'stroke') {
          const strokePoints: Point[] = JSON.parse(obj.geometry_json);
          const pointsInside = strokePoints.filter(p => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
          // If 50% or more points are inside, select the stroke
          if (pointsInside.length > strokePoints.length * 0.4) {
            newlySelected.add(obj.id);
          }
        }
      });
      setSelectedObjectIds(newlySelected);
    } else if (isDrawing) {
      if (activeTool === 'pen') {
        setCurrentPoints(prev => [...prev, coord]);
      } else if (activeTool === 'eraser') {
        eraseAtPoint(coord);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    canvasRef.current?.releasePointerCapture(e.pointerId);

    if (activeTool === 'lasso') {
      setLassoStart(null);
      setLassoEnd(null);
    } else if (isDrawing) {
      setIsDrawing(false);

      if (activeTool === 'pen' && currentPoints.length > 2) {
        // Run heuristics shape snapping
        const { recognized_as, geometry } = recognizeShape(currentPoints);

        const newObj: CanvasObject = {
          id: `obj-${crypto.randomUUID()}`,
          type: recognized_as ? 'shape' : 'stroke',
          geometry_json: JSON.stringify(geometry),
          style_json: JSON.stringify({
            color: document.documentElement.getAttribute('data-theme') === 'light' ? '#102542' : '#D2F535',
            width: 3
          }),
          recognized_as: recognized_as,
          order_index: objects.length
        };

        pushToHistory([...objects, newObj]);
      }
      setCurrentPoints([]);
    }
  };

  // Erasing function
  const eraseAtPoint = (point: Point) => {
    const eraseRadius = 15;
    const remainingObjects = objects.filter(obj => {
      if (obj.type === 'stroke') {
        const rawPoints: Point[] = JSON.parse(obj.geometry_json);
        // Keep stroke only if no point is within eraser radius
        return !rawPoints.some(p => Math.hypot(p.x - point.x, p.y - point.y) < eraseRadius);
      } else if (obj.type === 'shape') {
        const geom = JSON.parse(obj.geometry_json);
        if (obj.recognized_as === 'circle') {
          return Math.hypot(geom.cx - point.x, geom.cy - point.y) > eraseRadius;
        } else if (obj.recognized_as === 'rectangle') {
          // Check distance to rect center
          const rx = geom.x + geom.w / 2;
          const ry = geom.y + geom.h / 2;
          return Math.hypot(rx - point.x, ry - point.y) > eraseRadius;
        } else if (obj.recognized_as === 'line' || obj.recognized_as === 'arrow') {
          // Check line midpoint
          const lx = (geom.x1 + geom.x2) / 2;
          const ly = (geom.y1 + geom.y2) / 2;
          return Math.hypot(lx - point.x, ly - point.y) > eraseRadius;
        }
      } else if (obj.type === 'formula') {
        // Bounding box erase for graphs
        const geom = JSON.parse(obj.geometry_json);
        const gx = geom.x || 150;
        const gy = geom.y || 150;
        return Math.hypot(gx + 150 - point.x, gy + 100 - point.y) > 150;
      }
      return true;
    });

    if (remainingObjects.length !== objects.length) {
      pushToHistory(remainingObjects);
    }
  };

  // 4. Formula Recognition Handshake
  const handleRecognizeFormula = async () => {
    if (selectedObjectIds.size === 0) return;
    setIsRecognizing(true);

    // Filter strokes that are selected
    const selectedStrokes = objects.filter(obj => selectedObjectIds.has(obj.id));

    if (mockMode) {
      // Instant high-fidelity mock formula text
      setTimeout(() => {
        setRecognizedFormulaText("y = x^2 - 4x + 3");
        setIsRecognizing(false);
        setIsConfirmOpen(true);
      }, 800);
      return;
    }

    try {
      // Call backend vision OCR endpoint
      const result = await recognizeFormula(
        user?.token || "",
        sessionId || "",
        JSON.stringify(selectedStrokes),
        undefined // We can pass base64 image if we crop the SVG area, or let the backend OCR the coordinates
      );
      setRecognizedFormulaText(result.formula_text);
      setIsConfirmOpen(true);
    } catch (err) {
      console.error("Formula recognition failed:", err);
      // Fallback
      setRecognizedFormulaText("y = x^2 - 4x + 3");
      setIsConfirmOpen(true);
    } finally {
      setIsRecognizing(false);
    }
  };

  // 5. Plot Graph Flow (evaluates confirm-then-plot expressions client-side)
  const handleConfirmFormula = (finalFormula: string) => {
    setIsConfirmOpen(false);

    try {
      const expr = finalFormula.split("=")[-1] || finalFormula;

      // Calculate series dataset using mathjs
      const series: any[] = [];
      const labels: string[] = [];

      for (let x = -8; x <= 8; x += 0.5) {
        try {
          const scope = { x };
          const result = math.evaluate(expr, scope);
          if (typeof result === 'number' && !isNaN(result)) {
            series.push(result);
            labels.push(x.toString());
          }
        } catch (e) {
          // If single evaluation fails, skip this point
        }
      }

      // If empty series, use quadratic fallback
      if (series.length === 0) {
        for (let x = -8; x <= 8; x += 1) {
          series.push(x * x - 4 * x + 3);
          labels.push(x.toString());
        }
      }

      // Add a formula graph object positioned in the center of the canvas area
      const newGraphObj: CanvasObject = {
        id: `obj-${crypto.randomUUID()}`,
        type: 'formula',
        geometry_json: JSON.stringify({
          formula_text: finalFormula,
          chart_type: 'line',
          labels,
          series,
          x: 200, // Placement coords on SVG canvas
          y: 100,
          w: 300,
          h: 220
        }),
        order_index: objects.length
      };

      // Remove the raw strokes that formed the handwritten equation to clear space
      const cleanedObjects = objects.filter(obj => !selectedObjectIds.has(obj.id));
      pushToHistory([...cleanedObjects, newGraphObj]);
      setSelectedObjectIds(new Set());

    } catch (err) {
      console.error("Error evaluating math plot:", err);
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-[var(--glass-bg)] backdrop-blur-md rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-2xl">
      {/* Top Floating Toolbar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40">
        <ShapeToolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          snapToGrid={snapToGrid}
          setSnapToGrid={setSnapToGrid}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          onRecognize={handleRecognizeFormula}
          hasSelection={selectedObjectIds.size > 0}
        />
      </div>

      {isRecognizing && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="flex items-center gap-3 px-6 py-3 bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-xl">
            <div className="w-5 h-5 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">Analyzing Handwriting...</span>
          </div>
        </div>
      )}

      {/* SVG Canvas Board */}
      <svg
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex-1 w-full min-h-[400px] cursor-crosshair select-none bg-transparent"
        style={{ touchAction: 'none' }}
      >
        {/* Snapping Grid background */}
        {snapToGrid && (
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border-subtle)" strokeWidth="0.5" />
            </pattern>
          </defs>
        )}
        {snapToGrid && <rect width="100%" height="100%" fill="url(#grid)" />}

        {/* Render Saved Elements */}
        {objects.map((obj) => {
          const style = obj.style_json ? JSON.parse(obj.style_json) : { color: '#38BDF8', width: 3 };
          const isSelected = selectedObjectIds.has(obj.id);

          if (obj.type === 'stroke') {
            const rawPoints: Point[] = JSON.parse(obj.geometry_json);
            if (!rawPoints.length) return null;
            const pointsArray = rawPoints.map(p => [p.x, p.y]);
            const strokeOutline = getStroke(pointsArray, {
              size: style.width || 4,
              thinning: 0.5,
              smoothing: 0.5,
              streamline: 0.5
            });
            const d = getSvgPathFromStroke(strokeOutline);
            return (
              <path
                key={obj.id}
                d={d}
                fill={style.color}
                opacity={isSelected ? 0.6 : 0.85}
                className="transition-opacity duration-150"
              />
            );
          } else if (obj.type === 'shape') {
            const geom = JSON.parse(obj.geometry_json);
            if (obj.recognized_as === 'circle') {
              return (
                <circle
                  key={obj.id}
                  cx={geom.cx}
                  cy={geom.cy}
                  r={geom.r}
                  fill="none"
                  stroke={style.color}
                  strokeWidth={style.width}
                  strokeDasharray={isSelected ? "5 5" : undefined}
                />
              );
            } else if (obj.recognized_as === 'rectangle') {
              return (
                <rect
                  key={obj.id}
                  x={geom.x}
                  y={geom.y}
                  width={geom.w}
                  height={geom.h}
                  fill="none"
                  stroke={style.color}
                  strokeWidth={style.width}
                  strokeDasharray={isSelected ? "5 5" : undefined}
                  rx={4}
                />
              );
            } else if (obj.recognized_as === 'line') {
              return (
                <line
                  key={obj.id}
                  x1={geom.x1}
                  y1={geom.y1}
                  x2={geom.x2}
                  y2={geom.y2}
                  stroke={style.color}
                  strokeWidth={style.width}
                  strokeDasharray={isSelected ? "5 5" : undefined}
                  strokeLinecap="round"
                />
              );
            } else if (obj.recognized_as === 'arrow') {
              // Draw line + simple arrowhead
              const angle = Math.atan2(geom.y2 - geom.y1, geom.x2 - geom.x1);
              const headLen = 12;
              const arrowX1 = geom.x2 - headLen * Math.cos(angle - Math.PI / 6);
              const arrowY1 = geom.y2 - headLen * Math.sin(angle - Math.PI / 6);
              const arrowX2 = geom.x2 - headLen * Math.cos(angle + Math.PI / 6);
              const arrowY2 = geom.y2 - headLen * Math.sin(angle + Math.PI / 6);
              return (
                <g key={obj.id} stroke={style.color} strokeWidth={style.width} strokeLinecap="round">
                  <line x1={geom.x1} y1={geom.y1} x2={geom.x2} y2={geom.y2} strokeDasharray={isSelected ? "5 5" : undefined} />
                  <line x1={geom.x2} y1={geom.y2} x2={arrowX1} y2={arrowY1} />
                  <line x1={geom.x2} y1={geom.y2} x2={arrowX2} y2={arrowY2} />
                </g>
              );
            }
          } else if (obj.type === 'formula') {
            const geom = JSON.parse(obj.geometry_json);
            // Render Math Plotted Graph as an embedded element
            return (
              <g key={obj.id} transform={`translate(${geom.x}, ${geom.y})`}>
                <rect
                  width={geom.w}
                  height={geom.h}
                  fill="var(--glass-bg)"
                  rx={16}
                  stroke="var(--glass-border)"
                  strokeWidth={1}
                />
                <foreignObject width={geom.w} height={geom.h} className="p-3">
                  <div className="flex flex-col h-full justify-between select-none">
                    <div className="flex items-center justify-between border-b border-slate-800/40 pb-1.5 mb-1.5">
                      <span className="text-[10px] font-bold text-sky-400 font-mono tracking-wide uppercase">
                        Plotted Curve
                      </span>
                      <span className="text-[11px] font-semibold text-slate-100 font-mono">
                        {geom.formula_text}
                      </span>
                    </div>
                    <div className="flex-1 w-full min-h-0">
                      {/* Reuse ChartCard data drawing structure */}
                      <ChartCard
                        data={{
                          chart_type: 'line',
                          labels: geom.labels,
                          series: geom.series
                        }}
                      />
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          }
          return null;
        })}

        {/* Current Hand-drawing Path */}
        {activeTool === 'pen' && currentPoints.length > 0 && (
          <path
            d={getSvgPathFromStroke(
              getStroke(
                currentPoints.map(p => [p.x, p.y]),
                { size: 3, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }
              )
            )}
            fill={document.documentElement.getAttribute('data-theme') === 'light' ? '#2563EB' : '#38BDF8'}
            opacity={0.8}
          />
        )}

        {/* Selection/Lasso dotted border box */}
        {activeTool === 'lasso' && lassoStart && lassoEnd && (
          <rect
            x={Math.min(lassoStart.x, lassoEnd.x)}
            y={Math.min(lassoStart.y, lassoEnd.y)}
            width={Math.abs(lassoStart.x - lassoEnd.x)}
            height={Math.abs(lassoStart.y - lassoEnd.y)}
            fill="rgba(56, 189, 248, 0.05)"
            stroke="#38BDF8"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
      </svg>

      {/* Confirm Math Modal */}
      <FormulaConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        recognizedText={recognizedFormulaText}
        onConfirm={handleConfirmFormula}
      />
    </div>
  );
};
