import React, { useEffect, useRef } from 'react';
import { StudentStepAnalysis } from '../types';
import MathText from './MathText';
import MarkdownMath from './MarkdownMath';

interface StepAnalysisProps {
  steps: StudentStepAnalysis[];
  focusedStepIndex?: number | null;
}

const StepAnalysis: React.FC<StepAnalysisProps> = ({ steps, focusedStepIndex }) => {
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  useEffect(() => {
    if (focusedStepIndex !== null && focusedStepIndex !== undefined) {
      const row = rowRefs.current[focusedStepIndex];
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a temporary flash effect class if needed, or rely on the conditional styling below
      }
    }
  }, [focusedStepIndex]);

  if (!steps || steps.length === 0) return null;

  return (
    <div className="bg-white/80 dark:bg-[#0f172a]/75 backdrop-blur-xl rounded-[18px] border border-slate-200 dark:border-slate-700/40 overflow-hidden shadow-sm flex flex-col w-full transition-colors">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between flex-shrink-0 transition-colors">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wider">Analysis</h3>
            <span className="text-[10px] text-slate-500 font-mono">{steps.length} STEPS</span>
        </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-100 dark:bg-slate-900 shadow-sm">
            <tr className="border-b border-slate-200 dark:border-slate-700/40 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <th className="p-4 w-12 text-center">#</th>
              <th className="p-4 min-w-[150px]">Math</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 min-w-[200px]">Feedback</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, idx) => {
                const isFocused = focusedStepIndex === idx;
                return (
                  <tr 
                    key={idx}
                    ref={el => { rowRefs.current[idx] = el; }}
                    className={`border-b border-slate-100 dark:border-slate-800/50 transition-all duration-500 group
                        ${isFocused 
                            ? 'bg-amber-50 dark:bg-amber-900/20 shadow-inner' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                        }
                    `}
                  >
                    <td className="p-4 text-slate-500 dark:text-slate-600 font-mono text-xs text-center align-top pt-6">
                        {isFocused ? '👉' : idx + 1}
                    </td>
                    <td className="p-4 text-slate-800 dark:text-slate-100 font-medium align-top">
                        <div className={`p-3 rounded-xl border transition-colors
                            ${isFocused 
                                ? 'bg-amber-100/50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-500/50' 
                                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/30 group-hover:border-indigo-500/30'
                            }`}>
                            <MathText latex={step.math_latex || ''} block={true} />
                        </div>
                    </td>
                    <td className="p-4 text-center align-top pt-6">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm
                          ${step.evaluation === 'CORRECT' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : ''}
                          ${step.evaluation === 'PARTIALLY_CORRECT' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' : ''}
                          ${step.evaluation === 'INCORRECT' ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20' : ''}
                          ${step.evaluation === 'MISSING_KEY_STEP' ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20' : ''}
                        `}
                      >
                        {step.evaluation.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400 text-xs leading-relaxed align-top">
                        <div className="mb-2 text-slate-800 dark:text-slate-300 font-medium">
                            <MarkdownMath content={step.feedback} />
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            <MarkdownMath content={step.explanation} />
                        </div>
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StepAnalysis;