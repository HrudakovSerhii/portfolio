/**
 * Test suite for FallbackHandler
 * Tests query understanding failure detection and fallback flows
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import FallbackHandler from '../src/scripts/modules/chat-bot/fallback-handler.js';

// Mock StyleManager
const mockStyleManager = {
  getStyleData: vi.fn((style) => ({
    rephraseMessage: `${style} rephrase message`,
    fallbackIntro: `${style} fallback intro`,
    fallbackRequest: `${style} fallback request`,
    emailSubject: `${style} email subject`
  }))
};

// Mock ConversationManager
const mockConversationManager = {
  getContext: vi.fn(() => [
    {
      userMessage: 'Previous question',
      botResponse: 'Previous response',
      matchedSections: ['test.section'],
      confidence: 0.8
    }
  ])
};

describe('FallbackHandler', () => {
  let fallbackHandler;

  beforeEach(() => {
    fallbackHandler = new FallbackHandler(mockStyleManager, mockConversationManager);
  });

  describe('shouldTriggerFallback', () => {
    it('should trigger fallback for no matches', () => {
      const result = fallbackHandler.shouldTriggerFallback(0.8, 'test query', []);
      
      expect(result.shouldFallback).toBe(true);
      expect(result.reason).toBe('no_matches');
      expect(result.action).toBe('rephrase');
    });

    it('should trigger fallback for very low confidence', () => {
      const result = fallbackHandler.shouldTriggerFallback(0.2, 'test query', ['section1']);
      
      expect(result.shouldFallback).toBe(true);
      expect(result.reason).toBe('very_low_confidence');
      expect(result.action).toBe('rephrase');
    });

    it('should trigger fallback for low confidence', () => {
      const result = fallbackHandler.shouldTriggerFallback(0.4, 'test query', ['section1']);
      
      expect(result.shouldFallback).toBe(true);
      expect(result.reason).toBe('low_confidence');
      expect(result.action).toBe('rephrase');
    });

    it('should not trigger fallback for sufficient confidence', () => {
      const result = fallbackHandler.shouldTriggerFallback(0.7, 'test query', ['section1']);
      
      expect(result.shouldFallback).toBe(false);
      expect(result.reason).toBe('sufficient_confidence');
      expect(result.action).toBe(null);
    });
  });

  describe('getNextFallbackAction', () => {
    it('should return rephrase for first attempt', () => {
      const action = fallbackHandler.getNextFallbackAction('new query');
      expect(action).toBe('rephrase');
    });

    it('should return email for second attempt', () => {
      // First attempt
      fallbackHandler.getNextFallbackAction('same query');
      // Second attempt
      const action = fallbackHandler.getNextFallbackAction('same query');
      expect(action).toBe('email');
    });

    it('should track attempts per normalized query', () => {
      const action1 = fallbackHandler.getNextFallbackAction('Query One!');
      const action2 = fallbackHandler.getNextFallbackAction('query one');
      
      expect(action1).toBe('rephrase');
      expect(action2).toBe('email'); // Same normalized query
    });
  });

  describe('generateFallbackResponse', () => {
    it('should generate rephrase response', () => {
      const response = fallbackHandler.generateFallbackResponse('rephrase', 'developer');
      
      expect(response.type).toBe('rephrase');
      expect(response.message).toContain('developer rephrase message');
      expect(response.uiAction).toBe('show_message');
      expect(response.showFallbackButton).toBe(false);
    });

    it('should generate email response', () => {
      const response = fallbackHandler.generateFallbackResponse('email', 'hr');
      
      expect(response.type).toBe('email');
      expect(response.uiAction).toBe('show_email_form');
      expect(response.showFallbackButton).toBe(true);
    });
  });

  describe('generateRephraseMessage', () => {
    it('should include style-specific suggestions for HR', () => {
      const message = fallbackHandler.generateRephraseMessage('hr');
      
      expect(message).toContain('hr rephrase message');
      expect(message).toContain('professional experience');
    });

    it('should include style-specific suggestions for developer', () => {
      const message = fallbackHandler.generateRephraseMessage('developer');
      
      expect(message).toContain('developer rephrase message');
      expect(message).toContain('specific technologies');
    });

    it('should include style-specific suggestions for friend', () => {
      const message = fallbackHandler.generateRephraseMessage('friend');
      
      expect(message).toContain('friend rephrase message');
      expect(message).toContain('😊');
    });
  });

  describe('generateEmailOfferMessage', () => {
    it('should generate professional message for HR style', () => {
      const message = fallbackHandler.generateEmailOfferMessage('hr');
      
      expect(message).toContain('apologize');
      expect(message).toContain('detailed discussion');
    });

    it('should generate casual message for developer style', () => {
      const message = fallbackHandler.generateEmailOfferMessage('developer');
      
      expect(message).toContain('not quite getting');
      expect(message).toContain('draft an email');
    });

    it('should generate friendly message for friend style', () => {
      const message = fallbackHandler.generateEmailOfferMessage('friend');
      
      expect(message).toContain('😅');
      expect(message).toContain('😊');
    });
  });

  describe('generateMailtoLink', () => {
    it('should generate proper mailto URL', () => {
      const mailtoUrl = fallbackHandler.generateMailtoLink(
        'John Doe',
        'john@example.com',
        'What is React?',
        'developer'
      );
      
      expect(mailtoUrl).toContain('mailto:serhii@example.com');
      expect(mailtoUrl).toContain('subject=');
      expect(mailtoUrl).toContain('body=');
    });

    it('should include conversation context in email body', () => {
      const mailtoUrl = fallbackHandler.generateMailtoLink(
        'Jane Smith',
        'jane@example.com',
        'Tell me about your projects',
        'hr'
      );
      
      const decodedUrl = decodeURIComponent(mailtoUrl);
      expect(decodedUrl).toContain('Jane Smith');
      expect(decodedUrl).toContain('jane@example.com');
      expect(decodedUrl).toContain('Tell me about your projects');
    });
  });

  describe('validation methods', () => {
    it('should validate email addresses correctly', () => {
      expect(fallbackHandler.validateEmail('test@example.com')).toBe(true);
      expect(fallbackHandler.validateEmail('invalid-email')).toBe(false);
      expect(fallbackHandler.validateEmail('')).toBe(false);
      expect(fallbackHandler.validateEmail('test@')).toBe(false);
    });

    it('should validate names correctly', () => {
      expect(fallbackHandler.validateName('John Doe')).toBe(true);
      expect(fallbackHandler.validateName('A')).toBe(false); // Too short
      expect(fallbackHandler.validateName('')).toBe(false);
      expect(fallbackHandler.validateName('A'.repeat(51))).toBe(false); // Too long
    });

    it('should sanitize input correctly', () => {
      expect(fallbackHandler.sanitizeInput('  test  ')).toBe('test');
      expect(fallbackHandler.sanitizeInput('test<script>alert()</script>')).toBe('test');
      expect(fallbackHandler.sanitizeInput('test<>alert')).toBe('testalert');
      expect(fallbackHandler.sanitizeInput('A'.repeat(250))).toHaveLength(200);
    });
  });

  describe('attempt tracking', () => {
    it('should reset fallback attempts', () => {
      fallbackHandler.getNextFallbackAction('test query');
      fallbackHandler.resetFallbackAttempts();
      
      const action = fallbackHandler.getNextFallbackAction('test query');
      expect(action).toBe('rephrase'); // Should be first attempt again
    });

    it('should check if max attempts reached', () => {
      const query = 'test query';
      
      expect(fallbackHandler.hasReachedMaxAttempts(query)).toBe(false);
      
      fallbackHandler.getNextFallbackAction(query); // First attempt
      expect(fallbackHandler.hasReachedMaxAttempts(query)).toBe(false);
      
      fallbackHandler.getNextFallbackAction(query); // Second attempt
      expect(fallbackHandler.hasReachedMaxAttempts(query)).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should provide fallback statistics', () => {
      fallbackHandler.getNextFallbackAction('query1');
      fallbackHandler.getNextFallbackAction('query2');
      
      const stats = fallbackHandler.getFallbackStats();
      
      expect(stats.totalQueries).toBe(2);
      expect(stats.averageAttempts).toBe(1);
      expect(stats.maxAttempts).toBe(2);
      expect(stats.confidenceThreshold).toBe(0.5);
    });
  });
});