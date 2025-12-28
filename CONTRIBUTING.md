# Contributing to Plaintext-ai

Thank you for your interest in contributing to Plaintext-ai! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Git

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/l-forster/plaintext-ai.git
   cd plaintext-ai
   ```

3. Install dependencies:
   ```bash
   cd frontend && npm install
   ```

4. Set up environment variables:
   ```bash
   cp ../.env.example .env
   # Edit .env with your API keys
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Messages

Follow conventional commits:
- `feat: add new claim extractor tool`
- `fix: resolve workflow execution order bug`
- `docs: update README with Docker instructions`
- `refactor: simplify ToolNode component`

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run type checking: `npm run check`
4. Test your changes locally
5. Push to your fork
6. Open a PR against `main`

## Project Structure

```
frontend/
├── client/              # React frontend
│   └── src/
│       ├── components/
│       │   ├── workflow/    # Core workflow components
│       │   └── ui/          # shadcn/ui components
│       ├── pages/
│       ├── hooks/
│       └── lib/
└── server/              # Express backend
    ├── routes/          # API endpoints
    ├── services/        # Business logic
    └── middleware/
```

## Key Areas for Contribution

### New Tools
Add new research tools in `frontend/server/routes/`. Each tool should:
- Have its own router file
- Export a default Express router
- Be mounted in `aiAssistantRoutes.ts`
- Be added to `serverWorkflowToolsForLLM` array

### UI Improvements
Components live in `frontend/client/src/components/`. We use:
- React 19
- TailwindCSS
- shadcn/ui components
- React Flow for the workflow canvas

### Documentation
Help improve docs, examples, and tutorials.

### Bug Fixes
Check the Issues tab for bugs to fix.

## Code Style

- TypeScript strict mode
- Functional components with hooks
- Prefer `const` over `let`
- Use meaningful variable names
- Add comments for complex logic

## Testing

Currently, we don't have automated tests. This is a great area for contribution!

## Questions?

Open an issue or start a discussion in the GitHub Discussions tab.

---

Thank you for contributing!   

