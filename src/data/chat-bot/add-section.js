/**
 * CV Section Addition Utility
 * Helper script to add new sections to CV data with proper structure
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a new CV section template
 * @param {string} category - Category name (experience, skills, projects, etc.)
 * @param {string} sectionName - Section name (react, javascript, etc.)
 * @param {Object} options - Section options
 * @returns {Object} New section object
 */
function createSectionTemplate(category, sectionName, options = {}) {
  const {
    keywords = [],
    hrResponse = "",
    developerResponse = "",
    friendResponse = "",
    details = {},
    relatedSections = [],
  } = options;

  return {
    id: `${category}_${sectionName}`,
    keywords: keywords,
    embeddings: null,
    responses: {
      hr:
        hrResponse ||
        `Serhii has experience with ${sectionName}. [Please add detailed HR-style response]`,
      developer:
        developerResponse ||
        `I've worked with ${sectionName}. [Please add detailed developer-style response]`,
      friend:
        friendResponse ||
        `Oh ${sectionName}! [Please add detailed friend-style response with emoji]`,
    },
    details: details,
    relatedSections: relatedSections,
  };
}

/**
 * Add a new section to CV data
 * @param {string} category - Category name
 * @param {string} sectionName - Section name
 * @param {Object} sectionData - Section data
 */
function addSection(category, sectionName, sectionData) {
  const dataPath = path.join(__dirname, "cv-data.json");

  try {
    // Load existing data
    const cvData = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    // Ensure category exists
    if (!cvData.sections[category]) {
      cvData.sections[category] = {};
    }

    // Add new section
    cvData.sections[category][sectionName] = sectionData;

    // Update metadata
    cvData.metadata.totalSections = Object.values(cvData.sections).reduce(
      (count, cat) => count + Object.keys(cat).length,
      0
    );
    cvData.metadata.lastUpdated = new Date().toISOString().split("T")[0];

    // Write back to file
    fs.writeFileSync(dataPath, JSON.stringify(cvData, null, 2));

    console.log(`✅ Added section: ${category}.${sectionName}`);
    console.log(`📊 Total sections: ${cvData.metadata.totalSections}`);
  } catch (error) {
    console.error("❌ Error adding section:", error.message);
  }
}

/**
 * Interactive section creation (for command line use)
 */
function interactiveAdd() {
  console.log("CV Section Addition Utility");
  console.log("===========================");
  console.log("This utility helps you add new sections to the CV data.");
  console.log("Please edit this script to add your section data, then run it.");
  console.log("");
  console.log("Example usage:");
  console.log("");
  console.log('const newSection = createSectionTemplate("skills", "python", {');
  console.log('  keywords: ["python", "django", "flask", "programming"],');
  console.log('  hrResponse: "Serhii has 2+ years of Python development...",');
  console.log('  developerResponse: "I love Python for its simplicity...",');
  console.log('  friendResponse: "Python is such a fun language! 🐍...",');
  console.log('  details: { years: 2, level: "intermediate" },');
  console.log('  relatedSections: ["programming", "backend"]');
  console.log("});");
  console.log("");
  console.log('addSection("skills", "python", newSection);');
}

// Export functions
export { createSectionTemplate, addSection };

// Run interactive mode if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  interactiveAdd();
}
