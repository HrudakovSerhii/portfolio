import React, { useState, useEffect, useRef } from 'react';
import { WelcomeHero } from './components/WelcomeHero';
import { Header } from './components/Header';
import { Section } from './components/Section';
import { ActionPrompt } from './components/ActionPrompt';
import { Role, SectionData, SECTION_ORDER } from './types';

// Mock content generator based on role
const generateContent = (role: Role, section: string): SectionData => {
  const contentMap: Record<string, Record<string, string>> = {
    // Hero is handled statically by WelcomeHero, but we keep data here for completeness if needed
    hero: {
      recruiter: "I'm a results-driven Senior Engineer.",
      developer: "I specialize in the React ecosystem.",
      friend: "Hi! I'm Alex."
    },
    about: {
      recruiter: "Based in San Francisco. Worked at 2 Fortune 500 companies. Led teams of 5-10 developers. Consistent track record of delivering on time.",
      developer: "Full stack capabilities but frontend focused. Proficient in Node.js, GraphQL, and AWS. CI/CD enthusiast.",
      friend: "When I'm not coding, I'm probably hiking, playing video games, or trying to bake the perfect sourdough bread."
    },
    skills: {
      recruiter: "Core competencies: React, TypeScript, Tailwind CSS, Node.js, AWS, Agile Methodologies, Team Leadership.",
      developer: "Stack: React 18, Zustand, React Query, Tailwind, Framer Motion, Jest/RTL, Cypress, Webpack/Vite.",
      friend: "I'm really good at Googling errors, centering divs, and pretending to understand Regex."
    },
    experience: {
      recruiter: "Senior FE at TechCorp (2020-Present): Improved LCP by 40%. Mid-level at WebSol (2018-2020).",
      developer: "Architected a micro-frontend system at TechCorp. Migrated legacy Class components to Hooks.",
      friend: "I've been working in tech for a while. It pays the bills and lets me build cool stuff!"
    },
    projects: {
      recruiter: "E-commerce platform handling 50k DAU. Internal dashboard for data visualization.",
      developer: "Open source contributor to [Library]. Built a custom component library with Storybook.",
      friend: "Built a tracker for my plants so I stop killing them. Also this portfolio website!"
    },
    contact: {
      recruiter: "Available for interviews. Email: alex@example.com. LinkedIn: /in/alexdev",
      developer: "Check out my GitHub: github.com/alexdev. Let's talk code.",
      friend: "Hit me up on Twitter/X or send me an email just to say hi!"
    }
  };

  return {
    id: section,
    title: section.charAt(0).toUpperCase() + section.slice(1),
    type: section as any,
    content: contentMap[section]?.[role || 'friend'] || "Content loading...",
    imageUrl: `https://picsum.photos/seed/${section}-${role}/800/600`
  };
};

const App: React.FC = () => {
  const [role, setRole] = useState<Role>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Start with empty sections. 
  const [revealedSections, setRevealedSections] = useState<SectionData[]>([]);
  // We start at index 1 ('about') because index 0 ('hero') is the static WelcomeHero
  const [nextSectionIndex, setNextSectionIndex] = useState(1); 
  
  const [activeSection, setActiveSection] = useState('hero');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Scroll Spy to update active section in header
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-50% 0px -50% 0px', // Activate when section is in the middle of viewport
      threshold: 0
    };

    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Observe Hero
    const heroEl = document.getElementById('hero');
    if (heroEl) observer.observe(heroEl);

    // Observe Generated Sections
    revealedSections.forEach(section => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [revealedSections, role]); // Re-run when sections change

  const handleRoleSelect = (selectedRole: Role) => {
    setRole(selectedRole);
    
    // Reset generated sections (keep Hero static)
    setRevealedSections([]);
    
    // Generate the 'about' section immediately
    const firstGeneratedSection = generateContent(selectedRole, SECTION_ORDER[1]); // 'about'
    setRevealedSections([firstGeneratedSection]);
    setNextSectionIndex(2); // Next is 'skills'

    // Slight delay to allow the role buttons to fade out before scrolling
    setTimeout(() => {
      const element = document.getElementById(SECTION_ORDER[1]);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 600);
  };

  const handleNextSection = () => {
    if (nextSectionIndex >= SECTION_ORDER.length) return;

    const sectionId = SECTION_ORDER[nextSectionIndex];
    const newSection = generateContent(role, sectionId);
    
    setRevealedSections(prev => [...prev, newSection]);
    setNextSectionIndex(prev => prev + 1);

    setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
  };

  const handleChangeRole = () => {
    setRole(null);
    setRevealedSections([]);
    setNextSectionIndex(1); // Reset to after hero
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Visible sections for nav includes 'hero' + generated ones
  const navSections = ['hero', ...revealedSections.map(s => s.id)];

  return (
    <div className="min-h-screen transition-colors duration-300 bg-gray-50 dark:bg-gray-950">
      
      <Header 
        currentRole={role}
        visibleSections={navSections}
        activeSection={activeSection}
        theme={theme}
        onThemeToggle={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
        onChangeRole={handleChangeRole}
        onNavigate={handleNavigate}
      />

      <main className="transition-all duration-500">
        {/* Hero is always rendered, acts as the Intro Block */}
        <WelcomeHero 
          onRoleSelect={handleRoleSelect} 
          roleSelected={!!role}
        />

        {/* Content Sections Area */}
        {role && (
          <div className="flex flex-col">
            {revealedSections.map((section, index) => (
              <Section key={section.id} data={section} index={index + 1} />
            ))}
          </div>
        )}

        {/* Action Prompt */}
        {role && nextSectionIndex <= SECTION_ORDER.length && (
            <ActionPrompt 
              nextSectionTitle={nextSectionIndex < SECTION_ORDER.length ? SECTION_ORDER[nextSectionIndex] : ''}
              onTrigger={handleNextSection}
              isLast={nextSectionIndex === SECTION_ORDER.length}
            />
        )}
        
        <div ref={bottomRef} className="h-16" />
      </main>
    </div>
  );
};

export default App;