import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, DeepSlateResponse } from "../types";

// Base System Instruction
const BASE_SYSTEM_INSTRUCTION = `
You are "DeepSlate", a multimodal tutor for Math, Physics, and Data Structures & Algorithms (DSA).

Your job is to analyze the input (which may be text, an image, or a YouTube video URL) and generate a structured learning response.

--------------------------------
1. DETERMINE DOMAIN
--------------------------------
- **MATH** or **PHYSICS**: If the problem involves equations, derivations, or physical concepts.
- **CODING**: If the problem asks for an algorithm, code, data structure (Arrays, Trees, Graphs), or computational logic.

--------------------------------
2. YOUTUBE / SEARCH GROUNDING
--------------------------------
- If the user provides a **YouTube URL** or asks about a specific recent topic, use the Google Search tool to find the content or transcript summary of that video.
- Treat the video content as the "Problem" context.

--------------------------------
3. OUTPUT REQUIREMENTS (JSON)
--------------------------------
You MUST output a valid JSON object matching the structure below.

*** IF DOMAIN IS CODING/DSA ***
- **Reasoning Graph**: Must be an **ALGORITHM FLOWCHART**.
  - Nodes must have specific 'type' fields: "start", "end", "process" (action), "decision" (if/else), "loop" (while/for).
  - Edges must represent control flow (True/False branches).
- **student_analysis**: IMPORTANT: Map the algorithm's logical steps here.
  - step_id: "step1", "step2", "step3"... (Must match graph node IDs if possible).
  - math_latex: Big O notation or pseudo-code snippet for this step.
  - explanation: Description of what happens in this step.
  - evaluation: "CORRECT" (as this is the proposed solution).
- **Code Solution**: Provide clean, commented code (Python or JS).
  - **output**: Example output of the code or "Compiler output...".
  - **time_complexity**: e.g., "O(n log n)".
  - **space_complexity**: e.g., "O(1)".

*** IF DOMAIN IS MATH/PHYSICS ***
- **Reasoning Graph**: A DAG of logical steps. Nodes have type "default".
- **student_analysis**: Detailed step-by-step breakdown.

*** UNIVERSAL REQUIREMENTS ***
1. **Misconception Map**:
   - Analyze potential mistakes.
   - Nodes: Specific misconceptions (Red) and Prerequisite Concepts (Green).
   - Edges: 'stems_from' or 'blocks'.

2. **Flashcards**:
   - Generate 3-5 flashcards for key concepts, definitions, or formulas relevant to the problem.
   - CRITICAL: IF "front" or "back" contains math, YOU MUST WRAP IT IN LaTeX DELIMITERS like $...$ (inline) or $$...$$ (block). 
   - Example Front: "What is $\\int x dx$?" (Correct) vs "What is integral x dx?" (Incorrect).
   - Format: { "front": "Question/Term", "back": "Answer/Definition", "concept": "Category" }

--------------------------------
4. JSON FORMAT
--------------------------------
{
  "domain": "MATH", 
  "problem_summary": {
    "short_text": "Brief problem statement or Video Summary.",
    "question": "Core task or learning objective."
  },
  "misconception_graph": {
      "nodes": [
          { "id": "m1", "label": "Forgot Chain Rule", "type": "misconception", "explanation": "Did not multiply by inner derivative." },
          { "id": "c1", "label": "Composite Functions", "type": "concept", "explanation": "f(g(x)) structure." }
      ],
      "edges": [
          { "from": "m1", "to": "c1", "relation": "stems_from" }
      ]
  },
  "flashcards": [
      { "front": "What is the Chain Rule?", "back": "$d/dx f(g(x)) = f'(g(x)) * g'(x)$", "concept": "Calculus" },
      { "front": "Derivative of $\\sin(x)$", "back": "$\\cos(x)$", "concept": "Trigonometry" }
  ],
  "student_analysis": [
    {
        "step_id": "step1",
        "math_latex": "d/dx(sin(x^2)) = cos(x^2)", 
        "explanation": "Differentiated outer function but missed inner.",
        "evaluation": "INCORRECT", 
        "feedback": "You missed the Chain Rule."
    }
  ],
  "reasoning_graph": {
    "nodes": [
      {
        "id": "step1",
        "role": "STEP", 
        "type": "default",
        "label": "Apply Chain Rule",
        "explanation": "d/dx f(g(x)) = f'(g(x)) * g'(x)"
      }
    ],
    "edges": [],
    "main_path": ["step1"]
  },
  "code_solution": {
      "language": "python",
      "code": "print('Hello')",
      "output": "Hello",
      "time_complexity": "O(1)",
      "space_complexity": "O(1)"
  },
  "chat_response": {
    "opening": "Let's review the concept...",
    "step_by_step": ["Step 1...", "Step 2..."],
    "encouragement": "Good effort!"
  }
}
`;

