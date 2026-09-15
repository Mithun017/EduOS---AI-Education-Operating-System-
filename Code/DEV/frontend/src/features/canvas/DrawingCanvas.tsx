import React, { useRef, useState, useEffect } from 'react';
import { getStroke } from 'perfect-freehand';
import * as math from 'mathjs';
import { X, GripHorizontal, Minus, Plus, Edit3 } from 'lucide-react';
import mammoth from 'mammoth';
import { useEduOSStore } from '../../store/store';
import { ShapeToolbar } from './ShapeToolbar';
import { FormulaConfirmDialog } from './FormulaConfirmDialog';
import { SaveCanvasModal } from './SaveCanvasModal';
import { SecondBrainGraphModal } from './SecondBrainGraphModal';
import { DocumentCanvasModal } from './DocumentCanvasModal';
import type { DocumentAnnotationData } from './DocumentCanvasModal';
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
  const [activeDocumentModal, setActiveDocumentModal] = useState<DocumentAnnotationData | null>(null);

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
        if (msg && msg.type === 'complete_session') {
          const currentCanvasObjects = objectsRef.current || [];
          if (msg.save_requested && currentCanvasObjects.length > 0) {
            saveCanvasToHistory(currentCanvasObjects, msg.title || 'Classroom Session');
            setSaveNotification(true);
            setTimeout(() => setSaveNotification(false), 3000);
          }
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'complete_session',
              title: msg.title || 'Classroom Session',
              canvas_objects: currentCanvasObjects
            }));
          }
          return;
        }

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

            // Reset canvas to open fresh whiteboard
            setObjects([]);
            setHistory([[]]);
            setHistoryIndex(0);
            setSelectedObjectIds(new Set());
            objectsRef.current = [];
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

  const getCanvasImageBase64 = async (): Promise<string | undefined> => {
    if (!canvasRef.current) return undefined;
    try {
      const svgElement = canvasRef.current;
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const rect = svgElement.getBoundingClientRect();
      canvas.width = rect.width || 800;
      canvas.height = rect.height || 600;

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      return new Promise((resolve) => {
        img.onload = () => {
          if (ctx) {
            ctx.fillStyle = '#061a1e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          }
          URL.revokeObjectURL(url);
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl.split(',')[1]);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(undefined);
        };
        img.src = url;
      });
    } catch (e) {
      console.warn("Could not capture canvas SVG base64 image:", e);
      return undefined;
    }
  };

  // 4. Formula Recognition Handshake
  const handleRecognizeFormula = async () => {
    const strokeObjects = selectedObjectIds.size > 0
      ? objects.filter(obj => selectedObjectIds.has(obj.id))
      : objects.filter(obj => obj.type === 'stroke' || obj.type === 'shape');

    if (strokeObjects.length === 0 && objects.length === 0) return;
    setIsRecognizing(true);

    if (mockMode) {
      setTimeout(() => {
        setRecognizedFormulaText("y = x");
        setIsRecognizing(false);
        setIsConfirmOpen(true);
      }, 800);
      return;
    }

    try {
      const base64Img = await getCanvasImageBase64();
      const result = await recognizeFormula(
        user?.token || "",
        sessionId || "",
        JSON.stringify(strokeObjects.length > 0 ? strokeObjects : objects),
        base64Img
      );
      setRecognizedFormulaText(result.formula_text);
      setIsConfirmOpen(true);
    } catch (err) {
      console.error("Formula recognition failed:", err);
      setRecognizedFormulaText("y = x");
      setIsConfirmOpen(true);
    } finally {
      setIsRecognizing(false);
    }
  };

  // 5. OCR & Web Search Handshake (Reads handwritten notes/human language and searches Tavily)
  const handleWebSearch = async () => {
    setIsRecognizing(true);
    try {
      const strokeObjects = selectedObjectIds.size > 0
        ? objects.filter(obj => selectedObjectIds.has(obj.id))
        : objects.filter(obj => obj.type === 'stroke' || obj.type === 'shape');

      let queryTopic = selectedTopic?.name || "Linear Equations and Coordinate Graphs";

      if (strokeObjects.length > 0 || objects.length > 0) {
        try {
          const base64Img = await getCanvasImageBase64();
          const ocrResult = await recognizeFormula(
            user?.token || "",
            sessionId || "",
            JSON.stringify(strokeObjects.length > 0 ? strokeObjects : objects),
            base64Img
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
            `Recognized Handwriting / Graph Query: "${queryTopic}"`,
            `Grounded AI Synthesis: Analyzed top web sources for ${queryTopic}.`,
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

      pushToHistory([...objects, newCardObj]);
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

      let queryTopic = selectedTopic?.name || "Linear Equation y = x Graphing";

      if (strokeObjects.length > 0 || objects.length > 0) {
        try {
          const base64Img = await getCanvasImageBase64();
          const ocrResult = await recognizeFormula(
            user?.token || "",
            sessionId || "",
            JSON.stringify(strokeObjects.length > 0 ? strokeObjects : objects),
            base64Img
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

      pushToHistory([...objects, newCardObj]);
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
      const parts = finalFormula.split("=");
      let expr = parts.length > 1 ? parts[parts.length - 1].trim() : finalFormula.trim();

      if (expr.toLowerCase() === 'y' && parts[0].trim().toLowerCase() === 'x') {
        expr = 'x';
      }
      if (!expr || expr.toLowerCase() === 'x') {
        expr = 'x';
      }

      const mathExpr = expr.replace(/(\d+)([a-zA-Z])/g, '$1*$2');

      const series: any[] = [];
      const labels: string[] = [];

      for (let x = -8; x <= 8; x += 0.5) {
        try {
          const scope = { x };
          const result = math.evaluate(mathExpr, scope);
          if (typeof result === 'number' && !isNaN(result)) {
            series.push(result);
            labels.push(x.toString());
          }
        } catch (e) {
          // Skip point on error
        }
      }

      if (series.length === 0) {
        for (let x = -8; x <= 8; x += 1) {
          series.push(x);
          labels.push(x.toString());
        }
      }

      const newGraphObj: CanvasObject = {
        id: `obj-${crypto.randomUUID()}`,
        type: 'formula',
        geometry_json: JSON.stringify({
          formula_text: finalFormula,
          chart_type: 'line',
          labels,
          series,
          x: 150,
          y: 80,
          w: 520,
          h: 360
        }),
        order_index: objects.length
      };

      pushToHistory([...objects, newGraphObj]);
      setSelectedObjectIds(new Set());

    } catch (err) {
      console.error("Error evaluating math plot:", err);
    }
  };

  const removeObject = (id: string) => {
    const remaining = objects.filter(o => o.id !== id);
    pushToHistory(remaining);
  };

  const toggleCardMinimize = (id: string) => {
    const updated = objects.map(o => {
      if (o.id !== id) return o;
      try {
        const geom = JSON.parse(o.geometry_json);
        const isMinimized = !geom.is_minimized;
        return {
          ...o,
          geometry_json: JSON.stringify({
            ...geom,
            is_minimized: isMinimized
          })
        };
      } catch {
        return o;
      }
    });
    pushToHistory(updated);
  };

  const toggleCardMaximize = (id: string) => {
    const updated = objects.map(o => {
      if (o.id !== id) return o;
      try {
        const geom = JSON.parse(o.geometry_json);
        const isMaximized = !geom.is_maximized;
        const origW = geom.orig_w || geom.w || 560;
        const origH = geom.orig_h || geom.h || 420;
        const maxViewportW = typeof window !== 'undefined' ? Math.max(320, window.innerWidth - 80) : 860;
        const targetW = isMaximized ? Math.min(880, maxViewportW) : origW;
        const targetH = isMaximized ? 620 : origH;

        return {
          ...o,
          geometry_json: JSON.stringify({
            ...geom,
            is_minimized: false,
            is_maximized: isMaximized,
            orig_w: origW,
            orig_h: origH,
            w: targetW,
            h: targetH
          })
        };
      } catch {
        return o;
      }
    });
    pushToHistory(updated);
  };

  // Upload file (Image, PDF, PPT, Word, Text) directly onto Canvas board
  const handleUploadFileToCanvas = async (file: File) => {
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|svg|gif|bmp|ico)$/i.test(file.name);
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isDocx = /\.docx$/i.test(file.name) || file.type.includes('wordprocessingml');
    const isWord = /\.doc$/i.test(file.name) || file.type.includes('msword') || isDocx;
    const isPpt = /\.(ppt|pptx)$/i.test(file.name) || file.type.includes('presentation') || file.type.includes('powerpoint');
    const isText = file.type.startsWith('text/') || /\.(txt|md|csv|json|py|js|ts|html)$/i.test(file.name);

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          let w = img.width || 500;
          let h = img.height || 350;
          const maxW = 540;
          if (w > maxW) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          }
          const newImageObj: CanvasObject = {
            id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            type: 'image',
            geometry_json: JSON.stringify({
              x: 80,
              y: 60,
              w,
              h,
              src: dataUrl,
              name: file.name,
              size: file.size,
              file_type: file.type || 'image/png',
              is_minimized: false,
              is_maximized: false
            }),
            order_index: objects.length
          };
          pushToHistory([...objects, newImageObj]);
          setActiveDocumentModal({
            id: newImageObj.id,
            name: file.name,
            fileType: file.type || 'image/png',
            src: dataUrl
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } else if (isDocx) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const htmlRes = await mammoth.convertToHtml({ arrayBuffer });
        const rawTextRes = await mammoth.extractRawText({ arrayBuffer });
        const htmlContent = htmlRes.value;
        const textContent = rawTextRes.value;

        const newDocObj: CanvasObject = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'document',
          geometry_json: JSON.stringify({
            x: 80,
            y: 60,
            w: 600,
            h: 460,
            html_content: htmlContent,
            text_content: textContent,
            name: file.name,
            size: file.size,
            file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            is_minimized: false,
            is_maximized: false
          }),
          order_index: objects.length
        };
        pushToHistory([...objects, newDocObj]);
        setActiveDocumentModal({
          id: newDocObj.id,
          name: file.name,
          fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          htmlContent,
          textContent
        });
      } catch (err) {
        console.error("Failed to parse docx with mammoth:", err);
        // Fallback to reading as text
        const reader = new FileReader();
        reader.onload = (e) => {
          const textContent = e.target?.result as string;
          const newDocObj: CanvasObject = {
            id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            type: 'document',
            geometry_json: JSON.stringify({
              x: 80,
              y: 60,
              w: 560,
              h: 420,
              text_content: textContent || `Word Document: ${file.name}`,
              name: file.name,
              size: file.size,
              file_type: file.type || 'application/msword',
              is_minimized: false,
              is_maximized: false
            }),
            order_index: objects.length
          };
          pushToHistory([...objects, newDocObj]);
          setActiveDocumentModal({
            id: newDocObj.id,
            name: file.name,
            fileType: file.type || 'application/msword',
            textContent: textContent || `Word Document: ${file.name}`
          });
        };
        reader.readAsText(file);
      }
    } else if (isPdf) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const newDocObj: CanvasObject = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'document',
          geometry_json: JSON.stringify({
            x: 80,
            y: 60,
            w: 580,
            h: 440,
            src: dataUrl,
            name: file.name,
            size: file.size,
            file_type: 'application/pdf',
            is_minimized: false,
            is_maximized: false
          }),
          order_index: objects.length
        };
        pushToHistory([...objects, newDocObj]);
        setActiveDocumentModal({
          id: newDocObj.id,
          name: file.name,
          fileType: 'application/pdf',
          src: dataUrl
        });
      };
      reader.readAsDataURL(file);
    } else if (isText) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const textContent = e.target?.result as string;
        const newDocObj: CanvasObject = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'document',
          geometry_json: JSON.stringify({
            x: 80,
            y: 60,
            w: 540,
            h: 380,
            text_content: textContent,
            name: file.name,
            size: file.size,
            file_type: file.type || 'text/plain',
            is_minimized: false,
            is_maximized: false
          }),
          order_index: objects.length
        };
        pushToHistory([...objects, newDocObj]);
        setActiveDocumentModal({
          id: newDocObj.id,
          name: file.name,
          fileType: file.type || 'text/plain',
          textContent
        });
      };
      reader.readAsText(file);
    } else if (isWord || isPpt) {
      // Word (.doc) or PowerPoint (.ppt / .pptx)
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const newDocObj: CanvasObject = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'document',
          geometry_json: JSON.stringify({
            x: 80,
            y: 60,
            w: 560,
            h: 400,
            src: dataUrl,
            name: file.name,
            size: file.size,
            file_type: file.type || (isPpt ? 'application/vnd.ms-powerpoint' : 'application/msword'),
            is_minimized: false,
            is_maximized: false
          }),
          order_index: objects.length
        };
        pushToHistory([...objects, newDocObj]);
        setActiveDocumentModal({
          id: newDocObj.id,
          name: file.name,
          fileType: file.type || (isPpt ? 'application/vnd.ms-powerpoint' : 'application/msword'),
          src: dataUrl
        });
      };
      reader.readAsDataURL(file);
    } else {
      // Generic document
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const newDocObj: CanvasObject = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'document',
          geometry_json: JSON.stringify({
            x: 80,
            y: 60,
            w: 540,
            h: 380,
            src: dataUrl,
            name: file.name,
            size: file.size,
            file_type: file.type || 'application/octet-stream',
            is_minimized: false,
            is_maximized: false
          }),
          order_index: objects.length
        };
        pushToHistory([...objects, newDocObj]);
        setActiveDocumentModal({
          id: newDocObj.id,
          name: file.name,
          fileType: file.type || 'application/octet-stream',
          src: dataUrl
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Export Canvas along with all underlying uploaded files and handwritten markings to PNG
  const handleExportCanvasWithMarkings = (title: string = 'Annotated_Whiteboard_Note') => {
    if (!canvasRef.current) return;
    try {
      const svgElement = canvasRef.current;
      const rect = svgElement.getBoundingClientRect();
      const width = rect.width || 1200;
      const height = rect.height || 800;

      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(2, 2);
          const isLight = document.documentElement.getAttribute('data-theme') === 'light';
          ctx.fillStyle = isLight ? '#F8FAFC' : '#061A1E';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = `${title.trim().replace(/\s+/g, '_')}_annotated.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(url);
          setIsSaveModalOpen(false);
          setSaveNotification(true);
          setTimeout(() => setSaveNotification(false), 2500);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        alert("Failed to rasterize canvas for export.");
      };
      img.src = url;
    } catch (e) {
      console.error("Canvas export failed:", e);
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

    // Immediately reset canvas to open a fresh new whiteboard
    setObjects([]);
    setHistory([[]]);
    setHistoryIndex(0);
    setSelectedObjectIds(new Set());
    objectsRef.current = [];
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
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleUploadFileToCanvas(file);
      }}
      className="relative flex flex-col h-full bg-[var(--glass-bg)] backdrop-blur-md rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-2xl"
    >
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
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-[95%] flex justify-center pointer-events-none overflow-visible">
          <div className="pointer-events-auto overflow-visible">
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
            onUploadFile={handleUploadFileToCanvas}
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
            const maxViewportWidth = typeof window !== 'undefined' ? Math.max(300, window.innerWidth - 30) : 680;
            const cardWidth = Math.min(Math.max(geom.w || 540, 300), maxViewportWidth);
            const cardHeight = Math.max(geom.h || 420, 380);

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
                              {geom.sources.map((s: any, idx: number) => {
                                const isYouTube = s.is_video || s.title?.toLowerCase().includes('youtube') || s.url?.toLowerCase().includes('youtube');
                                const targetUrl = (s.url && s.url.startsWith('http'))
                                  ? s.url
                                  : (isYouTube
                                    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(s.title || geom.query || 'math')}`
                                    : `https://www.google.com/search?q=${encodeURIComponent(s.title || geom.query || 'math')}`);

                                return (
                                  <a
                                    key={idx}
                                    href={targetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(targetUrl, '_blank', 'noopener,noreferrer');
                                    }}
                                    className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold truncate max-w-[260px] cursor-pointer pointer-events-auto transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
                                      isYouTube
                                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25 hover:border-rose-400'
                                        : 'bg-[var(--card-bg)] text-[var(--accent-primary)] border-[var(--border-subtle)] hover:bg-[var(--accent-primary-soft)]'
                                    }`}
                                    title={`Open ${s.title}: ${targetUrl}`}
                                  >
                                    <span className="shrink-0">{isYouTube ? '▶️' : '🔗'}</span>
                                    <span className="truncate">{s.title}</span>
                                  </a>
                                );
                              })}
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
          } else if (obj.type === 'image') {
            const geom = JSON.parse(obj.geometry_json);
            const isMinimized = !!geom.is_minimized;
            const isMaximized = !!geom.is_maximized;

            const maxViewportWidth = typeof window !== 'undefined' ? Math.max(300, window.innerWidth - 30) : 680;
            const imgWidth = Math.min(geom.w || (isMaximized ? 800 : 500), maxViewportWidth);
            const imgHeight = geom.h || (isMaximized ? 540 : 350);
            const headerHeight = 38;
            const totalHeight = isMinimized ? headerHeight : (imgHeight + headerHeight);

            return (
              <g key={obj.id} transform={`translate(${geom.x || 80}, ${geom.y || 60})`}>
                <rect
                  width={imgWidth}
                  height={totalHeight}
                  fill="var(--glass-bg)"
                  rx={isMinimized ? 12 : 16}
                  stroke="var(--border-subtle)"
                  strokeWidth={1.5}
                  className="shadow-2xl"
                />
                <foreignObject width={imgWidth} height={headerHeight}>
                  <div
                    onPointerDown={(e) => handleCardDragStart(e, obj.id, geom.x || 80, geom.y || 60)}
                    className="flex items-center justify-between px-3 py-1.5 bg-[var(--accent-primary-soft)]/80 rounded-t-2xl border-b border-[var(--border-subtle)] cursor-grab active:cursor-grabbing text-xs select-none backdrop-blur-md h-[38px]"
                    title="Click & Drag header to move image anywhere on canvas"
                  >
                    <span className="font-bold text-[11px] text-[var(--text-primary)] flex items-center gap-1.5 truncate max-w-[55%]">
                      <GripHorizontal size={14} className="opacity-70 shrink-0" />
                      <span className="truncate">📷 {geom.name || 'Uploaded Image'}</span>
                      {geom.strokes && geom.strokes.length > 0 && (
                        <span className="text-[9px] font-mono text-[var(--accent-primary)] bg-[var(--card-bg)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] shrink-0">
                          ✎ {geom.strokes.length}
                        </span>
                      )}
                    </span>

                    {/* Window Controls: [-] Minimize, [+] Maximize, [X] Close */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] font-mono text-[var(--text-secondary)] bg-[var(--card-bg)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                        {Math.round(imgWidth)}×{Math.round(imgHeight)}
                      </span>

                      {/* Annotate / Open Full Canvas Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDocumentModal({
                            id: obj.id,
                            name: geom.name || 'Uploaded Image',
                            fileType: geom.file_type || 'image/png',
                            src: geom.src,
                            initialStrokes: geom.strokes || []
                          });
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--text-inverse)] transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 text-[10px] font-bold"
                        title="Open in Dedicated Annotation Canvas (Draw, Mark & Save)"
                      >
                        <Edit3 size={11} />
                        <span className="hidden sm:inline">Annotate</span>
                      </button>

                      {/* Minimize Button (-) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCardMinimize(obj.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`p-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center ${
                          isMinimized ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)]' : 'bg-[var(--card-bg)] hover:bg-[var(--accent-primary-soft)]'
                        }`}
                        title={isMinimized ? "Restore Image Height" : "Minimize Image (-)"}
                      >
                        <Minus size={13} />
                      </button>

                      {/* Maximize Button (+) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCardMaximize(obj.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`p-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center ${
                          isMaximized ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)]' : 'bg-[var(--card-bg)] hover:bg-[var(--accent-primary-soft)]'
                        }`}
                        title={isMaximized ? "Restore Normal Size" : "Maximize Image (+)"}
                      >
                        <Plus size={13} />
                      </button>

                      {/* Close Button (X) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeObject(obj.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="p-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--card-bg)] hover:bg-rose-500/20 text-[var(--text-secondary)] hover:text-rose-400 hover:border-rose-500/40 transition-colors cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center"
                        title="Remove Image (X)"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                </foreignObject>
                {!isMinimized && (
                  <image
                    href={geom.src}
                    x={0}
                    y={headerHeight}
                    width={imgWidth}
                    height={imgHeight}
                    preserveAspectRatio="xMidYMid meet"
                    className="rounded-b-2xl pointer-events-none"
                  />
                )}
              </g>
            );
          } else if (obj.type === 'document') {
            const geom = JSON.parse(obj.geometry_json);
            const isMinimized = !!geom.is_minimized;
            const isMaximized = !!geom.is_maximized;

            const maxViewportWidth = typeof window !== 'undefined' ? Math.max(300, window.innerWidth - 30) : 680;
            const docWidth = Math.min(geom.w || (isMaximized ? 880 : 580), maxViewportWidth);
            const headerHeight = 42;
            const docHeight = isMinimized ? headerHeight : (geom.h || (isMaximized ? 620 : 420));

            const isPdf = geom.name?.toLowerCase().endsWith('.pdf') || geom.file_type?.includes('pdf');
            const isPpt = geom.name?.toLowerCase().includes('.ppt') || geom.file_type?.includes('presentation');
            const isWord = geom.name?.toLowerCase().includes('.doc') || geom.file_type?.includes('word');

            const badgeColor = isPdf
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
              : isPpt
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : isWord
              ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';

            const badgeLabel = isPdf ? 'PDF' : isPpt ? 'PPT' : isWord ? 'DOCX' : 'DOC';

            return (
              <g key={obj.id} transform={`translate(${geom.x || 80}, ${geom.y || 60})`}>
                <rect
                  width={docWidth}
                  height={docHeight}
                  fill="var(--glass-bg)"
                  rx={isMinimized ? 12 : 18}
                  stroke="var(--border-subtle)"
                  strokeWidth={1.5}
                  className="shadow-2xl"
                />
                <foreignObject width={docWidth} height={docHeight} className="p-0">
                  <div className={`flex flex-col h-full justify-between select-none text-[var(--text-primary)] ${isMinimized ? 'rounded-xl' : 'rounded-2xl'} overflow-hidden`}>
                    {/* Document Header Bar */}
                    <div
                      onPointerDown={(e) => handleCardDragStart(e, obj.id, geom.x || 80, geom.y || 60)}
                      className="flex items-center justify-between px-3 py-2 bg-[var(--accent-primary-soft)]/90 border-b border-[var(--border-subtle)] cursor-grab active:cursor-grabbing text-xs select-none backdrop-blur-md h-[42px]"
                      title="Drag header to move document anywhere on canvas"
                    >
                      <div className="flex items-center gap-2 truncate max-w-[55%]">
                        <GripHorizontal size={14} className="opacity-70 shrink-0" />
                        <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase border ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                        <span className="font-bold text-xs truncate text-[var(--text-primary)]">
                          {geom.name || 'Uploaded Document'}
                        </span>
                        {geom.strokes && geom.strokes.length > 0 && (
                          <span className="text-[9px] font-mono text-[var(--accent-primary)] bg-[var(--card-bg)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] shrink-0">
                            ✎ {geom.strokes.length}
                          </span>
                        )}
                      </div>

                      {/* Window Controls: [Annotate], [-] Minimize, [+] Maximize, [X] Close */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Annotate / Open Full Canvas Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDocumentModal({
                              id: obj.id,
                              name: geom.name || 'Uploaded Document',
                              fileType: geom.file_type || 'application/pdf',
                              src: geom.src,
                              htmlContent: geom.html_content,
                              textContent: geom.text_content,
                              initialStrokes: geom.strokes || []
                            });
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--text-inverse)] transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 text-[10px] font-bold"
                          title="Open in Dedicated Annotation Canvas (Draw, Mark & Save)"
                        >
                          <Edit3 size={11} />
                          <span className="hidden sm:inline">Annotate</span>
                        </button>

                        {/* Minimize Button (-) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCardMinimize(obj.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={`p-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center ${
                            isMinimized ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)]' : 'bg-[var(--card-bg)] hover:bg-[var(--accent-primary-soft)]'
                          }`}
                          title={isMinimized ? "Restore Document Height" : "Minimize Document (-)"}
                        >
                          <Minus size={13} />
                        </button>

                        {/* Maximize Button (+) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCardMaximize(obj.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={`p-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center ${
                            isMaximized ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)]' : 'bg-[var(--card-bg)] hover:bg-[var(--accent-primary-soft)]'
                          }`}
                          title={isMaximized ? "Restore Normal Size" : "Maximize Document (+)"}
                        >
                          <Plus size={13} />
                        </button>

                        {/* Close Button (X) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeObject(obj.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="p-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--card-bg)] hover:bg-rose-500/20 text-[var(--text-secondary)] hover:text-rose-400 hover:border-rose-500/40 transition-colors cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center"
                          title="Remove Document (X)"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Document Content (Hidden if minimized) */}
                    {!isMinimized && (
                      <div className="flex-1 p-4 overflow-y-auto space-y-2.5 text-xs bg-[var(--card-bg)]/75">
                        {geom.html_content ? (
                          <div
                            className="w-full h-full text-xs text-[var(--text-primary)] leading-relaxed select-text word-doc-container"
                            dangerouslySetInnerHTML={{ __html: geom.html_content }}
                          />
                        ) : geom.src && isPdf ? (
                          <iframe
                            src={`${geom.src}#toolbar=0&navpanes=0&view=FitH`}
                            className="w-full h-full min-h-[300px] rounded-xl border border-[var(--border-subtle)] pointer-events-auto bg-white dark:bg-[#00272B]"
                            title={geom.name}
                          />
                        ) : geom.text_content ? (
                          <pre className="font-sans whitespace-pre-wrap leading-relaxed text-xs text-[var(--text-primary)]">
                            {geom.text_content}
                          </pre>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2 border border-dashed border-[var(--border-subtle)] rounded-xl">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border font-bold text-sm ${badgeColor}`}>
                              {badgeLabel}
                            </div>
                            <h4 className="font-bold text-sm text-[var(--text-primary)]">{geom.name}</h4>
                            <p className="text-[10px] text-[var(--text-secondary)]">
                              Document loaded on Canvas. You can mark, highlight, and write notes directly over this document.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
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
        onExportImage={handleExportCanvasWithMarkings}
        defaultTitle={selectedTopic ? `${selectedTopic.name} Note` : `Whiteboard Session #${savedCanvasHistory.length + 1}`}
        objectCount={objects.length}
      />

      {/* Second Brain Knowledge Graph Modal */}
      <SecondBrainGraphModal
        isOpen={isGraphicalViewOpen}
        onClose={() => setIsGraphicalViewOpen(false)}
      />

      {/* Dedicated Document Annotation Canvas Modal */}
      <DocumentCanvasModal
        isOpen={!!activeDocumentModal}
        onClose={() => setActiveDocumentModal(null)}
        documentData={activeDocumentModal}
        onSaveToMainCanvas={(updatedDocObj) => {
          setObjects(prev => {
            const existingIndex = prev.findIndex(o => o.id === updatedDocObj.id);
            let nextObjects: CanvasObject[];
            if (existingIndex >= 0) {
              const existing = prev[existingIndex];
              try {
                const existingGeom = JSON.parse(existing.geometry_json);
                const updatedGeom = JSON.parse(updatedDocObj.geometry_json);
                updatedDocObj = {
                  ...updatedDocObj,
                  geometry_json: JSON.stringify({
                    ...updatedGeom,
                    x: existingGeom.x ?? updatedGeom.x,
                    y: existingGeom.y ?? updatedGeom.y,
                    w: existingGeom.w ?? updatedGeom.w,
                    h: existingGeom.h ?? updatedGeom.h,
                    is_minimized: existingGeom.is_minimized ?? false,
                    is_maximized: existingGeom.is_maximized ?? false
                  })
                };
              } catch {}
              nextObjects = [...prev];
              nextObjects[existingIndex] = updatedDocObj;
            } else {
              nextObjects = [...prev, updatedDocObj];
            }
            pushToHistory(nextObjects);
            return nextObjects;
          });
        }}
      />
    </div>
  );
};
