# SwasthyaSetu — UI Design System & Aesthetic Foundation

## 1. Design Philosophy

SwasthyaSetu adopts a calm, authoritative, neutral-first healthcare aesthetic suitable for a national public service platform. Visual quality is achieved through precise typography, disciplined spacing, and clear information hierarchy rather than decorative visual effects.

---

## 2. Color Palette & Tokens

### 2.1 Neutral Surfaces & Typography
- **Page Background**: Slate-50 (`#F8FAFC`)
- **Card / Container Background**: White (`#FFFFFF`)
- **Primary Text**: Slate-900 (`#0F172A`)
- **Secondary / Subdued Text**: Slate-600 (`#475569`)
- **Muted / Placeholder Text**: Slate-400 (`#94A3B8`)
- **Subtle Borders**: Slate-200 (`#E2E8F0`)
- **Stronger Borders**: Slate-300 (`#CBD5E1`)

### 2.2 Healthcare Accent
- **Primary Accent**: Deep Teal (`#0F766E` / `#0D9488`)
- **Accent Hover**: Dark Teal (`#115E59`)
- **Accent Light Tint**: Teal-50 (`#F0FDFA`)

### 2.3 Semantic Status Palette
- **Success / Verified**: Emerald-700 (`#15803D`) on Emerald-50 (`#F0FDF4`), Border: `#BBF7D0`
- **Warning / Pending**: Amber-700 (`#B45309`) on Amber-50 (`#FFFBEB`), Border: `#FDE68A`
- **Error / Gap Detected**: Red-700 (`#B91C1C`) on Red-50 (`#FEF2F2`), Border: `#FECACA`
- **Informational**: Sky-700 (`#0369A1`) on Sky-50 (`#F0F9FF`), Border: `#BAE6FD`

### 2.4 Strictly Prohibited Styles
- ❌ Neon colors or glowing borders
- ❌ Purple/pink "AI gradients"
- ❌ Glassmorphism & excessive backdrop filters
- ❌ Over-rounded whimsical cards
- ❌ Distracting loop animations or floating particle effects

---

## 3. Responsive Breakpoints

The application is built **mobile-first** and verified across standard device viewports:

| Breakpoint | Target Device Category | Behavior |
|---|---|---|
| **390px** | Compact Mobile (iPhone SE, iPhone 13 mini) | Single column, full-width tap targets, compact padding |
| **430px** | Large Mobile (iPhone 15 Pro Max) | Single column, optimized font sizing |
| **768px** | Tablets / Foldables | 2-column grids, collapsible mobile drawer navigation |
| **1024px** | Laptops / Small Desktops | Expanded desktop navigation bar, 3-column feature grids |
| **1280px** | Standard Desktop | Centered `max-w-7xl` container with generous whitespace |
| **1440px** | Widescreen Desktop | High-density readability limits with balanced lateral gutters |

---

## 4. Accessibility Baseline

- **Contrast Ratios**: All text meets or exceeds WCAG AA standard (4.5:1 for normal text, 3:1 for large text).
- **Focus Indicators**: Visible focus rings on all interactive components:
  `focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2`
- **Form Controls**: Explicit `<label>` elements linked to inputs via unique `id` and `aria-describedby` associations for errors and helpers.
- **Tap Targets**: Minimum 40px × 40px touch targets for mobile accessibility.
