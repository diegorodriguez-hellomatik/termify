# Claude Terminal Platform

A web-based terminal management platform for running interactive shell sessions in your browser.

<!-- SCREENSHOTS -->
![Dashboard](./docs/screenshots/dashboard.png)
<!-- Add your dashboard screenshot here -->

## Features

- **Full Terminal Experience** - Real PTY with xterm.js
- **Real-time Streaming** - WebSocket-powered instant I/O
- **Dark/Light Theme** - System-aware with manual toggle
- **Categories** - Organize terminals by project
- **Drag & Drop** - Reorder terminals easily
- **OAuth Login** - GitHub & Google authentication
- **Brute Force Protection** - Rate limiting on login

<!-- SCREENSHOTS -->
![Terminal](./docs/screenshots/terminal.png)
<!-- Add your terminal screenshot here -->

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 15, React 19, TypeScript |
| Terminal | xterm.js |
| Backend | Node.js, Express |
| PTY | node-pty |
| WebSocket | ws |
| Database | PostgreSQL + Prisma |
| Auth | Auth.js v5 |

## Quick Start

```bash
# Install
npm install

# Configure environment
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env

# Setup database
cd apps/server && npx prisma db push

# Start development
npm run dev
```

**URLs:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Environment Variables

### Server (`apps/server/.env`)
```env
PORT=3001
DATABASE_URL="postgresql://user:pass@localhost:5432/claude_terminal"
JWT_SECRET="your-secret"
CORS_ORIGINS="http://localhost:3000"
```

### Web (`apps/web/.env`)
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_WS_URL="ws://localhost:3001"
AUTH_SECRET="your-auth-secret"

# OAuth (optional)
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
```

## OAuth Setup (Optional)

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name:** `Claude Terminal`
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
4. Click **"Register application"**
5. Copy **Client ID** → `AUTH_GITHUB_ID`
6. Click **"Generate a new client secret"** → `AUTH_GITHUB_SECRET`

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project (or select existing)
3. Click **"Create Credentials"** → **"OAuth client ID"**
4. Select **"Web application"**
5. Add to **Authorized redirect URIs:**
   ```
   http://localhost:3000/api/auth/callback/google
   ```
6. Click **"Create"**
7. Copy **Client ID** → `AUTH_GOOGLE_ID`
8. Copy **Client Secret** → `AUTH_GOOGLE_SECRET`

> **Note:** For production, replace `localhost:3000` with your actual domain.

## Screenshots

<!-- Add your screenshots here -->

### Dashboard
![Dashboard](./docs/screenshots/dashboard.png)

### Terminal View
![Terminal](./docs/screenshots/terminal.png)

### Categories
![Categories](./docs/screenshots/categories.png)

### Light Mode
![Light Mode](./docs/screenshots/light-mode.png)

## Project Structure

```
claude-terminal-platform/
├── apps/
│   ├── web/                 # Next.js frontend
│   └── server/              # Node.js backend
├── packages/
│   └── shared/              # Shared types
└── package.json
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `POST /api/auth/oauth` - OAuth login

### Terminals
- `GET /api/terminals` - List
- `POST /api/terminals` - Create
- `PATCH /api/terminals/:id` - Update
- `DELETE /api/terminals/:id` - Delete
- `POST /api/terminals/reorder` - Reorder

### Categories
- `GET /api/categories` - List
- `POST /api/categories` - Create
- `PATCH /api/categories/:id` - Update
- `DELETE /api/categories/:id` - Delete

## Security

- JWT with refresh tokens
- Password hashing (scrypt)
- Rate limiting (5 attempts/15 min)
- Account lockout (30 min)
- CORS protection

## License

MIT
