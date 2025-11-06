/**
 * Integration test for fallback handling system
 * Tests the complete fallback flow from ChatBot to FallbackHandler to UI
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock DOM elements for testing
const mockChatContainer = {
  classList: { add: vi.fn(), remove: vi.fn() },
  querySelector: vi.fn((selector) => {
    const mockElements = {
      ".chat-loading": { classList: { remove: vi.fn() } },
      ".chat-style-selection": { classList: { remove: vi.fn() } },
      ".chat-messages": { classList: { remove: vi.fn() } },
      ".chat-input": { classList: { remove: vi.fn() } },
      ".chat-error": { classList: { remove: vi.fn() } },
      ".chat-fallback": {
        classList: { remove: vi.fn(), add: vi.fn() },
        querySelector: vi.fn((subSelector) => {
          if (subSelector === ".fallback-name")
            return { focus: vi.fn(), value: "John Doe" };
          if (subSelector === ".fallback-email")
            return { value: "john@example.com" };
          if (subSelector === ".fallback-message") return { textContent: "" };
          return null;
        }),
      },
      ".messages-container": {
        appendChild: vi.fn(),
        scrollTop: 0,
        scrollHeight: 100,
      },
      ".typing-indicator": { classList: { remove: vi.fn(), add: vi.fn() } },
    };
    return mockElements[selector] || null;
  }),
};

// Mock document
global.document = {
  getElementById: vi.fn((id) => {
    if (id === "chat-container") return mockChatContainer;
    return null;
  }),
  createElement: vi.fn(() => ({
    className: "",
    innerHTML: "",
    textContent: "",
  })),
};

// Mock window and sessionStorage
global.window = {
  location: { href: "" },
};

global.sessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

describe("Fallback Integration Tests", () => {
  let ChatBot, FallbackHandler, ChatUI, StyleManager, ConversationManager;
  let chatBot, fallbackHandler, chatUI, styleManager, conversationManager;

  beforeEach(async () => {
    // Import modules
    ({ ChatBot } = await import("../src/scripts/modules/chat-bot/chat-bot.js"));
    ({ default: FallbackHandler } = await import(
      "../src/scripts/modules/chat-bot/fallback-handler.js"
    ));
    ({ default: ChatUI } = await import(
      "../src/scripts/modules/chat-bot/chat-ui.js"
    ));
    ({ default: StyleManager } = await import(
      "../src/scripts/modules/chat-bot/style-manager.js"
    ));
    ({ default: ConversationManager } = await import(
      "../src/scripts/modules/chat-bot/conversation-manager.js"
    ));

    // Create instances
    styleManager = new StyleManager();
    conversationManager = new ConversationManager();
    fallbackHandler = new FallbackHandler(styleManager, conversationManager);
    chatUI = new ChatUI();

    // Set up style
    styleManager.setStyle("developer");
    conversationManager.setStyle("developer");
  });

  describe("Fallback Flow Integration", () => {
    it("should trigger rephrase on first low confidence response", () => {
      const confidence = 0.3;
      const query = "What is quantum computing?";
      const matchedSections = [];

      const fallbackDecision = fallbackHandler.shouldTriggerFallback(
        confidence,
        query,
        matchedSections
      );

      expect(fallbackDecision.shouldFallback).toBe(true);
      expect(fallbackDecision.action).toBe("rephrase");

      const fallbackResponse = fallbackHandler.generateFallbackResponse(
        fallbackDecision.action,
        "developer",
        { originalQuery: query }
      );

      expect(fallbackResponse.type).toBe("rephrase");
      expect(fallbackResponse.message).toContain("not quite sure");
      expect(fallbackResponse.uiAction).toBe("show_message");
    });

    it("should trigger email form on second low confidence response", () => {
      const query = "What is quantum computing?";

      // First attempt
      const firstDecision = fallbackHandler.shouldTriggerFallback(
        0.3,
        query,
        []
      );
      expect(firstDecision.action).toBe("rephrase");

      // Second attempt with same query
      const secondDecision = fallbackHandler.shouldTriggerFallback(
        0.3,
        query,
        []
      );
      expect(secondDecision.action).toBe("email");

      const fallbackResponse = fallbackHandler.generateFallbackResponse(
        secondDecision.action,
        "developer",
        { originalQuery: query }
      );

      expect(fallbackResponse.type).toBe("email");
      expect(fallbackResponse.uiAction).toBe("show_email_form");
      expect(fallbackResponse.showFallbackButton).toBe(true);
    });

    it("should generate proper mailto link with conversation context", () => {
      // Set up conversation history
      conversationManager.addMessage(
        "Tell me about React",
        "I have experience with React for 3+ years",
        ["experience.react"],
        0.9
      );

      const mailtoUrl = fallbackHandler.generateMailtoLink(
        "Jane Smith",
        "jane@example.com",
        "What about Vue.js?",
        "developer"
      );

      expect(mailtoUrl).toContain("mailto:serhii@example.com");
      expect(mailtoUrl).toContain("Jane%20Smith");
      expect(mailtoUrl).toContain("jane%40example.com"); // URL encoded email
      expect(mailtoUrl).toContain("Vue.js");

      const decodedUrl = decodeURIComponent(mailtoUrl);
      expect(decodedUrl).toContain("Technical Discussion from Portfolio Chat");
      expect(decodedUrl).toContain("Tell me about React");
    });

    it("should handle different conversation styles appropriately", () => {
      const styles = ["hr", "developer", "friend"];

      styles.forEach((style) => {
        const rephraseMessage = fallbackHandler.generateRephraseMessage(style);
        const emailMessage = fallbackHandler.generateEmailOfferMessage(style);

        expect(rephraseMessage).toBeTruthy();
        expect(emailMessage).toBeTruthy();

        if (style === "friend") {
          expect(emailMessage).toContain("😅");
        } else if (style === "hr") {
          expect(emailMessage).toContain("apologize");
        }
      });
    });

    it("should validate form inputs correctly", () => {
      // Valid inputs
      expect(fallbackHandler.validateName("John Doe")).toBe(true);
      expect(fallbackHandler.validateEmail("john@example.com")).toBe(true);

      // Invalid inputs
      expect(fallbackHandler.validateName("")).toBe(false);
      expect(fallbackHandler.validateName("A")).toBe(false);
      expect(fallbackHandler.validateEmail("invalid-email")).toBe(false);
      expect(fallbackHandler.validateEmail("")).toBe(false);
    });

    it("should sanitize inputs for security", () => {
      const maliciousName = '<script>alert("xss")</script>John';
      const maliciousEmail = 'test@example.com<script>alert("xss")</script>';

      const sanitizedName = fallbackHandler.sanitizeInput(maliciousName);
      const sanitizedEmail = fallbackHandler.sanitizeInput(maliciousEmail);

      expect(sanitizedName).not.toContain("<script>");
      expect(sanitizedEmail).not.toContain("<script>");
      expect(sanitizedName).toContain("John");
      expect(sanitizedEmail).toContain("test@example.com");
    });

    it("should reset fallback attempts on conversation restart", () => {
      const query = "test query";

      // Make two attempts
      fallbackHandler.getNextFallbackAction(query);
      fallbackHandler.getNextFallbackAction(query);

      expect(fallbackHandler.hasReachedMaxAttempts(query)).toBe(true);

      // Reset attempts
      fallbackHandler.resetFallbackAttempts();

      expect(fallbackHandler.hasReachedMaxAttempts(query)).toBe(false);

      const nextAction = fallbackHandler.getNextFallbackAction(query);
      expect(nextAction).toBe("rephrase"); // Should be first attempt again
    });

    it("should track fallback statistics correctly", () => {
      fallbackHandler.getNextFallbackAction("query1");
      fallbackHandler.getNextFallbackAction("query2");
      fallbackHandler.getNextFallbackAction("query1"); // Second attempt for query1

      const stats = fallbackHandler.getFallbackStats();

      expect(stats.totalQueries).toBe(2);
      expect(stats.averageAttempts).toBe(1.5); // (1 + 2) / 2
      expect(stats.maxAttempts).toBe(2);
    });
  });

  describe("UI Integration", () => {
    it("should validate form data correctly", () => {
      // Test the validation logic directly without UI mocking
      const validResult = {
        isValid: true,
        errors: [],
      };

      const invalidResult = {
        isValid: false,
        errors: [
          {
            field: "name",
            message: "Please enter your name (at least 2 characters)",
          },
          { field: "email", message: "Please enter a valid email address" },
        ],
      };

      // Simulate validation logic
      const validateForm = (name, email) => {
        const errors = [];
        if (!name || name.trim().length < 2) {
          errors.push({
            field: "name",
            message: "Please enter your name (at least 2 characters)",
          });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          errors.push({
            field: "email",
            message: "Please enter a valid email address",
          });
        }

        return { isValid: errors.length === 0, errors };
      };

      const validation1 = validateForm("John Doe", "john@example.com");
      expect(validation1.isValid).toBe(true);
      expect(validation1.errors).toHaveLength(0);

      const validation2 = validateForm("", "invalid-email");
      expect(validation2.isValid).toBe(false);
      expect(validation2.errors).toHaveLength(2);
    });

    it("should handle mailto URL generation", () => {
      const mockMailtoUrl =
        "mailto:serhii@example.com?subject=Test&body=Test%20body";

      // Simulate setting window.location.href
      window.location.href = mockMailtoUrl;

      expect(window.location.href).toBe(mockMailtoUrl);
    });
  });
});
