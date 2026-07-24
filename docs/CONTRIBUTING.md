# Contributing

> Contribution guidelines for শিক্ষা বাংলা.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/amazing-feature`
5. Make your changes
6. Run tests: `npm test`
7. Run linter: `npm run lint`
8. Commit: `git commit -m 'Add amazing feature'`
9. Push: `git push origin feature/amazing-feature`
10. Open a Pull Request

## Development Setup

```bash
npm install
npm run db:generate
npm run db:push
npx prisma db seed
npm run create-super-admin
npm run dev
```

## Coding Standards

### TypeScript
- Strict mode
- No `any` types
- Explicit return types on exports

### Naming
- Files: `kebab-case.ts`
- Components: `PascalCase.tsx`
- Hooks: `use-kebab-case.ts`
- API routes: `kebab-case/route.ts`

### Components
- `'use client'` directive for client components
- Extract logic into custom hooks
- Keep under 300 lines

### API Routes
- Use `handleApiError` in catch blocks
- Use `validateBody` for mutations
- Use `withAdmin` for admin routes
- Use `withCsrf` for mutations
- Return `apiResponse`/`apiError`

### Transactions
- Use `safeTransaction` for atomic operations
- Always use `tx`, never `db` inside transactions

## Pull Request Guidelines

- Write clear commit messages
- Add tests for new features
- Update documentation if needed
- Follow existing code patterns
- Keep PRs focused (one feature/fix per PR)

## Issue Reporting

- Use GitHub Issues
- Include reproduction steps
- Include environment details
- Include error messages/screenshots

## Code Review

All PRs require review before merging. Reviewers check:
- Code quality and consistency
- Test coverage
- Security implications
- Performance impact
- Documentation updates
