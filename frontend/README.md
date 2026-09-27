# Aevora Frontend Monorepo

This monorepo is structured using [Turborepo](https://turbo.build/repo), [Next.js](https://nextjs.org), and [Tailwind CSS v4](https://tailwindcss.com).

## Repository Structure

```
frontend/
├── apps/
│   └── web/                   # Main Next.js 16 Web Application
└── packages/
    ├── eslint-config/         # Shared ESLint configuration
    ├── store/                 # Shared Redux Toolkit store and RTK Query services
    ├── tailwind-config/       # Shared Tailwind CSS v4 stylesheets & themes
    ├── typescript-config/     # Shared tsconfig base files
    └── ui/                    # Shared shadcn/Radix UI component library
```

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

### 3. Build All Projects
```bash
npm run build
```

### 4. Type Checking and Linting
```bash
npm run check-types
npm run lint
```
