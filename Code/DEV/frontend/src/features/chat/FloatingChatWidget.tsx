import React, { useState, useRef, useEffect } from 'react';
import {
  HelpCircle,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Paperclip,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  Download,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { useEduOSStore, type FileAttachment } from '../../store/store';
import { askTeacherHTTP, askStudentHTTP, uploadClassroomDocument } from '../../lib/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  file_attachment?: FileAttachment;
}

// Helper to determine document categories, icons, and themes
const getFileMeta = (filename: string, extension?: string) => {
  const ext = (extension || filename.split('.').pop() || '').toLowerCase();

  if (ext === 'pdf') {
    return {
      category: 'pdf',
      label: 'PDF',
      icon: FileText,
      badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
      cardClass: 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50',
      iconColor: 'text-rose-400',
      btnClass: 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/30'
    };
  }

  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) {
    return {
      category: 'word',
      label: ext.toUpperCase(),
      icon: FileText,
      badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
      cardClass: 'bg-blue-950/20 border-blue-500/30 hover:border-blue-500/50',
      iconColor: 'text-blue-400',
      btnClass: 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/30'
    };
  }

  if (['ppt', 'pptx', 'odp'].includes(ext)) {
    return {
      category: 'ppt',
      label: ext.toUpperCase(),
      icon: FileText,
      badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      cardClass: 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50',
      iconColor: 'text-amber-400',
      btnClass: 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/30'
    };
  }

  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return {
      category: 'excel',
      label: ext.toUpperCase(),
      icon: FileSpreadsheet,
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      cardClass: 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50',
      iconColor: 'text-emerald-400',
      btnClass: 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/30'
    };
  }

  if (['txt', 'md', 'json', 'py', 'js', 'ts', 'jsx', 'tsx', 'html', 'css'].includes(ext)) {
    return {
      category: 'text',
      label: ext.toUpperCase(),
      icon: FileCode,
      badgeClass: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
      cardClass: 'bg-cyan-950/20 border-cyan-500/30 hover:border-cyan-500/50',
      iconColor: 'text-cyan-400',
      btnClass: 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/30'
    };
  }

  return {
    category: 'other',
    label: (ext || 'DOC').toUpperCase(),
    icon: File,
    badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    cardClass: 'bg-purple-950/20 border-purple-500/30 hover:border-purple-500/50',
    iconColor: 'text-purple-400',
    btnClass: 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/30'
  };
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Reusable Document Card Component
const DocumentCard: React.FC<{ attachment: FileAttachment }> = ({ attachment }) => {
  const meta = getFileMeta(attachment.name, attachment.extension);
  const IconComponent = meta.icon;

  return (
    <div className={`mt-1.5 p-2.5 rounded-xl border ${meta.cardClass} flex flex-col gap-2 transition-all shadow-sm`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${meta.badgeClass}`}>
          <IconComponent className={`w-4 h-4 ${meta.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`px-1.5 py-0.2 rounded font-mono text-[8px] font-bold uppercase border ${meta.badgeClass}`}>
              {meta.label}
            </span>
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate" title={attachment.name}>
              {attachment.name}
            </p>
          </div>
          <span className="text-[9px] text-[var(--text-secondary)] font-mono block mt-0.5">
            {formatFileSize(attachment.size)}
          </span>
        </div>
      </div>

      {/* Action Buttons: Download & View */}
      <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-subtle)]">
        <a
          href={attachment.url}
          download={attachment.name}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${meta.btnClass}`}
          title={`Download ${attachment.name}`}
        >
          <Download className="w-3 h-3" />
          <span>Download</span>
        </a>
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] rounded-lg transition-all cursor-pointer"
          title="Open in new tab"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

export const FloatingChatWidget: React.FC = () => {
  const { user, viewMode, selectedTopic, roomCode, roomRole, studentDisplayName, isLiveConnected, roomChatMessages, roomWsSend } = useEduOSStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello! I am your AI Assistant. You are currently in ${viewMode.toUpperCase()} mode. You can ask questions or share documents (PDF, Word, PPT, Excel, etc.) anytime!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, roomChatMessages, isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 50MB check
      if (file.size > 50 * 1024 * 1024) {
        alert("File size exceeds maximum allowed limit of 50MB.");
        return;
      }
      setAttachedFile(file);
    }
    // reset input value so re-uploading same file works
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !attachedFile) || isLoading || isUploading) return;

    const userMsgText = inputText.trim();
    let fileAttachment: FileAttachment | undefined = undefined;

    // Process file upload if file is attached
    if (attachedFile) {
      setIsUploading(true);
      try {
        const uploadRes = await uploadClassroomDocument(attachedFile);
        fileAttachment = {
          name: uploadRes.filename,
          size: uploadRes.file_size,
          type: uploadRes.content_type,
          url: uploadRes.file_url,
          extension: uploadRes.extension
        };
      } catch (err) {
        console.error("Document upload failed", err);
      } finally {
        setIsUploading(false);
      }
    }

    // IF REAL-TIME CLASSROOM ROOM IS ACTIVE: Send over WebSocket room channel
    if (isLiveConnected && roomWsSend) {
      roomWsSend({
        type: 'chat_message',
        text: userMsgText,
        file_attachment: fileAttachment
      });
      setInputText('');
      setAttachedFile(null);
      return;
    }

    // Standard AI Assistant Chat Mode
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userMsgText,
      timestamp: timeStr,
      file_attachment: fileAttachment
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setAttachedFile(null);
    setIsLoading(true);

    try {
      let promptQuery = userMsgText;
      if (fileAttachment) {
        promptQuery = promptQuery
          ? `${promptQuery} [Attached document: ${fileAttachment.name}]`
          : `I have shared a document: ${fileAttachment.name}. Can you provide an overview or answer questions regarding this material?`;
      }

      let aiTextResponse = '';
      if (viewMode === 'teacher') {
        const res = await askTeacherHTTP(
          user?.token || '',
          selectedTopic?.id || '',
          promptQuery,
          'hybrid'
        );
        const data = res?.structured_data || res;
        aiTextResponse = data?.summary || res?.general_content || res?.grounded_content || (typeof data === 'string' ? data : 'I have analyzed your request.');
      } else {
        const res = await askStudentHTTP(
          user?.token || '',
          selectedTopic?.id || '',
          promptQuery,
          'medium'
        );
        aiTextResponse = res?.tutor_response || res?.content || 'I have analyzed your question.';
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiTextResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("Floating chat API error", err);
      const fallbackMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `I received your message${fileAttachment ? ` and document (${fileAttachment.name})` : ''}. Ready to assist with your educational workflows!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Round Circular Floating Action Button in Bottom Right */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full flex items-center justify-center bg-slate-900 text-white hover:bg-slate-800 shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 cursor-pointer border-2 border-slate-700/60 group"
        title="Open Classroom Chat & AI Assistant"
      >
        <div className="relative flex items-center justify-center">
          {isOpen ? (
            <X className="w-6 h-6 transition-transform group-hover:rotate-90" />
          ) : (
            <HelpCircle className="w-7 h-7 text-white stroke-[2.2] transition-transform group-hover:scale-110" />
          )}
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
        </div>
      </button>

      {/* Floating Chat Modal Box */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[540px] max-h-[calc(100vh-6rem)] bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl transition-all duration-300 animate-fade-in">
          {/* Header */}
          <div className="bg-[var(--accent-primary-soft)] border-b border-[var(--border-subtle)] p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)] text-[var(--text-inverse)] flex items-center justify-center shadow">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                  {isLiveConnected ? `Classroom Chat (${roomCode || 'Live'})` : 'EduOS AI Assistant'}
                  <Sparkles className="w-3 h-3 text-[var(--accent-primary)]" />
                </h3>
                <p className="text-[10px] text-[var(--text-secondary)] font-medium">
                  {isLiveConnected ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Room • Role: {roomRole === 'teacher' ? 'Teacher' : `Student (${studentDisplayName})`}
                    </span>
                  ) : (
                    <>Mode: <span className="text-[var(--accent-primary)] capitalize font-semibold">{viewMode}</span> • 🟢 Online</>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all cursor-pointer"
              title="Close Chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
            {isLiveConnected ? (
              /* LIVE CLASSROOM ROOM MESSAGES */
              roomChatMessages.length > 0 ? (
                roomChatMessages.map((msg) => {
                  const isTeacher = msg.sender_role === 'teacher';
                  return (
                    <div key={msg.id} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`font-bold flex items-center gap-1 ${isTeacher ? 'text-amber-400' : 'text-sky-400'}`}>
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] uppercase ${isTeacher ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-sky-500/20 border border-sky-500/30'}`}>
                            {isTeacher ? 'Teacher' : 'Student'}
                          </span>
                          <span>{msg.sender_name}</span>
                        </span>
                        <span className="text-[9px] text-[var(--text-secondary)] font-mono">{msg.timestamp}</span>
                      </div>

                      {/* Message Bubble + Optional Document Card */}
                      <div className="bg-[var(--glass-bg)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] leading-relaxed">
                        {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                        {msg.file_attachment && (
                          <DocumentCard attachment={msg.file_attachment} />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center border border-dashed border-[var(--border-subtle)] rounded-xl text-[10px] text-[var(--text-secondary)]">
                  Welcome to Live Classroom Chat! Ask questions or share documents (PDF, Word, PPT, Excel, etc.) with the teacher and class in real-time.
                </div>
              )
            ) : (
              /* STANDARD AI ASSISTANT MESSAGES */
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 ${
                    msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5 ${
                      msg.sender === 'user'
                        ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)]'
                        : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    }`}
                  >
                    {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded-tr-none font-medium'
                        : 'bg-[var(--glass-bg)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-tl-none'
                    }`}
                  >
                    {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                    {msg.file_attachment && (
                      <DocumentCard attachment={msg.file_attachment} />
                    )}
                    <span
                      className={`block text-[9px] mt-1 text-right font-mono ${
                        msg.sender === 'user' ? 'text-white/70' : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex items-center gap-2 p-3 bg-[var(--glass-bg)] border border-[var(--border-subtle)] rounded-xl text-[var(--accent-primary)] text-xs w-36 justify-center animate-pulse">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.rtf,.odt,.ods,.odp,.md,.zip,application/*,image/*"
          />

          {/* Selected File Preview Chip before sending */}
          {attachedFile && (
            <div className="px-3 py-1.5 bg-[var(--accent-primary-soft)] border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 animate-fade-in">
              <div className="flex items-center gap-2 min-w-0">
                {React.createElement(getFileMeta(attachedFile.name).icon, {
                  className: `w-4 h-4 shrink-0 ${getFileMeta(attachedFile.name).iconColor}`
                })}
                <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate max-w-[180px]">
                  {attachedFile.name}
                </span>
                <span className="text-[9px] text-[var(--text-secondary)] font-mono shrink-0">
                  ({formatFileSize(attachedFile.size)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="p-1 rounded-md text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Remove attachment"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Input Footer */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-[var(--glass-bg)] border-t border-[var(--border-subtle)] flex items-center gap-2"
          >
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--glass-bg)] rounded-xl border border-[var(--border-subtle)] transition-all cursor-pointer shadow-xs active:scale-95"
              title="Share Document (PDF, Word, PPT, Excel, etc.)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Input Field */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                attachedFile
                  ? "Add note or caption (optional)..."
                  : isLiveConnected
                  ? roomRole === 'teacher'
                    ? "Share document / message..."
                    : "Ask or share document..."
                  : `Ask as ${viewMode}...`
              }
              className="flex-1 bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] min-w-0"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={(!inputText.trim() && !attachedFile) || isLoading || isUploading}
              className="p-2 bg-[var(--accent-primary)] disabled:opacity-40 text-[var(--text-inverse)] rounded-xl hover:opacity-90 transition-all cursor-pointer shadow-sm shrink-0"
              title="Send Message"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
};
