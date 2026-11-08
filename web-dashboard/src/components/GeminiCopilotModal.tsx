import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Trash2, ArrowRight, Loader2, Lightbulb, Copy, Check, TrendingUp, Package, AlertTriangle, DollarSign, Activity, Users } from 'lucide-react';
import { Product, SalesInvoice } from '../types/warehouse';
import { askGeminiWarehouseCopilot, ChatMessage } from '../lib/gemini';
import { askExecutiveCopilot } from '../services/aiService';
import { getStoredAuthSession } from '../services/storageService';
import { getStoredTenants } from '../services/tenantService';
import { useSettings } from '../context/settings-context';

interface GeminiCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  invoices: SalesInvoice[];
  lang: 'en' | 'ar';
  plan?: 'Starter' | 'Pro' | 'Enterprise';
  companyName?: string;
}

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    if (match[2]) {
      parts.push(
        <strong key={`b-${match.index}`} className="copilot-bold">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <span key={`i-${match.index}`} className="copilot-italic-chip">
          {match[3]}
        </span>
      );
    } else if (match[4]) {
      parts.push(
        <code key={`c-${match.index}`} className="copilot-code-pill">
          {match[4]}
        </code>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function FormattedCopilotMessage({ text }: { text: string }) {
  const lines = text.split('\n');
  const renderedElements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      renderedElements.push(<div key={`br-${i}`} className="copilot-line-gap" />);
      continue;
    }

    // Divider: --- or *** or ___
    if (/^[-*_]{3,}$/.test(trimmed)) {
      renderedElements.push(<hr key={`hr-${i}`} className="copilot-hr-divider" />);
      continue;
    }

    // Heading 3: ### Title
    if (trimmed.startsWith('### ')) {
      renderedElements.push(
        <h4 key={`h3-${i}`} className="copilot-h3-title">
          {parseInlineMarkdown(trimmed.slice(4))}
        </h4>
      );
      continue;
    }

    // Heading 2: ## Title
    if (trimmed.startsWith('## ')) {
      renderedElements.push(
        <h3 key={`h2-${i}`} className="copilot-h2-title">
          {parseInlineMarkdown(trimmed.slice(3))}
        </h3>
      );
      continue;
    }

    // Numbered Item: 1. or 2.
    const numMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)$/);
    if (numMatch) {
      renderedElements.push(
        <div key={`num-${i}`} className="copilot-ordered-row">
          <span className="copilot-order-badge">{numMatch[1]}</span>
          <div className="copilot-order-content">
            {parseInlineMarkdown(numMatch[2])}
          </div>
        </div>
      );
      continue;
    }

    // Bullet Item: * or -
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      renderedElements.push(
        <div key={`bullet-${i}`} className="copilot-bullet-row">
          <span className="copilot-bullet-dot">•</span>
          <div className="copilot-bullet-content">
            {parseInlineMarkdown(trimmed.slice(2))}
          </div>
        </div>
      );
      continue;
    }

    // Normal paragraph
    renderedElements.push(
      <p key={`p-${i}`} className="copilot-text-p">
        {parseInlineMarkdown(trimmed)}
      </p>
    );
  }

  return <div className="copilot-formatted-container">{renderedElements}</div>;
}

interface ExecutivePrompt {
  id: string;
  iconType: 'sales' | 'stagnant' | 'stockout' | 'cash' | 'suppliers' | 'debts';
  textAr: string;
  textEn: string;
}

const EXECUTIVE_PROMPTS: ExecutivePrompt[] = [
  {
    id: 'sales',
    iconType: 'sales',
    textAr: 'ما هي أرباح ومبيعات اليوم والأسبوع الحالي؟',
    textEn: 'What are the net profits and sales for this week?'
  },
  {
    id: 'stagnant',
    iconType: 'stagnant',
    textAr: 'ما هي الأصناف الراكدة المعطلة للسيولة النقدية؟',
    textEn: 'Which stagnant items are freezing working capital?'
  },
  {
    id: 'stockout',
    iconType: 'stockout',
    textAr: 'ما هي الأصناف التي قاربت على النفاد وتحتاج طلب؟',
    textEn: 'Which critical items are near stockout?'
  },
  {
    id: 'cash',
    iconType: 'cash',
    textAr: 'هل توجد فروقات أو عجز في صناديق الكاشير والورديات؟',
    textEn: 'Are there any cash drawer discrepancies in shifts?'
  },
  {
    id: 'suppliers',
    iconType: 'suppliers',
    textAr: 'هل رصدت أي زيادة في أسعار وتكاليف الموردين؟',
    textEn: 'Are there any price surges detected from suppliers?'
  },
  {
    id: 'debts',
    iconType: 'debts',
    textAr: 'كشف إجمالي الديون والذمم المستحقة على العملاء',
    textEn: 'What are the total receivables from credit customers?'
  }
];

