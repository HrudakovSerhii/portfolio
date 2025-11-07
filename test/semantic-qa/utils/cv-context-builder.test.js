/**
 * Unit tests for CV Context Builder Utility Module
 * Tests CV section keyword matching, context building, and synthesis strategy determination
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  findRelevantSectionsByKeywords,
  buildCVContext,
  createSearchText,
  groupSectionsByCategory,
  determineSynthesisStrategy
} from '../../../src/scripts/modules/semantic-qa/utils/cv-context-builder.js';

describe('CV Context Builder Utility', () => {
  let mockCVSections;

  beforeEach(() => {
    // Create mock CV sections data
    mockCVSections = new Map([
      ['exp_react', {
        searchText: 'react reactjs jsx hooks components frontend development',
        section: {
          keywords: ['react', 'reactjs', 'jsx', 'hooks'],
          responses: {
            developer: 'I have 4+ years of React development experience with modern patterns.',
            hr: 'Serhii has extensive React experience.',
            friend: 'React is awesome! I love working with it.'
          },
          details: {
            years: 4,
            level: 'senior',
            skills: ['Hooks', 'Context API', 'Redux']
          }
        },
        category: 'experience',
        key: 'react'
      }],
      ['exp_javascript', {
        searchText: 'javascript js es6 vanilla programming language',
        section: {
          keywords: ['javascript', 'js', 'es6', 'vanilla'],
          responses: {
            developer: 'JavaScript is my primary language with 6+ years of experience.',
            hr: 'Serhii is an expert JavaScript developer.',
            friend: 'JavaScript is like my native language!'
          },
          details: {
            years: 6,
            level: 'expert'
          }
        },
        category: 'experience',
        key: 'javascript'
      }],
      ['proj_portfolio', {
        searchText: 'portfolio website personal project showcase vanilla javascript',
        section: {
          keywords: ['portfolio', 'website', 'personal', 'showcase'],
          responses: {
            developer: 'This portfolio site demonstrates my vanilla JS skills.',
            hr: 'The portfolio showcases technical capabilities.',
            friend: 'You\'re looking at one of my favorite projects!'
          },
          details: {
            technologies: ['Vanilla JavaScript', 'SCSS', 'HTML5']
          }
        },
        category: 'projects',
        key: 'portfolio'
      }]
    ]);
  });

  describe('findRelevantSectionsByKeywords', () => {
    it('should find sections matching query keywords', () => {
      const result = findRelevantSectionsByKeywords('react experience', mockCVSections);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].sectionId).toBe('exp_react');
      expect(result[0].similarity).toBeGreaterThan(0);
      expect(result[0].matchedKeywords).toContain('react');
    });

    it('should handle exact keyword matches with higher scores', () => {
      const result = findRelevantSectionsByKeywords('javascript', mockCVSections);
      
      expect(result.length).toBeGreaterThan(0);
      const jsMatch = result.find(r => r.sectionId === 'exp_javascript');
      expect(jsMatch).toBeDefined();
      expect(jsMatch.score).toBeGreaterThan(0);
      expect(jsMatch.matchedKeywords).toContain('javascript');
    });

    it('should return matches sorted by score', () => {
      const result = findRelevantSectionsByKeywords('react javascript', mockCVSections);
      
      if (result.length > 1) {
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
        }
      }
    });

    it('should limit results to top 3 matches', () => {
      // Add more sections to test limit
      mockCVSections.set('exp_node', {
        searchText: 'node nodejs backend server',
        section: { keywords: ['node', 'nodejs'] },
        category: 'experience'
      });
      mockCVSections.set('exp_css', {
        searchText: 'css scss styling frontend',
        section: { keywords: ['css', 'scss'] },
        category: 'experience'
      });
      
      const result = findRelevantSectionsByKeywords('javascript react node css', mockCVSections);
      
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should handle queries with no matches', () => {
      const result = findRelevantSectionsByKeywords('python django', mockCVSections);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle empty or invalid input', () => {
      expect(() => findRelevantSectionsByKeywords('', mockCVSections)).toThrow('Query must be a non-empty string');
      expect(() => findRelevantSectionsByKeywords(null, mockCVSections)).toThrow('Query must be a non-empty string');
      expect(() => findRelevantSectionsByKeywords('react', null)).toThrow('CV sections must be a Map');
      expect(() => findRelevantSectionsByKeywords('react', [])).toThrow('CV sections must be a Map');
    });

    it('should filter out short query words', () => {
      const result = findRelevantSectionsByKeywords('a react is good', mockCVSections);
      
      // Should match 'react' and 'good' but not 'a' or 'is'
      expect(result.length).toBeGreaterThan(0);
      const reactMatch = result.find(r => r.sectionId === 'exp_react');
      expect(reactMatch).toBeDefined();
    });

    it('should handle sections without keywords gracefully', () => {
      mockCVSections.set('exp_minimal', {
        searchText: 'minimal test section',
        section: {
          responses: { developer: 'Minimal section' }
        },
        category: 'experience'
      });
      
      const result = findRelevantSectionsByKeywords('minimal', mockCVSections);
      
      expect(result.length).toBeGreaterThan(0);
      const minimalMatch = result.find(r => r.sectionId === 'exp_minimal');
      expect(minimalMatch).toBeDefined();
    });
  });

  describe('buildCVContext', () => {
    it('should build context from relevant sections', () => {
      const relevantSections = [
        {
          sectionId: 'exp_react',
          similarity: 0.9,
          section: mockCVSections.get('exp_react').section
        }
      ];
      
      const context = buildCVContext(relevantSections);
      
      expect(typeof context).toBe('string');
      expect(context).toContain('About Serhii');
      expect(context).toContain('React development experience');
      expect(context).toContain('Experience: 4 years');
      expect(context).toContain('Skill level: senior');
    });

    it('should include key details when available', () => {
      const relevantSections = [
        {
          sectionId: 'exp_react',
          similarity: 0.9,
          section: mockCVSections.get('exp_react').section
        }
      ];
      
      const context = buildCVContext(relevantSections);
      
      expect(context).toContain('Key skills: Hooks, Context API, Redux');
    });

    it('should handle sections without details gracefully', () => {
      const minimalSection = {
        responses: {
          developer: 'I work with minimal technologies.'
        }
      };
      
      const relevantSections = [
        {
          sectionId: 'exp_minimal',
          similarity: 0.8,
          section: minimalSection
        }
      ];
      
      const context = buildCVContext(relevantSections);
      
      expect(typeof context).toBe('string');
      expect(context).toContain('About Serhii');
      expect(context).toContain('minimal technologies');
    });

    it('should return null for empty or invalid input', () => {
      expect(buildCVContext([])).toBe(null);
      expect(buildCVContext(null)).toBe(null);
      expect(buildCVContext(undefined)).toBe(null);
      expect(buildCVContext('invalid')).toBe(null);
    });

    it('should return null for sections without section data', () => {
      const relevantSections = [
        {
          sectionId: 'exp_empty',
          similarity: 0.9,
          section: null
        }
      ];
      
      const context = buildCVContext(relevantSections);
      
      expect(context).toBe(null);
    });

    it('should use best match only for focused context', () => {
      const relevantSections = [
        {
          sectionId: 'exp_react',
          similarity: 0.9,
          section: mockCVSections.get('exp_react').section
        },
        {
          sectionId: 'exp_javascript',
          similarity: 0.8,
          section: mockCVSections.get('exp_javascript').section
        }
      ];
      
      const context = buildCVContext(relevantSections);
      
      // Should only include React (best match), not JavaScript
      expect(context).toContain('React development experience');
      expect(context).not.toContain('JavaScript is my primary language');
    });

    it('should handle achievements when present', () => {
      const sectionWithAchievements = {
        responses: {
          developer: 'I have great achievements.'
        },
        details: {
          achievements: ['Built scalable apps', 'Led team of 5', 'Improved performance by 50%']
        }
      };
      
      const relevantSections = [
        {
          sectionId: 'exp_achievements',
          similarity: 0.9,
          section: sectionWithAchievements
        }
      ];
      
      const context = buildCVContext(relevantSections);
      
      expect(context).toContain('Notable achievements: Built scalable apps, Led team of 5');
    });
  });

  describe('createSearchText', () => {
    it('should create search text from section keywords', () => {
      const section = mockCVSections.get('exp_react').section;
      const searchText = createSearchText(section);
      
      expect(typeof searchText).toBe('string');
      expect(searchText).toContain('react');
      expect(searchText).toContain('reactjs');
      expect(searchText).toContain('jsx');
      expect(searchText).toContain('hooks');
    });

    it('should include response text in search text', () => {
      const section = mockCVSections.get('exp_react').section;
      const searchText = createSearchText(section);
      
      expect(searchText).toContain('react development experience');
    });

    it('should include skills from details', () => {
      const section = mockCVSections.get('exp_react').section;
      const searchText = createSearchText(section);
      
      expect(searchText).toContain('hooks');
      expect(searchText).toContain('context api');
      expect(searchText).toContain('redux');
    });

    it('should include technologies when available', () => {
      const section = mockCVSections.get('proj_portfolio').section;
      const searchText = createSearchText(section);
      
      expect(searchText).toContain('vanilla javascript');
      expect(searchText).toContain('scss');
      expect(searchText).toContain('html5');
    });

    it('should handle empty or invalid input', () => {
      expect(createSearchText(null)).toBe('');
      expect(createSearchText(undefined)).toBe('');
      expect(createSearchText({})).toBe('');
      expect(createSearchText('invalid')).toBe('');
    });

    it('should handle sections with missing properties', () => {
      const minimalSection = {
        responses: {
          developer: 'Basic response'
        }
      };
      
      const searchText = createSearchText(minimalSection);
      
      expect(searchText).toBe('basic response');
    });

    it('should convert to lowercase', () => {
      const section = {
        keywords: ['React', 'JavaScript'],
        responses: {
          developer: 'I Love React Development'
        }
      };
      
      const searchText = createSearchText(section);
      
      expect(searchText).toBe('react javascript i love react development');
    });
  });

  describe('groupSectionsByCategory', () => {
    it('should group sections by category', () => {
      const sections = [
        { sectionId: 'exp_react', category: 'experience' },
        { sectionId: 'exp_javascript', category: 'experience' },
        { sectionId: 'proj_portfolio', category: 'projects' }
      ];
      
      const grouped = groupSectionsByCategory(sections);
      
      expect(typeof grouped).toBe('object');
      expect(grouped.experience).toBeDefined();
      expect(grouped.projects).toBeDefined();
      expect(grouped.experience.length).toBe(2);
      expect(grouped.projects.length).toBe(1);
    });

    it('should handle sections without category', () => {
      const sections = [
        { sectionId: 'exp_react', category: 'experience' },
        { sectionId: 'unknown_section' }
      ];
      
      const grouped = groupSectionsByCategory(sections);
      
      expect(grouped.experience).toBeDefined();
      expect(grouped.unknown).toBeDefined();
      expect(grouped.unknown.length).toBe(1);
    });

    it('should handle empty or invalid input', () => {
      expect(groupSectionsByCategory([])).toEqual({});
      expect(groupSectionsByCategory(null)).toEqual({});
      expect(groupSectionsByCategory(undefined)).toEqual({});
      expect(groupSectionsByCategory('invalid')).toEqual({});
    });

    it('should handle single category', () => {
      const sections = [
        { sectionId: 'exp_react', category: 'experience' },
        { sectionId: 'exp_javascript', category: 'experience' }
      ];
      
      const grouped = groupSectionsByCategory(sections);
      
      expect(Object.keys(grouped).length).toBe(1);
      expect(grouped.experience.length).toBe(2);
    });
  });

  describe('determineSynthesisStrategy', () => {
    it('should return "comparative" for comparison queries', () => {
      const testCases = [
        'React vs Vue',
        'Compare JavaScript and TypeScript',
        'What is the difference between Node and Deno'
      ];
      
      testCases.forEach(query => {
        const strategy = determineSynthesisStrategy(query, {});
        expect(strategy).toBe('comparative');
      });
    });

    it('should return "comprehensive" for multiple categories', () => {
      const sectionsByCategory = {
        experience: [{ sectionId: 'exp_react' }],
        projects: [{ sectionId: 'proj_portfolio' }],
        skills: [{ sectionId: 'skill_frontend' }]
      };
      
      const strategy = determineSynthesisStrategy('tell me about yourself', sectionsByCategory);
      
      expect(strategy).toBe('comprehensive');
    });

    it('should return "focused" for multiple sections in same category', () => {
      const sectionsByCategory = {
        experience: [
          { sectionId: 'exp_react' },
          { sectionId: 'exp_javascript' }
        ]
      };
      
      const strategy = determineSynthesisStrategy('frontend experience', sectionsByCategory);
      
      expect(strategy).toBe('focused');
    });

    it('should return "single" for single section', () => {
      const sectionsByCategory = {
        experience: [{ sectionId: 'exp_react' }]
      };
      
      const strategy = determineSynthesisStrategy('React experience', sectionsByCategory);
      
      expect(strategy).toBe('single');
    });

    it('should handle empty or invalid input', () => {
      expect(determineSynthesisStrategy('', {})).toBe('single');
      expect(determineSynthesisStrategy(null, {})).toBe('single');
      expect(determineSynthesisStrategy('query', null)).toBe('single');
      expect(determineSynthesisStrategy('query', undefined)).toBe('single');
    });

    it('should prioritize comparative over other strategies', () => {
      const sectionsByCategory = {
        experience: [
          { sectionId: 'exp_react' },
          { sectionId: 'exp_javascript' }
        ],
        projects: [{ sectionId: 'proj_portfolio' }]
      };
      
      const strategy = determineSynthesisStrategy('React vs JavaScript experience', sectionsByCategory);
      
      expect(strategy).toBe('comparative');
    });

    it('should handle edge cases', () => {
      // Empty sections
      expect(determineSynthesisStrategy('query', {})).toBe('single');
      
      // Single empty category
      const emptySections = { experience: [] };
      expect(determineSynthesisStrategy('query', emptySections)).toBe('single');
    });
  });

  describe('Integration Tests', () => {
    it('should process complete CV context building workflow', () => {
      const query = 'React development experience';
      
      // Find relevant sections
      const relevantSections = findRelevantSectionsByKeywords(query, mockCVSections);
      expect(relevantSections.length).toBeGreaterThan(0);
      
      // Build context
      const context = buildCVContext(relevantSections);
      expect(context).toBeDefined();
      expect(context).toContain('React');
      
      // Group sections
      const grouped = groupSectionsByCategory(relevantSections);
      expect(grouped.experience).toBeDefined();
      
      // Determine strategy
      const strategy = determineSynthesisStrategy(query, grouped);
      expect(['single', 'focused', 'comprehensive', 'comparative']).toContain(strategy);
    });

    it('should handle malformed CV data gracefully', () => {
      const malformedSections = new Map([
        ['broken_section', {
          // Missing searchText and section
          category: 'experience'
        }]
      ]);
      
      const relevantSections = findRelevantSectionsByKeywords('test', malformedSections);
      expect(relevantSections.length).toBe(0);
      
      const context = buildCVContext(relevantSections);
      expect(context).toBe(null);
    });
  });
});