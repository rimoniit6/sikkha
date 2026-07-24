# শিক্ষা বাংলা (Sikkha)

> A Bangladeshi online learning platform serving students from Class 6 to HSC, built with Next.js 16, React 19, TypeScript 5.9, and Prisma 7.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

---

## Features

### Student Features
- **MCQ Practice** — Multiple choice questions with image support per option
- **Creative Questions (CQ)** — 4 sub-questions per stem with image annotation
- **Lectures** — Video/text content with resources
- **Board Questions** — Historical board exam questions by year and board
- **Custom Exams** — Student-created timed exams with MCQ/CQ/mixed
- **Knowledge Bank** — Knowledge and comprehension questions
- **Exam Suggestions** — Curated exam preparation materials
- **Premium Packages** — Time-based subscriptions (30 days, 6 months, 1 year)
- **Bundles** — One-time purchase of curated content collections
- **Courses** — Structured learning with lessons, assignments, and certificates
- **Bookmarks & Notes** — Personal content saving and note-taking
- **Search** — Global content search with filters
- **Learning Preference** — GLOBAL (all classes) or CLASS_BASED (specific class) mode

### Admin Features
- **Content Management** — Full CRUD for MCQ, CQ, lectures, exams, bundles, packages
- **Payment Review** — Approve/reject payments, create subscriptions
- **User Management** — View/edit users, role management
- **Analytics Dashboard** — Revenue, students, retention, conversion metrics
- **Bulk Import** — Excel-based content import
- **Audit Logging** — Complete admin action history
- **Version History** — Content versioning with rollback
- **Database Tools** — Export, import, reset

### Premium System
- **Package Subscriptions** — Class-specific time-based access
- **Bundle Purchases** — One-time curated content access
- **MCQ/CQ Exam Packages** — Dedicated exam access
- **Course Purchases** — Structured learning access
- **Subscription Renewal** — Automatic extension on repurchase

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.9 (strict) |
| UI | React 19 + Tailwind CSS 4 + Radix UI |
| State | Zustand 5 + TanStack React Query 5 |
| Database | SQLite via Prisma 7 (LibSQL adapter) |
| Auth | Custom JWT (jose) + HttpOnly cookies |
| Validation | Zod 4 |
| Rich Text | TipTap 3 |
| Math | KaTeX + MathJax 3 |
| Animation | Framer Motion 12 |
| Charts | Recharts |
| Testing | Vitest |
| Error Tracking | Sentry |

---

## Installation

### Prerequisites
- Node.js 20+ (v22 recommended)
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/rimoniit6/sikkha.git
cd sikkha

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Seed the database
npx prisma db seed

# Create super admin
npm run create-super-admin

# Start development server
npm run dev
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite path (`file:./db/custom.db`) |
| `JWT_SECRET` | Yes | JWT signing secret (32+ chars) |
| `CSRF_SECRET` | Yes | CSRF token signing secret (32+ chars) |
| `SUPER_ADMIN_EMAIL` | Yes | Default super admin email |
| `SUPER_ADMIN_PASSWORD` | Yes | Default super admin password |
| `ENABLE_CSRF` | No | Enable CSRF in dev (`true`/`false`) |
| `SENTRY_DSN` | No | Sentry error tracking |
| `STANDALONE_OUTPUT` | No | Enable standalone build |

---

## Database

SQLite via Prisma 7 ORM with 45+ models. See [DATABASE.md](DATABASE.md) for complete schema documentation.

```bash
npm run db:push      # Push schema changes
npm run db:generate  # Regenerate Prisma client
npm run db:reset     # Reset and re-seed
```

---

## Running Locally

```bash
npm run dev          # Development (Turbopack, port 3000)
npm run build        # Production build
npm run start        # Production server
```

---

## Production Build

```bash
STANDALONE_OUTPUT=true npm run build
npm run start
```

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide.

---

## Testing

```bash
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run lint         # ESLint
```

See [TESTING.md](TESTING.md) for testing strategy.

---

## Admin Credentials

Default super admin credentials (set in `.env`):
- **Email:** `admin@localhost`
- **Password:** `inp`

---

## User Roles

| Role | Access |
|------|--------|
| `STUDENT` | Free content, premium (if purchased), exams |
| `ADMIN` | Full CRUD on all content, payment approval |
| `SUPER_ADMIN` | System settings, database operations, admin management |

---

## Premium System

See [PREMIUM_SYSTEM.md](PREMIUM_SYSTEM.md) for complete documentation.

- **Packages** — Time-based subscriptions (30d, 6mo, 1yr)
- **Bundles** — One-time curated content
- **MCQ/CQ Exam Packages** — Dedicated exam access
- **Courses** — Structured learning paths

---

## Payment System

See [PAYMENT_SYSTEM.md](PAYMENT_SYSTEM.md) for complete documentation.

Manual payment via bKash/Nagad/Rocket with admin approval workflow.

---

## API Documentation

See [API.md](API.md) for complete API reference.

211 REST API endpoints across auth, content, payment, admin, and analytics.

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for complete architecture documentation.

---

## Security Features

- JWT authentication with HttpOnly cookies
- CSRF protection on all mutations
- Rate limiting on auth, API, and admin endpoints
- Role-based access control (STUDENT, ADMIN, SUPER_ADMIN)
- HTML sanitization at Prisma middleware layer
- SQL injection prevention via Prisma ORM
- Security headers (CSP, HSTS, X-Frame-Options)
- Audit logging for all admin actions

See [SECURITY.md](SECURITY.md) for complete security documentation.

---

## Roadmap

### Short Term
- [ ] Payment system unit tests
- [ ] Zod validation schemas for remaining routes
- [ ] Component decomposition (7 files > 1000 lines)

### Medium Term
- [ ] PostgreSQL migration for production
- [ ] Automated payment gateway integration
- [ ] Real-time notifications via WebSocket
- [ ] Content versioning UI

### Long Term
- [ ] Mobile app (React Native/PWA)
- [ ] Live class/video streaming
- [ ] AI-powered recommendations
- [ ] Multi-language support

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

1. Fork the repository
2. Create a feature branch
3. Follow coding standards
4. Add tests
5. Open a Pull Request

---

## License

ISC
