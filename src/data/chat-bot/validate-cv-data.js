/**
 * CV Data Validation Utility
 * Validates CV data structure against the defined JSON schema
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Simple JSON schema validator for CV data
 * @param {Object} data - The CV data to validate
 * @param {Object} schema - The JSON schema to validate against
 * @returns {Object} Validation result with success flag and errors
 */
function validateCVData(data, schema) {
  const errors = [];
  
  try {
    // Check required top-level properties
    const requiredProps = schema.required || [];
    for (const prop of requiredProps) {
      if (!(prop in data)) {
        errors.push(`Missing required property: ${prop}`);
      }
    }
    
    // Validate metadata
    if (data.metadata) {
      const metadata = data.metadata;
      if (!metadata.version || typeof metadata.version !== 'string') {
        errors.push('metadata.version must be a string');
      }
      if (!metadata.lastUpdated || typeof metadata.lastUpdated !== 'string') {
        errors.push('metadata.lastUpdated must be a string');
      }
      if (!metadata.totalSections || typeof metadata.totalSections !== 'number') {
        errors.push('metadata.totalSections must be a number');
      }
    }
    
    // Validate sections structure
    if (data.sections) {
      for (const [categoryName, category] of Object.entries(data.sections)) {
        for (const [sectionName, section] of Object.entries(category)) {
          const sectionPath = `sections.${categoryName}.${sectionName}`;
          
          // Check required section properties
          if (!section.id || typeof section.id !== 'string') {
            errors.push(`${sectionPath}.id must be a string`);
          }
          
          if (!Array.isArray(section.keywords) || section.keywords.length === 0) {
            errors.push(`${sectionPath}.keywords must be a non-empty array`);
          }
          
          if (!section.responses || typeof section.responses !== 'object') {
            errors.push(`${sectionPath}.responses must be an object`);
          } else {
            // Check conversation style responses
            const styles = ['hr', 'developer', 'friend'];
            for (const style of styles) {
              if (!section.responses[style] || typeof section.responses[style] !== 'string') {
                errors.push(`${sectionPath}.responses.${style} must be a string`);
              }
            }
          }
          
          if (!section.details || typeof section.details !== 'object') {
            errors.push(`${sectionPath}.details must be an object`);
          }
        }
      }
    }
    
    // Validate personality structure
    if (data.personality) {
      const personality = data.personality;
      const requiredArrays = ['traits', 'values', 'workStyle', 'interests'];
      
      for (const prop of requiredArrays) {
        if (!Array.isArray(personality[prop]) || personality[prop].length === 0) {
          errors.push(`personality.${prop} must be a non-empty array`);
        }
      }
      
      if (personality.communication_style) {
        const styles = ['hr', 'developer', 'friend'];
        for (const style of styles) {
          const styleObj = personality.communication_style[style];
          if (!styleObj || typeof styleObj !== 'object') {
            errors.push(`personality.communication_style.${style} must be an object`);
          } else {
            const requiredStyleProps = ['tone', 'language', 'focus', 'greeting'];
            for (const prop of requiredStyleProps) {
              if (!styleObj[prop] || typeof styleObj[prop] !== 'string') {
                errors.push(`personality.communication_style.${style}.${prop} must be a string`);
              }
            }
          }
        }
      }
    }
    
    // Validate response templates
    if (data.responseTemplates) {
      const templates = data.responseTemplates;
      const requiredTemplates = ['noMatch', 'lowConfidence', 'fallbackRequest', 'emailFallback'];
      
      for (const template of requiredTemplates) {
        if (!templates[template] || typeof templates[template] !== 'object') {
          errors.push(`responseTemplates.${template} must be an object`);
        } else {
          const styles = ['hr', 'developer', 'friend'];
          for (const style of styles) {
            if (!templates[template][style] || typeof templates[template][style] !== 'string') {
              errors.push(`responseTemplates.${template}.${style} must be a string`);
            }
          }
        }
      }
    }
    
  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
  }
  
  return {
    success: errors.length === 0,
    errors: errors,
    sectionsCount: data.sections ? Object.values(data.sections).reduce((count, category) => count + Object.keys(category).length, 0) : 0
  };
}

/**
 * Load and validate CV data from file
 * @param {string} dataPath - Path to CV data JSON file
 * @param {string} schemaPath - Path to JSON schema file
 * @returns {Object} Validation result
 */
function validateCVDataFromFile(dataPath, schemaPath) {
  try {
    const cvData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    
    const result = validateCVData(cvData, schema);
    
    console.log('CV Data Validation Results:');
    console.log('==========================');
    console.log(`Status: ${result.success ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`Sections found: ${result.sectionsCount}`);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    } else {
      console.log('\n✅ All validation checks passed!');
    }
    
    return result;
    
  } catch (error) {
    console.error('Error loading files:', error.message);
    return {
      success: false,
      errors: [`File loading error: ${error.message}`],
      sectionsCount: 0
    };
  }
}

// Export for use as module
export {
  validateCVData,
  validateCVDataFromFile
};

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dataPath = path.join(__dirname, 'cv-data.json');
  const schemaPath = path.join(__dirname, 'cv-schema.json');
  
  validateCVDataFromFile(dataPath, schemaPath);
}