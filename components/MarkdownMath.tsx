import React from 'react';
import MathText from './MathText';

interface MarkdownMathProps {
  content: string;
  className?: string;
}

const MarkdownMath: React.FC<MarkdownMathProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // 1. Split by BLOCK Math ($$...$$ or \[...\])
  // We do this first so we don't try to parse markdown inside block math
  const blockMathRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/g;
  const parts = content.split(blockMathRegex);

  return (
    <div className={`leading-relaxed ${className}`}>
      {parts.map((part, i) => {
        if (part.match(blockMathRegex)) {
          // Render Block Math
          // Remove delimiters for KaTeX
          const latex = part.startsWith('$$') ? part.slice(2, -2) : part.slice(2, -2);
          return <MathText key={i} latex={latex.trim()} block={true} className="my-4 block" />;
        } else {
          // Render Markdown Text (Paragraphs, Lists, Inline Math)
          return <MarkdownTextChunk key={i} content={part} />;
        }
      })}
    </div>
  );
};

const MarkdownTextChunk: React.FC<{ content: string }> = ({ content }) => {
  // Split content into lines to detect lists vs paragraphs
  const lines = content.split('\n');
  
  const nodes: React.ReactNode[] = [];
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length > 0) {
        // Join buffered lines into a single paragraph
        // We join with space to ensure flow, unless line ends with double space (md strict) 
        // but here simple join is usually sufficient for chat.
        const paragraphText = buffer.join(' ').trim();
        if (paragraphText) {
            nodes.push(
                <p key={`p-${nodes.length}`} className="my-2 mb-3 last:mb-0">
                    {parseInline(paragraphText)}
                </p>
            );
        }
        buffer = [];
    }
  };

  lines.forEach((line, idx) => {
      const trimmed = line.trim();
      
      // List Item (Bullet)
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          flushBuffer();
          nodes.push(
              <div key={`li-${idx}`} className="flex gap-2 ml-2 my-1">
                  <span className="text-current opacity-70">•</span>
                  <span>{parseInline(trimmed.substring(2))}</span>
              </div>
          );
      }
      // List Item (Numbered)
      else if (trimmed.match(/^\d+\.\s/)) {
          flushBuffer();
          const match = trimmed.match(/^(\d+\.)\s+(.*)/);
          if (match) {
            nodes.push(
                <div key={`num-${idx}`} className="flex gap-2 ml-2 my-1">
                    <span className="font-bold opacity-80 select-none">{match[1]}</span>
                    <span>{parseInline(match[2])}</span>
                </div>
            );
          } else {
              buffer.push(trimmed);
          }
      }
      // Empty line -> Flush paragraph
      else if (trimmed === '') {
          flushBuffer();
      }
      // Regular text -> Add to buffer
      else {
          buffer.push(trimmed);
      }
  });

  flushBuffer();

  return <>{nodes}</>;
};

// Helper to parse Inline Math ($...$, \(...\)) and formatting (**bold**, *italic*)
const parseInline = (text: string): React.ReactNode[] => {
    // Regex splits by Inline Math: $...$ or \(...\)
    // Negative lookbehind (?<!\\) ensures we don't match escaped \$
    const regex = /(\\\(.*?\\\)|(?<!\\)\$[^\n$]*?(?<!\\)\$)/g;
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
        // Check if part is inline math
        if (part.startsWith('\\(') && part.endsWith('\\)')) {
            const latex = part.slice(2, -2);
            return <MathText key={index} latex={latex} block={false} />;
        }
        if (part.startsWith('$') && part.endsWith('$')) {
            const latex = part.slice(1, -1);
            return <MathText key={index} latex={latex} block={false} />;
        }
        
        // Parse Bold/Italic inside text parts
        return <span key={index}>{parseFormatting(part)}</span>;
    });
};

const parseFormatting = (text: string): React.ReactNode[] => {
    // Split by Bold (**...**)
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
             return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        // Split by Italic (*...*)
        const italicParts = part.split(/(\*.*?\*)/g);
        return (
            <span key={i}>
                {italicParts.map((subPart, j) => {
                    if (subPart.startsWith('*') && subPart.endsWith('*')) {
                        return <em key={j} className="italic opacity-90">{subPart.slice(1, -1)}</em>;
                    }
                    return subPart;
                })}
            </span>
        );
    });
};

export default MarkdownMath;
