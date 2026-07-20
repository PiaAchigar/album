---
name: Album Dual-Context System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45474c'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#545f73'
  primary: '#091426'
  on-primary: '#ffffff'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#bcc7de'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed65b'
  on-secondary-container: '#745c00'
  tertiary: '#240b1d'
  on-tertiary: '#ffffff'
  tertiary-container: '#3b2032'
  on-tertiary-container: '#ab859c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e3fb'
  primary-fixed-dim: '#bcc7de'
  on-primary-fixed: '#111c2d'
  on-primary-fixed-variant: '#3c475a'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#ffd8ed'
  tertiary-fixed-dim: '#e5bad3'
  on-tertiary-fixed: '#2c1325'
  on-tertiary-fixed-variant: '#5c3d51'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-festive:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  touch-target-min: 48px
  margin-mobile: 16px
  gutter-grid: 8px
  stack-sm: 12px
  stack-md: 24px
---

## Brand & Style

This design system employs a bifurcated visual strategy to address two distinct user mindsets within a single ecosystem. It bridges the gap between high-stakes event coordination and the emotional, celebratory atmosphere of a live event.

- **The Organizer Persona:** Professional, authoritative, and focused. The aesthetic follows a **Corporate/Modern** style with a leaning toward **Minimalism**. It prioritizes information density and data clarity to instill confidence in the event host.
- **The Guest Persona:** Warm, elegant, and festive. The style shifts toward **Tactile/Editorial**, utilizing a soft color palette and high-contrast typography to evoke a premium, "wedding-grade" digital experience.

The unified emotional response is one of reliability for the host and effortless joy for the guest.

## Colors

The palette is split into two functional themes:

**Organizer Palette (Professional & Sober):**
- **Primary (Navy Blue):** `#1E293B`. Used for core navigation, headers, and primary actions to convey trust.
- **Neutral (Slate Grey):** `#64748B`. Used for secondary text, metadata, and borders to maintain a clean, technical look.
- **Background:** Pure white `#FFFFFF` for maximum legibility in data-heavy views.

**Guest Palette (Festive & Elegant):**
- **Primary (Gold):** `#D4AF37`. Used for celebratory accents, icons, and primary guest actions.
- **Tertiary (Pale Pink):** `#FBCFE8`. Used as a soft background wash or for secondary buttons to create a warm atmosphere.
- **Text:** The Navy Blue from the organizer side is used sparingly here for high-contrast body text to ensure readability.

## Typography

The typography system uses a strategic mix to distinguish between management and celebration.

- **Management Views:** Exclusively use **Inter**. It is systematic and utilitarian, perfect for dashboards and statistics. Use Bold weights for headers to maintain a clear visual hierarchy.
- **Guest Views:** Introduce **Playfair Display** for high-level headings (H1, H2) and "Display" moments (e.g., event titles, "Welcome"). This adds an editorial, premium feel. 
- **Body Text:** All functional text across both contexts remains in **Inter** for its superior legibility on mobile devices.
- **Mobile Scaling:** Headings scale down for mobile to prevent awkward line breaks in narrow containers while maintaining a minimum 16px size for body content to ensure accessibility.

## Layout & Spacing

This is a **Mobile-First Fluid Grid** system.

- **Safe Margins:** A standard 16px (4 units) margin is applied to the left and right of all mobile screens.
- **Touch Targets:** All interactive elements (buttons, inputs, toggles) must have a minimum height of 48px to accommodate comfortable thumb interactions.
- **Mosaic Grids:** Photo galleries utilize a "weighted mosaic" layout. Larger featured images span 2 columns, while smaller images span 1, using an 8px gutter to maintain a clean, breathable aesthetic.
- **Wizards & Steppers:** Use a full-width vertical stack for form elements with 24px spacing between logical groups. Progress bars are anchored to the top of the viewport or just below the header to indicate journey depth.

## Elevation & Depth

The design system uses two different elevation models to reinforce the dual-context:

- **Organizer Context (Tonal Layers):** Uses flat surfaces and subtle, 1px Slate Grey borders (`#E2E8F0`) to define containers. Depth is conveyed through background color shifts rather than shadows to keep the UI feeling fast and precise.
- **Guest Context (Ambient Shadows):** Uses soft, diffused shadows with a slight gold/warm tint to make cards and buttons feel "raised" and tactile. 
- **Full-Screen Detail Views:** When a photo is opened, the elevation is maximized by using a pure black backdrop, effectively "removing" the background to focus entirely on the content.
- **Glassmorphism:** Use a light backdrop blur (10px) on the navigation bar in the Guest App to allow the celebratory colors of the photo grid to peek through.

## Shapes

The shape language is consistently **Rounded** to keep the app feeling modern and approachable.

- **Base Radius:** 8px (`0.5rem`) for standard cards and input fields.
- **Large Radius:** 16px (`1rem`) for bottom sheets and the Guest App's primary feature cards.
- **Buttons:** Large buttons use a 12px radius, nearly reaching a pill shape but maintaining enough structure to feel professional in the organizer panel.
- **Mosaic Images:** Images in the grid should have a subtle 4px corner radius to soften the edges of the gallery.

## Components

- **Buttons:** Primary buttons are 48px height minimum. Organizer buttons are solid Navy; Guest buttons are solid Gold or Pink with high-contrast text.
- **Mosaic Grid:** A dynamic layout for photos. Use varying aspect ratios (1:1, 4:5, 16:9) to create a lively, festive feel in the guest view.
- **Steppers:** Large, centered numeric inputs for event guest counts or photo limits, using `+` and `-` buttons that meet the 48px touch target.
- **Progress Bars:** Thin 4px bars. In the Guest App, use a Gold gradient to show upload progress; in the Organizer panel, use solid Navy for wizard steps.
- **Cards:** Organizer cards are bordered and flat. Guest cards use soft shadows and Pale Pink backgrounds to highlight featured content.
- **Icons:** Use "Outline" icons for the Organizer panel for clarity; use "Filled" or "Duo-tone" icons in Gold for the Guest app to add a decorative flair.
- **Navigation:** Bottom navigation for both apps. The Guest app features a prominent "Add Photo" center button that uses the Gold primary color.