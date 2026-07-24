# Environment Variables

> Complete environment variable reference for শিক্ষা বাংলা.

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path | `file:./db/custom.db` |
| `JWT_SECRET` | JWT token signing secret (32+ chars) | `your-secret-key-here` |
| `CSRF_SECRET` | CSRF token signing secret (32+ chars) | `your-csrf-secret-here` |
| `SUPER_ADMIN_EMAIL` | Default super admin email | `admin@localhost` |
| `SUPER_ADMIN_PASSWORD` | Default super admin password | `secure-password` |

## Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_CSRF` | Enable CSRF in development | `false` |
| `SENTRY_DSN` | Sentry error tracking DSN | — |
| `NEXT_PUBLIC_SENTRY_DSN` | Public Sentry DSN for client | — |
| `NEXT_PUBLIC_SITE_URL` | Public-facing site URL | — |
| `STANDALONE_OUTPUT` | Enable standalone build output | `false` |
| `FEATURE_UPLOAD` | Enable file upload feature | `true` |
| `FEATURE_FORGOT_PASSWORD` | Enable forgot password flow | `true` |
| `NODE_ENV` | Environment mode | `development` |

## Development Defaults

In `.env`:
```
DATABASE_URL=file:./db/custom.db
ENABLE_CSRF=false
JWT_SECRET=0fb77bb415aa4431d519cc9d2708e3c039cefebd3e82f30ae4b60d917340fd90
SUPER_ADMIN_EMAIL=admin@localhost
SUPER_ADMIN_PASSWORD=inp
SUPER_ADMIN_NAME=Super Admin
```

## Production Requirements

- `JWT_SECRET`: Generate with `openssl rand -hex 32`
- `CSRF_SECRET`: Generate with `openssl rand -hex 32`
- `ENABLE_CSRF`: Set to `true`
- `SENTRY_DSN`: Get from Sentry dashboard
- `NEXT_PUBLIC_SITE_URL`: Your production URL

## Security Notes

- Never commit `.env` to version control
- Use different secrets for development and production
- Rotate secrets regularly in production
- `JWT_SECRET` and `CSRF_SECRET` must be at least 32 characters
