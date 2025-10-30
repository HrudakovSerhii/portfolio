# Translation System Structure

## Translation Key Convention
Format: `page.view.component.content`

## Content Categories

### 1. Navigation & Global
```json
{
  "global": {
    "navigation": {
      "home": { "text": "Home" },
      "about": { "text": "About" },
      "projects": { "text": "Projects" },
      "contact": { "text": "Contact" }
    },
    "footer": {
      "copyright": { "text": "© 2024 Portfolio" },
      "rights": { "text": "All rights reserved" }
    }
  }
}
```

### 2. Home Page Content
```json
{
  "home": {
    "hero": {
      "title": { "text": "Full Stack Developer" },
      "subtitle": { "text": "Creating digital experiences with modern technologies" },
      "cta": { "text": "View My Work" }
    },
    "skills": {
      "title": { "text": "Skills & Technologies" },
      "frontend": { "text": "Frontend Development" },
      "backend": { "text": "Backend Development" },
      "tools": { "text": "Development Tools" }
    },
    "featured": {
      "title": { "text": "Featured Projects" },
      "viewAll": { "text": "View All Projects" }
    }
  }
}
```

### 3. About Page Content
```json
{
  "about": {
    "hero": {
      "title": { "text": "About Me" },
      "subtitle": { "text": "Passionate developer with a focus on user experience" }
    },
    "bio": {
      "title": { "text": "Background" },
      "content": { "text": "Professional bio content..." }
    },
    "experience": {
      "title": { "text": "Experience" },
      "years": { "text": "Years of Experience" }
    },
    "skills": {
      "title": { "text": "Technical Skills" },
      "frontend": { "text": "Frontend Technologies" },
      "backend": { "text": "Backend Technologies" },
      "tools": { "text": "Tools & Platforms" }
    }
  }
}
```

### 4. Projects Page Content
```json
{
  "projects": {
    "hero": {
      "title": { "text": "My Projects" },
      "subtitle": { "text": "A showcase of my recent work and experiments" }
    },
    "filter": {
      "all": { "text": "All Projects" },
      "web": { "text": "Web Applications" },
      "mobile": { "text": "Mobile Apps" },
      "tools": { "text": "Tools & Utilities" }
    },
    "project": {
      "viewLive": { "text": "View Live" },
      "viewCode": { "text": "View Code" },
      "technologies": { "text": "Technologies Used" }
    }
  }
}
```

### 5. Contact Page Content
```json
{
  "contact": {
    "hero": {
      "title": { "text": "Get In Touch" },
      "subtitle": { "text": "Let's discuss your next project" }
    },
    "form": {
      "name": { "label": "Name", "placeholder": "Your name" },
      "email": { "label": "Email", "placeholder": "your.email@example.com" },
      "message": { "label": "Message", "placeholder": "Tell me about your project..." },
      "submit": { "text": "Send Message" },
      "success": { "text": "Message sent successfully!" },
      "error": { "text": "Please fill in all fields" }
    },
    "info": {
      "title": { "text": "Contact Information" },
      "email": { "text": "Email" },
      "location": { "text": "Location" },
      "availability": { "text": "Available for freelance work" }
    }
  }
}
```

### 6. SEO & Meta Content
```json
{
  "meta": {
    "home": {
      "title": { "text": "John Doe - Full Stack Developer Portfolio" },
      "description": { "text": "Professional portfolio showcasing web development projects and skills" }
    },
    "about": {
      "title": { "text": "About - John Doe Developer" },
      "description": { "text": "Learn about my background, experience, and technical skills" }
    },
    "projects": {
      "title": { "text": "Projects - John Doe Portfolio" },
      "description": { "text": "Explore my latest web development projects and case studies" }
    },
    "contact": {
      "title": { "text": "Contact - John Doe Developer" },
      "description": { "text": "Get in touch for your next web development project" }
    }
  }
}
```

## Fallback Strategy
- Default language: English (`en.json`)
- Missing keys fall back to English version
- Empty content shows key name as fallback
- Language detection via URL parameter or browser preference

## Supported Languages (Initial)
1. **English** (`en.json`) - Primary
2. **Spanish** (`es.json`) - Secondary

## Content Modularity
- Separate files for each language
- Consistent key structure across all languages
- Easy addition of new languages
- Component-based content organization