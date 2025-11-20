/**
 * ContentMiddleware Usage Examples
 * 
 * This file demonstrates how to use the ContentMiddleware class
 * to fetch portfolio content from the JSON data source.
 */

// Import the ContentMiddleware class
// import ContentMiddleware from './content-middleware.js';

// Example 1: Initialize the middleware
const contentMiddleware = new ContentMiddleware('/data/content.json');

// Example 2: Get user profile information
async function displayUserProfile() {
  const profile = await contentMiddleware.getUserProfile();
  console.log('Name:', profile.name);
  console.log('Title:', profile.title);
  console.log('Email:', profile.email);
  console.log('GitHub:', profile.socialLinks?.github);
}

// Example 3: Fetch section content for a specific role
async function displayHeroContent() {
  const heroContent = await contentMiddleware.fetchSectionContent('hero', 'recruiter');
  console.log('Section:', heroContent.title);
  console.log('Text:', heroContent.text);
  console.log('Image:', heroContent.imageUrl);
}

// Example 4: Get placeholder text for action prompts
async function getSkillsPlaceholder() {
  const placeholder = await contentMiddleware.getActionPromptPlaceholder('skills');
  console.log('Placeholder:', placeholder);
  // Output: "React, TypeScript, Node.js, PostgreSQL, AWS, Docker"
}

// Example 5: Get main/highlighted items for a section
async function getMainProjects() {
  const mainProjects = await contentMiddleware.getMainItems('projects');
  console.log('Featured Projects:', mainProjects);
  // Output: ["E-Commerce Platform", "Real-Time Analytics Dashboard", "Open-Source Contributions"]
}

// Example 6: Get section metadata
async function getSectionInfo() {
  const metadata = await contentMiddleware.getSectionMetadata('skills');
  console.log('Section ID:', metadata.id);
  console.log('Title:', metadata.title);
  console.log('Icon:', metadata.icon);
  console.log('Order:', metadata.order);
}

// Example 7: Get all sections sorted by order
async function listAllSections() {
  const sections = await contentMiddleware.getAllSections();
  sections.forEach(section => {
    console.log(`${section.order}. ${section.title} (${section.icon})`);
  });
}

// Example 8: Fetch content with custom query
async function fetchCustomContent() {
  const content = await contentMiddleware.fetchSectionContent(
    'skills',
    'developer',
    'Tell me about your React experience'
  );
  console.log('Custom Query:', content.customQuery);
  console.log('Content:', content.text);
}

// Example 9: Handle errors gracefully
async function handleErrors() {
  try {
    // This will return fallback content if section doesn't exist
    const content = await contentMiddleware.fetchSectionContent('invalid-section', 'recruiter');
    
    if (content.isError) {
      console.log('Error occurred:', content.errorMessage);
      console.log('Fallback content:', content.text);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Example 10: Using content for different roles
async function compareRoleContent() {
  const recruiterView = await contentMiddleware.fetchSectionContent('about', 'recruiter');
  const developerView = await contentMiddleware.fetchSectionContent('about', 'developer');
  const friendView = await contentMiddleware.fetchSectionContent('about', 'friend');
  
  console.log('Recruiter sees:', recruiterView.text);
  console.log('Developer sees:', developerView.text);
  console.log('Friend sees:', friendView.text);
}

// Export examples for documentation
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    displayUserProfile,
    displayHeroContent,
    getSkillsPlaceholder,
    getMainProjects,
    getSectionInfo,
    listAllSections,
    fetchCustomContent,
    handleErrors,
    compareRoleContent
  };
}