const ADHD_INSTRUCTION = `
*** ADHD MODE ACTIVE ***
Scientific Adaptation Rules:
1. **Chunking**: Break all explanations into extremely short, bulleted lists. Max 2 sentences per bullet.
2. **Bionic Emphasis**: Use **bold** for the most important verb or noun in every sentence to guide the eye.
3. **Executive Function Support**: In the 'chat_response', explicitly state the estimated time to understand this concept (e.g., "⏱️ 2 mins read").
4. **Dopamine Markers**: Use emojis (✅, 🚀, 💡) to mark progress steps in the text.
`;

const DYSLEXIA_INSTRUCTION = `
*** DYSLEXIA MODE ACTIVE ***
Scientific Adaptation Rules:
1. **Syntax Simplification**: Use active voice only. Subject-Verb-Object. No nested clauses.
2. **Visual Anchors**: Do not use large blocks of italics. Use clear vertical spacing.
3. **Phonetic Clarity**: If a complex term is introduced, provide a phonetic breakdown in parentheses.
4. **Step Clarity**: Number every single action distinctively.
`;

const extractJson = (text: string): any | null => {
  // 1. Try strict parse first
  try {
    return JSON.parse(text);
  } catch (e) {
    // Continue
  }

  // 2. Remove markdown code blocks
  let cleanText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  // 3. Try parsing cleaned text
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // Continue
  }

  // 4. Robust extraction: find outermost braces
  const startIndex = cleanText.indexOf('{');
  if (startIndex === -1) return null;

  // We need to match braces carefully to handle nested objects
  let braceCount = 0;
  let inString = false;
  let escaped = false;
  let endIndex = -1;

  for (let i = startIndex; i < cleanText.length; i++) {
    const char = cleanText[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i;
          break;
        }
      } else if (char === '"') {
        inString = true;
      }
    }
  }

  if (endIndex !== -1) {
    const candidate = cleanText.substring(startIndex, endIndex + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      console.warn("Extracted JSON failed to parse, attempting fallback.", e);
    }
  }

  // 5. Last resort: Regex
  try {
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (e) {
    console.error("Failed to parse JSON response", e);
    return null;
  }
};

const fileToGenerativePart = async (file: File) => {
  const SUPPORTED_MIME_TYPES = [
      'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.ms-powerpoint' // .ppt
  ];

  if (SUPPORTED_MIME_TYPES.includes(file.type)) {
    const base64EncodedDataPromise = new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: {
        data: (await base64EncodedDataPromise) as string,
        mimeType: file.type,
      },
    };
  }

  if (file.type.startsWith('image/')) {
    return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
            reject(new Error("Canvas context not supported."));
            return;
            }
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            resolve({
            inlineData: {
                data: dataUrl.split(',')[1],
                mimeType: 'image/jpeg',
            },
            });
        };
        img.onerror = () => reject(new Error(`Could not convert ${file.type}.`));
        if (typeof event.target?.result === 'string') {
            img.src = event.target.result;
        } else {
            reject(new Error("Failed to read file data."));
        }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file);
    });
  }

  throw new Error("Unsupported file type.");
};

