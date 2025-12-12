export interface StudentStepAnalysis {
  step_id: string;
  math_latex: string;
  explanation: string;
  evaluation: 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT' | 'MISSING_KEY_STEP';
  feedback: string;
}

export interface ReasoningNode {
  id: string;
  role: 'PROBLEM' | 'STEP' | 'FACT' | 'SOLUTION';
  // New: Specific type for Algorithm Flowcharts
  type?: 'default' | 'start' | 'end' | 'process' | 'decision' | 'loop'; 
  label: string;
  math?: string;
  explanation: string;
  // Layout properties
  level?: number;
  x?: number;
  y?: number;
}

export interface ReasoningEdge {
  from: string;
  to: string;
  reason: string;
}

export interface ReasoningGraphData {
  nodes: ReasoningNode[];
  edges: ReasoningEdge[];
  main_path: string[];
}

export interface MisconceptionNode {
  id: string;
  label: string;
  type: 'misconception' | 'concept' | 'gap';
  severity?: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface MisconceptionEdge {
  from: string;
  to: string;
  relation: 'stems_from' | 'blocks' | 'related_to';
}

export interface MisconceptionGraphData {
  nodes: MisconceptionNode[];
  edges: MisconceptionEdge[];
}

export interface ProblemSummary {
  short_text: string;
  question: string;
}

export interface ChatResponse {
  opening: string;
  step_by_step: string[];
  encouragement: string;
}

export interface Flashcard {
  front: string;
  back: string;
  concept: string;
}

export interface CodeSolution {
  language: string;
  code: string;
  output: string;
  time_complexity: string;
  space_complexity: string;
}

export interface DeepSlateResponse {
  domain: 'MATH' | 'PHYSICS' | 'CODING'; 
  problem_summary: ProblemSummary;
  student_analysis: StudentStepAnalysis[];
  reasoning_graph: ReasoningGraphData;
  misconception_graph?: MisconceptionGraphData; // New field
  chat_response: ChatResponse;
  flashcards?: Flashcard[];
  code_solution?: CodeSolution; 
}

export interface AnalysisResult {
  id: string; 
  timestamp: number;
  parsedData: DeepSlateResponse | null;
  rawText: string;
  originalPrompt?: string; 
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface QuizContent {
  questions: QuizQuestion[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'structured_steps' | 'quiz'; 
  content: string | string[] | QuizContent; 
}

export interface User {
  name: string;
  avatar: string;
  xp: number; 
  level: number; 
  unlockedNodes: string[]; 
  history: AnalysisResult[];
  revisionList: AnalysisResult[];
}