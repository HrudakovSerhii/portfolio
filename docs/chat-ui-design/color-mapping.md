# Chat UI Design - Color Mapping

This document maps the Stitch-generated design colors to our existing theme system.

## Stitch Design Colors → Theme Variables

### Primary/Accent Colors
- `#137fec` (Stitch primary blue) → `--color-accent`
  - Light theme: `#2563eb` (blue-600)
  - Dark theme: `#3b82f6` (blue-500)
  - Close enough match, our blue is slightly darker but maintains brand consistency

### Background Colors
- `#f6f7f8` (Stitch light bg) → `--color-bg`
  - Light: `#f9fafb` (gray-50)

- `#101922` (Stitch dark bg) → `--color-bg` (dark theme)
  - Dark: `#030712` (gray-950)
  - Note: Stitch is slightly lighter, but we'll use our darker bg for better contrast

### Surface/Card Colors
- `#ffffff` (Stitch light surface) → `--color-surface`
  - Light: `#ffffff`

- `#1e2936` (Stitch chat bubble dark) → `--color-surface` (dark theme)
  - Dark: `#1f2937` (gray-800)
  - Perfect match!

- `#233648` (Stitch accent dark) → `--color-border` (dark theme)
  - Dark: `#374151` (gray-700)
  - We'll use this for borders, dividers, and subtle accents

### Text Colors
- Stitch light text: `#111827` → `--color-text`
- Stitch dark text: `#ffffff` → `--color-text`
- Stitch secondary text `#92adc9` → `--color-text-secondary` (dark)
  - Dark: `#d1d5db` is slightly lighter but works well

### Semantic Colors (already defined)
- Success: `--color-success`
- Warning: `--color-warning`
- Error: `--color-error`

## Typography Adjustments

### Stitch Design Font Sizes
- Hero title: 48-60px → Will use `$font-size-6xl` (60px) or `$font-size-5xl` (48px)
- Section titles: 32-40px → `$font-size-4xl` (40px) or `$font-size-3xl` (32px)
- Chat messages: 15-16px → `$font-size-base` (16px)
- Small labels: 11-12px → `$font-size-xs` (12px)
- Timestamps: 10px → Add new `$font-size-2xs` (10px)

### New Variables Needed
Add to `_variables.scss`:
```scss
$font-size-2xs: 0.625rem;  // 10px (for timestamps, micro labels)
$font-size-chat: 0.9375rem; // 15px (for chat messages)
```

## Shadow/Elevation
Stitch uses similar shadows to our system:
- Cards: `--shadow-sm` or `--shadow-md`
- Modals: `--shadow-xl`
- Floating elements: `--shadow-lg`

## Border Radius
Stitch uses large radius (1rem, 1.5rem, 2rem):
- Our system already has: `$radius-xl` (1rem), `$radius-2xl` (1.5rem)
- Chat bubbles: `$radius-2xl` (1.5rem)
- Cards: `$radius-xl` (1rem)
- Pills/chips: `$radius-full`

## Conclusion
Our existing theme system covers 95% of the Stitch design needs. Only minor typography additions required. This ensures:
- ✅ No color bloat or duplication
- ✅ Consistent light/dark theme switching
- ✅ Minimal CSS additions (~2-3KB)
- ✅ Maintains brand identity