export default function GeminiCopilotModal({
  isOpen,
  onClose,
  products,
  invoices,
  lang,
  plan,
  companyName
}: GeminiCopilotModalProps) {
  const { formatMoney, currencySymbol } = useSettings();
  const isAr = lang === 'ar';

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Determine Tenant & Plan Tier
  const session = getStoredAuthSession();
  const allTenants = getStoredTenants();
  const currentTenant = allTenants.find(t => t.slug.toLowerCase() === session?.tenantSlug?.toLowerCase());
  const effectivePlan = plan || currentTenant?.plan || (session?.role === 'PlatformSuperAdmin' ? 'Enterprise' : 'Enterprise');
  const effectiveCompany = companyName || currentTenant?.name || session?.tenantName || 'منشأة زيلوكس';

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'gemini',
      text: isAr
        ? `أهلاً بك في **المستشار الإداري والتنفيذي الذكي لمنظومة ZiloX Business Suite**.\nأقوم بمتابعة مؤشرات الأرباح اللحظية، وتدقيق الصناديق والورديات، وتحليل المخازن والفروع باللغة الطبيعية. كيف يمكنني إفادتك اليوم؟`
        : `Welcome to the **ZiloX Business Suite Executive AI Copilot**.\nI analyze live profit margins, cash drawer reconciliations, and warehouse turnover via natural language. How can I assist you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, loading, isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (queryToSend?: string) => {
    const q = (queryToSend || inputQuery).trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      if (effectivePlan === 'Enterprise' || session?.role === 'PlatformSuperAdmin') {
        const copilotResult = await askExecutiveCopilot(q, 'Enterprise', effectiveCompany);
        let replyText = copilotResult.data?.response || '';

        // If the query was an open strategic query or hit fallback, attempt Gemini AI for deep natural reasoning
        if (!replyText || Boolean((copilotResult.data?.metrics as any)?.isFallback)) {
          try {
            const geminiText = await askGeminiWarehouseCopilot(q, products, invoices, lang);
            if (geminiText && !geminiText.startsWith('عذراً، حدث تعذر') && !geminiText.startsWith('Sorry, an error')) {
              replyText = geminiText;
            }
          } catch {
            // Keep the structured local response
          }
        }

        const geminiMsg: ChatMessage = {
          id: `gemini-${Date.now()}`,
          sender: 'gemini',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, geminiMsg]);
      } else {
        const upgradeMsg: ChatMessage = {
          id: `gemini-${Date.now()}`,
          sender: 'gemini',
          text: isAr
            ? `**المستشار الإداري مخصص للباقة الفائقة (Enterprise - 45$):**\n\nتتيح لك الباقة الفائقة:\n* استعلامات SQL تنفيذية باللغة العربية الطبيعية\n* مراقبة أرباح وهوامش كافة الفروع لحظياً\n* رادار كشف العجز والاحتيال في صناديق الكاشير\n* خوارزميات التسكين المخزني الذكي\n\nباقتك الحالية المسجلة: **${effectivePlan === 'Starter' ? 'الأساسية (10$)' : 'المتوسطة (25$)'}**.`
            : `**Executive Copilot is exclusive to Enterprise Tier ($45/mo):**\n\nYour current tier is **${effectivePlan}**.\nUpgrade to unlock Natural Language Arabic querying, branch P&L, cashier fraud radar, and WMS slotting.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, upgradeMsg]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop fade-in" onClick={onClose} dir={isAr ? 'rtl' : 'ltr'}>
      <div 
        className="copilot-modal-content glass-panel" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="copilot-modal-header">
          <div className="copilot-header-title-box">
            <div className="copilot-avatar-badge">
              <Bot size={20} />
            </div>
            <div>
              <div className="copilot-title-row">
                <h3 className="copilot-title">
                  {isAr ? 'المستشار الإداري والتنفيذي الذكي (Executive Copilot)' : 'Executive AI Copilot'}
                </h3>
                <span className="copilot-model-chip">
                  {isAr ? 'الباقة الفائقة' : 'Enterprise AI'}
                </span>
              </div>
              <p className="copilot-subtitle">
                {isAr ? 'استعلامات تنفيذية فورية باللغة الطبيعية عن أرباح الفروع، الصناديق، وحركة المخزون' : 'Real-time Arabic natural language executive queries for branch P&L, shifts & stock turnover'}
              </p>
            </div>
          </div>

          <div className="copilot-header-actions">
            <button 
              type="button" 
              className="icon-circle-btn scanner-close-btn" 
              onClick={() => setMessages([messages[0]])}
              title={isAr ? 'مسح المحادثة' : 'Clear Chat'}
            >
              <Trash2 size={16} />
            </button>
            <button 
              type="button" 
              className="icon-circle-btn scanner-close-btn" 
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="copilot-quick-prompts-bar">
          <div className="prompt-label-wrap">
            <Lightbulb size={14} className="text-amber-500" />
            <span>{isAr ? 'استفسارات تنفيذية موجهة:' : 'Executive Inquiries:'}</span>
          </div>
          <div className="quick-prompts-scroll">
            {EXECUTIVE_PROMPTS.map((p) => {
              const text = isAr ? p.textAr : p.textEn;
              return (
                <button 
                  key={p.id}
                  type="button"
                  className="quick-prompt-pill"
                  onClick={() => handleSend(text)}
                  disabled={loading}
                >
                  <span className="pill-icon">
                    {p.iconType === 'sales' && <TrendingUp size={13} className="text-emerald-500" />}
                    {p.iconType === 'stagnant' && <Package size={13} className="text-sky-500" />}
                    {p.iconType === 'stockout' && <AlertTriangle size={13} className="text-amber-500" />}
                    {p.iconType === 'cash' && <DollarSign size={13} className="text-emerald-600" />}
                    {p.iconType === 'suppliers' && <Activity size={13} className="text-indigo-500" />}
                    {p.iconType === 'debts' && <Users size={13} className="text-blue-500" />}
                  </span>
                  <span>{text}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat Messages Body */}
        <div className="copilot-chat-body">
          {messages.map(m => {
            const isUser = m.sender === 'user';
            const isCopied = copiedId === m.id;

            return (
              <div key={m.id} className={`chat-message-row ${isUser ? 'user-row' : 'gemini-row'}`}>
                <div className={`chat-avatar ${isUser ? 'user-av' : 'gemini-av'}`}>
                  {isUser ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`chat-bubble ${isUser ? 'user-bubble' : 'gemini-bubble'}`}>
                  <div className="bubble-header">
                    <span className="sender-name">{isUser ? (isAr ? 'المستخدم' : 'User') : (isAr ? 'المساعد التحليلي' : 'Analytics Engine')}</span>
                    <div className="bubble-actions-right">
                      <span className="message-time">{m.timestamp}</span>
                      {!isUser && (
                        <button 
                          type="button"
                          className="btn-copy-bubble"
                          onClick={() => copyToClipboard(m.text, m.id)}
                          title={isAr ? 'نسخ الإجابة' : 'Copy Response'}
                        >
                          {isCopied ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                          <span>{isCopied ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="bubble-content">
                    <FormattedCopilotMessage text={m.text} />
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="chat-message-row gemini-row">
              <div className="chat-avatar gemini-av">
                <Bot size={16} />
              </div>
              <div className="chat-bubble gemini-bubble loading-bubble">
                <Loader2 size={18} className="spinner-icon text-cyan" />
                <span>{isAr ? 'جاري معالجة واستخراج المؤشرات الإحصائية...' : 'Processing and generating analytical summary...'}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="copilot-input-bar">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="copilot-input-form"
          >
            <input 
              type="text" 
              className="copilot-input-field"
              placeholder={isAr ? 'اكتب استفسارك التحليلي (مثال: ما هي الأصناف المنخفضة؟ أو لخص فواتير اليوم)...' : 'Type your analytical query (e.g. summarize low stock, list pending invoices)...'}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              disabled={loading}
            />
            <button 
              type="submit" 
              className="btn-copilot-send"
              disabled={!inputQuery.trim() || loading}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
