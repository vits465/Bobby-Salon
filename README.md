# 3D Gallery Frontend Template

A config-driven 3D CSS room gallery website template. Features immersive CSS 3D perspective rooms with wall-mounted images, particle sculpture animations, fullscreen video sections, a 3x3 image gallery with lightbox, and a terminal-style ticker footer.

## Features

- CSS 3D room gallery with perspective transforms and mouse-tilt interaction
- Multiple rooms with left/right arrow navigation and animated transitions
- Three.js particle sculpture with simplex noise shader
- Fullscreen video section with liquid glass overlay panel
- Widescreen video section with typography overlay
- 3x3 image gallery grid with click-to-lightbox (image + description)
- Terminal-style ticker footer with GSAP-animated text sweep
- Fullscreen navigation menu with GSAP entrance animations
- Lenis smooth scrolling with GSAP ScrollTrigger integration
- Dark theme with serif/sans/mono typography system

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 3
- GSAP (ScrollTrigger, timeline animations)
- Three.js (particle sculpture with custom shaders)
- Lenis (smooth scroll)
- CSS 3D Transforms (room gallery)

## Quick Start

1. Clone this repository
2. Install dependencies: `npm install`
3. Edit `src/config.ts` with your content
4. Add images to `public/images/`
5. Add videos to `public/videos/`
6. Run dev server: `npm run dev`
7. Build for production: `npm run build`

## Configuration

All content is configured in `src/config.ts`. Edit this file to customize your site.

### Site Config

```typescript
export const siteConfig: SiteConfig = {
  language: "",      // Language code (e.g. "en", "zh-CN")
  brandName: "",     // Brand name displayed in top-left nav (split into animated letters)
}
```

### Navigation Config

```typescript
export const navigationConfig: NavigationConfig = {
  menuLabel: "",                 // Text on the menu button (e.g. "MENU")
  closeLabel: "",                // Text on the close button in fullscreen menu (e.g. "CLOSE")
  fullscreenMenuLinks: [],       // Array of { label: string, target: string }
  menuSideInfo: [],              // Array of strings shown on right side of menu
}
```

### Hero Room Gallery Config

```typescript
export const heroConfig: HeroConfig = {
  mainTitle: "",     // Large title at bottom of hero (e.g. "A Room of One's Own")
  rooms: [],         // Array of RoomConfig objects (see below)
  metaLines: [],     // Array of meta text lines below subtitle
}
```

Each room in the `rooms` array:

```typescript
{
  name: "",                    // Room name shown as subtitle
  className: "room--waves",    // CSS class that controls wall color
  theme: "dark",               // "light" or "dark" — controls text color
  images: {
    back: [""],                // Back wall image path (1 image)
    left: [""],                // Left wall image path (1 image)
    right: [""],               // Right wall image path (1 image)
  },
}
```

