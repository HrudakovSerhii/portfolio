import React, { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface ActionPromptProps {
  nextSectionTitle: string;
  onTrigger: (customPrompt?: string) => void;
  isLast?: boolean;
}

export const ActionPrompt: React.FC<ActionPromptProps> = ({ nextSectionTitle, onTrigger, isLast }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onTrigger(inputValue);
    setInputValue('');
  };

  if (isLast) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">You've reached the end of the presentation.</p>
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="mt-4 text-blue-600 hover:underline"
        >
          Scroll to top
        </button>
      </div>
    );
  }

  return (
    <div className="sticky bottom-8 z-40 max-w-2xl mx-auto px-4 animate-fade-in mt-8">
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full opacity-75 blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
        
        <form onSubmit={handleSubmit} className="relative flex items-center bg-white dark:bg-gray-900 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 p-1.5 pl-5">
          
          <Sparkles className="w-5 h-5 text-gray-400 mr-3 animate-pulse" />
          
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Tell me about your ${nextSectionTitle}...`}
            className="flex-1 bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 text-sm md:text-base h-10"
          />

          <button
            type="submit"
            className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full px-4 py-2 text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span className="hidden sm:inline">Ask</span>
            <ArrowRight size={14} />
          </button>
        </form>
      </div>
      
      <div className="text-center mt-2">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">
          Press Enter or click Ask to reveal
        </p>
      </div>
    </div>
  );
};
