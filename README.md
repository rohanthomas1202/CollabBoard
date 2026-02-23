# CollabBoard

A real-time collaborative whiteboard with AI-powered board manipulation. Multiple users can brainstorm, draw, and organize ideas simultaneously with live cursor tracking, presence awareness, and an AI assistant that creates and arranges board elements through natural language.

**Live Demo:** [collabboard-nu-gules.vercel.app](https://collabboard-nu-gules.vercel.app)

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- **Canvas:** Konva.js / React Konva (HTML5 Canvas)
- **Backend:** Firebase (Firestore for persistence, Realtime Database for cursors/presence/timers, Authentication)
- **AI:** Anthropic Claude via Vercel AI SDK with function calling
- **Styling:** Tailwind CSS 4 + Framer Motion
- **Observability:** Langfuse + OpenTelemetry (LLM tracing)
- **Testing:** Jest + React Testing Library
- **Deployment:** Vercel

## Features

### Core Whiteboard
- **Infinite canvas** with smooth pan (Space+drag or H tool) and scroll-to-zoom (0.1x–5x)
- **Sticky notes** — create, edit text inline (double-click), 6 color options
- **Shapes** — rectangles and circles with 7 color options
- **Lines & connectors** — straight lines and object-to-object connectors with endpoints
- **Freehand drawing** — variable stroke width (thin/medium/thick) with path simplification
- **Text elements** — standalone text with inline editing and font size control
- **Frames** — group and organize content areas, used for presentation mode
- **Transforms** — move, resize, and rotate any object
- **Selection** — single-click select, drag-to-select marquee for multi-select
- **Operations** — delete, undo/redo (Ctrl+Z / Ctrl+Shift+Z, 50-step history)

### Real-Time Collaboration
- **Multiplayer cursors** — see other users' cursors with name labels and assigned colors
- **Presence awareness** — presence bar shows who's currently on the board
- **Live sync** — object creation, edits, and deletions appear instantly for all users
- **Cursor chat** — press to send short messages at your cursor position (100 char max, 4s display)
- **Conflict handling** — last-write-wins with Firestore real-time listeners
- **Persistence** — board state survives all users leaving and returning

### AI Assistant
Chat panel (toggle with toolbar icon) powered by Anthropic Claude with function calling. Supports:
- **Creation** — "Add a yellow sticky note that says 'User Research'"
- **Manipulation** — "Move all pink sticky notes to the right side"
- **Layout** — "Arrange these sticky notes in a grid"
- **Templates** — "Create a SWOT analysis" / "Set up a retrospective board"
- **Organization** — "Organize these sticky notes by theme"
- Multiple chat threads per board with history
- Built-in templates: SWOT Analysis, Sprint Retro, User Journey Map, Pros & Cons, Brainstorm, Organize

### Collaboration Tools
- **Comments & threads** — pin comments anywhere on the canvas or on specific objects, reply in threads, resolve/unresolve
- **Voting** — enable voting mode with configurable votes per user (3/5/10), cast votes on any object
- **Reactions** — emoji reactions on objects (👍 ❤️ 🔥 ⭐ 🎉)
- **Timer** — shared countdown timer with presets (1m, 3m, 5m, 10m), synced across all users
- **Presentation mode** — step through frames as slides with smooth zoom animation, keyboard nav (arrow keys / space / esc)

### Board Management
- **Dashboard** — view all boards, my boards, or shared boards with search and filtering
- **Board sharing** — share boards with other users by link
- **Thumbnails** — auto-generated preview thumbnails on board cards
- **Export** — export board as PNG (2x resolution) or PDF (auto-orientation)
- **Smart guides** — visual alignment guides with 5px snap threshold when moving objects
- **Grid overlay** — toggleable 20px grid
- **Minimap** — bottom-right overview of entire board with click-to-navigate
- **Dark/light theme** — toggle available on all pages

### Keyboard Shortcuts

| Action | Key |
|---|---|
| Select | V |
| Pan | H |
| Sticky Note | N |
| Rectangle | R |
| Circle | O |
| Line | L |
| Connector | C |
| Freehand Draw | D |
| Text | T |
| Comment | M |
| Undo | Ctrl+Z |
| Redo | Ctrl+Shift+Z |
| Delete | Del |
| Zoom | Scroll wheel |
| Pan | Space + drag |

## Setup Guide

### Prerequisites
- Node.js 18+
- npm
- A Firebase project
- An Anthropic API key

### 1. Clone the repository

```bash
git clone https://github.com/rohanthomas1202/CollabBoard.git
cd CollabBoard
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project
2. **Authentication:** Enable Email/Password and Google sign-in providers under Authentication > Sign-in method
3. **Firestore:** Create a Firestore database (start in test mode for development)
4. **Realtime Database:** Create a Realtime Database (used for cursor presence and timers)
5. **Get your config:** Go to Project Settings > General > Your apps > Add a web app, then copy the config values

### 4. Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Create an account and navigate to API Keys
3. Generate a new API key

### 5. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Firebase (Client) — from Firebase Console > Project Settings > Your apps
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com

# Firebase (Admin / Server-side) — optional, for server API routes
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="your_private_key"

# Anthropic — for AI assistant
ANTHROPIC_API_KEY=sk-ant-...

# Langfuse — optional, for LLM observability
LANGFUSE_PUBLIC_KEY=your_public_key
LANGFUSE_SECRET_KEY=your_secret_key
```

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Build for production

```bash
npm run build
npm start
```

### 8. Run tests

```bash
npm test
```

## Architecture Overview

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Dashboard (board list, search, create)
│   ├── login/page.tsx      # Authentication (email/password, Google OAuth)
│   ├── board/[id]/page.tsx # Board workspace
│   └── api/chat/route.ts   # AI chat endpoint (Claude + function calling)
├── components/
│   ├── canvas/             # Konva canvas components (Board, Shape, StickyNote, etc.)
│   ├── toolbar/            # Tool selection toolbar
│   └── ui/                 # UI panels (AI chat, presence, comments, minimap, etc.)
├── hooks/                  # Feature logic (useAuth, useBoard, usePresence, useExport, etc.)
└── lib/                    # Firebase config, types, constants, templates
```

**Data flow:**
- **Firestore** stores board metadata and all board objects (sticky notes, shapes, frames, etc.)
- **Realtime Database** handles ephemeral data: cursor positions, presence status, shared timers
- **AI API route** receives chat messages, calls Claude with board-manipulation tools, writes results back to Firestore
