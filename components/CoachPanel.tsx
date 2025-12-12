import React, { useEffect, useRef, useState } from 'react';
import { ChatResponse, Message, QuizContent, DeepSlateResponse } from '../types';
import MarkdownMath from './MarkdownMath';

interface CoachPanelProps {
  initialChat: ChatResponse;
  messages: Message[];
  onSendMessage: (text: string) => void;
  isTyping: boolean;
  focusedStepIndex?: number | null;
  onMarkRevision: () => void;
  fullAnalysis?: DeepSlateResponse | null; // Pass full analysis for Code Studio
}

const QuizMessage: React.FC<{ content: QuizContent, onSubmit: (answer: string) => void }> = ({ content, onSubmit }) => {
    // ... (Keep existing implementation)
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState(false);

    const handleSelect = (qId: string, option: string) => {
        if (submitted) return;
        setSelections(prev => ({ ...prev, [qId]: option }));
    };

    const handleSubmit = () => {
        setSubmitted(true);
        const answers = content.questions.map((q, i) => 
            `Question ${i+1}: ${selections[q.id] || "No Answer"}`
        ).join('\n');
        
        onSubmit(`Here are my quiz answers:\n${answers}\n\nPlease check them and explain.`);
    };

    const allAnswered = content.questions.length > 0 && content.questions.every(q => selections[q.id]);

    return (
        <div className="space-y-4 w-full">
            <p className="text-slate-700 dark:text-slate-200 text-sm font-medium mb-2">Conceptual Quiz:</p>
            {content.questions.map((q, idx) => (
                <div key={q.id} className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 shadow-sm">
                    <div className="text-sm text-slate-800 dark:text-slate-200 mb-3 font-medium">
                        <span className="text-indigo-600 dark:text-indigo-400 mr-2">{idx + 1}.</span>
                        <MarkdownMath content={q.question} />
                    </div>
                    <div className="space-y-2">
                        {q.options.map((opt, optIdx) => (
                            <label 
                                key={optIdx} 
                                className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-all border text-sm
                                    ${selections[q.id] === opt 
                                        ? 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-200 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-100' 
                                        : 'bg-slate-50 dark:bg-slate-900/30 border-transparent hover:bg-slate-100 dark:hover:bg-slate-900/50 text-slate-600 dark:text-slate-400'}
                                    ${submitted ? 'opacity-75 cursor-default' : ''}
                                `}
                            >
                                <input 
                                    type="radio" 
                                    name={`q-${q.id}`} 
                                    value={opt}
                                    checked={selections[q.id] === opt}
                                    onChange={() => handleSelect(q.id, opt)}
                                    disabled={submitted}
                                    className="mt-1 w-3 h-3 text-indigo-600 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 focus:ring-indigo-500"
                                />
                                <span className="leading-snug"><MarkdownMath content={opt} /></span>
                            </label>
                        ))}
                    </div>
                </div>
            ))}
            {!submitted && (
                <button 
                    onClick={handleSubmit}
                    disabled={!allAnswered}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20"
                >
                    Submit Answers
                </button>
            )}
        </div>
    );
};

const CoachPanel: React.FC<CoachPanelProps> = ({ initialChat, messages, onSendMessage, isTyping, focusedStepIndex, onMarkRevision, fullAnalysis }) => {
  const [input, setInput] = useState('');
  const [marked, setMarked] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'code'>('chat');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Switch to code tab automatically if domain is coding and it's the first load
  useEffect(() => {
      if (fullAnalysis?.domain === 'CODING' && messages.length <= 3) {
          setActiveTab('code');
      }
  }, [fullAnalysis]);

  useEffect(() => {
    if (scrollRef.current && focusedStepIndex === null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, focusedStepIndex]);

  useEffect(() => {
    if (focusedStepIndex !== null && focusedStepIndex !== undefined) {
        setTimeout(() => {
             const el = stepRefs.current[focusedStepIndex];
             if (el) {
                 el.scrollIntoView({ behavior: 'smooth', block: 'center' });
             }
        }, 100); // Slight delay to ensure DOM is ready/stable
    }
  }, [focusedStepIndex]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  const handleMarkClick = () => {
      onMarkRevision();
      setMarked(true);
      setTimeout(() => setMarked(false), 2000); 
  };

  const renderMessageContent = (msg: Message) => {
      if (msg.type === 'structured_steps' && Array.isArray(msg.content)) {
          return (
            <div className="space-y-3">
                <p className="text-slate-700 dark:text-slate-200 text-sm font-medium mb-2">Analysis Breakdown:</p>
                {msg.content.map((step, i) => (
                    <div 
                        key={i} 
                        ref={el => { stepRefs.current[i] = el; }}
                        className={`relative p-3 rounded-xl border text-sm text-slate-700 dark:text-slate-300 text-left transition-all duration-300
                            ${focusedStepIndex === i 
                                ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-400 ring-2 ring-amber-400/50 shadow-lg scale-[1.02] z-10' 
                                : 'bg-white/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800/60'}`}
                    >
                        <div className={`absolute -left-2 top-3 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono transition-colors
                            ${focusedStepIndex === i 
                                ? 'bg-amber-500 border-amber-600 text-white shadow-lg' 
                                : 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300'}`}
                        >
                            {i + 1}
                        </div>
                        <div className="pl-4">
                            <MarkdownMath content={step} />
                        </div>
                    </div>
                ))}
            </div>
          );
      } else if (msg.type === 'quiz') {
          return <QuizMessage content={msg.content as QuizContent} onSubmit={onSendMessage} />;
      } else {
          return (
            <div className={`inline-block p-3 rounded-2xl text-sm leading-relaxed text-left shadow-sm dark:shadow-none
                ${msg.role === 'assistant' 
                    ? 'bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 rounded-tl-none' 
                    : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 dark:shadow-indigo-900/50 rounded-tr-none'}`}
            >
                <MarkdownMath content={msg.content as string} />
            </div>
          );
      }
  };

  return (
    <div className="bg-white/80 dark:bg-[#0f172a]/75 backdrop-blur-xl rounded-[18px] border border-slate-200 dark:border-slate-700/40 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col h-full min-h-[400px] transition-colors">
      
      {/* Header with Tabs */}
      <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700/40 bg-indigo-50 dark:bg-indigo-600/10 flex justify-between items-center transition-colors">
        <h2 className="text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            DeepCoach
        </h2>
        {fullAnalysis?.domain === 'CODING' && (
            <div className="flex bg-white dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700/50">
                <button 
                   onClick={() => setActiveTab('chat')}
                   className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition-all ${activeTab === 'chat' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    Chat
                </button>
                <button 
                   onClick={() => setActiveTab('code')}
                   className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition-all ${activeTab === 'code' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    Code Studio
                </button>
            </div>
        )}
      </div>

      {/* CHAT TAB CONTENT */}
      {activeTab === 'chat' && (
        <>
            <div ref={scrollRef} className="p-6 space-y-6 flex-grow overflow-y-auto custom-scrollbar">
                {messages.map((msg, msgIdx) => {
                    if (msg.role === 'user' && typeof msg.content === 'string' && msg.content.startsWith("Here are my quiz answers:")) return null;
                    return (
                        <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold border ${msg.role === 'assistant' ? 'bg-indigo-100 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30' : 'bg-slate-200 dark:bg-slate-600/20 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-500/30'}`}>
                                {msg.role === 'assistant' ? 'DS' : 'ME'}
                            </div>
                            <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                                {renderMessageContent(msg)}
                            </div>
                        </div>
                    );
                })}
                {isTyping && (
                    <div className="flex gap-4 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-600/20 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold">DS</div>
                        <div className="bg-white dark:bg-slate-800/50 p-3 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700/50 flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-100"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="border-t border-slate-200 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col transition-colors">
                {!isTyping && (
                    <div className="px-4 pt-3 flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                        <button onClick={() => onSendMessage("Generate a short conceptual quiz (3 questions) based on the analysis of this problem.")} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-500/20 text-xs font-medium transition-all">
                            <span>📝</span><span>Take Concept Quiz</span>
                        </button>
                        <button onClick={handleMarkClick} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-medium ${marked ? 'bg-amber-200 dark:bg-amber-600/30 border-amber-300 text-amber-900 dark:text-amber-100' : 'bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-500/20'}`}>
                            <span>{marked ? '✓' : '🔖'}</span><span>{marked ? 'Marked!' : 'Mark for Revision'}</span>
                        </button>
                    </div>
                )}
                <div className="p-4">
                    <form onSubmit={handleSubmit} className="relative">
                        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a follow-up..." disabled={isTyping} className="w-full h-10 bg-white dark:bg-slate-800/50 rounded-full border border-slate-300 dark:border-slate-700/50 pl-4 pr-10 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                        <button type="submit" disabled={!input.trim() || isTyping} className="absolute right-1 top-1 w-8 h-8 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-lg transition-colors disabled:opacity-50"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>
                    </form>
                </div>
            </div>
        </>
      )}

      {/* CODE STUDIO TAB */}
      {activeTab === 'code' && fullAnalysis?.code_solution && (
          <div className="flex flex-col h-full overflow-hidden bg-slate-900">
              <div className="p-2 bg-slate-950 flex justify-between items-center border-b border-slate-800">
                  <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">main.{fullAnalysis.code_solution.language === 'python' ? 'py' : 'js'}</span>
              </div>
              <div className="flex-grow overflow-auto p-4 custom-scrollbar font-mono text-sm">
                  <pre className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {fullAnalysis.code_solution.code}
                  </pre>
              </div>
              <div className="border-t border-slate-800 bg-slate-950 p-4">
                  <div className="flex justify-between items-center mb-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Compiler Output</h4>
                      <button className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded font-medium flex items-center gap-1 transition-colors">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Run
                      </button>
                  </div>
                  <div className="bg-black/50 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400">
                      {fullAnalysis.code_solution.output}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-[10px] text-slate-500 block uppercase">Time Complexity</span>
                          <span className="text-xs text-slate-300 font-mono">{fullAnalysis.code_solution.time_complexity}</span>
                      </div>
                      <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-[10px] text-slate-500 block uppercase">Space Complexity</span>
                          <span className="text-xs text-slate-300 font-mono">{fullAnalysis.code_solution.space_complexity}</span>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default CoachPanel;