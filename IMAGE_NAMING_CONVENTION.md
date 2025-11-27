# Image Naming Convention

## Overview
Images are now managed using a hybrid convention-based approach that reduces JSON verbosity while maintaining flexibility.

## File Naming Pattern
```
{section}.{variant}.{type}.jpg
```

- **section**: Section ID (hero, about, skills, experience, projects, contact)
- **variant**: Image variant name (photo, photo2, etc.)
- **type**: Resolution type
  - `full` - Full resolution image
  - `low` - Low resolution for loading animation

## Examples
```
hero.photo.full.jpg
hero.photo.low.jpg
hero.photo2.full.jpg
hero.photo2.low.jpg
about.photo.full.jpg
skills.photo2.low.jpg
```

## JSON Structure
Images in `portfolio-default-content.json` now use minimal metadata:

```json
{
  "image": {
    "name": "hero.photo2",
    "imageAlt": "Serhii Hrudakov",
    "aspectRatio": "aspect-square"
  }
}
```

- **name**: Optional. Custom image name without extension or type suffix. Defaults to `{sectionId}.{role}` if omitted
- **imageAlt**: Required. Alt text for accessibility
- **aspectRatio**: Required. CSS class for aspect ratio

## Path Construction
The middleware automatically constructs full paths:

```javascript
// Input: name = "hero.photo2"
// Output:
imageUrl: "/images/hero.photo2.full.jpg"
lowResImageUrl: "/images/hero.photo2.low.jpg"
```

## Benefits
- Reduced JSON file size (removed repetitive paths)
- Single source of truth for path construction
- Easy to change image directory or naming scheme
- Flexibility to override default naming when needed
- Type-safe with JSDoc definitions
