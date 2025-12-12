import React, { useState, useEffect, useRef } from 'react';
import { analyzeProblem, askFollowUpQuestion } from './services/geminiService';
import { AnalysisResult, Message, User, ReasoningNode } from './types';
import ConceptGraph from './components/ConceptGraph';
import StepAnalysis from './components/StepAnalysis';
import CoachPanel from './components/CoachPanel';
import MarkdownMath from './components/MarkdownMath';
import FlashcardDeck from './components/FlashcardDeck';

// Types for Google Picker API & Speech API
declare global {
  interface Window {
    gapi: any;
    google: any;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Google Translate Icon
const GoogleTranslateIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
       <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
    </svg>
);

// Supported Languages for Custom Panel
const LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱' },
    { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
    { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
    { code: 'th', name: 'Thai', flag: '🇹🇭' },
];

const LanguageSelector: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    // Filter languages
    const filteredLangs = LANGUAGES.filter(l => 
        l.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const changeLanguage = (langCode: string) => {
        const setLanguage = () => {
             // Target the specific Google Translate Combo Box
             const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement;
             if (combo) {
                 combo.value = langCode;
                 // Dispatch events to trigger the change detection in Google's script
                 combo.dispatchEvent(new Event('change', { bubbles: true }));
                 combo.dispatchEvent(new Event('input', { bubbles: true }));
                 return true;
             }
             return false;
        };

        if (!setLanguage()) {
            // Poll for it briefly
            const interval = setInterval(() => {
                if (setLanguage()) clearInterval(interval);
            }, 300);
            
            setTimeout(() => clearInterval(interval), 3000);
        }
        
        onClose();
    };

    return (
        <div className="absolute top-16 right-0 z-50 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div className="relative">
                    <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input 
                        type="text" 
                        placeholder="Search language..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                </div>
            </div>
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
                {filteredLangs.length > 0 ? (
                    filteredLangs.map((lang) => (
                        <button 
                            key={lang.code}
                            onClick={() => changeLanguage(lang.code)}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors border-b border-slate-50 dark:border-slate-700/30 last:border-0"
                        >
                            <span className="text-xl">{lang.flag}</span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{lang.name}</span>
                        </button>
                    ))
                ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                        No languages found.
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper Component for Insights
const UserInsights: React.FC<{ history: AnalysisResult[] }> = ({ history }) => {
    if (!history || history.length === 0) return null;

    // Simple logic to extract keywords from history
    // In a real app, this would be computed by the backend/AI
    const misconceptions = history
        .flatMap(h => h.parsedData?.misconception_graph?.nodes || [])
        .filter(n => n.type === 'misconception')
        .map(n => n.label)
        .slice(0, 3); // Top 3

    const strengths = history
        .filter(h => !h.parsedData?.misconception_graph?.nodes.some(n => n.type === 'misconception'))
        .flatMap(h => h.parsedData?.reasoning_graph?.nodes || [])
        .map(n => n.label)
        .slice(0, 3); // Top 3 from successful problems

    // Fallback if empty (mocking for demo if history has no explicit graph data yet)
    const displayWeaknesses = misconceptions.length > 0 ? misconceptions : ["Chain Rule", "Edge Cases"];
    const displayStrengths = strengths.length > 0 ? strengths : ["Logic Setup", "Basic Arithmetic"];

    return (
        <div className="grid grid-cols-2 gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl p-4">
                <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Strengths
                </h3>
                <div className="flex flex-wrap gap-2">
                    {displayStrengths.map((s, i) => (
                        <span key={i} className="px-2.5 py-1 bg-white dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-md shadow-sm border border-emerald-100 dark:border-emerald-500/30">
                            {s}
                        </span>
                    ))}
                </div>
            </div>
            <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-500/20 rounded-2xl p-4">
                <h3 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Places to Improve
                </h3>
                <div className="flex flex-wrap gap-2">
                    {displayWeaknesses.map((w, i) => (
                        <span key={i} className="px-2.5 py-1 bg-white dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-semibold rounded-md shadow-sm border border-red-100 dark:border-red-500/30">
                            {w}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  // User & History State
  const [user, setUser] = useState<User | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // App Logic State
  const [file, setFile] = useState<File | null>(null);
  const [studentText, setStudentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // View State for Graph
  const [graphViewMode, setGraphViewMode] = useState<'reasoning' | 'flashcards'>('reasoning');
  const [showTranslate, setShowTranslate] = useState(false);

  // Drive/Import State
  const [isImporting, setIsImporting] = useState(false);

  // Google Drive Auth Config (Initialized from Env)
  const [driveConfig] = useState({
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    apiKey: process.env.GOOGLE_API_KEY || '',
  });
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Ref to hold token for callbacks to avoid stale closures
  const accessTokenRef = useRef<string | null>(null);

  const [pickerInited, setPickerInited] = useState(false);
  const [gisInited, setGisInited] = useState(false);
  const tokenClient = useRef<any>(null);
  
  // Revision State
  const [showRevisionBank, setShowRevisionBank] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [focusedStepIndex, setFocusedStepIndex] = useState<number | null>(null);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // Accessibility State
  const [accessibilityMode, setAccessibilityMode] = useState<'default' | 'dyslexia' | 'adhd'>('default');
  
  // Voice & Speech State
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null); // Ref for SpeechRecognition instance

  // Resizable Panels State
  const [widths, setWidths] = useState([35, 30, 35]); // Percentages
  const isResizing = useRef<number | null>(null);

  // Theme Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Stop speaking when component unmounts or result clears
  useEffect(() => {
    return () => {
        window.speechSynthesis.cancel();
        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }
    };
  }, []);

  // Initialize Google APIs
  useEffect(() => {
    const loadGoogleApis = () => {
        if (!window.gapi || !window.google) return;
        
        window.gapi.load('picker', () => {
            setPickerInited(true);
        });
    };
    
    // Check periodically if scripts are loaded
    const interval = setInterval(() => {
        if (window.gapi && window.google) {
            clearInterval(interval);
            loadGoogleApis();
            setGisInited(true);
        }
    }, 500);
    
    return () => clearInterval(interval);
  }, []);

  // Handle Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (isResizing.current === null) return;
        
        const totalWidth = window.innerWidth;
        const index = isResizing.current;
        const deltaPercentage = (e.movementX / totalWidth) * 100;
        
        setWidths(prev => {
            const newWidths = [...prev];
            // If resizing divider 0 (between panel 0 and 1)
            if (index === 0) {
                if (newWidths[0] + deltaPercentage > 10 && newWidths[1] - deltaPercentage > 10) {
                    newWidths[0] += deltaPercentage;
                    newWidths[1] -= deltaPercentage;
                }
            } 
            // If resizing divider 1 (between panel 1 and 2)
            else if (index === 1) {
                if (newWidths[1] + deltaPercentage > 10 && newWidths[2] - deltaPercentage > 10) {
                    newWidths[1] += deltaPercentage;
                    newWidths[2] -= deltaPercentage;
                }
            }
            return newWidths;
        });
    };

    const handleMouseUp = () => {
        isResizing.current = null;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
    };

    if (result) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [result]);

  const startResize = (index: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = index;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDirectDriveUpload = () => {
      // Check if we already have a valid token
      if (accessTokenRef.current && pickerInited) {
          createPicker(accessTokenRef.current);
      } else {
          // If not, trigger auth flow, then open picker
          handleAuthClick(true);
      }
  };

  // --- VOICE INPUT (Speech-to-Text) ---
  const toggleVoiceInput = () => {
    if (isListening) {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Your browser does not support voice input. Please use Chrome or Edge.");
        return;
    }

    // Reuse or create instance
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        setIsListening(true);
        setError(null);
    };

    recognition.onend = () => {
        setIsListening(false);
    };

    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setStudentText(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
            setIsListening(false);
            return; // Ignore "no speech" error to prevent console spam
        }
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            setError("Microphone access denied. Please allow microphone permissions in your browser.");
        } else {
            setError(`Speech recognition error: ${event.error}`);
        }
    };

    try {
        recognition.start();
    } catch (e) {
        console.error(e);
        setIsListening(false);
    }
  };

  // --- READ OUT LOUD (Text-to-Speech) ---
  const toggleReadAloud = () => {
      if (isSpeaking) {
          window.speechSynthesis.cancel();
          setIsSpeaking(false);
          return;
      }

      if (!result?.parsedData) return;

      const data = result.parsedData;
      
      // Construct a script to read
      let script = `Problem Summary. ${cleanMarkdownForSpeech(data.problem_summary.short_text)}. `;
      script += `Goal: ${cleanMarkdownForSpeech(data.problem_summary.question)}. `;
      
      script += `Here is the Step by Step Analysis. `;
      data.student_analysis.forEach((step, index) => {
          script += `Step ${index + 1}. ${cleanMarkdownForSpeech(step.explanation)}. `;
          script += `Feedback: ${cleanMarkdownForSpeech(step.feedback)}. `;
      });

      const utterance = new SpeechSynthesisUtterance(script);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
  };

  const cleanMarkdownForSpeech = (text: string | null | undefined) => {
      if (!text) return '';
      // Remove basic markdown symbols that sound weird
      return text
        .replace(/\*\*/g, '') // Bold
        .replace(/\$\$/g, '') // Block Math
        .replace(/\$/g, '')   // Inline Math
        .replace(/\\/g, ' ')  // Backslashes
        .replace(/_/g, ' ')   // Underscores
        .replace(/frac/g, 'fraction')
        .replace(/sqrt/g, 'square root');
  };

  // --- AUTHENTICATION & DRIVE LOGIC ---

  const handleLogin = (provider: 'google' | 'email') => {
      if (provider === 'email') {
          // Mock Email Login
          setTimeout(() => {
            setUser({
                name: "Student",
                avatar: "S",
                xp: 350,
                level: 3,
                unlockedNodes: ['arrays', 'linked-lists', 'basic-math'],
                history: [],
                revisionList: []
            });
          }, 500);
      } else {
          // Google Login
          handleAuthClick(false);
      }
  };

  const handleLogout = () => {
      handleReset();
      setUser(null);
      setAccessToken(null);
      accessTokenRef.current = null;
      if (window.google?.accounts?.oauth2) {
          // Revoke is optional but good for clean logout
          // Note: we just clear local state mostly
      }
      setShowProfileMenu(false);
  };

  const fetchGoogleProfile = async (token: string) => {
      try {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
              const data = await res.json();
              setUser({
                  name: data.name,
                  avatar: data.given_name ? data.given_name.charAt(0) : "G",
                  xp: 120,
                  level: 1,
                  unlockedNodes: ['arrays'],
                  history: [],
                  revisionList: []
              });
          }
      } catch (e) {
          console.error("Failed to fetch google profile", e);
      }
  };

  const handleAuthClick = (openPickerAfter: boolean = false) => {
      if (!driveConfig.clientId || !driveConfig.apiKey) {
          if (openPickerAfter) {
            setError("Google Drive integration requires Client ID and API Key configuration in environment.");
          }
          if (!openPickerAfter) {
               handleLogin('email');
          }
          return;
      }

      const callback = async (response: any) => {
          if (response.error !== undefined) {
              throw (response);
          }
          setAccessToken(response.access_token);
          accessTokenRef.current = response.access_token;
          
          await fetchGoogleProfile(response.access_token);
          
          if (openPickerAfter) {
             createPicker(response.access_token);
          }
      };

      if (!tokenClient.current) {
          tokenClient.current = window.google.accounts.oauth2.initTokenClient({
              client_id: driveConfig.clientId,
              scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
              callback: '', 
          });
      }

      tokenClient.current.callback = callback;
      tokenClient.current.requestAccessToken({ prompt: '' });
  };

  const createPicker = (token: string) => {
      if (pickerInited && token) {
          const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
          view.setMimeTypes("application/pdf,application/vnd.google-apps.presentation,application/vnd.google-apps.spreadsheet,application/vnd.google-apps.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg");
          
          const picker = new window.google.picker.PickerBuilder()
              .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
              .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
              .setDeveloperKey(driveConfig.apiKey)
              .setAppId(driveConfig.clientId)
              .setOAuthToken(token)
              .addView(view)
              .addView(new window.google.picker.DocsUploadView())
              .setCallback(pickerCallback)
              .build();
          picker.setVisible(true);
      }
  };

  const pickerCallback = async (data: any) => {
      if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
          const doc = data[window.google.picker.Response.DOCUMENTS][0];
          const fileId = doc[window.google.picker.Document.ID];
          const mimeType = doc[window.google.picker.Document.MIME_TYPE];
          const name = doc[window.google.picker.Document.NAME];
          const token = accessTokenRef.current;
          
          if (token) {
              await downloadDriveFile(fileId, mimeType, name, token);
          } else {
              setError("Session expired. Please reconnect to Google Drive.");
          }
      }
  };

  const downloadDriveFile = async (fileId: string, mimeType: string, name: string, token: string) => {
      setIsImporting(true);
      setError(null);
      try {
          let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
          let finalName = name;
          let finalMime = mimeType;

          if (mimeType === 'application/vnd.google-apps.presentation') {
              url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.presentationml.presentation`;
              finalName = name.endsWith('.pptx') ? name : `${name}.pptx`;
              finalMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          } else if (mimeType === 'application/vnd.google-apps.document') {
              url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
              finalName = name.endsWith('.pdf') ? name : `${name}.pdf`;
              finalMime = 'application/pdf';
          } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
              url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
              finalName = name.endsWith('.pdf') ? name : `${name}.pdf`;
              finalMime = 'application/pdf';
          }

          const response = await fetch(url, {
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          });

          if (!response.ok) {
              throw new Error(`Failed to download file (Status ${response.status}). Ensure you have permissions.`);
          }

          const blob = await response.blob();
          const importedFile = new File([blob], finalName, { type: finalMime });
          
          setFile(importedFile);
      } catch (e: any) {
          console.error("Drive Download Error", e);
          let msg = "Failed to download selected file.";
          if (e.message.includes('Failed to fetch') || e.name === 'TypeError') {
               msg = "Network Error: Unable to fetch file from Google. This is often due to 3rd party cookie blocking or CORS issues. Please check your browser settings.";
          } else {
              msg = e.message;
          }
          setError(msg);
      } finally {
          setIsImporting(false);
      }
  };

  const handleReset = () => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setFile(null);
      setStudentText('');
      setResult(null);
      setError(null);
      setMessages([]);
      setWidths([35, 30, 35]); 
      setFocusedStepIndex(null);
      setShowRevisionBank(false);
      setGraphViewMode('reasoning'); // Reset view mode
  };

  const handleAnalyze = async () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    
    if (!file && !studentText.trim()) {
      setError("Please provide an image, document, OR text description.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setFocusedStepIndex(null);
    setGraphViewMode('reasoning');

    try {
      // Pass the current accessibility mode to the AI service to get scientifically adapted content
      const data = await analyzeProblem(file, studentText, accessibilityMode);
      
      if (user) {
          const updatedHistory = [data, ...user.history];
          // Simulate XP gain
          const newXP = (user.xp || 0) + 50;
          const newLevel = Math.floor(newXP / 100) + 1;
          setUser({ ...user, history: updatedHistory, xp: newXP, level: newLevel });
      }

      setResult(data);

      if (data.parsedData) {
        // Use either explicit student_analysis or construct a default if missing (fallback handled in service now)
        const stepsContent = data.parsedData.student_analysis.map(s => s.explanation);
        
        const initialMessages: Message[] = [
            { id: 'init-1', role: 'assistant', type: 'text', content: data.parsedData.chat_response.opening },
            { id: 'init-2', role: 'assistant', type: 'structured_steps', content: stepsContent },
            { id: 'init-3', role: 'assistant', type: 'text', content: data.parsedData.chat_response.encouragement }
        ];
        setMessages(initialMessages);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong during analysis.");
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryClick = (item: AnalysisResult) => {
      setResult(item);
      setFocusedStepIndex(null);
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      if (item.parsedData) {
        const stepsContent = item.parsedData.student_analysis.map(s => s.explanation);
        setMessages([
            { id: 'hist-1', role: 'assistant', type: 'text', content: item.parsedData.chat_response.opening },
            { id: 'hist-2', role: 'assistant', type: 'structured_steps', content: stepsContent },
            { id: 'hist-3', role: 'assistant', type: 'text', content: item.parsedData.chat_response.encouragement }
        ]);
      }
      setShowRevisionBank(false); 
  };
  
  const handleMarkRevision = () => {
      if (user && result) {
          if (user.revisionList.some(item => item.id === result.id)) {
              return;
          }
          const updatedRevisionList = [result, ...user.revisionList];
          setUser({ ...user, revisionList: updatedRevisionList });
      }
  };

  const handleSendMessage = async (text: string) => {
      if (!result?.parsedData) return;

      const userMsg: Message = { id: Date.now().toString(), role: 'user', type: 'text', content: text };
      setMessages(prev => [...prev, userMsg]);
      setIsTyping(true);

      try {
          const chatHistory = messages
            .filter(m => m.type === 'text')
            .map(m => ({ role: m.role, content: m.content as string }));

          const response = await askFollowUpQuestion(result.parsedData, chatHistory, text);
          
          const aiMsg: Message = { 
              id: (Date.now() + 1).toString(), 
              role: 'assistant', 
              type: response.type, 
              content: response.content 
          };
          setMessages(prev => [...prev, aiMsg]);
      } catch (e) {
          console.error(e);
      } finally {
          setIsTyping(false);
      }
  };

  const handleGraphNodeClick = (node: ReasoningNode) => {
     if (!node || !node.id) {
         setFocusedStepIndex(null);
         return;
     }

     if (result?.parsedData?.student_analysis) {
         // Helper to extract numeric part of ID (e.g., "step1" -> 1, "S1" -> 1)
         const getNum = (str: string) => {
             const match = str.match(/\d+/);
             return match ? parseInt(match[0], 10) : -1;
         };

         const nodeIdNum = getNum(node.id);
         
         // 1. Try to find an item in student_analysis where step_id's number matches the node's number
         let index = result.parsedData.student_analysis.findIndex(s => getNum(s.step_id) === nodeIdNum);
         
         // 2. Fallback: direct ID match
         if (index === -1) {
             index = result.parsedData.student_analysis.findIndex(s => s.step_id === node.id);
         }

         // 3. Fallback: if student_analysis has items but we couldn't match by ID, 
         // try matching by order. If graph node has an index (D3 datum) or just use the node number
         // This is useful for "process-1" mapping to 1st step
         if (index === -1) {
             // If we found a number in the node ID, try to use it as 1-based index
             if (nodeIdNum > 0 && nodeIdNum <= result.parsedData.student_analysis.length) {
                 index = nodeIdNum - 1; 
             }
         }
         
         if (index !== -1) {
             setFocusedStepIndex(index);
         } else {
             setFocusedStepIndex(null);
         }
     } else {
         setFocusedStepIndex(null);
     }
  };

  const renderFilePreview = (f: File) => {
      const type = f.type;
      if (type.includes('pdf')) {
          return (
            <div className="flex flex-col items-center justify-center p-4">
                 <svg className="w-12 h-12 text-red-500 mb-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2H17L21 6V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V4C3 2.9 3.9 2 5 2M17 7V3L20.5 7H17M11.2 16.7L12.5 15.5L14.7 17.7L17.5 13L19 14.5L14.7 20L11.2 16.7Z" /></svg>
                 <span className="text-xs text-slate-500 dark:text-slate-300 font-semibold truncate max-w-[200px]">{f.name}</span>
                 <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">PDF Document</span>
            </div>
          );
      }
      if (type.includes('presentation') || type.includes('powerpoint')) {
          return (
             <div className="flex flex-col items-center justify-center p-4">
                 <svg className="w-12 h-12 text-orange-500 mb-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 2C3.9 2 3 2.9 3 4V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V8L15 2H5M13 9H18.5L13 3.5V9M6 12H18V14H6V12M6 16H18V18H6V16Z" /></svg>
                 <span className="text-xs text-slate-500 dark:text-slate-300 font-semibold truncate max-w-[200px]">{f.name}</span>
                 <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">PowerPoint</span>
            </div>
          );
      }
      return (
        <div className="text-center">
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mb-2">Ready: {f.name}</p>
            <img src={URL.createObjectURL(f)} alt="Preview" className="h-24 object-contain rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
        </div>
      );
  };

  // --- LOGIN SCREEN ---
  if (!user) {
      return (
          <div className="min-h-screen font-sans flex flex-col items-center justify-center bg-slate-50 dark:bg-[#050816] text-slate-900 dark:text-slate-200 p-6 relative overflow-hidden">
             {/* Background Decoration */}
             <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                 <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
                 <div className="absolute top-40 -left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl"></div>
             </div>

             <div className="max-w-md w-full bg-white/50 dark:bg-[#0f172a]/50 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-2xl p-8 text-center relative z-10">
                 <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/30">
                     <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                        <rect x="4" y="4" width="24" height="24" rx="6" fill="currentColor" fillOpacity="0.1"/>
                        <path d="M16 8L24 16L16 24L8 16L16 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 12L20 16L16 20L12 16L16 12Z" fill="currentColor"/>
                    </svg>
                 </div>
                 <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">DeepSlate Tutor</h1>
                 <p className="text-slate-500 dark:text-slate-400 mb-8">Sign in to start your reasoning journey.</p>
                 
                 <div className="space-y-4">
                     <button 
                        onClick={() => handleLogin('google')}
                        className="w-full py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center justify-center gap-3 transition-all group"
                     >
                         <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                         </svg>
                         <span className="font-medium text-slate-700 dark:text-slate-200">Continue with Google</span>
                     </button>
                     <button 
                        onClick={() => handleLogin('email')}
                        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-medium flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-500/20"
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                         <span>Continue with Email</span>
                     </button>
                 </div>
                 <div className="mt-8 text-xs text-slate-400">
                     By continuing, you agree to DeepSlate's Terms of Service and Privacy Policy.
                 </div>
             </div>
          </div>
      );
  }

  // --- MAIN APP ---
  return (
    <div className="min-h-screen font-sans selection:bg-indigo-500/30 overflow-hidden flex flex-col bg-slate-50 dark:bg-[#050816] text-slate-900 dark:text-slate-200 transition-colors duration-300">
      
      {/* Strict Accessibility Styles */}
      <style>{`
        ${accessibilityMode === 'dyslexia' ? `
          /* Dyslexia Mode Rules */
          body, p, h1, h2, h3, h4, h5, h6, span, div, input, textarea, button, a, li {
            font-family: 'Atkinson Hyperlegible', 'Verdana', sans-serif !important;
            letter-spacing: 0.12em !important;
            word-spacing: 0.16em !important;
            line-height: 1.6 !important;
          }
          
          /* Limit line length & improve alignment */
          p, li {
            max-width: 65ch !important;
            text-align: left !important;
            margin-bottom: 1.5em !important;
          }
          
          /* Soft Colors: Replace Pure Black/White */
          .bg-white, .dark .bg-[#050816], .dark .bg-slate-900 {
            background-color: #fdfdf0 !important;
            color: #333333 !important;
          }
          .text-slate-900, .dark .text-slate-200, .dark .text-white {
             color: #333333 !important;
          }
          
          /* Disable Animations */
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
          }
          
          /* No Italics */
          em, i, .italic {
            font-style: normal !important;
          }
          
          /* Input Assistance */
          input, textarea {
             background-color: #fff !important;
             color: #000 !important;
             border: 2px solid #ccc !important;
          }
        ` : ''}

        ${accessibilityMode === 'adhd' ? `
          /* ADHD Focus Mode Rules */
          
          /* Reduce Visual Noise - Hide Decorative Blobs */
          .absolute.blur-3xl, .bg-gradient-to-r {
            display: none !important;
          }
          
          /* FIXED: Ensure Title is Visible (Override transparent text clip) */
          h1.text-transparent {
             background: none !important;
             -webkit-text-fill-color: initial !important;
             color: ${isDarkMode ? '#e2e8f0' : '#1e293b'} !important;
          }
          
          /* FLATTEN CONTAINERS: Remove Blur, Set Solid Background */
          .backdrop-blur-xl, .backdrop-blur-md, .backdrop-blur-sm, .backdrop-blur {
              backdrop-filter: none !important;
              background-color: ${isDarkMode ? '#0f172a' : '#ffffff'} !important;
              box-shadow: none !important;
              border: 1px solid ${isDarkMode ? '#334155' : '#cbd5e1'} !important;
          }
          
          /* Ensure upload container is solid and visible */
          label[class*="border-dashed"] {
             background-color: ${isDarkMode ? '#1e293b' : '#f8fafc'} !important;
             opacity: 1 !important;
             border: 2px dashed ${isDarkMode ? '#475569' : '#cbd5e1'} !important;
          }

          /* Strong Focus Indicators */
          *:focus-visible {
            outline: 4px solid #F59E0B !important;
            outline-offset: 2px !important;
            box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.3) !important;
          }
          
          /* Chunking: spacing */
          p, li, .step {
             margin-bottom: 24px !important;
          }
          
          /* Hide non-essential decorative animations */
          .animate-pulse, .animate-spin, .animate-bounce {
             animation: none !important;
             opacity: 1 !important;
          }
          
          /* Clearer Buttons */
          button {
             font-weight: 700 !important;
             text-transform: uppercase !important;
             letter-spacing: 0.05em !important;
          }
        ` : ''}
      `}</style>

      {/* Navbar */}
      <nav className="border-b border-slate-200 dark:border-slate-700/40 bg-white/80 dark:bg-[#050816]/80 backdrop-blur-md z-50 flex-shrink-0 transition-colors duration-300">
        <div className="w-full px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-6">
              <div className="flex items-center gap-2.5 cursor-pointer group" onClick={handleReset}>
                <div className="w-8 h-8 text-indigo-600 dark:text-indigo-400 transition-transform group-hover:scale-110">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="4" y="4" width="24" height="24" rx="6" fill="currentColor" fillOpacity="0.1"/>
                        <path d="M16 8L24 16L16 24L8 16L16 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 12L20 16L16 20L12 16L16 12Z" fill="currentColor"/>
                    </svg>
                </div>
                <span className="font-bold text-xl text-slate-800 dark:text-slate-100 tracking-tight">DeepSlate</span>
              </div>
              
              {result && (
                <div className="hidden md:flex items-center gap-3">
                    <button 
                      onClick={handleReset}
                      className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-medium transition-all border border-slate-200 dark:border-slate-700 hover:border-indigo-500/50"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
                       Solve Another
                    </button>
                    
                    {/* Read Out Loud Button */}
                    <button 
                        onClick={toggleReadAloud}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all border
                            ${isSpeaking 
                                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}`}
                    >
                        {isSpeaking ? 'Stop Reading' : 'Read Aloud'}
                    </button>
                </div>
              )}
          </div>
          
          <div className="flex items-center gap-4 relative">
               
               <button 
                  onClick={() => setShowTranslate(!showTranslate)}
                  className={`p-2 rounded-full transition-colors ${showTranslate ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  title="Translate Page"
               >
                   <GoogleTranslateIcon className="w-5 h-5" />
               </button>

               {/* Custom Language Panel Popover */}
               {showTranslate && <LanguageSelector onClose={() => setShowTranslate(false)} />}

               <button 
                  onClick={() => setShowRevisionBank(true)}
                  className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
               >
                  <span>🔖</span> Revision Questions
               </button>

               {/* Theme Toggle */}
               <button 
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-2 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
               >
                 {isDarkMode ? '☀️' : '🌙'}
               </button>

               <div className="relative">
                   <button 
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-full border border-slate-200 dark:border-slate-700/50 hover:border-indigo-500/50 transition-colors"
                   >
                       <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white uppercase">{user.avatar}</div>
                       <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{user.name}</span>
                       <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                   </button>
                   
                   {/* Profile Dropdown */}
                   {showProfileMenu && (
                       <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                           <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                               <p className="text-sm font-semibold text-slate-800 dark:text-white">{user.name}</p>
                               <p className="text-xs text-slate-500 truncate">Student Account</p>
                           </div>
                           <button 
                               onClick={handleLogout}
                               className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                           >
                               <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                               Log Out
                           </button>
                       </div>
                   )}
               </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        
        {/* VIEW: Dashboard / Upload */}
        {!result && !loading && (
          <div className="w-full h-full overflow-y-auto custom-scrollbar p-8">
              <div className="max-w-5xl mx-auto mt-10 grid grid-cols-1 md:grid-cols-2 gap-12 animate-in fade-in zoom-in duration-700">
                
                {/* Left: Input Form */}
                <div>
                    {/* Accessibility Toggle */}
                    <div className="flex flex-wrap gap-3 mb-8 justify-center md:justify-start">
                        <button onClick={() => setAccessibilityMode('default')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${accessibilityMode === 'default' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 ring-2 ring-offset-2 ring-slate-400' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'}`}><span>✨</span> Default</button>
                        <button onClick={() => { setAccessibilityMode('dyslexia'); setIsDarkMode(false); }} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${accessibilityMode === 'dyslexia' ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-offset-2 ring-amber-400 font-bold' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-slate-700'}`}><span className="text-sm font-serif">Aa</span> Dyslexia Friendly</button>
                        <button onClick={() => setAccessibilityMode('adhd')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${accessibilityMode === 'adhd' ? 'bg-teal-100 text-teal-900 border-teal-300 ring-2 ring-offset-2 ring-teal-400 font-bold' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-teal-50 dark:hover:bg-slate-700'}`}><span>🎯</span> ADHD Focus</button>
                    </div>

                    <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 dark:from-indigo-400 dark:via-violet-400 dark:to-indigo-400 mb-6 drop-shadow-sm pb-2">
                    Reason Deeper.
                    </h1>
                    
                    {/* User Insights Section - Conditionally Rendered */}
                    {user && user.history.length > 0 && <UserInsights history={user.history} />}

                    <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 leading-relaxed font-light">
                    DeepSlate reconstructs your reasoning graph, finds logic gaps, <br/> and coaches you Socratic-style.
                    </p>

                    <div className="bg-white/50 dark:bg-[#0f172a]/50 backdrop-blur-xl p-8 rounded-[24px] shadow-2xl border border-slate-200 dark:border-slate-700/40 text-left transition-colors">
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">1. Upload Material</label>
                            <span className="text-[10px] text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded">PDF, PPT, Images</span>
                        </div>
                        
                        <div className="flex gap-4">
                            {/* Local File Dropzone */}
                            <label className="flex-1 flex flex-col items-center justify-center h-40 border-2 border-slate-300 dark:border-slate-700/50 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all group relative overflow-hidden">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    {file ? (
                                        renderFilePreview(file)
                                    ) : (
                                        <>
                                            <div className="flex gap-2 mb-3 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                                                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                            </div>
                                            <p className="mb-1 text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200">Local File</p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-600">Drag PDF, PPT, or Image</p>
                                        </>
                                    )}
                                </div>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.ppt,.pptx" 
                                    onChange={handleFileChange} 
                                />
                                {file && (
                                    <button 
                                        onClick={(e) => { e.preventDefault(); setFile(null); }}
                                        className="absolute top-2 right-2 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-red-500 p-1 rounded-full z-10 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                )}
                            </label>

                            {/* Direct Google Drive Button */}
                            <button 
                                onClick={handleDirectDriveUpload}
                                disabled={isImporting}
                                className="w-1/3 flex flex-col items-center justify-center h-40 border-2 border-slate-300 dark:border-slate-700/50 rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:border-blue-500/50 transition-all group disabled:opacity-50"
                            >
                                <div className="mb-3 p-2 bg-white dark:bg-white/5 rounded-full group-hover:bg-white/80 dark:group-hover:bg-white/10 transition-colors shadow-sm dark:shadow-none h-10 w-10 flex items-center justify-center overflow-hidden">
                                    <img 
                                        src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" 
                                        alt="Google Drive" 
                                        className="w-full h-full object-contain" 
                                    />
                                </div>
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200">
                                    {isImporting ? 'Opening...' : 'Google Drive'}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-600">
                                    Direct Upload
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="mb-8">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">2. Problem / Context / YouTube</label>
                        <div className="relative">
                            <textarea
                                spellCheck={true}
                                rows={3}
                                className="block w-full rounded-xl border-slate-300 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/50 p-4 pr-12 text-slate-800 dark:text-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm placeholder-slate-400 dark:placeholder-slate-600 transition-all font-light"
                                placeholder="Describe your problem, paste a YouTube Link (for video analysis), or type a question here..."
                                value={studentText}
                                onChange={(e) => setStudentText(e.target.value)}
                            />
                            {/* Voice Input Button */}
                            <button
                                onClick={toggleVoiceInput}
                                className={`absolute right-3 top-3 p-2 rounded-full transition-all duration-300
                                    ${isListening 
                                        ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse' 
                                        : 'bg-transparent text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                title="Use Voice Input"
                            >
                                {isListening ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={!file && !studentText}
                        className="w-full flex justify-center py-4 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30"
                    >
                        Analyze Reasoning
                    </button>
                    
                    {error && (
                        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs border border-red-200 dark:border-red-500/20 text-center">
                        {error}
                        </div>
                    )}
                    </div>
                </div>

                {/* Right: History Dashboard */}
                <div className="pt-20">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Your History</h2>
                    </div>
                    
                    <div className="space-y-4">
                        {user && user.history.length > 0 ? (
                            user.history.map((item) => (
                                <div 
                                    key={item.id} 
                                    onClick={() => handleHistoryClick(item)}
                                    className="bg-white/50 dark:bg-[#0f172a]/40 backdrop-blur border border-slate-200 dark:border-slate-700/40 p-4 rounded-xl cursor-pointer hover:bg-white dark:hover:bg-slate-800/60 hover:border-indigo-500/30 transition-all group shadow-sm dark:shadow-none"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase
                                            ${item.parsedData?.flashcards ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}
                                        `}>
                                            {item.parsedData?.domain || (item.parsedData?.flashcards ? 'Concept' : 'Solved')}
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            {new Date(item.timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium line-clamp-2">
                                        {item.parsedData?.problem_summary.short_text || item.originalPrompt}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                                <p className="text-slate-500 dark:text-slate-600 text-sm">No analysis history yet.</p>
                            </div>
                        )}
                    </div>
                    
                </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="relative w-20 h-20">
               <div className="absolute top-0 left-0 w-full h-full border-2 border-slate-200 dark:border-slate-800 rounded-full"></div>
               <div className="absolute top-0 left-0 w-full h-full border-t-2 border-indigo-500 rounded-full animate-spin"></div>
            </div>
            <h2 className="mt-8 text-2xl font-light text-slate-700 dark:text-slate-200 animate-pulse tracking-wide">Building Reasoning Graph...</h2>
            <p className="text-slate-500 text-sm mt-2">Checking logical consistency & theorems</p>
          </div>
        )}

        {/* Results Resizable Dashboard */}
        {result && result.parsedData && (
          <div className="flex w-full h-full overflow-hidden animate-in fade-in duration-500 bg-slate-100 dark:bg-[#050816]">
            
            {/* Left Panel: Problem & Steps */}
            <div 
                className="flex flex-col h-full bg-slate-50 dark:bg-[#050816] min-w-[250px] overflow-hidden transition-colors" 
                style={{ width: `${widths[0]}%` }}
            >
                <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
                    {/* Problem Statement Card */}
                    <div className="bg-white/80 dark:bg-[#0f172a]/75 backdrop-blur-xl rounded-[18px] p-6 border border-slate-200 dark:border-slate-700/40 shadow-sm relative overflow-hidden flex-shrink-0 transition-colors">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-3">Problem Summary</h3>
                        <div className="text-sm text-slate-800 dark:text-slate-100 font-serif leading-relaxed mb-4">
                            <MarkdownMath content={result.parsedData.problem_summary.short_text} />
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/30">
                            <p className="text-xs text-indigo-500 dark:text-indigo-300 font-semibold uppercase mb-1">Goal</p>
                            <div className="text-xs text-slate-700 dark:text-slate-300">
                                <MarkdownMath content={result.parsedData.problem_summary.question} />
                            </div>
                        </div>
                    </div>

                    {/* Steps Table - Fills remaining space conceptually, but in scrollable container */}
                    <StepAnalysis 
                        steps={result.parsedData.student_analysis} 
                        focusedStepIndex={focusedStepIndex} 
                    />
                </div>
            </div>

            {/* Resizer 1 */}
            <div 
                className="w-1.5 h-full bg-slate-200 dark:bg-slate-900 hover:bg-indigo-500 cursor-col-resize z-20 flex items-center justify-center transition-colors flex-shrink-0"
                onMouseDown={startResize(0)}
            >
                <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
            </div>

            {/* Middle Panel: Reasoning Graph */}
            <div 
                className="h-full bg-slate-100 dark:bg-slate-900/50 relative overflow-hidden min-w-[250px] transition-colors flex flex-col" 
                style={{ width: `${widths[1]}%` }}
            >
                {/* Toggle Controls for Graph Mode - Moved down (top-16) to avoid overlap */}
                <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20 flex bg-white/90 dark:bg-slate-800/90 rounded-full p-1 shadow-lg border border-slate-200 dark:border-slate-700/50 backdrop-blur-sm">
                    <button 
                        onClick={() => setGraphViewMode('reasoning')}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${graphViewMode === 'reasoning' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        Reasoning
                    </button>
                    <button 
                        onClick={() => setGraphViewMode('flashcards')}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-1 ${graphViewMode === 'flashcards' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <span>🗂️</span> Cards
                    </button>
                </div>

                {graphViewMode === 'reasoning' ? (
                    <ConceptGraph 
                        data={result.parsedData.reasoning_graph} 
                        studentAnalysis={result.parsedData.student_analysis}
                        onNodeSelect={handleGraphNodeClick}
                        domain={result.parsedData.domain} 
                    />
                ) : (
                    <div className="flex items-center justify-center h-full p-4">
                        <FlashcardDeck cards={result.parsedData.flashcards || []} />
                    </div>
                )}
            </div>

            {/* Resizer 2 */}
            <div 
                className="w-1.5 h-full bg-slate-200 dark:bg-slate-900 hover:bg-indigo-500 cursor-col-resize z-20 flex items-center justify-center transition-colors flex-shrink-0"
                onMouseDown={startResize(1)}
            >
                <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
            </div>

            {/* Right Panel: Coach */}
            <div 
                className="h-full bg-slate-50 dark:bg-[#050816] min-w-[250px] overflow-hidden flex flex-col transition-colors" 
                style={{ width: `${widths[2]}%` }}
            >
                <div className="flex-grow overflow-hidden p-4">
                    <CoachPanel 
                        initialChat={result.parsedData.chat_response} 
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        isTyping={isTyping}
                        focusedStepIndex={focusedStepIndex}
                        onMarkRevision={handleMarkRevision}
                        fullAnalysis={result.parsedData} // Pass full analysis for code studio
                    />
                </div>
            </div>

          </div>
        )}
        
        {/* Error View */}
        {result && !result.parsedData && (
             <div className="w-full h-full flex items-center justify-center p-8">
                 <div className="max-w-4xl w-full bg-red-50 dark:bg-red-900/20 p-8 rounded-[24px] border border-red-200 dark:border-red-500/30 text-center">
                     <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Analysis Failed</h2>
                     <p className="text-slate-600 dark:text-slate-400 mb-4">DeepSlate could not structure the reasoning graph for this input.</p>
                     <pre className="bg-slate-100 dark:bg-slate-950 p-4 rounded-xl text-xs text-slate-500 text-left overflow-auto h-64 mb-6">
                         {result.rawText}
                     </pre>
                     <button onClick={() => setResult(null)} className="px-6 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-sm transition-colors">Try Again</button>
                 </div>
             </div>
        )}
      </main>

      {/* Revision Bank Modal (Keep existing) */}
      {showRevisionBank && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                           <span className="text-xl">🔖</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Revision Bank</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Questions marked for later review</p>
                        </div>
                      </div>
                      <button onClick={() => setShowRevisionBank(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto custom-scrollbar flex-grow bg-slate-50/50 dark:bg-slate-950/50">
                      {user && user.revisionList.length > 0 ? (
                          <div className="space-y-3">
                              {user.revisionList.map((item) => (
                                  <div 
                                      key={item.id} 
                                      onClick={() => handleHistoryClick(item)}
                                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl cursor-pointer hover:border-indigo-500 transition-all shadow-sm group"
                                  >
                                      <div className="flex justify-between items-start mb-2">
                                          <span className="text-[10px] text-slate-400 font-mono">
                                              {new Date(item.timestamp).toLocaleDateString()}
                                          </span>
                                          <span className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold">
                                              Review &rarr;
                                          </span>
                                      </div>
                                      <p className="text-sm text-slate-800 dark:text-slate-200 font-medium line-clamp-2">
                                          {item.parsedData?.problem_summary.short_text || item.originalPrompt}
                                      </p>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div className="text-center py-12 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                              <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                              </svg>
                              <p className="text-sm">No questions marked for revision yet.</p>
                              <p className="text-xs mt-1">Click "Mark for Revision" in the Coach panel to save problems here.</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default App;