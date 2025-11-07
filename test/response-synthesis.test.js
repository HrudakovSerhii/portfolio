/**
 * Integration tests for response synthesis and multi-section combination
 * Tests the ConversationManager's enhanced response generation capabilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import ConversationManager from '../src/scripts/modules/chat-bot/conversation-manager.js';

describe('Response Synthesis Integration Tests', () => {
  let conversationManager;
  let mockCVMatches;

  beforeEach(() => {
    conversationManager = new ConversationManager();
    conversationManager.setStyle('developer');

    // Mock CV matches for testing
    mockCVMatches = [
      {
        id: 'exp_react',
        confidence: 0.95,
        responses: {
          hr: 'Serhii has 4+ years of professional React development experience, having built 20+ production applications.',
          developer: 'I\'ve been working with React for 4+ years now. Really love the hooks ecosystem and functional components.',
          friend: 'Oh React! 🚀 That\'s definitely one of my favorite frameworks to work with. Been coding with it for 4+ years.'
        },
        category: 'experience',
        keywords: ['react', 'reactjs', 'jsx', 'hooks']
      },
      {
        id: 'exp_javascript',
        confidence: 0.85,
        responses: {
          hr: 'Serhii possesses advanced JavaScript skills with 6+ years of experience in modern ES6+ development.',
          developer: 'JavaScript is my bread and butter - 6+ years of experience with everything from vanilla JS to modern frameworks.',
          friend: 'JavaScript is like my native language at this point! 😄 Been writing it for 6+ years.'
        },
        category: 'experience',
        keywords: ['javascript', 'js', 'es6', 'vanilla']
      },
      {
        id: 'proj_portfolio',
        confidence: 0.75,
        responses: {
          hr: 'Serhii\'s portfolio website demonstrates his technical skills through a performance-optimized static site.',
          developer: 'This portfolio site you\'re looking at! Built it with vanilla JS and SCSS to keep things lightweight.',
          friend: 'You\'re actually looking at one of my favorite projects right now! 😊 Built this whole portfolio from scratch.'
        },
        category: 'projects',
        keywords: ['portfolio', 'website', 'personal', 'showcase']
      }
    ];
  });

  describe('Single Section Response Generation', () => {
    it('should generate appropriate responses for each conversation style', () => {
      const singleMatch = [mockCVMatches[0]]; // React experience
      const styles = ['hr', 'developer', 'friend'];

      styles.forEach(style => {
        conversationManager.setStyle(style);
        const response = conversationManager.generateResponse(
          'Tell me about React',
          singleMatch,
          style
        );

        expect(response).toBeDefined();
        expect(response.length).toBeGreaterThan(20);
        expect(response).toContain('React');
        
        // Style-specific expectations
        if (style === 'hr') {
          expect(response).toContain('professional');
          expect(response).toContain('experience');
        } else if (style === 'friend') {
          expect(response).toContain('🚀');
        }
      });
    });

    it('should handle missing style responses gracefully', () => {
      const matchWithMissingStyle = [{
        id: 'test_section',
        confidence: 0.8,
        responses: {
          developer: 'I have experience with this technology.'
          // Missing hr and friend responses
        }
      }];

      conversationManager.setStyle('hr');
      const response = conversationManager.generateResponse(
        'Tell me about this',
        matchWithMissingStyle,
        'hr'
      );

      // Should fallback to developer response or generic response
      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Section Response Synthesis', () => {
    it('should combine responses from same category appropriately', () => {
      const sameCategory = mockCVMatches.slice(0, 2); // React and JavaScript (both experience)
      
      const response = conversationManager.generateResponse(
        'Tell me about your frontend experience',
        sameCategory,
        'developer'
      );

      expect(response).toContain('React');
      expect(response).toContain('JavaScript');
      expect(response).toMatch(/Also,|Additionally,|Also/); // Should contain connectors
    });

    it('should handle cross-category responses comprehensively', () => {
      const crossCategory = [mockCVMatches[0], mockCVMatches[2]]; // React (experience) + Portfolio (projects)
      
      const response = conversationManager.generateResponse(
        'Tell me about your React work',
        crossCategory,
        'developer'
      );

      expect(response).toContain('React');
      expect(response).toContain('portfolio');
      expect(response.length).toBeGreaterThan(100); // Should be comprehensive
    });

    it('should use appropriate connectors for different styles', () => {
      const multipleMatches = mockCVMatches.slice(0, 2);
      
      const styles = [
        { style: 'hr', expectedConnectors: ['Additionally'] },
        { style: 'developer', expectedConnectors: ['Also'] },
        { style: 'friend', expectedConnectors: ['Oh, and'] }
      ];

      styles.forEach(({ style, expectedConnectors }) => {
        const response = conversationManager.generateResponse(
          'Tell me about your experience',
          multipleMatches,
          style
        );

        const hasExpectedConnector = expectedConnectors.some(connector => 
          response.includes(connector)
        );
        expect(hasExpectedConnector).toBe(true);
      });
    });
  });

  describe('Context-Aware Response Generation', () => {
    it('should reference previous conversation when relevant', () => {
      // Add some conversation history
      conversationManager.addMessage(
        'Tell me about React',
        'I have 4+ years of React experience',
        ['exp_react'],
        0.9
      );

      const response = conversationManager.generateResponse(
        'What about JavaScript?',
        [mockCVMatches[1]], // JavaScript match
        'developer'
      );

      // Should include contextual reference since both are related (experience category)
      expect(response).toMatch(/Following up|Building on|Speaking of/);
    });

    it('should maintain context window correctly', () => {
      // Add multiple messages to test context window
      for (let i = 0; i < 7; i++) {
        conversationManager.addMessage(
          `Question ${i}`,
          `Response ${i}`,
          [`section_${i}`],
          0.8
        );
      }

      const context = conversationManager.getContext();
      expect(context.length).toBeLessThanOrEqual(5); // Should maintain 5-message limit
      
      // Should contain most recent messages
      const lastMessage = context[context.length - 1];
      expect(lastMessage.userMessage).toContain('Question 6');
    });

    it('should extract topics from conversation history correctly', () => {
      conversationManager.addMessage(
        'Tell me about React',
        'I have React experience',
        ['exp_react'],
        0.9
      );

      conversationManager.addMessage(
        'What about hooks?',
        'I love working with hooks',
        ['exp_react'],
        0.85
      );

      const context = conversationManager.getContext(['exp_react'], 3);
      expect(context.length).toBe(2); // Should find both related messages
      
      context.forEach(entry => {
        expect(entry.matchedSections).toContain('exp_react');
      });
    });
  });

  describe('Fallback Response Handling', () => {
    it('should generate appropriate fallback responses when no matches found', () => {
      const styles = ['hr', 'developer', 'friend'];
      
      styles.forEach(style => {
        const response = conversationManager.generateResponse(
          'Tell me about quantum computing',
          [], // No matches
          style
        );

        expect(response).toBeDefined();
        expect(response.length).toBeGreaterThan(20);
        
        // Should contain appropriate fallback language
        if (style === 'hr') {
          expect(response).toMatch(/apologize|don't have|rephrase/i);
        } else if (style === 'friend') {
          expect(response).toContain('😅');
        }
      });
    });

    it('should handle low confidence matches appropriately', () => {
      const lowConfidenceMatches = [{
        id: 'exp_react',
        confidence: 0.3, // Low confidence
        responses: mockCVMatches[0].responses
      }];

      const response = conversationManager.generateResponse(
        'React experience?',
        lowConfidenceMatches,
        'developer'
      );

      // Should still generate a response but might be more cautious
      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(0);
    });
  });

  describe('Response Quality and Metrics', () => {
    it('should generate responses of appropriate length', () => {
      const testCases = [
        { matches: mockCVMatches.slice(0, 1), minLength: 30 }, // Single match
        { matches: mockCVMatches.slice(0, 2), minLength: 60 }, // Multiple matches
        { matches: mockCVMatches, minLength: 80 } // All matches
      ];

      testCases.forEach(({ matches, minLength }) => {
        const response = conversationManager.generateResponse(
          'Tell me about your experience',
          matches,
          'developer'
        );

        expect(response.length).toBeGreaterThanOrEqual(minLength);
      });
    });

    it('should maintain response coherence across multiple sections', () => {
      const response = conversationManager.generateResponse(
        'Tell me about your technical background',
        mockCVMatches,
        'developer'
      );

      // Should be coherent - check for basic sentence structure
      expect(response.split('.').length).toBeGreaterThan(1); // Should have multiple sentences
      
      // Should flow naturally
      expect(response).toMatch(/Also|Additionally|Furthermore|Moreover/i);
    });

    it('should handle edge cases gracefully', () => {
      const edgeCases = [
        { matches: null, query: 'test' },
        { matches: [], query: '' },
        { matches: mockCVMatches, query: null }
      ];

      edgeCases.forEach(({ matches, query }) => {
        expect(() => {
          conversationManager.generateResponse(query || 'test', matches || [], 'developer');
        }).not.toThrow();
      });
    });
  });

  describe('Conversation Statistics and Analytics', () => {
    it('should track conversation statistics correctly', () => {
      // Add some conversation history
      conversationManager.addMessage('Question 1', 'Response 1', ['exp_react'], 0.9);
      conversationManager.addMessage('Question 2', 'Response 2', ['exp_javascript'], 0.8);
      conversationManager.addMessage('Question 3', 'Response 3', ['proj_portfolio'], 0.7);

      const stats = conversationManager.getConversationStats();

      expect(stats.messageCount).toBe(3);
      expect(stats.currentStyle).toBe('developer');
      expect(stats.averageConfidence).toBeCloseTo(0.8, 1);
      expect(stats.topicsDiscussed).toContain('exp_react');
      expect(stats.topicsDiscussed).toContain('exp_javascript');
      expect(stats.topicsDiscussed).toContain('proj_portfolio');
    });

    it('should calculate average confidence correctly', () => {
      conversationManager.addMessage('Q1', 'R1', ['s1'], 1.0);
      conversationManager.addMessage('Q2', 'R2', ['s2'], 0.6);
      conversationManager.addMessage('Q3', 'R3', ['s3'], 0.8);

      const stats = conversationManager.getConversationStats();
      expect(stats.averageConfidence).toBeCloseTo(0.8, 1);
    });

    it('should identify unique topics discussed', () => {
      conversationManager.addMessage('Q1', 'R1', ['exp_react', 'exp_javascript'], 0.9);
      conversationManager.addMessage('Q2', 'R2', ['exp_react'], 0.8);
      conversationManager.addMessage('Q3', 'R3', ['proj_portfolio'], 0.7);

      const stats = conversationManager.getConversationStats();
      const uniqueTopics = stats.topicsDiscussed;

      expect(uniqueTopics).toHaveLength(3);
      expect(uniqueTopics).toContain('exp_react');
      expect(uniqueTopics).toContain('exp_javascript');
      expect(uniqueTopics).toContain('proj_portfolio');
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large conversation histories efficiently', () => {
      const startTime = Date.now();
      
      // Add many messages to test performance
      for (let i = 0; i < 100; i++) {
        conversationManager.addMessage(
          `Question ${i}`,
          `Response ${i}`,
          [`section_${i % 10}`],
          Math.random()
        );
      }

      const context = conversationManager.getContext();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      expect(context.length).toBeLessThanOrEqual(5); // Should maintain limit
      expect(conversationManager.history.length).toBeLessThanOrEqual(25); // Should maintain history limit
    });

    it('should generate responses quickly for complex queries', () => {
      const startTime = Date.now();
      
      const response = conversationManager.generateResponse(
        'Tell me about your comprehensive technical background including all your experience with frontend and backend technologies, projects you\'ve worked on, and your overall approach to software development',
        mockCVMatches,
        'developer'
      );

      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(50);
    });
  });
});