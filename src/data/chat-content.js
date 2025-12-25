/**
 * Chat Content Data Structure
 * Role-personalized content for chat-based portfolio sections
 * Each message can be filtered by role: 'recruiter', 'developer', 'friend'
 */

const AVATAR_URL = './assets/images/avatar.webp';
const BOT_NAME = 'Portfolio Assistant';

/**
 * About Section Messages
 */
export const aboutMessages = [
  {
    text: "Hey there! Let me introduce myself.",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: [] // Show to all roles
  },
  {
    text: "I'm a Senior Frontend Engineer with a passion for building performant, accessible web experiences.",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: ['recruiter', 'developer']
  },
  {
    text: "I love solving complex problems with clean, maintainable code and making the web a better place.",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: ['developer']
  },
  {
    text: "Beyond code, I'm someone who values collaboration, continuous learning, and building meaningful connections.",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: ['friend']
  },
  {
    text: "When I'm not coding, you'll find me exploring new technologies, contributing to open source, or mentoring junior developers.",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: [] // Show to all
  }
];

/**
 * Experience Section Messages
 * Include job details as attachments
 */
export const experienceMessages = [
  {
    text: "Let me walk you through my professional journey.",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: []
  },
  {
    text: "Here's my current role and what I'm working on:",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: [],
    attachment: {
      type: 'experience',
      data: {
        role: 'Senior Frontend Engineer',
        company: 'TechCorp',
        period: '2022 - Present',
        description: 'Leading frontend architecture and <strong>performance optimization</strong> for a high-traffic SaaS platform. Reduced initial load time by 40% and improved Core Web Vitals across the board.',
        descriptionHtml: 'Leading frontend architecture and <strong>performance optimization</strong> for a high-traffic SaaS platform. Reduced initial load time by <strong>40%</strong> and improved Core Web Vitals across the board.',
        techStack: ['React', 'TypeScript', 'Next.js', 'GraphQL', 'Tailwind'],
        visual: {
          imageUrl: './assets/images/experience-metrics.png',
          alt: 'Performance metrics dashboard',
          caption: 'Performance improvements over 6 months'
        }
      }
    }
  },
  {
    text: "What I built here:",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: ['developer'],
    attachment: {
      type: 'experience',
      data: {
        role: 'Frontend Developer',
        company: 'StartupXYZ',
        period: '2020 - 2022',
        description: 'Built the company\'s design system from scratch, creating reusable components used across 5 products.',
        techStack: ['Vue.js', 'TypeScript', 'Storybook', 'Jest'],
        visual: {
          imageUrl: './assets/images/design-system.png',
          alt: 'Component library screenshot',
          caption: 'Design system components',
          compact: true
        }
      }
    }
  },
  {
    text: "My track record includes consistent delivery and strong stakeholder relationships.",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: ['recruiter']
  }
];

/**
 * Projects Section Messages
 */
export const projectsMessages = [
  {
    text: "Here are some projects I'm proud of:",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: []
  },
  {
    text: "This one showcases my focus on developer experience:",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: ['developer'],
    attachment: {
      type: 'project',
      data: {
        title: 'Component Playground',
        category: 'Developer Tools',
        description: 'Interactive environment for testing React components in isolation. Features hot reloading, TypeScript support, and built-in accessibility testing.',
        imageUrl: './assets/images/project-playground.png',
        imageAlt: 'Component Playground screenshot',
        techStack: ['React', 'TypeScript', 'Vite', 'Testing Library'],
        links: {
          demo: 'https://example.com/demo',
          code: 'https://github.com/example/repo'
        }
      }
    }
  },
  {
    text: "A project that delivered measurable business impact:",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: ['recruiter'],
    attachment: {
      type: 'project',
      data: {
        title: 'E-Commerce Dashboard',
        category: 'SaaS Product',
        description: 'Real-time analytics dashboard for e-commerce businesses. Increased user engagement by 35% and reduced support tickets by 20%.',
        imageUrl: './assets/images/project-dashboard.png',
        techStack: ['Next.js', 'GraphQL', 'PostgreSQL', 'Redis'],
        links: {
          demo: 'https://example.com/dashboard'
        }
      }
    }
  }
];

/**
 * Skills Section Messages
 */
export const skillsMessages = [
  {
    text: "Here's what I bring to the table:",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: []
  },
  {
    text: "Core technical skills:",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: [],
    attachment: {
      type: 'skills',
      data: {
        title: 'Languages & Frameworks',
        icon: '💻',
        type: 'progress',
        skills: [
          { name: 'JavaScript/TypeScript', level: 'Expert', percentage: 95 },
          { name: 'React & Next.js', level: 'Expert', percentage: 95 },
          { name: 'Vue.js', level: 'Advanced', percentage: 85 },
          { name: 'Node.js', level: 'Advanced', percentage: 80 },
          { name: 'Python', level: 'Intermediate', percentage: 70 }
        ]
      }
    }
  },
  {
    text: "Technologies I work with daily:",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: ['developer'],
    attachment: {
      type: 'skills',
      data: {
        title: 'Tech Stack',
        icon: '🛠',
        type: 'chips',
        skills: ['React', 'Next.js', 'TypeScript', 'Tailwind', 'GraphQL', 'Node.js', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'Git', 'Figma']
      }
    }
  },
  {
    text: "Beyond technical skills, I excel at communication, project management, and mentoring.",
    sender: BOT_NAME,
    avatarUrl: AVATAR_URL,
    isUser: false,
    roles: ['recruiter']
  }
];

/**
 * Get messages for a specific section and role
 * @param {string} section - Section ID (about, experience, projects, skills)
 * @param {string} role - User role (recruiter, developer, friend)
 * @returns {Array} Filtered messages
 */
export function getMessagesForSection(section, role) {
  const messageMap = {
    about: aboutMessages,
    experience: experienceMessages,
    projects: projectsMessages,
    skills: skillsMessages
  };

  const messages = messageMap[section] || [];

  return messages.filter(msg => {
    if (!msg.roles || msg.roles.length === 0) {
      return true; // Show to all roles
    }
    return msg.roles.includes(role);
  });
}

/**
 * Get all available sections
 * @returns {Array} Section metadata
 */
export function getSections() {
  return [
    { id: 'about', title: 'About', icon: '👤' },
    { id: 'experience', title: 'Experience', icon: '💼' },
    { id: 'projects', title: 'Projects', icon: '🚀' },
    { id: 'skills', title: 'Skills', icon: '🛠' }
  ];
}