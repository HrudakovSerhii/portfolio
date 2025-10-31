#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Page configurations
const pages = {
  'index': {
    pageName: 'home',
    pageUrl: '',
    pageTitle: 'Serhii Hrudakov - Full Stack Developer Portfolio',
    activeNav: 'home',
    structuredData: `
    <!-- Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "Serhii Hrudakov",
      "jobTitle": "Full Stack Developer",
      "url": "https://serhiihrudakov.github.io/",
      "sameAs": [
        "https://github.com/hrudakovserhii",
        "https://linkedin.com/in/serhiihrudakov"
      ],
      "knowsAbout": ["JavaScript", "React", "Node.js", "Python", "Web Development"],
      "description": "Professional full stack developer specializing in modern web technologies"
    }
    </script>`
  },
  'about': {
    pageName: 'about',
    pageUrl: 'about.html',
    pageTitle: 'About - Serhii Hrudakov Developer',
    activeNav: 'about',
    structuredData: ''
  },
  'projects': {
    pageName: 'projects',
    pageUrl: 'projects.html',
    pageTitle: 'Projects - Serhii Hrudakov Portfolio',
    activeNav: 'projects',
    structuredData: ''
  },
  'contact': {
    pageName: 'contact',
    pageUrl: 'contact.html',
    pageTitle: 'Contact - Serhii Hrudakov Developer',
    activeNav: 'contact',
    structuredData: ''
  }
};

// Helper function to read file
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    process.exit(1);
  }
}

// Helper function to write file
function writeFile(filePath, content) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Generated ${filePath}`);
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error.message);
    process.exit(1);
  }
}

// Helper function to replace placeholders
function replacePlaceholders(template, config) {
  let result = template;
  
  // Replace basic placeholders
  result = result.replace(/\{\{PAGE_NAME\}\}/g, config.pageName);
  result = result.replace(/\{\{PAGE_URL\}\}/g, config.pageUrl);
  result = result.replace(/\{\{PAGE_TITLE\}\}/g, config.pageTitle);
  result = result.replace(/\{\{STRUCTURED_DATA\}\}/g, config.structuredData);
  
  // Replace navigation active states
  const navItems = ['home', 'about', 'projects', 'contact'];
  navItems.forEach(item => {
    const isActive = item === config.activeNav;
    const activeClass = isActive ? 'navigation__link--active' : '';
    const ariaCurrent = isActive ? 'aria-current="page"' : '';
    
    result = result.replace(new RegExp(`\\{\\{${item.toUpperCase()}_ACTIVE\\}\\}`, 'g'), activeClass);
    result = result.replace(new RegExp(`\\{\\{${item.toUpperCase()}_ARIA_CURRENT\\}\\}`, 'g'), ariaCurrent);
  });
  
  return result;
}

// Main build function
function buildPages() {
  console.log('🔨 Building HTML pages from templates...\n');
  
  // Read templates
  const headerTemplate = readFile('src/templates/header.html');
  const footerTemplate = readFile('src/templates/footer.html');
  
  // Build each page
  Object.entries(pages).forEach(([pageName, config]) => {
    console.log(`Building ${pageName}.html...`);
    
    // Read page content template
    const pageTemplate = readFile(`src/templates/pages/${pageName}.template.html`);
    
    // Replace placeholders in header
    const processedHeader = replacePlaceholders(headerTemplate, config);
    
    // Combine header + page content + footer
    const fullPage = processedHeader + '\n' + pageTemplate + '\n' + footerTemplate;
    
    // Write to pages directory
    const outputPath = `src/pages/${pageName}.html`;
    writeFile(outputPath, fullPage);
  });
  
  console.log('\n✅ HTML build complete!');
}

// Run the build
if (require.main === module) {
  buildPages();
}

module.exports = { buildPages };