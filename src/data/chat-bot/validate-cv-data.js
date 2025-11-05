/**
 * CV Data Validation Script
 * Tests the CVDataService with actual CV data
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import CVDataService
const CVDataService = require('../../scripts/modules/chat-bot/cv-data-service.cjs');

// Mock fetch for Node.js environment
global.fetch = async (url) => {
  try {
    const filePath = join(__dirname, 'cv-data.json');
    const data = readFileSync(filePath, 'utf8');
    return {
      ok: true,
      json: () => Promise.resolve(JSON.parse(data))
    };
  } catch (error) {
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found'
    };
  }
};

async function validateCVData() {
  console.log('🔍 Validating CV Data with CVDataService...\n');

  try {
    const service = new CVDataService();
    
    // Test loading
    console.log('📥 Loading CV data...');
    const cvData = await service.loadCVData();
    console.log('✅ CV data loaded successfully');
    console.log(`📊 Metadata: ${cvData.metadata.totalSections} sections, version ${cvData.metadata.version}\n`);

    // Test section retrieval
    console.log('🔍 Testing section retrieval...');
    const reactSection = service.getSectionById('exp_react');
    if (reactSection) {
      console.log('✅ Found React experience section');
      console.log(`   Keywords: ${reactSection.keywords.join(', ')}`);
    }

    // Test category retrieval
    console.log('\n📂 Testing category retrieval...');
    const experienceSections = service.getSectionsByCategory('experience');
    console.log(`✅ Found ${experienceSections.length} experience sections`);
    experienceSections.forEach(section => {
      console.log(`   - ${section.name}: ${section.id}`);
    });

    // Test keyword search
    console.log('\n🔎 Testing keyword search...');
    const reactMatches = service.findSectionsByKeywords(['react', 'javascript']);
    console.log(`✅ Found ${reactMatches.length} sections matching 'react' or 'javascript'`);
    reactMatches.forEach(match => {
      console.log(`   - ${match.path} (score: ${match.relevanceScore.toFixed(2)}, keywords: ${match.matchedKeywords.join(', ')})`);
    });

    // Test embeddings
    console.log('\n🧠 Testing embeddings...');
    const jsEmbeddings = service.getEmbeddings('skill_js');
    if (jsEmbeddings) {
      console.log(`✅ JavaScript section has embeddings (${jsEmbeddings.length} dimensions)`);
    } else {
      console.log('ℹ️  JavaScript section has no pre-computed embeddings');
    }

    // Test caching
    console.log('\n💾 Testing embeddings caching...');
    const testEmbeddings = Array.from({length: 768}, () => Math.random());
    service.cacheEmbeddings('exp_react', testEmbeddings);
    const cachedEmbeddings = service.getCachedEmbeddings('exp_react');
    if (cachedEmbeddings && cachedEmbeddings.length === testEmbeddings.length) {
      console.log('✅ Embeddings cached and retrieved successfully');
    }

    // Test personality and templates
    console.log('\n👤 Testing personality and templates...');
    const personality = service.getPersonality();
    console.log(`✅ Personality loaded with ${personality.traits.length} traits`);
    
    const templates = service.getResponseTemplates();
    console.log(`✅ Response templates loaded with ${Object.keys(templates).length} template types`);

    const hrStyle = service.getCommunicationStyle('hr');
    console.log(`✅ HR communication style: ${hrStyle.tone}`);

    // Test all sections
    console.log('\n📋 Testing all sections retrieval...');
    const allSections = service.getAllSections();
    console.log(`✅ Retrieved all ${allSections.length} sections`);
    
    // Group by category
    const categories = {};
    allSections.forEach(section => {
      if (!categories[section.category]) {
        categories[section.category] = 0;
      }
      categories[section.category]++;
    });
    
    console.log('📊 Sections by category:');
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`   - ${category}: ${count} sections`);
    });

    console.log('\n🎉 All validation tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run validation
validateCVData();