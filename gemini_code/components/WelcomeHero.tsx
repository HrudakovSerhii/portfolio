import React, { useState } from 'react';
import { Code2, Briefcase, Coffee, ArrowRight } from 'lucide-react';
import { Typewriter } from './Typewriter';
import { Role } from '../types';

interface WelcomeHeroProps {
  onRoleSelect: (role: Role) => void;
  roleSelected: boolean;
}

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({ onRoleSelect, roleSelected }) => {
  const [introComplete, setIntroComplete] = useState(false);

  return (
    <section 
      id="hero" 
      className="relative flex flex-col items-center justify-center p-4 min-h-screen w-full"
    >
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-blue-200/40 dark:bg-blue-900/20 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-lighten animate-blob"></div>
        <div className="absolute top-20 right-10 w-64 h-64 bg-purple-200/40 dark:bg-purple-900/20 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-lighten animate-blob animation-delay-2000"></div>
      </div>

      <div className="max-w-6xl w-full mx-auto flex flex-col items-center text-center z-10 pt-16">
        
        {/* Profile Image & Badge */}
        <div className="mb-8 relative group">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-1 bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-xl">
            <div className="w-full h-full rounded-full border-4 border-white dark:border-gray-900 overflow-hidden bg-white dark:bg-gray-800">
               <img 
                src="https://picsum.photos/300/300" 
                alt="Profile" 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-1 rounded-full shadow-md border border-gray-100 dark:border-gray-700">
             <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
               Alex Dev
             </span>
          </div>
        </div>

        {/* Intro Text */}
        <div className="max-w-2xl mb-12 min-h-[120px]">
           <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
             Building <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Digital Experiences</span>
           </h1>
           <div className="text-lg md:text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
             <Typewriter 
                text="I transform complex problems into beautiful, functional interfaces. Let's tailor this portfolio to your needs." 
                speed={20}
                onComplete={() => setIntroComplete(true)}
              />
           </div>
        </div>

        {/* Role Selection - Collapses when role is selected */}
        <div 
          className={`
            w-full max-w-5xl transition-all duration-700 ease-in-out overflow-hidden
            ${roleSelected ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[800px] opacity-100'}
            ${introComplete ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
          `}
        >
          <div className="flex flex-col md:flex-row gap-4 justify-center items-stretch w-full px-4">
            
            {/* Recruiter Option */}
            <button 
              onClick={() => onRoleSelect('recruiter')}
              className="flex-1 group relative p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 shadow-sm hover:shadow-xl transition-all duration-300 text-left"
            >
              <div className="absolute inset-0 bg-blue-50 dark:bg-blue-900/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="bg-blue-100 dark:bg-blue-900/50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <Briefcase size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Recruiter</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex-grow">
                  Focus on skills, work history, and project metrics.
                </p>
                <div className="flex items-center text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all">
                  Select <ArrowRight size={16} className="ml-1" />
                </div>
              </div>
            </button>

            {/* Developer Option */}
            <button 
              onClick={() => onRoleSelect('developer')}
              className="flex-1 group relative p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 shadow-sm hover:shadow-xl transition-all duration-300 text-left"
            >
              <div className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="bg-indigo-100 dark:bg-indigo-900/50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                  <Code2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Developer</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex-grow">
                  Deep dive into code quality, stack, and architecture.
                </p>
                <div className="flex items-center text-indigo-600 text-sm font-medium opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all">
                  Select <ArrowRight size={16} className="ml-1" />
                </div>
              </div>
            </button>

            {/* Friend Option */}
            <button 
              onClick={() => onRoleSelect('friend')}
              className="flex-1 group relative p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-teal-500 dark:hover:border-teal-500 shadow-sm hover:shadow-xl transition-all duration-300 text-left"
            >
              <div className="absolute inset-0 bg-teal-50 dark:bg-teal-900/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="bg-teal-100 dark:bg-teal-900/50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
                  <Coffee size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Friend</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex-grow">
                   Get to know me, my hobbies, and what drives me.
                </p>
                <div className="flex items-center text-teal-600 text-sm font-medium opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all">
                  Select <ArrowRight size={16} className="ml-1" />
                </div>
              </div>
            </button>

          </div>
        </div>

      </div>
    </section>
  );
};