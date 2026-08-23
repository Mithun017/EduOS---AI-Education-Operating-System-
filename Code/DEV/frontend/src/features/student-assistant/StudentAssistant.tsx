import { useState, useEffect, useRef } from 'react';
import { useEduOSStore } from '../../store/store';
import { askStudentHTTP } from '../../lib/api';
import { Send, GraduationCap, Compass, Info, RefreshCw } from 'lucide-react';
import { DrawingCanvas } from '../canvas/DrawingCanvas';

interface ChatMessage {
  id: string;
  sender: 'student' | 'tutor';
  text: string;
  level?: string;
  suggestedActions?: string[];
  isPracticeQuestion?: boolean;
}

export const StudentAssistant: React.FC = () => {
  const { user, selectedTopic, mockMode, canvasModeActive, setCanvasModeActive } = useEduOSStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentLevel, setCurrentLevel] = useState<'technical' | 'simplified' | 'beginner'>('technical');
  const [conversationId, setConversationId] = useState<string | null>(null);
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
          text: `Hi Alex! Welcome to your private, judgment-free study assistant. We are currently looking at "${selectedTopic?.name || 'CNN'}". Feel free to ask me anything — no question is too basic!`,
          level: 'technical',
          suggestedActions: ["Explain CNN standard concept", "Give me a simple example", "Practice question"]
        }
      ]);
      setCurrentLevel('technical');
      setConversationId(null);
    }
  }, [selectedTopic]);

  // Mock State-Machine for Adaptive Learning
  const handleSimulatedTutor = (message: string) => {
    setIsLoading(true);
    const msgLower = message.toLowerCase();

    let responseText = "";
    let nextLevel = currentLevel;
    let suggestedActions: string[] = [];
    let isQuestion = false;

    // State machine logic based on intent matching
    if (msgLower.includes('simpler') || msgLower.includes("don't understand") || msgLower.includes("confused") || msgLower.includes("hard")) {
      if (currentLevel === 'technical') {
        nextLevel = 'simplified';
        responseText = "No problem! Let's break it down simpler. In a standard CNN, we use complex math matrices. Simply put: think of a CNN as a scanning grid. Instead of analyzing the whole image at once (which takes too much memory), it moves a tiny window (kernel) across the picture line by line to detect basic features like outlines and borders. Does this grid explanation make more sense?";
        suggestedActions = ["Explain even simpler", "Give me an example", "Let's try a question"];
      } else {
        nextLevel = 'beginner';
        responseText = "Got it, let's strip away all the computer science jargon. Think of a CNN like a puzzle solver. Imagine you're sorting pictures. You don't guess the puzzle by staring at all pieces scattered. You look for corners (Level 1 features), then lock pieces together to recognize a face or shape (Level 2), and finally see the whole picture. That's all a CNN does — building small details into big recognition. How's that?";
        suggestedActions = ["Give me a concrete example", "Test me with a question", "Go back to Technical level"];
      }
    } else if (msgLower.includes('example') || msgLower.includes('analogy')) {
      responseText = `Here is a real-world example: Think of face recognition on your phone.
1. The CNN first scans small patches of your face, detecting simple lines and dark gradients (low-level).
2. It then groups those lines to recognize shapes like two circles and a curved arc (mid-level: eyes and mouth).
3. Finally, it combines those features to declare 'This is Alex' (high-level classification).`;
      suggestedActions = ["Let's try a practice question", "Explain the math standard", "Still confused"];
    } else if (msgLower.includes('question') || msgLower.includes('test') || msgLower.includes('practice')) {
      isQuestion = true;
      responseText = "Here is a quick concept check:\n\nIf you apply a 3x3 filter to a 10x10 image with a stride of 1 (shifting the filter by 1 pixel at a time) and no padding, what will the width of the output feature map be?\n\n(Write your guess or click 'Reveal Answer' to check!)";
      suggestedActions = ["Answer: 8x8", "Answer: 10x10", "Reveal Answer"];
    } else if (msgLower.includes('8x8') || msgLower.includes('correct') || msgLower.includes('reveal')) {
      responseText = "Perfect! Yes, the answer is 8x8. The formula is (W - F)/S + 1. So (10 - 3)/1 + 1 = 8. Excellent job analyzing the spatial dimension reduction! Would you like to try another or return to the main theory?";
      suggestedActions = ["Give me another question", "Explain MaxPooling next", "Reset difficulty to technical"];
    } else if (msgLower.includes('reset') || msgLower.includes('technical') || msgLower.includes('standard')) {
      nextLevel = 'technical';
      responseText = "Okay! Resetting to our standard technical level. A Convolutional Neural Network uses parameterized sliding tensor kernels to compute discrete cross-correlation feature maps, applying non-linear activation functions (ReLU) and dimensionality-reducing pooling layers. What specific component (convolutions, pooling, linear layers) should we dive into?";
      suggestedActions = ["Explain MaxPooling math", "Show me a simple roadmap", "Give me a simple example"];
    } else {
      // Default technical response
      nextLevel = 'technical';
      responseText = "A Convolutional Neural Network (CNN) is a deep neural network class that uses convolutional layers to preserve the spatial hierarchy of pixels. Rather than connecting every pixel to every neuron (fully connected), it slide kernels across the grid to extract local features, making it highly parameter-efficient for vision tasks.";
      suggestedActions = ["I don't understand this", "Give me an example", "Give me a practice question"];
    }

    setTimeout(() => {
      setIsLoading(false);
      setCurrentLevel(nextLevel);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          sender: 'tutor',
          text: responseText,
          level: nextLevel,
          suggestedActions,
          isPracticeQuestion: isQuestion
        }
      ]);
    }, 1200);
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    // Student message
    setMessages((prev) => [
      ...prev,
      { id: `msg-${Date.now()}`, sender: 'student', text: textToSend }
    ]);
    setInputText('');

    if (mockMode) {
      handleSimulatedTutor(textToSend);
    } else if (user) {
      setIsLoading(true);
      try {
        const response = await askStudentHTTP(
          user.token,
          selectedTopic?.id || "topic-cnn-001",
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
            text: response.content,
            level: response.current_level || 'technical',
            suggestedActions: response.suggested_next_actions || []
          }
        ]);
      } catch (err) {
        setIsLoading(false);
        console.error("HTTP error calling student assistant:", err);
        handleSimulatedTutor(textToSend);
      }
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCanvasModeActive(!canvasModeActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
              canvasModeActive
                ? 'bg-[var(--accent-primary)] text-slate-950 border-[var(--accent-primary)] font-semibold shadow-lg'
                : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
            }`}
          >
            {canvasModeActive ? "Hide Drawing Board" : "Show Drawing Board"}
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
</div>
  );
};
