/**
 * Unit tests for Prompt Builder Utility Module
 * Tests prompt construction, style instructions, and context formatting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPrompt,
  buildEnhancedPrompt,
  getStyleInstructions,
  formatContextForPrompt
} from '../../../src/scripts/modules/semantic-qa/utils/prompt-builder.js';

describe('Prompt Builder Utility', () => {
  describe('createPrompt', () => {
    it('should create a basic prompt with question', () => {
      const prompt = createPrompt('What is your React experience?');
      
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('You are Serhii');
      expect(prompt).toContain('What is your React experience?');
      expect(prompt).toContain('Answer as Serhii in first person');
      expect(prompt).toContain('Answer:');
    });

    it('should include CV context when provided', () => {
      const cvContext = 'About Serhii:\nI have 4+ years of React development experience.';
      const prompt = createPrompt('Tell me about React', cvContext);
      
      expect(prompt).toContain('Based on this information:');
      expect(prompt).toContain('4+ years of React development experience');
    });

    it('should use correct style instructions', () => {
      const styles = ['hr', 'developer', 'friend'];
      
      styles.forEach(style => {
        const prompt = createPrompt('Test question', null, style);
        expect(prompt).toContain(`Respond in a ${getStyleInstructions(style)}`);
      });
    });

    it('should default to developer style for invalid styles', () => {
      const prompt = createPrompt('Test question', null, 'invalid_style');
      
      expect(prompt).toContain('technical and collaborative manner');
    });

    it('should handle null or undefined CV context', () => {
      const prompt1 = createPrompt('Test question', null);
      const prompt2 = createPrompt('Test question', undefined);
      
      expect(prompt1).not.toContain('Based on this information:');
      expect(prompt2).not.toContain('Based on this information:');
    });

    it('should include standard instructions', () => {
      const prompt = createPrompt('Test question');
      
      expect(prompt).toContain('Only use information provided above');
      expect(prompt).toContain('If no relevant info is provided, say so honestly');
      expect(prompt).toContain('Keep response under 100 words');
      expect(prompt).toContain('Be specific and provide examples when possible');
    });

    it('should handle empty or invalid input', () => {
      expect(() => createPrompt('')).toThrow('Question must be a non-empty string');
      expect(() => createPrompt(null)).toThrow('Question must be a non-empty string');
      expect(() => createPrompt(undefined)).toThrow('Question must be a non-empty string');
      expect(() => createPrompt(123)).toThrow('Question must be a non-empty string');
    });

    it('should handle conversation context parameter', () => {
      const context = [
        { userMessage: 'Hello', response: 'Hi there!' }
      ];
      
      const prompt = createPrompt('Follow up question', null, 'developer', context);
      
      expect(prompt).toBeDefined();
      expect(prompt).toContain('Follow up question');
    });

    it('should format prompt structure correctly', () => {
      const prompt = createPrompt('Test question', 'Test context', 'developer');
      
      const lines = prompt.split('\n');
      expect(lines[0]).toContain('You are Serhii');
      expect(prompt.indexOf('Based on this information:')).toBeGreaterThan(0);
      expect(prompt.indexOf('Question:')).toBeGreaterThan(0);
      expect(prompt.indexOf('Instructions:')).toBeGreaterThan(0);
      expect(prompt.indexOf('Answer:')).toBeGreaterThan(prompt.indexOf('Instructions:'));
    });
  });

  describe('buildEnhancedPrompt', () => {
    it('should build enhanced prompt with options', () => {
      const options = {
        style: 'hr',
        maxWords: 150,
        includeExamples: true
      };
      
      const prompt = buildEnhancedPrompt('Test question', 'Test context', options);
      
      expect(prompt).toContain('professional and achievement-focused manner');
      expect(prompt).toContain('Keep response under 150 words');
      expect(prompt).toContain('Provide examples when possible');
    });

    it('should use default options when not provided', () => {
      const prompt = buildEnhancedPrompt('Test question', 'Test context');
      
      expect(prompt).toContain('technical and collaborative manner'); // Default developer style
      expect(prompt).toContain('Keep response under 100 words'); // Default maxWords
    });

    it('should include conversation context when provided', () => {
      const conversationContext = [
        {
          userMessage: 'Tell me about React',
          response: 'I have React experience'
        },
        {
          userMessage: 'What about hooks?',
          response: 'I use hooks extensively'
        }
      ];
      
      const options = { conversationContext };
      const prompt = buildEnhancedPrompt('Follow up question', 'Context', options);
      
      expect(prompt).toContain('Recent conversation:');
      expect(prompt).toContain('Q1: Tell me about React');
      expect(prompt).toContain('A1: I have React experience');
      expect(prompt).toContain('Q2: What about hooks?');
      expect(prompt).toContain('A2: I use hooks extensively');
    });

    it('should limit conversation context to last 2 exchanges', () => {
      const conversationContext = [
        { userMessage: 'Question 1', response: 'Answer 1' },
        { userMessage: 'Question 2', response: 'Answer 2' },
        { userMessage: 'Question 3', response: 'Answer 3' },
        { userMessage: 'Question 4', response: 'Answer 4' }
      ];
      
      const options = { conversationContext };
      const prompt = buildEnhancedPrompt('Current question', 'Context', options);
      
      expect(prompt).toContain('Question 3');
      expect(prompt).toContain('Question 4');
      expect(prompt).not.toContain('Question 1');
      expect(prompt).not.toContain('Question 2');
    });

    it('should handle fenced context', () => {
      const fencedContext = '```\nCode example\nconst x = 1;\n```';
      const prompt = buildEnhancedPrompt('Explain this code', fencedContext);
      
      expect(prompt).toContain('Context:');
      expect(prompt).toContain('Code example');
      expect(prompt).toContain('const x = 1;');
    });

    it('should handle includeExamples option', () => {
      const prompt1 = buildEnhancedPrompt('Test', 'Context', { includeExamples: true });
      const prompt2 = buildEnhancedPrompt('Test', 'Context', { includeExamples: false });
      
      expect(prompt1).toContain('Provide examples when possible');
      expect(prompt2).not.toContain('Provide examples when possible');
    });

    it('should handle empty or invalid input', () => {
      expect(() => buildEnhancedPrompt('')).toThrow('Question must be a non-empty string');
      expect(() => buildEnhancedPrompt(null)).toThrow('Question must be a non-empty string');
    });

    it('should handle invalid conversation context gracefully', () => {
      const options = { conversationContext: 'invalid' };
      const prompt = buildEnhancedPrompt('Test question', 'Context', options);
      
      expect(prompt).not.toContain('Recent conversation:');
    });

    it('should handle conversation context with missing properties', () => {
      const conversationContext = [
        { userMessage: 'Question 1' }, // Missing response
        { response: 'Answer 2' }, // Missing userMessage
        { userMessage: 'Question 3', response: 'Answer 3' } // Complete
      ];
      
      const options = { conversationContext };
      const prompt = buildEnhancedPrompt('Current question', 'Context', options);
      
      expect(prompt).toContain('Question 3');
      expect(prompt).toContain('Answer 3');
    });
  });

  describe('getStyleInstructions', () => {
    it('should return correct instructions for HR style', () => {
      const instructions = getStyleInstructions('hr');
      
      expect(instructions).toContain('professional and achievement-focused');
      expect(instructions).toContain('experience, qualifications, and measurable results');
    });

    it('should return correct instructions for developer style', () => {
      const instructions = getStyleInstructions('developer');
      
      expect(instructions).toContain('technical and collaborative');
      expect(instructions).toContain('technical language and share insights');
    });

    it('should return correct instructions for friend style', () => {
      const instructions = getStyleInstructions('friend');
      
      expect(instructions).toContain('casual and enthusiastic');
      expect(instructions).toContain('emojis when appropriate');
      expect(instructions).toContain('make concepts accessible');
    });

    it('should default to developer style for invalid input', () => {
      const testCases = ['invalid', '', null, undefined, 123];
      
      testCases.forEach(style => {
        const instructions = getStyleInstructions(style);
        expect(instructions).toContain('technical and collaborative');
      });
    });

    it('should be case sensitive', () => {
      const instructions = getStyleInstructions('HR'); // Uppercase
      
      expect(instructions).toContain('technical and collaborative'); // Should default to developer
    });

    it('should return string for all valid styles', () => {
      const styles = ['hr', 'developer', 'friend'];
      
      styles.forEach(style => {
        const instructions = getStyleInstructions(style);
        expect(typeof instructions).toBe('string');
        expect(instructions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('formatContextForPrompt', () => {
    it('should format string context', () => {
      const context = '  This is a test context.  ';
      const formatted = formatContextForPrompt(context);
      
      expect(formatted).toBe('This is a test context.');
    });

    it('should handle null or undefined context', () => {
      expect(formatContextForPrompt(null)).toBe('');
      expect(formatContextForPrompt(undefined)).toBe('');
    });

    it('should format object with text property', () => {
      const context = {
        text: '  Object with text property  ',
        other: 'ignored'
      };
      
      const formatted = formatContextForPrompt(context);
      
      expect(formatted).toBe('Object with text property');
    });

    it('should format object with content property', () => {
      const context = {
        content: '  Object with content property  ',
        other: 'ignored'
      };
      
      const formatted = formatContextForPrompt(context);
      
      expect(formatted).toBe('Object with content property');
    });

    it('should prefer text over content property', () => {
      const context = {
        text: 'Text property',
        content: 'Content property'
      };
      
      const formatted = formatContextForPrompt(context);
      
      expect(formatted).toBe('Text property');
    });

    it('should stringify objects without text/content properties', () => {
      const context = {
        name: 'Serhii',
        skills: ['React', 'JavaScript']
      };
      
      const formatted = formatContextForPrompt(context);
      
      expect(formatted).toContain('Serhii');
      expect(formatted).toContain('React');
      expect(formatted).toContain('JavaScript');
    });

    it('should handle objects that cannot be stringified', () => {
      const circularRef = {};
      circularRef.self = circularRef;
      
      const formatted = formatContextForPrompt(circularRef);
      
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('[object Object]');
    });

    it('should handle primitive types', () => {
      expect(formatContextForPrompt(123)).toBe('123');
      expect(formatContextForPrompt(true)).toBe('true');
      expect(formatContextForPrompt(false)).toBe('false');
    });

    it('should handle arrays', () => {
      const context = ['item1', 'item2', 'item3'];
      const formatted = formatContextForPrompt(context);
      
      expect(formatted).toContain('item1');
      expect(formatted).toContain('item2');
      expect(formatted).toContain('item3');
    });

    it('should handle empty strings', () => {
      expect(formatContextForPrompt('')).toBe('');
      expect(formatContextForPrompt('   ')).toBe('');
    });

    it('should handle complex nested objects', () => {
      const context = {
        user: {
          name: 'Serhii',
          skills: {
            frontend: ['React', 'JavaScript'],
            backend: ['Node.js']
          }
        }
      };
      
      const formatted = formatContextForPrompt(context);
      
      expect(formatted).toContain('Serhii');
      expect(formatted).toContain('React');
      expect(formatted).toContain('Node.js');
    });
  });

  describe('Integration Tests', () => {
    it('should create complete prompts with all components', () => {
      const question = 'What is your React experience?';
      const cvContext = 'About Serhii:\nI have 4+ years of React development experience with hooks and modern patterns.';
      const style = 'developer';
      
      const prompt = createPrompt(question, cvContext, style);
      
      // Verify all components are present
      expect(prompt).toContain('You are Serhii');
      expect(prompt).toContain('technical and collaborative manner');
      expect(prompt).toContain('Based on this information:');
      expect(prompt).toContain('4+ years of React development experience');
      expect(prompt).toContain('Question: What is your React experience?');
      expect(prompt).toContain('Instructions:');
      expect(prompt).toContain('Answer as Serhii in first person');
      expect(prompt).toContain('Answer:');
    });

    it('should build enhanced prompts with conversation context', () => {
      const question = 'What about hooks specifically?';
      const context = 'React experience details...';
      const options = {
        style: 'friend',
        maxWords: 80,
        includeExamples: false,
        conversationContext: [
          {
            userMessage: 'Tell me about React',
            response: 'I love working with React!'
          }
        ]
      };
      
      const prompt = buildEnhancedPrompt(question, context, options);
      
      expect(prompt).toContain('casual and enthusiastic manner');
      expect(prompt).toContain('Keep response under 80 words');
      expect(prompt).not.toContain('Provide examples when possible');
      expect(prompt).toContain('Recent conversation:');
      expect(prompt).toContain('Tell me about React');
      expect(prompt).toContain('I love working with React!');
    });

    it('should handle all style variations consistently', () => {
      const question = 'Test question';
      const context = 'Test context';
      const styles = ['hr', 'developer', 'friend'];
      
      styles.forEach(style => {
        const basicPrompt = createPrompt(question, context, style);
        const enhancedPrompt = buildEnhancedPrompt(question, context, { style });
        
        const styleInstructions = getStyleInstructions(style);
        
        expect(basicPrompt).toContain(styleInstructions);
        expect(enhancedPrompt).toContain(styleInstructions);
      });
    });

    it('should optimize prompts for small LLM constraints', () => {
      const longQuestion = 'This is a very long question that goes into great detail about React development experience and asks about many different aspects of the technology including hooks, context API, state management, component lifecycle, performance optimization, and best practices in modern React development.';
      const longContext = 'This is a very detailed context about Serhii that includes extensive information about his React experience, JavaScript skills, Node.js backend development, CSS styling capabilities, project management experience, and many other technical and soft skills that he has developed over his career.';
      
      const prompt = createPrompt(longQuestion, longContext, 'developer');
      
      // Should still be structured properly despite length
      expect(prompt).toContain('You are Serhii');
      expect(prompt).toContain('Keep response under 100 words');
      expect(prompt).toContain('Answer:');
      
      // Should include all content
      expect(prompt).toContain(longQuestion);
      expect(prompt).toContain(longContext);
    });

    it('should handle edge cases gracefully', () => {
      // Minimal valid input
      const minimalPrompt = createPrompt('Hi');
      expect(minimalPrompt).toContain('Hi');
      expect(minimalPrompt).toContain('Answer:');
      
      // Empty context with conversation
      const contextPrompt = buildEnhancedPrompt('Question', '', {
        conversationContext: []
      });
      expect(contextPrompt).not.toContain('Recent conversation:');
      
      // All options provided
      const fullPrompt = buildEnhancedPrompt('Question', 'Context', {
        style: 'hr',
        maxWords: 200,
        includeExamples: true,
        conversationContext: [
          { userMessage: 'Previous question', response: 'Previous answer' }
        ]
      });
      expect(fullPrompt).toContain('professional and achievement-focused');
      expect(fullPrompt).toContain('200 words');
      expect(fullPrompt).toContain('Provide examples');
      expect(fullPrompt).toContain('Previous question');
    });
  });
});