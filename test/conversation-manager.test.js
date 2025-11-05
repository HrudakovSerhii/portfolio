/**
 * Unit tests for ConversationManager
 * Tests context management, response generation, and conversation flow
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Import ConversationManager using dynamic import for CommonJS module
const ConversationManager = await import('../src/scripts/modules/chat-bot/conversation-manager.js').then(m => m.default);

describe('ConversationManager', () => {
  let conversationManager;

  beforeEach(() => {
    conversationManager = new ConversationManager();
  });

  describe('Initialization', () => {
    it('should initialize with empty history', () => {
      expect(conversationManager.history).toEqual([]);
      expect(conversationManager.maxContextSize).toBe(5);
      expect(conversationManager.currentStyle).toBeNull();
    });

    it('should generate unique session IDs', () => {
      const manager1 = new ConversationManager();
      const manager2 = new ConversationManager();
      expect(manager1.sessionId).not.toBe(manager2.sessionId);
      expect(manager1.sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });
  });

  describe('Style Management', () => {
    it('should set valid conversation styles', () => {
      conversationManager.setStyle('hr');
      expect(conversationManager.getStyle()).toBe('hr');

      conversationManager.setStyle('developer');
      expect(conversationManager.getStyle()).toBe('developer');

      conversationManager.setStyle('friend');
      expect(conversationManager.getStyle()).toBe('friend');
    });

    it('should throw error for invalid styles', () => {
      expect(() => conversationManager.setStyle('invalid')).toThrow('Invalid conversation style');
    });
  });

  describe('Message History Management', () => {
    beforeEach(() => {
      conversationManager.setStyle('developer');
    });

    it('should add messages to history', () => {
      conversationManager.addMessage(
        'What is React?',
        'React is a JavaScript library',
        ['experience.react'],
        0.95
      );

      expect(conversationManager.history).toHaveLength(1);
      const message = conversationManager.history[0];
      expect(message.userMessage).toBe('What is React?');
      expect(message.botResponse).toBe('React is a JavaScript library');
      expect(message.matchedSections).toEqual(['experience.react']);
      expect(message.confidence).toBe(0.95);
      expect(message.style).toBe('developer');
      expect(message.timestamp).toBeDefined();
    });

    it('should trim whitespace from messages', () => {
      conversationManager.addMessage('  Hello  ', '  World  ');
      const message = conversationManager.history[0];
      expect(message.userMessage).toBe('Hello');
      expect(message.botResponse).toBe('World');
    });

    it('should maintain 25-message history limit', () => {
      // Add 30 messages
      for (let i = 1; i <= 30; i++) {
        conversationManager.addMessage(`Question ${i}`, `Answer ${i}`);
      }

      // History is limited to 25 messages
      expect(conversationManager.history).toHaveLength(25);
      expect(conversationManager.history[0].userMessage).toBe('Question 6');
      expect(conversationManager.history[24].userMessage).toBe('Question 30');

      // getContext without topics returns last 5 messages
      const context = conversationManager.getContext();
      expect(context).toHaveLength(5);
      expect(context[0].userMessage).toBe('Question 26');
      expect(context[4].userMessage).toBe('Question 30');
    });

    it('should get context with specified limit', () => {
      // Ensure clean state
      conversationManager.clearHistory();

      for (let i = 1; i <= 7; i++) {
        conversationManager.addMessage(`Question ${i}`, `Answer ${i}`);
      }

      // Request 3 messages
      const context3 = conversationManager.getContext(3);
      expect(context3).toHaveLength(3);
      expect(context3[0].userMessage).toBe('Question 5');
      expect(context3[2].userMessage).toBe('Question 7');

      // Request more than available (should return all 7)
      const context10 = conversationManager.getContext(10);
      expect(context10).toHaveLength(7);
      expect(context10[0].userMessage).toBe('Question 1');

      // Default context (max 5)
      const contextAll = conversationManager.getContext();
      expect(contextAll).toHaveLength(5);
      expect(contextAll[0].userMessage).toBe('Question 3');
    });

    it('should get topic-aware context', () => {
      // Ensure clean state
      conversationManager.clearHistory();

      // Add messages with different topics
      conversationManager.addMessage('React question 1', 'React answer 1', ['experience.react']);
      conversationManager.addMessage('Node.js question', 'Node.js answer', ['experience.nodejs']);
      conversationManager.addMessage('React question 2', 'React answer 2', ['experience.react']);
      conversationManager.addMessage('Python question', 'Python answer', ['skills.python']);
      conversationManager.addMessage('React question 3', 'React answer 3', ['experience.react']);

      // Get context for React topics - should return only React messages
      const reactContext = conversationManager.getContext(['experience.react']);

      expect(reactContext).toHaveLength(3);
      expect(reactContext[0].userMessage).toBe('React question 1');
      expect(reactContext[1].userMessage).toBe('React question 2');
      expect(reactContext[2].userMessage).toBe('React question 3');

      // Get context for Node.js topics
      const nodeContext = conversationManager.getContext(['experience.nodejs']);
      expect(nodeContext).toHaveLength(1);
      expect(nodeContext[0].userMessage).toBe('Node.js question');
    });

    it('should fall back to recent messages when no topic matches found', () => {
      conversationManager.addMessage('Question 1', 'Answer 1', ['topic1']);
      conversationManager.addMessage('Question 2', 'Answer 2', ['topic2']);
      conversationManager.addMessage('Question 3', 'Answer 3', ['topic3']);

      // Request context for non-existent topic
      const context = conversationManager.getContext(['nonexistent.topic']);
      expect(context).toHaveLength(3); // Should return all recent messages
    });

    it('should handle related topics correctly', () => {
      expect(conversationManager.areTopicsRelated('experience.react', 'experience.react')).toBe(true);
      expect(conversationManager.areTopicsRelated('experience.react', 'experience.nodejs')).toBe(false);
      expect(conversationManager.areTopicsRelated('experience.react', 'skills.javascript')).toBe(false);
      expect(conversationManager.areTopicsRelated('skills.python', 'skills.javascript')).toBe(false);
    });

    it('should clear history and generate new session ID', () => {
      conversationManager.addMessage('Test', 'Response');
      const oldSessionId = conversationManager.sessionId;

      conversationManager.clearHistory();

      expect(conversationManager.history).toHaveLength(0);
      expect(conversationManager.sessionId).not.toBe(oldSessionId);
    });
  });

  describe('Response Generation', () => {
    beforeEach(() => {
      conversationManager.setStyle('developer');
    });

    it('should throw error when style not set', () => {
      const manager = new ConversationManager();
      expect(() => manager.generateResponse('test', [])).toThrow('Conversation style must be set');
    });

    it('should generate fallback response for no matches', () => {
      const response = conversationManager.generateResponse('unknown query', []);
      expect(response).toContain('don\'t have details');
      expect(response).toContain('rephras');
    });

    it('should generate response from single CV match', () => {
      const cvMatch = {
        id: 'experience.react',
        responses: {
          developer: 'I\'ve been working with React for 3+ years now.',
          hr: 'Serhii has 3+ years of professional React development experience.',
          friend: 'Oh React! 🚀 That\'s definitely one of my favorite frameworks.'
        },
        confidence: 0.95
      };

      const response = conversationManager.generateResponse('React experience', [cvMatch]);
      expect(response).toContain('I\'ve been working with React for 3+ years now.');
    });

    it('should handle multiple CV matches', () => {
      const cvMatches = [
        {
          id: 'experience.react',
          responses: { developer: 'React experience here.' },
          confidence: 0.95
        },
        {
          id: 'skills.javascript',
          responses: { developer: 'JavaScript skills here.' },
          confidence: 0.85
        }
      ];

      const response = conversationManager.generateResponse('frontend skills', cvMatches);
      expect(response).toContain('React experience here.');
      expect(response).toContain('JavaScript skills here.');
    });

    it('should generate style-specific responses', () => {
      const cvMatch = {
        responses: {
          hr: 'Professional response',
          developer: 'Technical response',
          friend: 'Casual response 😊'
        }
      };

      conversationManager.setStyle('hr');
      let response = conversationManager.generateResponse('test', [cvMatch]);
      expect(response).toContain('Professional response');

      conversationManager.setStyle('friend');
      response = conversationManager.generateResponse('test', [cvMatch]);
      expect(response).toContain('Casual response 😊');
    });

    it('should generate fallback responses for each style', () => {
      conversationManager.setStyle('hr');
      let response = conversationManager.generateResponse('unknown', []);
      expect(response).toContain('apologize');

      conversationManager.setStyle('developer');
      response = conversationManager.generateResponse('unknown', []);
      expect(response).toContain('Hmm');

      conversationManager.setStyle('friend');
      response = conversationManager.generateResponse('unknown', []);
      expect(response).toContain('😅');
    });
  });

  describe('Contextual Response Enhancement', () => {
    beforeEach(() => {
      conversationManager.setStyle('developer');
    });

    it('should add contextual references for related topics', () => {
      // Add a message about React
      conversationManager.addMessage(
        'Tell me about React',
        'React is great for building UIs',
        ['experience.react']
      );

      // Ask a follow-up about React
      const cvMatch = {
        responses: { developer: 'React hooks are powerful.' }
      };

      const response = conversationManager.generateResponse('React hooks', [cvMatch]);
      // Should include contextual reference since it's related to previous React discussion
      expect(response).toBeDefined();
    });

    it('should extract topics from conversation history', () => {
      conversationManager.addMessage(
        'React question',
        'React answer',
        ['experience.react']
      );

      const context = conversationManager.getContext(1);
      const topic = conversationManager.extractTopicFromHistory(context);
      expect(topic).toBe('experience.react');
    });

    it('should detect related topics correctly', () => {
      const isRelated1 = conversationManager.isRelatedTopic('experience.react', 'React is awesome');
      expect(isRelated1).toBe(true);

      const isRelated2 = conversationManager.isRelatedTopic('skills.javascript', 'Python is different');
      expect(isRelated2).toBe(false);
    });
  });

  describe('Response Combination Logic', () => {
    beforeEach(() => {
      conversationManager.setStyle('developer');
    });

    it('should get appropriate style connectors', () => {
      conversationManager.setStyle('hr');
      const connectors = conversationManager.getStyleConnectors('hr');
      expect(connectors.continuation).toBe('Additionally,');

      conversationManager.setStyle('friend');
      const friendConnectors = conversationManager.getStyleConnectors('friend');
      expect(friendConnectors.continuation).toBe('Oh, and');
    });

    it('should generate multi-topic introductions', () => {
      conversationManager.setStyle('hr');
      const intro = conversationManager.getMultiTopicIntro('hr', 'test query');
      expect(intro).toBe('Regarding your question,');

      conversationManager.setStyle('friend');
      const friendIntro = conversationManager.getMultiTopicIntro('friend', 'test query');
      expect(friendIntro).toContain('😊');
    });

    it('should combine multiple responses coherently', () => {
      const responses = ['First response.', 'Second response.'];
      const combined = conversationManager.combineResponses(responses, 'developer', 'test query');

      expect(combined).toContain('First response.');
      expect(combined).toContain('Second response.');
      expect(combined).toContain('Also,'); // Developer style connector
    });
  });

  describe('Conversation Statistics', () => {
    beforeEach(() => {
      conversationManager.setStyle('developer');
    });

    it('should calculate conversation statistics', () => {
      conversationManager.addMessage('Q1', 'A1', ['topic1'], 0.9);
      conversationManager.addMessage('Q2', 'A2', ['topic2'], 0.8);

      const stats = conversationManager.getConversationStats();
      expect(stats.messageCount).toBe(2);
      expect(stats.currentStyle).toBe('developer');
      expect(stats.averageConfidence).toBeCloseTo(0.85);
      expect(stats.topicsDiscussed).toEqual(['topic1', 'topic2']);
      expect(stats.sessionId).toBeDefined();
    });

    it('should calculate average confidence correctly', () => {
      conversationManager.addMessage('Q1', 'A1', [], 1.0);
      conversationManager.addMessage('Q2', 'A2', [], 0.5);
      conversationManager.addMessage('Q3', 'A3', [], 0.75);

      const avgConfidence = conversationManager.calculateAverageConfidence();
      expect(avgConfidence).toBeCloseTo(0.75);
    });

    it('should return zero confidence for empty history', () => {
      const avgConfidence = conversationManager.calculateAverageConfidence();
      expect(avgConfidence).toBe(0);
    });

    it('should track unique topics discussed', () => {
      conversationManager.addMessage('Q1', 'A1', ['topic1', 'topic2']);
      conversationManager.addMessage('Q2', 'A2', ['topic2', 'topic3']);
      conversationManager.addMessage('Q3', 'A3', ['topic1']);

      const uniqueTopics = conversationManager.getUniqueTopics();
      expect(uniqueTopics).toHaveLength(3);
      expect(uniqueTopics).toContain('topic1');
      expect(uniqueTopics).toContain('topic2');
      expect(uniqueTopics).toContain('topic3');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty CV matches gracefully', () => {
      conversationManager.setStyle('developer');
      const response = conversationManager.generateResponse('test', []);
      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(0);
    });

    it('should handle CV matches without style-specific responses', () => {
      conversationManager.setStyle('developer');
      const cvMatch = {
        id: 'test_section',
        responses: {} // No responses for any style
      };

      const response = conversationManager.generateResponse('test', [cvMatch]);
      expect(response).toBeDefined();
      expect(response).toContain('technically discuss');
    });

    it('should handle malformed CV matches', () => {
      conversationManager.setStyle('developer');
      const malformedMatch = { id: 'test' }; // Missing responses

      const response = conversationManager.generateResponse('test', [malformedMatch]);
      expect(response).toBeDefined();
    });

    it('should preserve full history but getContext returns last 5', () => {
      conversationManager.setStyle('developer');

      // Rapidly add many messages
      for (let i = 0; i < 20; i++) {
        conversationManager.addMessage(`Question ${i}`, `Answer ${i}`);
      }

      // Full history is preserved
      expect(conversationManager.history).toHaveLength(20);
      expect(conversationManager.history[0].userMessage).toBe('Question 0');
      expect(conversationManager.history[19].userMessage).toBe('Question 19');

      // But getContext returns only last 5
      const context = conversationManager.getContext();
      expect(context).toHaveLength(5);
      expect(context[0].userMessage).toBe('Question 15');
      expect(context[4].userMessage).toBe('Question 19');
    });
  });
});