export const analyzeProblem = async (
    file: File | null, 
    studentNotes: string,
    accessibilityMode: 'default' | 'dyslexia' | 'adhd' = 'default'
): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using a preview model that supports Search Grounding for YouTube links
  const model = 'gemini-3-pro-preview';
  
  const parts: any[] = [];
  
  if (file) {
    const part = await fileToGenerativePart(file);
    parts.push(part);
  }

  // Check if studentNotes contains a YouTube URL
  const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/[^\s]+/;
  const hasYoutubeLink = youtubeRegex.test(studentNotes);

  let promptText = "";
  
  if (hasYoutubeLink) {
      promptText = `Context provided: ${studentNotes}. \n\nIMPORTANT: The user has provided a YouTube link. Use the 'googleSearch' tool to find information about this video (transcript, summary, educational content). \n\nAnalyze the educational content of this video as the 'Problem'. Break down the concepts explained in the video into a Reasoning Graph. Identify common misconceptions related to this topic for the Misconception Map. Generate Flashcards for key terms.`;
  } else {
      promptText = file 
        ? `Context provided: ${studentNotes}. Please analyze the attached file. Is this Math, Physics, or Coding/DSA? Analyze accordingly.`
        : `Please analyze this query: "${studentNotes}". determine if it is a specific math/physics/coding problem.`;
  }

  parts.push({ text: promptText });

  // Construct System Instruction based on Accessibility Mode
  let systemInstruction = BASE_SYSTEM_INSTRUCTION;
  if (accessibilityMode === 'adhd') {
      systemInstruction += ADHD_INSTRUCTION;
  } else if (accessibilityMode === 'dyslexia') {
      systemInstruction += DYSLEXIA_INSTRUCTION;
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: parts },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, 
        responseMimeType: 'application/json',
        // Enable Google Search to handle YouTube links/context
        tools: [{ googleSearch: {} }] 
      }
    });

    const text = response.text || "";
    // Sometimes search grounding returns result in text, try to extract JSON
    const parsedData = extractJson(text) as DeepSlateResponse;

    if (!parsedData) {
        throw new Error("Failed to parse analysis response.");
    }

    return { 
        id: Date.now().toString(),
        timestamp: Date.now(),
        parsedData, 
        rawText: text,
        originalPrompt: studentNotes || (file ? `File Upload: ${file.name}` : "Problem Analysis")
    };

  } catch (error) {
    console.error("DeepSlate Error:", error);
    throw error;
  }
};

export const askFollowUpQuestion = async (
    originalContext: DeepSlateResponse, 
    chatHistory: {role: string, content: string}[], 
    newQuestion: string
): Promise<{ type: 'text' | 'quiz', content: any }> => {
    if (!process.env.API_KEY) {
        throw new Error("API Key not found");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-pro-preview';

    const contextSummary = `
        Domain: ${originalContext.domain}
        Original Problem: ${originalContext.problem_summary.short_text}
        Question: ${originalContext.problem_summary.question}
        ${originalContext.code_solution ? `Code: ${originalContext.code_solution.code}` : ''}
    `;

    const chatHistoryText = chatHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    const prompt = `
        You are DeepSlate.
        CONTEXT: ${contextSummary}
        HISTORY: ${chatHistoryText}
        QUESTION: "${newQuestion}"
        
        CRITICAL FORMATTING RULES:
        1. WRAP ALL MATH in $...$ (inline) or $$...$$ (block). 
        2. Do not output raw LaTeX without delimiters.
        3. Use **bold** for key terms.
        
        --------------------------------
        OUTPUT FORMAT (STRICT JSON)
        --------------------------------
        You must ALWAYS return a JSON object.
        
        OPTION 1: IF ASKED FOR A QUIZ:
        { "quiz": { "questions": [...] } }

        OPTION 2: ALL OTHER QUESTIONS (Default):
        { "text": "Your helpful response..." }
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt }] },
            config: { 
                temperature: 0.4,
                responseMimeType: 'application/json' 
            }
        });
        
        const text = response.text || "";
        const json = extractJson(text);

        if (json) {
            if (json.quiz) {
                return { type: 'quiz', content: json.quiz };
            }
            if (json.text) {
                return { type: 'text', content: json.text };
            }
        }

        return {
            type: 'text',
            content: typeof json === 'string' ? json : JSON.stringify(json)
        };

    } catch (e) {
        console.error("Follow-up error", e);
        return {
            type: 'text',
            content: "Sorry, I couldn't process that follow-up question."
        };
    }
}