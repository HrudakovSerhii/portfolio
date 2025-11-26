import React, { useState, useEffect } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  onComplete?: () => void;
  className?: string;
}

export const Typewriter: React.FC<TypewriterProps> = ({ 
  text, 
  speed = 30, 
  delay = 0, 
  onComplete,
  className = ""
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    if (delay > 0 && !hasStarted) {
      timeout = setTimeout(() => {
        setHasStarted(true);
      }, delay);
      return () => clearTimeout(timeout);
    } else {
      setHasStarted(true);
    }
  }, [delay, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText((prev) => prev + text.charAt(index));
        index++;
      } else {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, speed);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, text, speed]);

  return (
    <span className={className}>
      {displayedText}
      {displayedText.length < text.length && (
        <span className="inline-block w-1 h-[1em] bg-blue-600 ml-1 animate-typing align-middle"></span>
      )}
    </span>
  );
};