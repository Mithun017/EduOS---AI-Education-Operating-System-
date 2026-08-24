import { useState, useEffect, useRef } from 'react';
import { useEduOSStore } from '../../store/store';
import { askStudentHTTP } from '../../lib/api';
import { Send, GraduationCap, Compass, Info, RefreshCw, Network } from 'lucide-react';
import { DrawingCanvas } from '../canvas/DrawingCanvas';
import { SecondBrainGraphModal } from '../canvas/SecondBrainGraphModal';

interface ChatMessage {
  id: string;
  sender: 'student' | 'tutor';
  text: string;
  level?: string;
  suggestedActions?: string[];
  isPracticeQuestion?: boolean;
}

export const StudentAssistant: React.FC = () => {
  const { user, selectedTopic, canvasModeActive, setCanvasModeActive } = useEduOSStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentLevel, setCurrentLevel] = useState<'technical' | 'simplified' | 'beginner'>('technical');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isGraphicalViewOpen, setIsGraphicalViewOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Seed initial prompt
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'tutor',
          text: `Hi ${user?.fullName || 'there'}! Welcome to your private, judgment-free study assistant. We are currently looking at "${selectedTopic?.name || 'this topic'}". Feel free to ask me anything — no question is too basic!`,
          level: 'technical',
          suggestedActions: [`Explain ${selectedTopic?.name || 'concept'}`, "Give me a simple example", "Practice question"]
        }
      ]);
      setCurrentLevel('technical');
      setConversationId(null);
    }
  }, [selectedTopic]);



  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    // Student message
    setMessages((prev) => [
      ...prev,
      { id: `msg-${Date.now()}`, sender: 'student', text: textToSend }
    ]);
    setInputText('');

    setIsLoading(true);
    try {
      const response = await askStudentHTTP(
        user?.token || '',
        selectedTopic?.id || '',
        conversationId,
        textToSend
      );
      setIsLoading(false);
      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }
      if (response.current_level) {
        setCurrentLevel(response.current_level);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          sender: 'tutor',
          text: response.text,
          level: response.current_level,
          suggestedActions: response.suggested_actions || [],
          isPracticeQuestion: response.is_practice_question || false
        }
      ]);
    } catch (err) {
      console.error("Student AI API call error", err);
      setIsLoading(false);
    }
  };

  const currentTutorMessage = messages[messages.length - 1]?.sender === 'tutor' 
    ? messages[messages.length - 1] 
    : messages[messages.length - 2];

  return (
    <div className="flex flex-col h-full bg-[var(--glass-bg)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-2xl transition-all duration-300">
      {/* Header */}
      <div className="bg-[var(--glass-bg)]/40 border-b border-[var(--border-subtle)] p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-primary-soft)] flex items-center justify-center text-[var(--accent-primary)] font-extrabold border border-[var(--border-subtle)]">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-1.5">
              Private Tutor AI
              <span className="bg-slate-800/10 text-[var(--text-secondary)] text-[8px] font-mono font-medium px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)]">
                Private Chat
              </span>
            </h3>
            <p className="text-[10px] text-[var(--text-secondary)]">
              Personalized learning on <span className="text-[var(--accent-primary)] font-medium">{selectedTopic?.name || "CNN"}</span>
            </p>
          </div>
        </div>

        {/* Adaptive level state */}
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

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[var(--glass-bg)] px-2.5 py-1.5 rounded-xl border border-[var(--border-subtle)] text-[10px]">
              <Compass className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span className="text-[var(--text-secondary)] font-medium">Complexity:</span>
              <span className="text-[var(--accent-primary)] font-bold uppercase font-mono tracking-wider ml-1">
                {currentLevel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Scroll / Drawing Canvas Workspace */}
      {canvasModeActive ? (
        <div className="flex-1 min-h-0">
          <DrawingCanvas conversationId={conversationId} />
        </div>
      ) : (
        <>
          {/* Chat scroll workspace */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--glass-bg)]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'student' ? 'items-end' : 'items-start'} gap-1.5 animate-slide-up`}
          >
            {/* Sender tag */}
            <span className="text-[9px] text-[var(--text-secondary)] font-medium px-1">
              {msg.sender === 'student' ? 'You' : 'Personal Tutor AI'}
            </span>

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.sender === 'student'
                  ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] font-medium rounded-tr-none'
                  : 'glass-panel text-[var(--text-primary)] rounded-tl-none'
              }`}
            >
              {msg.text.split('\n').map((line, i) => (
                <p key={i} className={line ? 'mb-2 last:mb-0' : 'h-3'} >{line}</p>
              ))}

              {/* level stamp for AI responses */}
              {msg.sender === 'tutor' && msg.level && (
                <div className="mt-2.5 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[9px] text-[var(--text-secondary)] font-mono">
                  <span>Level: {msg.level}</span>
                  <span className="flex items-center gap-1">
                    <Info className="w-3 h-3 text-[var(--accent-primary)]" /> Institutional Grounded
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 p-3 glass-panel-interactive text-[var(--accent-primary)] text-xs w-36 justify-center font-medium">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Analyzing & adapting...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested next replies */}
      {currentTutorMessage && currentTutorMessage.suggestedActions && currentTutorMessage.suggestedActions.length > 0 && (
        <div className="px-4 py-2.5 bg-[var(--glass-bg)] border-t border-[var(--border-subtle)]">
          <span className="text-[9px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider block mb-1.5">
            Suggested replies (low friction):
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {currentTutorMessage.suggestedActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(action)}
                disabled={isLoading}
                className="flex-shrink-0 bg-[var(--glass-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all hover:bg-[var(--accent-primary-soft)] active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input container */}
      <div className="p-3.5 bg-[var(--glass-bg)] border-t border-[var(--border-subtle)] flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend(inputText)}
          placeholder="Ask a question privately... (e.g. explain like I'm a beginner)"
          disabled={isLoading}
          className="flex-1 bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] transition-all disabled:opacity-50"
        />
        <button
          onClick={() => handleSend(inputText)}
          disabled={isLoading || !inputText.trim()}
          className="p-3 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 text-[var(--text-inverse)] font-bold shadow-md active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
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