Available className values and their wall colors:
- `room--waves` — deep red (#8b2525)
- `room--monk` — warm beige (#d5d0c8)
- `room--lighthouse` — navy blue (#1a3a5c)
- `room--orlando` — gold (#c8a82e)

### Particle Sculpture Config

```typescript
export const particleConfig: ParticleConfig = {
  sectionLabel: "",    // Section label (e.g. "02 / CONSCIOUSNESS")
  title: "",           // Section heading
  paragraphs: [],      // Array of paragraph HTML strings (supports <em> tags)
  quote: "",           // Blockquote text
}
```

### Lighthouse Video Config

```typescript
export const lighthouseVideoConfig: LighthouseVideoConfig = {
  sectionLabel: "",    // Label inside the glass panel
  dataPoints: [],      // Array of data point strings shown in the panel
  description: "",     // Italic quote text below the divider
  videoPath: "",       // Path to video file (e.g. "videos/lighthouse.mp4")
}
```

### Waves Video Config

```typescript
export const wavesVideoConfig: WavesVideoConfig = {
  sectionLabel: "",    // Section label above video (e.g. "05 / THE WAVES")
  title: "",           // Large text overlay on video
  ctaText: "",         // Call-to-action text (e.g. "ENTER THE EXHIBITION")
  videoPath: "",       // Path to video file (e.g. "videos/waves.mp4")
}
```

### Gallery Config

```typescript
export const galleryConfig: GalleryConfig = {
  sectionLabel: "",        // Section label (e.g. "04 / ARCHIVE")
  sectionTitle: "",        // Section title (e.g. "The Waves")
  items: [],               // Array of { src, caption, description }
  lightboxCloseHint: "",   // Close hint text in lightbox
}
```

### Footer Config

```typescript
export const footerConfig: FooterConfig = {
  linkColumns: [],     // Array of { heading: string, links: string[] }
  tickerWords: [],     // Array of words for terminal ticker effect
  copyright: "",       // Copyright text
}
```

## Required Images

### Room Images (3 per room, 4 rooms = 12 images)

Place in `public/images/rooms/`:

Each room needs exactly 3 images:
- Back wall image (landscape, 1200x800 recommended)
- Left wall image (landscape, 1200x800 recommended)
- Right wall image (landscape, 1200x800 recommended)

### Gallery Images (9 images for 3x3 grid)

Place in `public/images/gallery/`:

- 9 portrait-oriented images (3:4 aspect ratio, 800x1067 recommended)
- Each image needs a caption and description in config

## Required Videos

Place in `public/videos/`:

- Lighthouse video (landscape, 1920x1080 recommended, MP4 format)
- Waves video (landscape, 16:9 aspect ratio, 1920x1080 recommended, MP4 format)

## Design

**Colors:**
- Background: #0a0a0b (void/dark)
- Light section: #f5f4f0 (alabaster)
- Accent: #f25b29 (amber/orange)
- Room walls: #8b2525 (waves), #d5d0c8 (monk), #1a3a5c (lighthouse), #c8a82e (orlando)

**Fonts:**
- Serif: Instrument Serif (titles, headings)
- Sans: Inter 300/400 (body text, labels)
- Mono: Source Code Pro 400 (data points, ticker)

**Animations:**
- GSAP ScrollTrigger entrance animations on all sections
- CSS 3D room perspective with mouse-tilt interaction
- Three.js particle sculpture with simplex noise deformation
- Terminal ticker with GSAP tween sweep reveal/erase cycle
- Logo letter rotation on hover
- Fullscreen menu GSAP timeline open/close

## Build

```bash
npm run build
```

Output in `dist/` folder ready to deploy.

## Project Structure

```
src/
  config.ts              # All content configuration
  App.tsx                # Root component with section layout
  main.tsx               # React entry point
  index.css              # Global styles, CSS 3D room styles
  components/
    Navigation.tsx       # Fixed top nav with brand + menu button
    FullScreenMenu.tsx   # Fullscreen overlay menu
  sections/
    HeroRoomGallery.tsx  # CSS 3D room gallery hero
    ParticleSculpture.tsx # Three.js particle + editorial text
    LighthouseVideo.tsx  # Fullscreen video with glass panel
    ImageGallery.tsx     # 3x3 grid gallery with lightbox
    WavesVideo.tsx       # Widescreen video with text overlay
    FooterTicker.tsx     # Footer links + terminal ticker
  hooks/
    useLenis.ts          # Smooth scroll hook
public/
  images/                # User images go here
  videos/                # User videos go here
```

## Notes

- Do not modify component files unless fixing bugs
- All content goes in `src/config.ts`
- Images go in `public/images/` (rooms/ and gallery/ subdirectories)
- Videos go in `public/videos/`
- Room CSS classes (room--waves, room--monk, etc.) control wall colors in CSS
- The `theme` field on rooms controls whether overlay text is light or dark
- The `paragraphs` field in particleConfig supports HTML (e.g. `<em>` for italics)
- Gallery displays in a 3x3 grid; provide exactly 9 items for best layout
- Ticker words should be short, uppercase words (5-10 characters each)
