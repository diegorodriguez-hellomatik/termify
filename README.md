# Termify

Your AI Terminal Workspace - Run Claude Code in your browser with a VS Code-like experience.

![Termify Landing Page](docs/screenshots/landing-page.png)

## Screenshots

### Terminal with File Explorer and Code Editor
Run terminals with a VS Code-like interface featuring file explorer and integrated code editor.

![Terminal with Editor](docs/screenshots/terminal-with-editor.png)

### Dark Theme
Full dark mode support with system-aware theme switching.

![Dark Theme](docs/screenshots/dark-theme.png)

### Dashboard
Manage multiple terminal sessions with categories and favorites.

![Dashboard](docs/screenshots/dashboard-empty.png)

### API Keys Management
Secure API key management for programmatic access.

![API Keys](docs/screenshots/api-keys.png)

### Authentication
OAuth login with GitHub and Google, plus email/password.

![Login](docs/screenshots/login-page.png)

## Features

### Core Features
- **Multiple Terminals** - Run multiple Claude Code sessions simultaneously with categories and drag-and-drop reordering
- **VS Code-style File Explorer** - Real-time file browser that updates when you create, move, or delete files
- **Built-in Code Editor** - Syntax highlighting, line numbers, and instant save with Ctrl+S
- **Task Tracking** - See Claude's tasks in real-time: what's done, in progress, and pending
- **Real-time Sync** - Everything syncs instantly via WebSocket: file changes, terminal output, task updates
- **API Access** - Full REST API with secure key management for automation

### Additional Features
- **Dark/Light Theme** - System-aware with manual toggle
- **Categories** - Organize terminals by project
- **Drag & Drop** - Reorder terminals easily
- **OAuth Login** - GitHub & Google authentication
- **Brute Force Protection** - Rate limiting on login

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
| Styling | Tailwind CSS, shadcn/ui |

## Quick Start

```bash
# Install dependencies
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
DATABASE_URL="postgresql://user:pass@localhost:5432/termify"
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
   - **Application name:** `Termify`
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

## Project Structure

```
termify/
├── apps/
│   ├── web/                      # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/              # App router pages
│   │   │   ├── components/
│   │   │   │   ├── files/        # FileExplorer, FileEditor
│   │   │   │   ├── layout/       # Sidebar, AppShell
│   │   │   │   ├── tasks/        # TasksPanel
│   │   │   │   ├── terminal/     # Terminal component
│   │   │   │   └── ui/           # shadcn/ui components
│   │   │   ├── hooks/            # useTerminalSocket, etc.
│   │   │   └── lib/              # api, utils
│   │   └── ...
│   └── server/                   # Node.js backend
│       ├── src/
│       │   ├── api/              # REST endpoints
│       │   ├── pty/              # PTY management
│       │   └── websocket/        # WebSocket server
│       └── prisma/               # Database schema
├── packages/
│   └── shared/                   # Shared types
└── package.json
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/oauth` - OAuth login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Terminals
- `GET /api/terminals` - List all terminals
- `POST /api/terminals` - Create new terminal
- `GET /api/terminals/:id` - Get terminal details
- `PATCH /api/terminals/:id` - Update terminal
- `DELETE /api/terminals/:id` - Delete terminal
- `POST /api/terminals/reorder` - Reorder terminals
- `PATCH /api/terminals/:id/favorite` - Toggle favorite

### Files (per terminal)
- `GET /api/terminals/:id/files?path=` - List files in directory
- `GET /api/terminals/:id/file?path=` - Read file content
- `PUT /api/terminals/:id/file` - Write file content

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `PATCH /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category
- `POST /api/categories/reorder` - Reorder categories

### API Keys
- `GET /api/apikeys` - List API keys
- `POST /api/apikeys` - Create API key
- `PATCH /api/apikeys/:id` - Update API key
- `DELETE /api/apikeys/:id` - Revoke API key

## WebSocket Events

### Client to Server
- `terminal.input` - Send input to terminal
- `terminal.resize` - Resize terminal

### Server to Client
- `terminal.output` - Terminal output data
- `terminal.status` - Terminal status change
- `files.changed` - File system changed (triggers file explorer refresh)

## Security

- JWT with refresh tokens
- Password hashing (scrypt)
- Rate limiting (5 attempts/15 min)
- Account lockout (30 min)
- CORS protection
- File access restricted to home directory

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Run type checking
npm run typecheck
```

## Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

## License

MIT
