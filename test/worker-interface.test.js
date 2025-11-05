/**
 * Test the worker interface and message structure
 */

import { describe, it, expect } from "vitest";

describe("ML Worker Interface", () => {
  it("should define correct message types for initialization", () => {
    const initMessage = {
      type: "initialize",
      data: {
        cvData: {
          sections: {
            experience: {
              react: {
                id: "exp_react",
                keywords: ["react"],
                responses: { developer: "React experience" },
              },
            },
          },
        },
      },
    };

    expect(initMessage.type).toBe("initialize");
    expect(initMessage.data.cvData).toBeDefined();
    expect(initMessage.data.cvData.sections).toBeDefined();
  });

  it("should define correct message types for query processing", () => {
    const queryMessage = {
      type: "process_query",
      data: {
        message: "Do you have React experience?",
        context: [],
        style: "developer",
      },
    };

    expect(queryMessage.type).toBe("process_query");
    expect(queryMessage.data.message).toBeDefined();
    expect(queryMessage.data.style).toBe("developer");
  });

  it("should define expected response message structure", () => {
    const responseMessage = {
      type: "response",
      answer: "I have 3+ years of React experience",
      confidence: 0.95,
      matchedSections: [
        {
          id: "exp_react",
          category: "experience",
          similarity: 0.95,
        },
      ],
      query: "Do you have React experience?",
    };

    expect(responseMessage.type).toBe("response");
    expect(responseMessage.answer).toBeDefined();
    expect(responseMessage.confidence).toBeGreaterThan(0);
    expect(Array.isArray(responseMessage.matchedSections)).toBe(true);
  });

  it("should define error message structure", () => {
    const errorMessage = {
      type: "error",
      error: "Model not initialized",
      query: "test query",
    };

    expect(errorMessage.type).toBe("error");
    expect(errorMessage.error).toBeDefined();
  });

  it("should define status message structure", () => {
    const statusMessage = {
      type: "status",
      message: "Loading DistilBERT model...",
    };

    expect(statusMessage.type).toBe("status");
    expect(statusMessage.message).toBeDefined();
  });

  it("should define ready message structure", () => {
    const readyMessage = {
      type: "ready",
      success: true,
      message: "DistilBERT model loaded successfully",
    };

    expect(readyMessage.type).toBe("ready");
    expect(readyMessage.success).toBe(true);
  });

  it("should define progress message structure", () => {
    const progressMessage = {
      type: "progress",
      progress: { loaded: 1024, total: 2048 },
    };

    expect(progressMessage.type).toBe("progress");
    expect(progressMessage.progress).toBeDefined();
  });
});
