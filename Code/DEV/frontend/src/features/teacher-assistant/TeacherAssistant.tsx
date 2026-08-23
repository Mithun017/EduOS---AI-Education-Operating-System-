import { useState, useEffect, useRef } from 'react';
import { useEduOSStore } from '../../store/store';
import { EduOSWebSocket } from '../../lib/ws';
import { askTeacherHTTP } from '../../lib/api';
import { Sparkles, Send, RefreshCw, Network } from 'lucide-react';
import { DrawingCanvas } from '../canvas/DrawingCanvas';
import { SecondBrainGraphModal } from '../canvas/SecondBrainGraphModal';
import {
  ExplanationCard,
  RoadmapDiagram,
  ChartCard,
  KeyPointsList,
  ResourceList,
  QuickQuestionCard,
  PreviousQuestionCard
} from './ResponseRenderers';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  responseType?: string;
  payload?: any;
  text?: string;
  isStreaming?: boolean;
}

export const TeacherAssistant: React.FC = () => {
  const { user, selectedTopic, canvasModeActive, setCanvasModeActive } = useEduOSStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [wsClient, setWsClient] = useState<EduOSWebSocket | null>(null);
  const [responseMode, setResponseMode] = useState<'hybrid' | 'institution_grounded' | 'general'>('hybrid');
  const [isGraphicalViewOpen, setIsGraphicalViewOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick Action Chips
  const quickActions = [
    { label: "Explain simply", text: "Explain CNN with a simple real-world example" },
    { label: "Show roadmap", text: "Show me a simple roadmap for this topic" },
    { label: "Key points", text: "Key points for this unit" },
    { label: "Class question", text: "Give me a quick question to ask the class" },
    { label: "Resources", text: "What resources do I have for this topic?" },
  ];

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Set up real WS client if authenticated
  useEffect(() => {
    if (user) {
      const convId = `teacher-conv-${Date.now()}`;
      const client = new EduOSWebSocket(
        convId,
        user.token,
        "teacher",
        (data) => {
          console.log("Teacher WS payload received:", data);
          setIsLoading(false);
          if (data.response_type) {
            const responseType = data.response_type;
            let payload: any = null;
            try {
              if (typeof data.content === 'string') {
                payload = JSON.parse(data.content);
              } else {
                payload = data.content || data;
              }
            } catch (e) {
              payload = data;
            }
            setMessages((prev) => [
              ...prev.filter(m => !m.isStreaming),
              {
                id: `msg-${Date.now()}`,
                sender: 'assistant',
                responseType,
                payload
              }
            ]);
          } else if (data.text) {
            setMessages((prev) => {
              const existingStream = prev.find(m => m.isStreaming);
              if (existingStream) {
                return prev.map(m => m.isStreaming ? { ...m, text: (m.text || '') + data.text } : m);
              } else {
                return [...prev, { id: 'stream', sender: 'assistant', text: data.text, isStreaming: true }];
              }
            });
          }
        },
        (err) => {
          console.error("Teacher WebSocket connection failed.", err);
        }
      );
      client.connect();
      setWsClient(client);
      return () => {
        client.disconnect();
      };
    } else {
      setWsClient(null);
    }
  }, [user]);



  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    // User Message
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: textToSend
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    setIsLoading(true);
    try {
      if (wsClient) {
        wsClient.sendQuery(textToSend, selectedTopic?.id || "topic-cnn-001");
      } else {
        const response = await askTeacherHTTP(
          textToSend,
          responseMode,
          user?.token || '',
          user?.institutionId || 'demo-inst-001'
        );
        setIsLoading(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            responseType: response?.response_type || 'explanation',
            payload: response
          }
        ]);
      }
    } catch (err) {
      console.error("FastAPI AI Pipeline Call Error", err);
      setIsLoading(false);
    }
  };

  const renderResponseCard = (msg: Message) => {
    if (!msg.payload) return null;
    switch (msg.responseType) {
      case 'explanation':
        return <ExplanationCard data={msg.payload} />;
      case 'roadmap':
        return <RoadmapDiagram data={msg.payload} />;
      case 'chart':
        return <ChartCard data={msg.payload} />;
      case 'key_points':
        return <KeyPointsList data={msg.payload} />;
      case 'resources':
        return <ResourceList data={msg.payload} />;
      case 'quick_question':
        return <QuickQuestionCard data={msg.payload} />;
      case 'previous_question_context':
        return <PreviousQuestionCard data={msg.payload} />;
      default:
        return (
          <div className="glass-panel p-4 text-slate-300 text-sm">
            {JSON.stringify(msg.payload)}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--glass-bg)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-2xl transition-all duration-300">
      {/* Header */}
      <div className="bg-[var(--glass-bg)]/40 border-b border-[var(--border-subtle)] p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary-soft)] flex items-center justify-center text-[var(--accent-primary)] font-extrabold border border-[var(--border-subtle)]">
            T
          </div>
          <div>
            <h3 className="font-semibold text-sm text-[var(--text-primary)]">Live Teaching Assistant</h3>
            <p className="text-[10px] text-[var(--text-secondary)]">Context: <span className="text-[var(--accent-primary)] font-medium">{selectedTopic?.name || "No Topic Selected"}</span></p>
          </div>
        </div>

        {/* Configuration settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsGraphicalViewOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border border-[var(--border-subtle)] bg-[var(--glass-bg)] text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer shadow-sm hover:scale-105"
            title="Open Second Brain Knowledge Graph (Nodes & Edges)"
          >
            <Network className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Graphical View</span>
          </button>

          <button
            onClick={() => setCanvasModeActive(!canvasModeActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
              canvasModeActive
                ? 'bg-[var(--accent-primary)] text-slate-950 border-[var(--accent-primary)] font-semibold shadow-lg'
                : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
            }`}
          >
            {canvasModeActive ? "Assistant Chat View" : "Drawing Board View"}
          </button>

          <div className="flex items-center gap-1 bg-[var(--glass-bg)] px-2.5 py-1.5 rounded-xl border border-[var(--border-subtle)]">
            <span className="text-[9px] text-[var(--text-secondary)] font-mono">Mode:</span>
            <select
              value={responseMode}
              onChange={(e: any) => setResponseMode(e.target.value)}
              className="bg-transparent text-[10px] text-[var(--accent-primary)] focus:outline-none cursor-pointer"
            >
              <option value="hybrid" className="bg-[var(--card-bg)] text-[var(--text-primary)]">Hybrid</option>
              <option value="institution_grounded" className="bg-[var(--card-bg)] text-[var(--text-primary)]">Grounded</option>
              <option value="general" className="bg-[var(--card-bg)] text-[var(--text-primary)]">General</option>
            </select>
          </div>
        </div>
      </div>

      {/* Messages Scroll / Drawing Canvas Workspace */}
      {canvasModeActive ? (
        <div className="flex-1 min-h-0">
          <DrawingCanvas conversationId={null} />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <Sparkles className="w-8 h-8 text-[var(--accent-primary)] animate-bounce" />
            <h4 className="font-medium text-[var(--text-primary)] text-sm">Ask EduOS Live Assistant</h4>
            <p className="text-xs text-[var(--text-secondary)] max-w-[280px]">
              Tap a quick chip below or query explanations, diagrams, roadmaps, and quiz questions instantly while teaching.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} gap-1.5`}
          >
            {msg.sender === 'user' ? (
              <div className="max-w-[85%] bg-[var(--accent-primary)] text-[var(--text-inverse)] font-medium rounded-2xl rounded-tr-none px-4 py-2 text-sm shadow-md animate-fade-in">
                {msg.text}
              </div>
            ) : msg.isStreaming ? (
              <div className="max-w-[90%] glass-panel px-4 py-3 text-sm text-[var(--text-primary)] typing-cursor animate-fade-in">
                {msg.text}
              </div>
            ) : (
              <div className="w-full max-w-[95%]">
                {renderResponseCard(msg)}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 p-3 glass-panel-interactive text-[var(--accent-primary)] text-xs w-32 justify-center font-medium">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Generating...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Drawer */}
      <div className="px-4 py-2 bg-[var(--glass-bg)] border-t border-[var(--border-subtle)]">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {quickActions.map((act, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(act.text)}
              disabled={isLoading}
              className="flex-shrink-0 bg-[var(--glass-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all hover:bg-[var(--accent-primary-soft)] active:scale-95 cursor-pointer"
            >
              {act.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div className="p-3 bg-[var(--glass-bg)] border-t border-[var(--border-subtle)] flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend(inputText)}
          placeholder="Ask something... (e.g. show roadmap for CNN)"
          disabled={isLoading}
          className="flex-1 bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] transition-all disabled:opacity-50"
        />
        <button
          onClick={() => handleSend(inputText)}
          disabled={isLoading || !inputText.trim()}
          className="p-2.5 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-[var(--text-inverse)] font-bold shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
        </>
      )}

      {/* Second Brain Knowledge Graph Modal */}
      <SecondBrainGraphModal
        isOpen={isGraphicalViewOpen}
        onClose={() => setIsGraphicalViewOpen(false)}
      />
    </div>
  );
};
