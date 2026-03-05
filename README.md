# Next.js App with shadcn/ui

Production-ready Next.js application with TypeScript, Tailwind CSS, and shadcn/ui components.

## Features

- ✅ **Next.js 14** (App Router)
- ✅ **TypeScript** (strict mode)
- ✅ **Tailwind CSS** with custom design tokens
- ✅ **shadcn/ui** components (accessible, customizable)
- ✅ **Dark Mode** with system preference detection
- ✅ **Form Validation** (React Hook Form + Zod)
- ✅ **Accessibility** (ARIA, keyboard navigation, focus states)
- ✅ **Performance** optimized (code-splitting, lazy loading)
- ✅ **Testing** setup (Vitest + Testing Library)
- ✅ **Linting & Formatting** (ESLint + Prettier)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type check
npm run type-check

# Format code
npm run format
```

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles & design tokens
├── components/
│   ├── ui/                # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── form.tsx
│   │   └── ...
│   ├── navbar.tsx         # Navigation component
│   └── ...
├── lib/
│   └── utils.ts           # Utility functions
└── components/providers/
    └── theme-provider.tsx # Theme provider
```

## Components

All UI components are built with:
- **Accessibility** (ARIA labels, keyboard navigation)
- **TypeScript** (fully typed)
- **Tailwind CSS** (customizable via CSS variables)
- **Dark mode** support

## Testing

Tests are written with Vitest and React Testing Library:

```bash
npm test              # Run tests
npm run test:ui       # Run tests with UI
```

## License

MIT
