import React from 'react';
import { Moon, Sun, RefreshCw, UserCircle } from 'lucide-react';
import { Role } from '../types';

interface HeaderProps {
  currentRole: Role;
  visibleSections: string[];
  activeSection: string;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  onChangeRole: () => void;
  onNavigate: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  currentRole, 
  visibleSections, 
  activeSection, 
  theme, 
  onThemeToggle,
  onChangeRole,
  onNavigate
}) => {
  // Removed the check: if (!currentRole) return null; to make header always visible

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-50 border-b border-gray-200 dark:border-gray-800 transition-all duration-300">
      <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
        
        {/* Left: Brand / Home */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            AD
          </div>
          <span className="hidden md:block font-semibold text-gray-800 dark:text-white tracking-tight">
            Portfolio
          </span>
          
          {/* Vertical Divider */}
          <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-2"></div>

          {/* Progressive Navigation Items - sliding in from left */}
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-gradient">
            {visibleSections.map((sectionId) => (
              <button
                key={sectionId}
                onClick={() => onNavigate(sectionId)}
                className={`
                  relative px-3 py-1.5 rounded-full text-xs md:text-sm font-medium transition-all duration-300 whitespace-nowrap animate-slide-in
                  ${activeSection === sectionId 
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-md' 
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}
                `}
              >
                {sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* Role Badge - Only show if role selected */}
          {currentRole && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              <UserCircle size={14} />
              <span>{currentRole.charAt(0).toUpperCase() + currentRole.slice(1)} View</span>
            </div>
          )}

          {/* Change Role Button - Only show if role selected */}
          {currentRole && (
            <button
              onClick={onChangeRole}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              title="Change Role"
            >
              <RefreshCw size={18} />
            </button>
          )}

          <button
            onClick={onThemeToggle}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
};