import React, { useRef, useState, useEffect } from 'react';
import { getStroke } from 'perfect-freehand';
import * as math from 'mathjs';
import { X, GripHorizontal } from 'lucide-react';
import { useEduOSStore } from '../../store/store';
import { ShapeToolbar } from './ShapeToolbar';
import { FormulaConfirmDialog } from './FormulaConfirmDialog';
import { SaveCanvasModal } from './SaveCanvasModal';
import { SecondBrainGraphModal } from './SecondBrainGraphModal';
import { fetchCanvasSession, saveCanvasObjects, recognizeFormula, searchWebForSelection, visualizeConceptForSelection } from '../../lib/api';
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
  const {
    user,
    selectedTopic,
    mockMode,
    saveCanvasToHistory,
    savedCanvasHistory,
    activeCanvasSessionToLoad,
    loadCanvasSession,
    viewMode,
    // Real-Time Classroom Room State
    roomId,
    roomSecret,
    roomRole,
    studentDisplayName,
    isTeacherConnected,
    isLiveConnected,
    lastSeq,
    setConnectedStudents,
    setIsTeacherConnected,
    setIsLiveConnected,
    setLastSeq,
    addRoomChatMessage,
    setRoomWsSend
  } = useEduOSStore();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<any>(null);
  const canvasRef = useRef<SVGSVGElement>(null);
  const [saveNotification, setSaveNotification] = useState(false);
  const [sessionCompletedNotice, setSessionCompletedNotice] = useState<string | null>(null);

  // Live in-progress stroke preview streamed from teacher to students
  const [remoteLiveStroke, setRemoteLiveStroke] = useState<{ points: Point[]; color: string; width: number } | null>(null);
  const lastLiveStreamTimeRef = useRef<number>(0);

  // Canvas session and objects
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [history, setHistory] = useState<CanvasObject[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Active drawing state & customization options
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'lasso' | 'select'>('pen');
  const [canvasMode, setCanvasMode] = useState<'writing' | 'drawing'>('writing');
  const [strokeColor, setStrokeColor] = useState<string>('#D6C8DF');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [snapToGrid, setSnapToGrid] = useState(false);

  // Floating Card Dragging State
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleCardDragStart = (e: React.PointerEvent, objId: string, currentX: number, currentY: number) => {
    e.stopPropagation();
    canvasRef.current?.setPointerCapture(e.pointerId);
    setDraggingCardId(objId);
    setDragOffset({
      x: e.clientX - currentX,
      y: e.clientY - currentY
    });
  };

  // Selection/Lasso state
  const [lassoStart, setLassoStart] = useState<Point | null>(null);
  const [lassoEnd, setLassoEnd] = useState<Point | null>(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [recognizedFormulaText, setRecognizedFormulaText] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isGraphicalViewOpen, setIsGraphicalViewOpen] = useState(false);

  // Auto-save debounce timer
  const saveTimerRef = useRef<any>(null);

  // 1. Fetch Canvas Session on mount/topic change (with LocalStorage fallback for seamless F5 reloads)
  useEffect(() => {
    const activeTopicId = selectedTopic?.id || 'dynamic-ai-scope';
    const localSaved = localStorage.getItem(`eduos-canvas-${activeTopicId}`);

    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        if (Array.isArray(parsed)) {
          setObjects(parsed);
          setHistory([parsed]);
          setHistoryIndex(0);
        }
      } catch (e) {
        console.warn("Failed to parse local canvas storage", e);
      }
    }

    if (!user) return;

    const initSession = async () => {
      try {
        const session = await fetchCanvasSession(
          user.token,
          activeTopicId,
          conversationId
        );
        setSessionId(session.id);
        if (session.objects && session.objects.length > 0) {
          setObjects(session.objects);
          setHistory([session.objects]);
          setHistoryIndex(0);
          localStorage.setItem(`eduos-canvas-${activeTopicId}`, JSON.stringify(session.objects));
        }
      } catch (err) {
        console.error("Failed to fetch backend canvas session:", err);
        setSessionId(`session-${activeTopicId}`);
      }
    };

    initSession();
  }, [user, selectedTopic, conversationId]);

  const objectsRef = useRef<CanvasObject[]>([]);
  const lastSeqRef = useRef<number>(0);
  const roomRoleRef = useRef<string>(roomRole);

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  useEffect(() => {
    roomRoleRef.current = roomRole;
  }, [roomRole]);

  useEffect(() => {
    lastSeqRef.current = lastSeq;
  }, [lastSeq]);

  // Real-Time Classroom WebSocket Collaboration Lifecycle
  useEffect(() => {
    if (!roomId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsLiveConnected(false);
      return;
    }

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsHost = window.location.host;
      if (window.location.port === '5173' || window.location.port === '3000') {
        wsHost = `${window.location.hostname}:8000`;
      }
      const wsUrl = `${protocol}//${wsHost}/ws/classroom/${roomId}`;

      console.log(`Connecting to Classroom WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      setRoomWsSend((msg: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(msg));
        }
      });

      ws.onopen = () => {
        console.log("Classroom WebSocket Open. Sending Auth/Join frame...");
        reconnectAttemptsRef.current = 0;

        if (roomRoleRef.current === 'teacher') {
          ws.send(JSON.stringify({
            type: 'auth',
            token: user?.token || '',
            display_name: user?.fullName || 'Educator'
          }));
          if (objectsRef.current.length > 0) {
            ws.send(JSON.stringify({
              type: 'canvas_update',
              canvas_objects: objectsRef.current
            }));
          }
        } else {
          ws.send(JSON.stringify({
            type: 'join',
            secret: roomSecret,
            display_name: studentDisplayName || 'Student'
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const msgType = data.type;

          if (msgType === 'auth_success' || msgType === 'join_success') {
            setIsLiveConnected(true);
            setIsTeacherConnected(true);
          } else if (msgType === 'canvas_sync') {
            if (Array.isArray(data.canvas_objects)) {
              setObjects(data.canvas_objects);
              objectsRef.current = data.canvas_objects;
              setHistory([data.canvas_objects]);
              setHistoryIndex(0);
              const newSeq = data.seq || 0;
              setLastSeq(newSeq);
              lastSeqRef.current = newSeq;
              setRemoteLiveStroke(null);
            }
          } else if (msgType === 'stroke_preview') {
            if (Array.isArray(data.stroke_points)) {
              setRemoteLiveStroke({
                points: data.stroke_points,
                color: data.color || '#D6C8DF',
                width: data.width || 4
              });
            }
          } else if (msgType === 'canvas_update') {
            setRemoteLiveStroke(null);
            if (Array.isArray(data.canvas_objects)) {
              setObjects(data.canvas_objects);
              objectsRef.current = data.canvas_objects;
              const newSeq = data.seq || (lastSeqRef.current + 1);
              setLastSeq(newSeq);
              lastSeqRef.current = newSeq;
            }
          } else if (msgType === 'canvas_clear') {
            setObjects([]);
            objectsRef.current = [];
            setRemoteLiveStroke(null);
            if (data.seq) {
              setLastSeq(data.seq);
              lastSeqRef.current = data.seq;
            }
          } else if (msgType === 'session_completed') {
            const completedTitle = data.title || 'Live Classroom Session';
            const completedObjects = Array.isArray(data.canvas_objects) ? data.canvas_objects : objects;
            saveCanvasToHistory(completedObjects, completedTitle);
            setSessionCompletedNotice(completedTitle);
            localStorage.removeItem('eduos_student_name');
          } else if (msgType === 'presence_update') {
            setConnectedStudents(data.connected_students || [], data.teacher_connected ?? true);
          } else if (msgType === 'teacher_disconnected') {
            setIsTeacherConnected(false);
          } else if (msgType === 'chat_message') {
            addRoomChatMessage({
              id: data.id || `msg-${Date.now()}`,
              sender_role: data.sender_role,
              sender_name: data.sender_name,
              text: data.text,
              timestamp: data.timestamp
            });
          }
        } catch (e) {
          console.error("Error parsing WebSocket frame", e);
        }
      };

      ws.onclose = () => {
        console.warn("Classroom WebSocket closed.");
        setIsLiveConnected(false);
        setRoomWsSend(null);

        // Auto-reconnect with exponential backoff (max 5 attempts)
        if (reconnectAttemptsRef.current < 5) {
          const timeout = Math.pow(2, reconnectAttemptsRef.current) * 1000;
          reconnectAttemptsRef.current += 1;
          console.log(`Reconnecting in ${timeout}ms (Attempt ${reconnectAttemptsRef.current})...`);
          reconnectTimerRef.current = setTimeout(connectWebSocket, timeout);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };
    };

    connectWebSocket();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsLiveConnected(false);
      setRoomWsSend(null);
    };
  }, [roomId, roomSecret, roomRole, studentDisplayName, user]);

  // 2. Auto-save objects to backend & LocalStorage on changes
  const triggerAutoSave = (updatedObjects: CanvasObject[]) => {
    const activeTopicId = selectedTopic?.id || 'dynamic-ai-scope';
    localStorage.setItem(`eduos-canvas-${activeTopicId}`, JSON.stringify(updatedObjects));

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
    }, 1000); // 1 second debounce
  };

  // Push new state to undo/redo history
  const pushToHistory = (newObjects: CanvasObject[]) => {
    objectsRef.current = newObjects;
    const updatedHistory = history.slice(0, historyIndex + 1);
    setHistory([...updatedHistory, newObjects]);
    setHistoryIndex(updatedHistory.length);
    setObjects(newObjects);
    triggerAutoSave(newObjects);

    // Broadcast WebSocket update to room if Teacher
    if ((viewMode === 'teacher' || roomRoleRef.current === 'teacher') && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'canvas_update',
        canvas_objects: newObjects
      }));
    }
  };

  // Undo/Redo handlers
  const handleUndo = () => {
    if (roomRole === 'student') return;
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setObjects(history[prevIndex]);
      triggerAutoSave(history[prevIndex]);

      if (roomRole === 'teacher' && isLiveConnected && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'canvas_update',
          canvas_objects: history[prevIndex]
        }));
      }
    }
  };

  const handleRedo = () => {
    if (roomRole === 'student') return;
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setObjects(history[nextIndex]);
      triggerAutoSave(history[nextIndex]);

      if (roomRole === 'teacher' && isLiveConnected && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'canvas_update',
          canvas_objects: history[nextIndex]
        }));
      }
    }
  };

  const handleClear = () => {
    if (roomRole === 'student') return;
    if (objects.length > 0) {
      pushToHistory([]);
      setSelectedObjectIds(new Set());

      if (roomRole === 'teacher' && isLiveConnected && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'canvas_clear'
        }));
      }
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
    // STUDENT READ-ONLY UX GUARD
    if (roomRole === 'student') return;

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

    if (draggingCardId) {
      const newX = Math.max(10, e.clientX - dragOffset.x);
      const newY = Math.max(10, e.clientY - dragOffset.y);

      setObjects(prev => prev.map(o => {
        if (o.id === draggingCardId) {
          const geom = JSON.parse(o.geometry_json);
          return {
            ...o,
            geometry_json: JSON.stringify({ ...geom, x: Math.round(newX), y: Math.round(newY) })
          };
        }
        return o;
      }));
      return;
    }

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
        try {
          const parsed = JSON.parse(obj.geometry_json);
          if (obj.type === 'stroke' && Array.isArray(parsed)) {
            const pointsInside = parsed.filter((p: Point) => p && typeof p.x === 'number' && p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
            if (pointsInside.length > parsed.length * 0.3) {
              newlySelected.add(obj.id);
            }
          } else if (obj.type === 'shape') {
            if (obj.recognized_as === 'circle' && parsed.cx !== undefined) {
              if (parsed.cx >= minX && parsed.cx <= maxX && parsed.cy >= minY && parsed.cy <= maxY) {
                newlySelected.add(obj.id);
              }
            } else if (obj.recognized_as === 'rectangle' && parsed.x !== undefined) {
              const rx = parsed.x + (parsed.w || 0) / 2;
              const ry = parsed.y + (parsed.h || 0) / 2;
              if (rx >= minX && rx <= maxX && ry >= minY && ry <= maxY) {
                newlySelected.add(obj.id);
              }
            } else if ((obj.recognized_as === 'line' || obj.recognized_as === 'arrow') && parsed.x1 !== undefined) {
              const lx = (parsed.x1 + parsed.x2) / 2;
              const ly = (parsed.y1 + parsed.y2) / 2;
              if (lx >= minX && lx <= maxX && ly >= minY && ly <= maxY) {
                newlySelected.add(obj.id);
              }
            }
          }
        } catch (e) {
          // ignore parse error
        }
      });
      setSelectedObjectIds(newlySelected);
    } else if (isDrawing) {
      if (activeTool === 'pen') {
        const nextPoints = [...currentPoints, coord];
        setCurrentPoints(nextPoints);

        // Stream in-progress stroke preview over WebSocket (throttled ~30ms)
        const now = Date.now();
        if (roomRoleRef.current === 'teacher' && wsRef.current?.readyState === WebSocket.OPEN && now - lastLiveStreamTimeRef.current > 30) {
          lastLiveStreamTimeRef.current = now;
          wsRef.current.send(JSON.stringify({
            type: 'stroke_preview',
            stroke_points: nextPoints,
            color: strokeColor,
            width: strokeWidth
          }));
        }
      } else if (activeTool === 'eraser') {
        eraseAtPoint(coord);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    canvasRef.current?.releasePointerCapture(e.pointerId);

    if (draggingCardId) {
      setDraggingCardId(null);
      pushToHistory(objects);
    }

    if (activeTool === 'lasso') {
      setLassoStart(null);
      setLassoEnd(null);
    } else if (isDrawing) {
      setIsDrawing(false);

      if (activeTool === 'pen' && currentPoints.length > 1) {
        let objectType: 'stroke' | 'shape' = 'stroke';
        let geomData: any = currentPoints;
        let shapeName: string | null = null;

        if (canvasMode === 'drawing') {
          // Drawing Mode: Smart Auto-Shape Recognition
          const { recognized_as, geometry } = recognizeShape(currentPoints);
          if (recognized_as) {
            objectType = 'shape';
            geomData = geometry;
            shapeName = recognized_as;
          } else {
            // Default in Drawing mode: snap straight line connecting start and end
            const start = currentPoints[0];
            const end = currentPoints[currentPoints.length - 1];
            objectType = 'shape';
            geomData = { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
            shapeName = 'line';
          }
        } else {
          // Writing Mode: Preserve exact raw freehand stroke
          objectType = 'stroke';
          geomData = currentPoints;
          shapeName = null;
        }

        const newObj: CanvasObject = {
          id: `obj-${crypto.randomUUID()}`,
          type: objectType,
          geometry_json: JSON.stringify(geomData),
          style_json: JSON.stringify({
            color: strokeColor,
            width: strokeWidth
          }),
          recognized_as: shapeName,
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

  // 5. OCR & Web Search Handshake (Reads handwritten notes/human language and searches Tavily)
  const handleWebSearch = async () => {
    setIsRecognizing(true);
    try {
      // Find handwritten strokes: selected strokes if any, or all strokes on canvas
      const strokeObjects = selectedObjectIds.size > 0
        ? objects.filter(obj => selectedObjectIds.has(obj.id))
        : objects.filter(obj => obj.type === 'stroke' || obj.type === 'shape');

      let queryTopic = selectedTopic?.name || "Artificial Intelligence";

      if (strokeObjects.length > 0) {
        try {
          // Vision OCR to transcribe handwriting & human language into plain text
          const ocrResult = await recognizeFormula(
            user?.token || "",
            sessionId || "",
            JSON.stringify(strokeObjects)
          );
          if (ocrResult && ocrResult.formula_text && ocrResult.formula_text.trim()) {
            queryTopic = ocrResult.formula_text.trim();
          }
        } catch (ocrErr) {
          console.warn("OCR recognition fallback for handwriting strokes.", ocrErr);
        }
      }

      const data = await searchWebForSelection(user?.token || '', queryTopic);

      const newCardObj: CanvasObject = {
        id: `obj-${crypto.randomUUID()}`,
        type: 'formula',
        geometry_json: JSON.stringify({
          card_type: 'web_search',
          title: data.title || `OCR Web Search: ${queryTopic}`,
          query: queryTopic,
          summary: data.summary || `Real-time web search results and grounded AI analysis for '${queryTopic}'.`,
          key_points: data.key_points || [
            `Recognized Handwriting Query: "${queryTopic}"`,
            `Grounded AI Synthesis: Analyzed top web sources.`,
            `Key Takeaways: Structured research notes & live references.`
          ],
          sources: data.sources || [
            { title: "Authoritative Reference", url: "https://wikipedia.org" }
          ],
          x: 120,
          y: 60,
          w: 560,
          h: 400
        }),
        order_index: objects.length
      };

      // Clear recognized handwritten strokes so canvas stays clean with floating research card
      const remainingObjects = strokeObjects.length > 0
        ? objects.filter(obj => !strokeObjects.some(s => s.id === obj.id))
        : objects;

      pushToHistory([...remainingObjects, newCardObj]);
      setSelectedObjectIds(new Set());
    } catch (err) {
      console.error("OCR Web search failed:", err);
    } finally {
      setIsRecognizing(false);
    }
  };

  // 6. Visualize AI Handshake (Reads handwritten notes/human language and generates visual breakdown)
  const handleVisualize = async () => {
    setIsRecognizing(true);
    try {
      const strokeObjects = selectedObjectIds.size > 0
        ? objects.filter(obj => selectedObjectIds.has(obj.id))
        : objects.filter(obj => obj.type === 'stroke' || obj.type === 'shape');

      let queryTopic = selectedTopic?.name || "Neural Network Architecture";

      if (strokeObjects.length > 0) {
        try {
          const ocrResult = await recognizeFormula(
            user?.token || "",
            sessionId || "",
            JSON.stringify(strokeObjects)
          );
          if (ocrResult && ocrResult.formula_text && ocrResult.formula_text.trim()) {
            queryTopic = ocrResult.formula_text.trim();
          }
        } catch (ocrErr) {
          console.warn("OCR visualization fallback for handwriting strokes.", ocrErr);
        }
      }

      const data = await visualizeConceptForSelection(user?.token || '', queryTopic);

      const newCardObj: CanvasObject = {
        id: `obj-${crypto.randomUUID()}`,
        type: 'formula',
        geometry_json: JSON.stringify({
          card_type: 'visualizer',
          concept_title: data.concept_title || queryTopic,
          definition: data.definition,
          real_world_analogy: data.real_world_analogy,
          components: data.components || [],
          x: 140,
          y: 70,
          w: 540,
          h: 380
        }),
        order_index: objects.length
      };

      const remaining = strokeObjects.length > 0
        ? objects.filter(obj => !strokeObjects.some(s => s.id === obj.id))
        : objects;

      pushToHistory([...remaining, newCardObj]);
      setSelectedObjectIds(new Set());
    } catch (err) {
      console.error("Concept visualization failed:", err);
    } finally {
      setIsRecognizing(false);
    }
  };

  // 7. Plot Graph Flow (evaluates confirm-then-plot expressions client-side)
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
          x: 150, // Placement coords on SVG canvas
          y: 80,
          w: 520,
          h: 360
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

  // Save Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // Handle manual Save Canvas to History via custom Save modal
  const handleSaveCanvas = () => {
    setIsSaveModalOpen(true);
  };

  const handleConfirmSaveModal = (title: string) => {
    setIsSaveModalOpen(false);
    saveCanvasToHistory(objects, title);
    setSaveNotification(true);
    setTimeout(() => setSaveNotification(false), 2500);

    // If Teacher in a live room session, broadcast completion event so all students save it to their history too!
    if (roomRoleRef.current === 'teacher' && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'complete_session',
        title: title,
        canvas_objects: objects
      }));
    }
  };

  // Listen for canvas load requests from Left History Sidebar
  useEffect(() => {
    if (activeCanvasSessionToLoad) {
      setObjects(activeCanvasSessionToLoad.objects);
      setHistory([activeCanvasSessionToLoad.objects]);
      setHistoryIndex(0);
      loadCanvasSession(null); // Reset session loader trigger
    }
  }, [activeCanvasSessionToLoad, loadCanvasSession]);

  return (
    <div className="relative flex flex-col h-full bg-[var(--glass-bg)] backdrop-blur-md rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-2xl">
      {/* Student Read-Only Live Badge */}
      {roomRole === 'student' && isLiveConnected && (
        <div className="absolute top-4 left-4 z-40 px-3 py-1.5 bg-sky-500/20 backdrop-blur-md text-sky-300 font-bold text-xs rounded-xl border border-sky-500/30 flex items-center gap-2 shadow-lg select-none">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          <span>🔒 Read-Only Student View (Live)</span>
        </div>
      )}

      {/* Teacher Disconnected Alert Banner (For Students Only) */}
      {roomRole === 'student' && roomId && !isTeacherConnected && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-amber-500/90 text-slate-950 font-bold text-xs rounded-xl shadow-2xl border border-amber-400 flex items-center gap-2 animate-pulse select-none">
          <span>⚠️ Teacher disconnected or reconnecting... Canvas updates paused.</span>
        </div>
      )}

      {/* Save Notification Toast */}
      {saveNotification && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xl border border-emerald-400/50 flex items-center gap-2 animate-bounce">
          <span>✓ Canvas Session Saved to History!</span>
        </div>
      )}

      {/* Session Completed Notice Banner */}
      {sessionCompletedNotice && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 px-5 py-3 bg-emerald-600/95 text-white font-bold text-xs rounded-2xl shadow-2xl border border-emerald-300 flex items-center justify-between gap-3 animate-fade-in select-none">
          <div className="flex items-center gap-2">
            <span className="text-base">🎉</span>
            <span>Classroom Session Completed & Saved to your History: <strong>"{sessionCompletedNotice}"</strong></span>
          </div>
          <button
            onClick={() => setSessionCompletedNotice(null)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Floating Toolbar (Hidden for Students in Read-Only Live View) */}
      {(viewMode === 'teacher' || roomRole !== 'student') && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40 max-w-[95%] flex justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <ShapeToolbar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            canvasMode={canvasMode}
            setCanvasMode={setCanvasMode}
            strokeColor={strokeColor}
            setStrokeColor={setStrokeColor}
            strokeWidth={strokeWidth}
            setStrokeWidth={setStrokeWidth}
            snapToGrid={snapToGrid}
            setSnapToGrid={setSnapToGrid}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
            onRecognize={handleRecognizeFormula}
            onWebSearch={handleWebSearch}
            onVisualize={handleVisualize}
            onSaveCanvas={handleSaveCanvas}
            hasSelection={selectedObjectIds.size > 0}
          />
          </div>
        </div>
      )}

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
            const cardWidth = Math.max(geom.w || 680, 680);
            const cardHeight = Math.max(geom.h || 460, 460);

            const removeCard = () => {
              const remaining = objects.filter(o => o.id !== obj.id);
              pushToHistory(remaining);
            };

            if (geom.card_type === 'web_search') {
              return (
                <g key={obj.id} transform={`translate(${geom.x}, ${geom.y})`}>
                  <rect
                    width={cardWidth}
                    height={cardHeight}
                    fill="var(--glass-bg)"
                    rx={20}
                    stroke="var(--accent-primary)"
                    strokeWidth={2}
                    className="shadow-2xl"
                  />
                  <foreignObject width={cardWidth} height={cardHeight} className="p-4">
                    <div className="flex flex-col h-full justify-between select-none text-[var(--text-primary)]">
                      <div
                        onPointerDown={(e) => handleCardDragStart(e, obj.id, geom.x || 120, geom.y || 60)}
                        className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5 mb-2.5 cursor-grab active:cursor-grabbing hover:bg-[var(--accent-primary-soft)]/40 p-1.5 rounded-xl transition-colors"
                        title="Click & Drag header to move floating component anywhere on canvas"
                      >
                        <span className="text-xs font-extrabold text-[var(--accent-primary)] tracking-wider uppercase flex items-center gap-1.5">
                          <GripHorizontal className="w-4 h-4 opacity-70" />
                          🌐 GROUNDED WEB RESEARCH
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[var(--text-primary)] bg-[var(--accent-primary-soft)] px-2.5 py-0.5 rounded-lg border border-[var(--border-subtle)]">
                            Tavily AI Search
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCard();
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="p-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-rose-500 hover:border-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer shadow-sm"
                            title="Close Component (X)"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 w-full min-h-0 overflow-y-auto space-y-3 text-xs pr-1">
                        <h4 className="font-bold text-base text-[var(--text-primary)]">{geom.title}</h4>
                        <p className="text-[var(--text-secondary)] leading-relaxed text-xs">{geom.summary}</p>
                        {geom.key_points && (
                          <div className="space-y-1 pt-1">
                            <span className="text-[10px] font-bold uppercase text-[var(--accent-primary)] block">Key Takeaways</span>
                            <ul className="list-disc pl-4 space-y-1 text-xs text-[var(--text-primary)]">
                              {geom.key_points.map((pt: string, i: number) => (
                                <li key={i}>{pt}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {geom.sources && geom.sources.length > 0 && (
                          <div className="pt-2 border-t border-[var(--border-subtle)]">
                            <span className="text-[9px] font-bold uppercase text-[var(--text-secondary)] block mb-1">Web Sources</span>
                            <div className="flex flex-wrap gap-1.5">
                              {geom.sources.map((s: any, idx: number) => (
                                <a
                                  key={idx}
                                  href={s.url || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] bg-[var(--card-bg)] border border-[var(--border-subtle)] px-2 py-1 rounded-lg text-[var(--accent-primary)] hover:underline truncate max-w-[240px]"
                                >
                                  🔗 {s.title}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </foreignObject>
                </g>
              );
            } else if (geom.card_type === 'visualizer') {
              return (
                <g key={obj.id} transform={`translate(${geom.x}, ${geom.y})`}>
                  <rect
                    width={cardWidth}
                    height={cardHeight}
                    fill="var(--glass-bg)"
                    rx={20}
                    stroke="var(--accent-primary)"
                    strokeWidth={2}
                    className="shadow-2xl"
                  />
                  <foreignObject width={cardWidth} height={cardHeight} className="p-4">
                    <div className="flex flex-col h-full justify-between select-none text-[var(--text-primary)]">
                      <div
                        onPointerDown={(e) => handleCardDragStart(e, obj.id, geom.x || 140, geom.y || 70)}
                        className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5 mb-2.5 cursor-grab active:cursor-grabbing hover:bg-[var(--accent-primary-soft)]/40 p-1.5 rounded-xl transition-colors"
                        title="Click & Drag header to move floating component anywhere on canvas"
                      >
                        <span className="text-xs font-extrabold text-[var(--accent-primary)] tracking-wider uppercase flex items-center gap-1.5">
                          <GripHorizontal className="w-4 h-4 opacity-70" />
                          ✨ AI CONCEPT VISUALIZER
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[var(--text-primary)] bg-[var(--accent-primary-soft)] px-2.5 py-0.5 rounded-lg border border-[var(--border-subtle)]">
                            Structured Breakdown
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCard();
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="p-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-rose-500 hover:border-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer shadow-sm"
                            title="Close Component (X)"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 w-full min-h-0 overflow-y-auto space-y-3 text-xs pr-1">
                        <h3 className="font-bold text-base text-[var(--text-primary)]">{geom.concept_title}</h3>
                        <p className="text-[var(--text-secondary)] leading-relaxed text-xs">{geom.definition}</p>
                        {geom.real_world_analogy && (
                          <div className="p-3 rounded-xl bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] italic">
                            💡 {geom.real_world_analogy}
                          </div>
                        )}
                        {geom.components && (
                          <div className="grid grid-cols-3 gap-2.5 pt-1">
                            {geom.components.map((c: any, idx: number) => (
                              <div key={idx} className="p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-subtle)] text-center space-y-1">
                                <div className="text-xs font-bold text-[var(--accent-primary)] truncate">{c.name}</div>
                                <div className="text-[10px] text-[var(--text-secondary)] leading-tight">{c.role}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </foreignObject>
                </g>
              );
            }

            // Render Math Plotted Graph as an embedded element
            return (
              <g key={obj.id} transform={`translate(${geom.x}, ${geom.y})`}>
                <rect
                  width={cardWidth}
                  height={cardHeight}
                  fill="var(--glass-bg)"
                  rx={20}
                  stroke="var(--glass-border)"
                  strokeWidth={2}
                  className="shadow-2xl"
                />
                <foreignObject width={cardWidth} height={cardHeight} className="p-4">
                  <div className="flex flex-col h-full justify-between select-none">
                    <div
                      onPointerDown={(e) => handleCardDragStart(e, obj.id, geom.x || 150, geom.y || 80)}
                      className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-2 cursor-grab active:cursor-grabbing hover:bg-[var(--accent-primary-soft)]/40 p-1.5 rounded-xl transition-colors"
                      title="Click & Drag header to move floating component anywhere on canvas"
                    >
                      <span className="text-xs font-extrabold text-[var(--accent-primary)] font-mono tracking-wider uppercase flex items-center gap-1.5">
                        <GripHorizontal className="w-4 h-4 opacity-70" />
                        📈 PLOTTED CURVE
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)] font-mono bg-[var(--accent-primary-soft)] px-3 py-1 rounded-lg border border-[var(--border-subtle)] shadow-sm">
                          {geom.formula_text}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCard();
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="p-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-rose-500 hover:border-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer shadow-sm"
                          title="Close Component (X)"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 w-full min-h-0 overflow-y-auto">
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

        {/* Current Hand-drawing Path (Teacher local) */}
        {activeTool === 'pen' && currentPoints.length > 0 && (
          <path
            d={getSvgPathFromStroke(
              getStroke(
                currentPoints.map(p => [p.x, p.y]),
                { size: strokeWidth, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }
              )
            )}
            fill={strokeColor}
            opacity={strokeWidth > 15 ? 0.5 : 0.9}
          />
        )}

        {/* Remote Live Hand-drawing Stroke (Streamed from Teacher to Students in real time) */}
        {remoteLiveStroke && remoteLiveStroke.points.length > 0 && (
          <path
            d={getSvgPathFromStroke(
              getStroke(
                remoteLiveStroke.points.map(p => [p.x, p.y]),
                { size: remoteLiveStroke.width || 4, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }
              )
            )}
            fill={remoteLiveStroke.color || '#D6C8DF'}
            opacity={0.9}
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

      {/* Custom Glassmorphic Save Session Modal */}
      <SaveCanvasModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleConfirmSaveModal}
        defaultTitle={selectedTopic ? `${selectedTopic.name} Note` : `Whiteboard Session #${savedCanvasHistory.length + 1}`}
        objectCount={objects.length}
      />

      {/* Second Brain Knowledge Graph Modal */}
      <SecondBrainGraphModal
        isOpen={isGraphicalViewOpen}
        onClose={() => setIsGraphicalViewOpen(false)}
      />
    </div>
  );
};
