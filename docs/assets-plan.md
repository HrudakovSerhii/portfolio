# Visual Assets Planning

## Required Assets

### Profile/Personal Images
- **Profile Photo**: Professional headshot (400x400px minimum)
  - Format: WebP with JPEG fallback
  - Optimized versions: 200px, 400px, 800px
  - Location: `src/assets/images/profile/`

### Project Images
- **Project Screenshots**: High-quality project previews
  - Format: WebP with JPEG fallback
  - Sizes: Thumbnail (300x200px), Full (1200x800px)
  - Location: `src/assets/images/projects/`

### Icons & Graphics
- **Favicon Package**: Multiple sizes for different devices
  - 16x16, 32x32, 48x48, 180x180, 192x192, 512x512
  - Format: ICO, PNG, SVG
  - Location: `src/assets/icons/favicon/`

- **Technology Icons**: SVG icons for skills section
  - JavaScript, React, Node.js, Python, etc.
  - Consistent style and size (24x24px, 48x48px)
  - Location: `src/assets/icons/tech/`

- **Social Media Icons**: Platform icons for contact section
  - GitHub, LinkedIn, Twitter, Email
  - SVG format for scalability
  - Location: `src/assets/icons/social/`

### Background Images (Optional)
- **Hero Background**: Subtle pattern or gradient
  - Format: WebP with fallback
  - Size: 1920x1080px
  - Location: `src/assets/images/backgrounds/`

## Image Optimization Strategy

### Formats
1. **WebP**: Primary format for modern browsers
2. **JPEG**: Fallback for older browsers
3. **SVG**: Icons and simple graphics
4. **PNG**: When transparency is needed

### Responsive Images
```html
<!-- Example responsive image markup -->
<picture>
  <source srcset="image-800w.webp 800w, image-400w.webp 400w" type="image/webp">
  <source srcset="image-800w.jpg 800w, image-400w.jpg 400w" type="image/jpeg">
  <img src="image-400w.jpg" alt="Description" loading="lazy">
</picture>
```

### Lazy Loading
- Implement native lazy loading: `loading="lazy"`
- Intersection Observer for advanced cases
- Placeholder images for better UX

## File Naming Convention

### Images
```
profile-photo-400w.webp
profile-photo-400w.jpg
project-ecommerce-thumb-300w.webp
project-ecommerce-full-1200w.webp
```

### Icons
```
icon-javascript.svg
icon-react.svg
icon-github.svg
icon-linkedin.svg
```

## Asset Directory Structure
```
src/assets/
├── images/
│   ├── profile/
│   │   ├── profile-photo-200w.webp
│   │   ├── profile-photo-400w.webp
│   │   └── profile-photo-800w.webp
│   ├── projects/
│   │   ├── project-1-thumb.webp
│   │   ├── project-1-full.webp
│   │   └── project-2-thumb.webp
│   └── backgrounds/
│       └── hero-bg.webp
├── icons/
│   ├── favicon/
│   │   ├── favicon.ico
│   │   ├── favicon-16x16.png
│   │   └── favicon-32x32.png
│   ├── tech/
│   │   ├── javascript.svg
│   │   ├── react.svg
│   │   └── nodejs.svg
│   └── social/
│       ├── github.svg
│       ├── linkedin.svg
│       └── email.svg
└── fonts/ (if custom fonts needed)
    ├── inter-regular.woff2
    └── inter-bold.woff2
```

## Performance Considerations

### Image Compression
- WebP: 80-85% quality
- JPEG: 85-90% quality
- PNG: Optimize with tools like TinyPNG

### Loading Strategy
1. **Critical images**: Load immediately (hero, profile)
2. **Above-the-fold**: Preload if necessary
3. **Below-the-fold**: Lazy load
4. **Decorative**: Lowest priority

### CDN Strategy (Future)
- Consider using image CDN for automatic optimization
- Cloudinary, ImageKit, or similar services
- Automatic format selection and resizing

## Placeholder Content

### Sample Project Data
```json
{
  "projects": [
    {
      "id": "ecommerce-platform",
      "title": "E-commerce Platform",
      "description": "Full-stack e-commerce solution with React and Node.js",
      "image": "project-ecommerce-thumb.webp",
      "technologies": ["React", "Node.js", "MongoDB", "Stripe"],
      "liveUrl": "https://example.com",
      "codeUrl": "https://github.com/username/project"
    },
    {
      "id": "task-manager",
      "title": "Task Management App",
      "description": "Collaborative task management with real-time updates",
      "image": "project-tasks-thumb.webp",
      "technologies": ["Vue.js", "Express", "Socket.io", "PostgreSQL"],
      "liveUrl": "https://example.com",
      "codeUrl": "https://github.com/username/project"
    }
  ]
}
```

### Contact Information Template
```json
{
  "contact": {
    "email": "hrudakovserhii@gmail.com",
    "location": "Available Worldwide (Remote)",
    "availability": "Available for freelance projects",
    "social": {
      "github": "https://github.com/serhiihrudakov",
      "linkedin": "https://linkedin.com/in/serhiihrudakov"
    }
  }
}
```