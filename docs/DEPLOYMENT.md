# Deployment

> Deployment guide for শিক্ষা বাংলা.

## Development

```bash
npm install
npm run db:generate
npm run db:push
npx prisma db seed
npm run create-super-admin
npm run dev
```

Development server runs on port 3000 with Turbopack.

## Production Build

```bash
STANDALONE_OUTPUT=true npm run build
npm run start
```

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

## Prisma

```bash
npm run db:push      # Push schema changes
npm run db:generate  # Regenerate Prisma client
npm run db:migrate   # Run migrations
npm run db:reset     # Reset and re-seed
npx prisma db seed   # Seed database
```

## Seed Data

```bash
npx prisma db seed          # Full seed (users, content, settings)
npm run seed:content        # Content data only
npm run seed:missing        # Missing content references
npm run create-super-admin  # Create super admin user
```

## Vercel Deployment

1. Connect repository to Vercel
2. Set environment variables in Vercel dashboard
3. Vercel auto-detects Next.js and deploys

Note: SQLite works for development. For production, consider PostgreSQL migration.

## Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN STANDALONE_OUTPUT=true npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Production Checklist

- [ ] `JWT_SECRET` set to strong random value
- [ ] `CSRF_SECRET` set to strong random value
- [ ] `ENABLE_CSRF=true` in production
- [ ] `STANDALONE_OUTPUT=true` for Docker
- [ ] Sentry DSN configured
- [ ] Database backed up
- [ ] Admin accounts created
- [ ] SSL/TLS configured
- [ ] Security headers enabled
