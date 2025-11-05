/**
 * CV Data Validation Script
 * Tests the CVDataService with actual CV data
 */

import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import CVDataService
const CVDataService = require("../../scripts/modules/chat-bot/cv-data-service.cjs");

// Mock fetch for Node.js environment
global.fetch = async () => {
  try {
    const filePath = join(__dirname, "cv-data.json");
    const data = readFileSync(filePath, "utf8");
    return {
      ok: true,
      json: () => Promise.resolve(JSON.parse(data)),
    };
  } catch (error) {
    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
    };
  }
};

async function validateCVData() {
  try {
    const service = new CVDataService();

    // Test core functionality
    const cvData = await service.loadCVData();
    const reactSection = service.getSectionById("exp_react");
    const experienceSections = service.getSectionsByCategory("experience");
    const reactMatches = service.findSectionsByKeywords([
      "react",
      "javascript",
    ]);

    // Test embeddings
    const testEmbeddings = Array.from({ length: 768 }, () => Math.random());
    service.cacheEmbeddings("exp_react", testEmbeddings);
    const cachedEmbeddings = service.getCachedEmbeddings("exp_react");

    // Test data access
    const personality = service.getPersonality();
    const templates = service.getResponseTemplates();
    const hrStyle = service.getCommunicationStyle("hr");
    const allSections = service.getAllSections();

    // Validate results
    if (
      !cvData ||
      !reactSection ||
      !experienceSections.length ||
      !reactMatches.length ||
      !cachedEmbeddings ||
      !personality ||
      !templates ||
      !hrStyle ||
      !allSections.length
    ) {
      throw new Error("Validation failed - missing expected data");
    }

    console.log(
      `✅ CV Data validation passed - ${allSections.length} sections loaded`
    );
  } catch (error) {
    console.error("❌ Validation failed:", error.message);
    process.exit(1);
  }
}

// Run validation
validateCVData();