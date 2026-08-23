import { useState, useEffect, useRef } from 'react';
import { useEduOSStore } from '../../store/store';
import { EduOSWebSocket } from '../../lib/ws';
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
  const { user, selectedTopic, mockMode, canvasModeActive, setCanvasModeActive } = useEduOSStore();
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
    if (!mockMode && user) {
      const convId = `teacher-conv-${Date.now()}`;
      const client = new EduOSWebSocket(
        convId,
        user.token,
        "teacher",
        (data) => {
          // Handle incoming message chunks or final payload
          console.log("Teacher WS payload received:", data);
          setIsLoading(false);

          if (data.response_type) {
            // Render specific structured response card
            const responseType = data.response_type;
            let payload: any = null;

            // Map and parse content
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
            // Standard typing/streaming chunk fallback
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
          console.error("Teacher WebSocket connection failed, fallback to simulated stream.", err);
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
  }, [mockMode, user]);

  // Simulated Streaming Responses for Demo Mode
  const handleSimulatedResponse = (query: string) => {
    setIsLoading(true);
    let responseType = 'explanation';
    let payload: any = null;

    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('roadmap')) {
      responseType = 'roadmap';
      payload = {
        nodes: [
          { id: 'n1', label: '1. Kernels & Filters', order: 1 },
          { id: 'n2', label: '2. Feature Extraction', order: 2 },
          { id: 'n3', label: '3. Max Pooling', order: 3 },
          { id: 'n4', label: '4. Classification Layers', order: 4 }
        ],
        edges: [
          { from: 'n1', to: 'n2' },
          { from: 'n2', to: 'n3' },
          { from: 'n3', to: 'n4' }
        ]
      };
    } else if (lowerQuery.includes('chart') || lowerQuery.includes('distribution')) {
      responseType = 'chart';
      payload = {
        chart_type: 'bar',
        labels: ['Conv2D', 'ReLU', 'MaxPool', 'Flatten', 'Dense'],
        series: [45, 12, 28, 5, 62]
      };
    } else if (lowerQuery.includes('question') || lowerQuery.includes('quiz') || lowerQuery.includes('class question')) {
      responseType = 'quick_question';
      payload = {
        question: "Why do we typically use Max Pooling instead of Average Pooling in standard Convolutional Networks?",
        expected_answer_hint: "Max Pooling extracts the most prominent features (highest activation value) in a patch, preserving strong edge / texture gradients, whereas Average Pooling smooths out and dilutes features."
      };
    } else if (lowerQuery.includes('resource') || lowerQuery.includes('reference')) {
      responseType = 'resources';
      payload = {
        resources: [
          { title: "Module 3: CNN Fundamentals & Spatial Kernels (PDF)", type: "pdf", url_or_ref: "#" },
          { title: "CNN Interactive Visualization (Visualizer)", type: "web", url_or_ref: "#" },
          { title: "Stanford CS231n: Convolutional Layers Lecture (Stanford)", type: "youtube", url_or_ref: "#" }
        ]
      };
    } else if (lowerQuery.includes('key point') || lowerQuery.includes('unit')) {
      responseType = 'key_points';
      payload = {
        points: [
          "Convolution layers preserve spatial relationships by learning local features instead of fully flattening the inputs.",
          "Kernels/Filters are 3D tensors representing learned weights that slide across inputs to perform dot products.",
          "ReLU activations add non-linearity, thresholding negative pixel features to 0.",
          "Pooling layers perform downsampling, reducing the dimensions to achieve translation invariance."
        ]
      };
    } else {
      // Default: Explanation
      responseType = 'explanation';
      payload = {
        summary: "A Convolutional Neural Network (CNN) is a deep learning architecture designed for visual data. Unlike standard fully connected networks that flatten images into 1D, CNNs use local spatial filters (kernels) that slide across the image, computing dot products to detect low-level features (edges, textures) and combining them into high-level features.",
        real_world_example: "Imagine looking through a small magnifying glass and sliding it across a large photo piece by piece. First, you notice sharp edges (low-level features). As you combine small pieces, you recognize shapes like eyes or wheels (mid-level features). Finally, combining all pieces lets you identify the full picture as a face or car.",
        key_points: ["Spatial Kernels", "Feature Maps", "ReLU activation", "Max Pooling"]
      };
    }

    // Simulate streaming delays
    setTimeout(() => {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          responseType,
          payload
        }
      ]);
    }, 1500);
  };

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

    if (mockMode || !wsClient) {
      handleSimulatedResponse(textToSend);
    } else {
      setIsLoading(true);
      wsClient.sendQuery(textToSend, selectedTopic?.id || "topic-cnn-001");
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
