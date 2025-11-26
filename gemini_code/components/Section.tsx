import React from 'react';
import { Typewriter } from './Typewriter';
import { SectionData } from '../types';

interface SectionProps {
  data: SectionData;
  index: number;
}

export const Section: React.FC<SectionProps> = ({ data, index }) => {
  const isEven = index % 2 === 0;

  return (
    <section 
      id={data.id} 
      className="min-h-screen flex flex-col justify-center py-20 scroll-mt-16 opacity-0 animate-fade-in"
      style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
    >
      <div className="max-w-5xl mx-auto px-4 w-full">
        {/* Section Header */}
        <div className="mb-12 flex items-center gap-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {data.title}
          </h2>
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800"></div>
          <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
            0{index + 1}
          </span>
        </div>

        {/* Content Layout */}
        <div className={`flex flex-col md:flex-row gap-8 md:gap-16 items-center ${!isEven ? 'md:flex-row-reverse' : ''}`}>
          
          {/* Image Side */}
          <div className="w-full md:w-1/2">
            <div className="relative group">
              {/* Decorative Frame */}
              <div className={`absolute -inset-4 border-2 border-gray-200 dark:border-gray-800 rounded-2xl transition-transform duration-500 group-hover:scale-105 ${!isEven ? 'rotate-2' : '-rotate-2'}`}></div>
              
              <div className="relative rounded-xl overflow-hidden shadow-xl aspect-video bg-gray-100 dark:bg-gray-800">
                <img 
                  src={data.imageUrl || `https://picsum.photos/seed/${data.id}/800/600`}
                  alt={data.title}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  loading="lazy"
                />
                
                {/* AI-like badge overlay */}
                <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-mono text-white/80 border border-white/10">
                  GENERATED
                </div>
              </div>
            </div>
          </div>

          {/* Text Side */}
          <div className="w-full md:w-1/2">
            <div className={`p-6 md:p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm relative ${isEven ? 'rounded-tl-none' : 'rounded-tr-none'}`}>
              
              {/* Chat bubble tail visual */}
              <div className={`absolute top-0 w-4 h-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 ${isEven ? '-left-2 border-l skew-x-[20deg]' : '-right-2 border-r -skew-x-[20deg]'}`}></div>

              <div className="prose prose-lg dark:prose-invert">
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  <Typewriter text={data.content} speed={15} />
                </p>
              </div>

              {/* Tags/Skills row example */}
              <div className="mt-6 flex flex-wrap gap-2">
                {['Creative', 'Technical', 'Efficient'].map((tag, i) => (
                  <span key={i} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-md">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};