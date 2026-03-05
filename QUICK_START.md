# Quick Start Guide

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests with Vitest
- `npm run type-check` - Type check with TypeScript

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── about/             # About page
│   ├── contact/           # Contact page
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── navbar.tsx         # Navigation
│   └── *-demo.tsx        # Demo components
├── lib/
│   └── utils.ts           # Utilities
└── components/providers/
    └── theme-provider.tsx # Theme provider
```

## Features

✅ **Accessibility** - All components are accessible (ARIA, keyboard navigation)
✅ **Dark Mode** - System preference detection with persistence
✅ **TypeScript** - Strict mode enabled
✅ **Form Validation** - React Hook Form + Zod
✅ **Testing** - Vitest + Testing Library setup
✅ **Performance** - Optimized images, code-splitting

## Adding New Components

To add new shadcn/ui components:

```bash
npx shadcn-ui@latest add [component-name]
```

Or manually create components in `components/ui/` following the existing patterns.

## Customization

### Theme Colors

Edit `app/globals.css` to customize color tokens:

```css
:root {
  --primary: 222.2 47.4% 11.2%;
  /* ... */
}
```

### Tailwind Config

Customize design tokens in `tailwind.config.ts`:

```typescript
extend: {
  borderRadius: {
    lg: "var(--radius)",
    // ...
  }
}
```

## Testing

Run tests:
```bash
npm test
```

Run tests with UI:
```bash
npm run test:ui
```

## Deployment

Build for production:
```bash
npm run build
npm start
```

Or deploy to Vercel:
```bash
vercel
```
