
import React, { useEffect, useRef } from 'react';

interface MathTextProps {
  latex: string;
  block?: boolean;
  className?: string;
}

declare global {
  interface Window {
    katex: any;
  }
}

const MathText: React.FC<MathTextProps> = ({ latex, block = false, className = '' }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Safety check: ensure latex is a string
    if (typeof latex !== 'string') {
        if (containerRef.current) containerRef.current.innerText = '';
        return;
    }

    // Check if KaTeX is loaded
    if (window.katex && containerRef.current) {
      try {
        const html = window.katex.renderToString(latex, {
          throwOnError: false,
          displayMode: block,
          output: 'html', 
          strict: false,  
        });
        containerRef.current.innerHTML = html;
      } catch (e) {
        console.error("KaTeX error:", e);
        containerRef.current.innerText = latex;
      }
    } else if (containerRef.current) {
        containerRef.current.innerText = latex;
    }
  }, [latex, block]);

  return <span ref={containerRef} className={`font-serif ${className}`} />;
};

export default MathText;
