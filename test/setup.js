// Test setup file for vitest
import { vi } from 'vitest';

// Mock fetch globally for tests
global.fetch = vi.fn();

// Mock window object for node environment
global.window = {
  location: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000'
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  matchMedia: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
};

// Mock module exports for CommonJS compatibility
global.module = { exports: {} };

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});