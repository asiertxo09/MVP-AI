---
trigger: always_on
---

EduPlay Design System & Style Rules

Context: EduPlay is an educational platform bridging clinical rigor with childlike wonder ("Scientific Magic"). The UI must adapt between a gamified, immersive experience for children and a clean, data-driven dashboard for professionals/parents.

1. Design Tokens & Variables

1.1. Color Palette ("Soft Space")

Constraint: Avoid pure black (#000000) and pure white (#FFFFFF) for main backgrounds to reduce visual stress (dyslexia/ADHD friendly).

Token Name

Hex Value

Usage

--color-primary

#6C5CE7

Main actions, "Play" buttons, active states (Nebula Purple).

--color-text-main

#1F3C88

Headings, primary text (Deep Space Navy).

--color-bg-body

#F0F4F8

Main background, replacing white (Stratosphere Blue).

--color-accent-gold

#F7B500

Rewards, stars, streaks (Solar Gold).

--color-success

#2ECC71

Success states, completion (Life Green).

--color-danger

#FF6B6B

Alerts, "Try Again" (Rocket Red - Pastel, non-alarming).

--color-text-muted

#576B8A

Secondary text, captions.

1.2. Typography

Constraint: Must support an accessibility toggle for OpenDyslexic.

Headings (--font-heading): 'Baloo 2', sans-serif

Style: Rounded, friendly, playful.

Usage: All H1-H4, Button text, Gamification labels.

Body (--font-body): 'Outfit', sans-serif

Style: Geometric, high legibility, open counters.

Usage: Instructions, Reports, Paragraphs.

1.3. Shadows & Depth

Do not use black shadows. Use colored shadows derived from the element's hue.

Small: 0 4px 12px rgba(31, 60, 136, 0.08)

Medium: 0 12px 24px rgba(31, 60, 136, 0.12)

Glow (Primary): 0 10px 20px -5px rgba(108, 92, 231, 0.5)

2. Component Architecture

2.1. Buttons

Shape: Full pill shape (border-radius: 99px).

Primary Button:

Background: linear-gradient(135deg, #6C5CE7 0%, #8E44AD 100%).

Shadow: Colored glow (see 1.3).

Animation: transform: translateY(-2px) on hover.

Secondary Button:

Background: White/Glass.

Border: 2px solid var(--color-primary).

Text: var(--color-primary).

2.2. Glassmorphism Panels

Differentiate between "Play" (Kids) and "Work" (Adults).

.glass-candy (Kids UI):

Opacity: High (Frosted).

Border: 2px solid rgba(255, 255, 255, 0.8).

Blur: backdrop-filter: blur(16px).

Usage: Game modals, rewards, map nodes.

.glass-pro (Professional UI):

Opacity: Low (Clean).

Border: 1px solid rgba(0, 0, 0, 0.05).

Shadow: Distinct, crisp shadow.

Usage: Dashboards, reports, settings.

2.3. Dashboard Cards ("Health Card" Style)

Instead of spreadsheets, use visual metric cards.

Layout: Metric on left, mini-chart (sparkline) on right.

Indicator: Use "Traffic Light" dots (Green/Amber/Red) for status, never harsh text labels like "Fail".

Corner Radius: 20px.

3. Layout & Navigation Patterns

3.1. The Portal (Landing Page)

Hero Section: Must feature the Rocket Mascot (3D/SVG) floating (animation: float).

Role Selection: Three distinct cards instead of a generic login form.

Kid: "Adventure Mode" (Colorful, Mascot icon).

Family: "Progress Mode" (Warm colors, House icon).

Professional: "Tools Mode" (Clean, Medical/School icon).

3.2. Gamification Map (The "Journey")

Structure: Vertical scrolling zig-zag path.

Thematic Worlds: Background gradients must transition as user scrolls:

Level 1-10: Jungle/Earth (Greens/Browns).

Level 11-20: Sky/Clouds (Blues/Whites).

Level 21+: Space (Deep Purples/Stars).

Node States:

Locked: Greyscale, Padlock icon.

Active: Pulsing, larger size, Mascot head.

Completed: Gold checkmark/Star.

4. Interaction & Animation Rules

4.1. Feedback Loops (Crucial for Neurodiversity)

Success: Visual confetti/particle explosion + Positive sound.

Error:

NEVER use: Buzzers, Red "X", flashing red screens.

ALWAYS use: Gentle shake animation (.shake), element dims slightly, encouraging text ("Try again!").

Micro-interactions: Buttons must have active states (scale(0.95)) to provide tactile feedback on touch screens.

4.2. Focus Management

Focus Mode: When a game/activity starts, the HUD (Head-Up Display) with coins/streaks must slide out or fade away to reduce distraction.

5. Assets & Imagery Guidelines

Mascot: "EduRocket" - A rocket with a face (eyes/mouth). Friendly, not mechanical.

Iconography: "Flat 2.5D" style. Flat colors but with a soft bottom shadow to create depth. Rounded stroke caps (3px-4px thickness).

Empty States: Never leave a blank container. Use a spot illustration (e.g., The rocket sleeping, or looking through a telescope) with helpful text.

6. Accessibility & Safety

High Contrast Mode: Include a CSS media query @media (prefers-contrast: high) that overrides brand colors with Black/Yellow/White.

Touch Targets: Minimum 60x60px for all interactive elements in the Child View (motor control accommodation).

Font Toggle: A class .font-dyslexic that applies the OpenDyslexic font family globally when toggled.