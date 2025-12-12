import React, { useState } from 'react';
import { Flashcard } from '../types';
import MarkdownMath from './MarkdownMath';

interface FlashcardDeckProps {
  cards: Flashcard[];
}

const FlashcardDeck: React.FC<FlashcardDeckProps> = ({ cards }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!cards || cards.length === 0) return null;

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 300);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
        setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, 300);
  };

  const currentCard = cards[currentIndex];

  return (
    <div className="w-full flex flex-col items-center justify-center p-6 bg-slate-100 dark:bg-[#0f172a]/40 rounded-[24px] transition-colors">
      <div className="w-full max-w-lg aspect-[3/2] perspective-1000 group cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
        <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* Front */}
          <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-2xl p-8 flex flex-col items-center justify-center text-center transition-colors">
             <div className="absolute top-4 right-4 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border border-indigo-200 dark:border-indigo-500/20 px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/5">
                {currentCard.concept}
             </div>
             <div className="absolute top-4 left-4 text-xs text-slate-400 dark:text-slate-500 font-mono">
                {(currentIndex + 1).toString().padStart(2, '0')} / {cards.length.toString().padStart(2, '0')}
             </div>
             
             <div className="text-2xl font-semibold text-slate-800 dark:text-slate-100 mb-4 font-serif">
                 {/* Explicitly wrap in MarkdownMath to catch raw text equations */}
                 <MarkdownMath content={currentCard.front} />
             </div>
             
             <div className="absolute bottom-6 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2 animate-pulse">
                <span>Tap to flip</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
             </div>
          </div>

          {/* Back */}
          <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/40 dark:to-slate-900 border border-indigo-200 dark:border-indigo-500/50 rounded-2xl shadow-2xl p-8 flex flex-col items-center justify-center text-center transition-colors">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
              <div className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed overflow-y-auto max-h-full custom-scrollbar w-full">
                  <MarkdownMath content={currentCard.back} />
              </div>
          </div>

        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-8 mt-8 items-center">
          <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="p-4 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-700 hover:scale-110 active:scale-95 shadow-sm dark:shadow-none">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div className="h-1 w-24 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}></div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="p-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/30 hover:scale-110 active:scale-95">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
};

export default FlashcardDeck;