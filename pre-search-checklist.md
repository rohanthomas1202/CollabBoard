# CollabBoard — Pre-Search Checklist

> Completed before writing code. This document captures the AI-assisted exploration of stack options, tradeoffs, and architecture decisions for building a real-time collaborative whiteboard with an AI board agent.

---

## Phase 1: Define Your Constraints

### 1. Scale & Load Profile

| Question | Answer | Reasoning |
|----------|--------|-----------|
| Users at launch? | 5-50 | Gauntlet evaluation + early testers. Spec tests with 5+ concurrent users |
| Users in 6 months? | 50-500 | Organic growth if product succeeds beyond the sprint |
| Traffic pattern? | **Spiky** | Whiteboard sessions are bursty — idle most of the time, intense during live collaboration |
| Real-time requirements? | **Yes — mandatory** | Spec requires <100ms object sync, <50ms cursor sync. WebSocket or Firebase Realtime listeners required |
| Cold start tolerance? | **Low** | Users expect instant load when opening a board. Firebase's always-on listeners help here — no cold start like serverless functions |

**Implication**: Firebase Realtime Database or Firestore listeners provide always-on real-time sync without managing a WebSocket server. This eliminates the cold start problem entirely.

### 2. Budget & Cost Ceiling

| Question | Answer | Reasoning |
|----------|--------|-----------|
| Monthly spend limit? | $25-100/mo | Serious side project budget |
| Pricing model preference? | Pay-per-use | Firebase's pay-as-you-go (Blaze plan) fits bursty traffic |
| Money-for-time tradeoffs? | **Use managed services heavily** | Solo dev, 1-week sprint. Don't self-host anything |

**Budget allocation (projected)**:
- Firebase (Auth + Firestore + Hosting): $0-25/mo (free tier covers MVP easily)
- AI API (Claude/GPT-4 function calling): $5-30/mo depending on usage
- Domain (optional): $0-12/yr
- **Total projected: $5-55/mo** — well within budget

### 3. Time to Ship

| Question | Answer | Reasoning |
|----------|--------|-----------|
| MVP timeline? | **24 hours** (hard gate from spec) | Must have: infinite board, pan/zoom, sticky notes, shapes, real-time sync, cursors, presence, auth, deployed |
| Full feature deadline? | **Friday (4 days)** for early submission, **Sunday (7 days)** for final | AI agent, connectors, frames, transforms, polish |
| Priority? | **Ship multiplayer first, features second** | Spec says "simple whiteboard with bulletproof multiplayer beats feature-rich board with broken sync" |
| Iteration cadence? | Daily during sprint | Build vertically: finish one layer before starting the next |

**Build priority order (from spec)**:
1. Cursor sync — two cursors moving across browsers
2. Object sync — sticky notes appearing for all users
3. Conflict handling — simultaneous edits
4. State persistence — survive refreshes and reconnects
5. Board features — shapes, frames, connectors, transforms
6. AI commands (basic) — single-step creation/manipulation
7. AI commands (complex) — multi-step template generation

### 4. Compliance & Regulatory Needs

| Requirement | Needed? | Action |
|-------------|---------|--------|
| HIPAA | No | Not handling health data |
| GDPR | No | No EU targeting at launch |
| SOC 2 | No | No enterprise clients |
| Data residency | No | Single region fine for 5-50 users |

**Decision**: No compliance overhead for this sprint. Revisit if product grows.

### 5. Team & Skill Constraints

| Question | Answer | Reasoning |
|----------|--------|-----------|
| Team size? | **Solo developer** | All decisions optimized for one person shipping fast |
| Core skills? | **JavaScript/TypeScript, React** | Stick to what's known — no time to learn new languages |
| Learning required? | Firebase Realtime DB patterns, AI function calling | These are the novel parts of this project |
| AI dev tools required? | At least 2 of: Claude Code, Cursor, Codex, MCP integrations | Spec requirement for AI-first development methodology |

---

## Phase 2: Architecture Discovery

### 6. Hosting & Deployment

**Decision: Firebase Hosting (frontend) + Firebase serverless backend**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Firebase Hosting** | Free tier, global CDN, automatic SSL, GitHub CI/CD, supports Next.js via App Hosting | Framework support is newer | **Winner for frontend** — zero-config deploy, free |
| **Firebase + Firestore listeners** (no separate server) | No server to manage. Firestore `onSnapshot` provides real-time sync. Simplest architecture | 1 write/sec per document limit. Less control over sync logic | **Winner for MVP** — fastest to ship, handles 5+ users easily |
| **Firebase + Cloud Run** (WebSocket server) | Full WebSocket control, Socket.IO + Yjs support, session stickiness | Extra complexity, billed while connections are open | **Upgrade path** if Firestore listeners aren't fast enough |
| Railway/Fly.io | Good WebSocket hosting | Adds a vendor outside Firebase ecosystem | Not needed if staying Firebase-native |

**CI/CD**: Firebase App Hosting auto-deploys from GitHub on push.

**Scaling path**: Firestore listeners (MVP) → Cloud Run + Socket.IO (if needed for performance) → multi-region Cloud Run.

**Key architectural decision**: For MVP, skip a dedicated WebSocket server. Use Firestore's real-time listeners (`onSnapshot`) for object sync and a separate Realtime Database path for cursor/presence data (lower latency for high-frequency updates). This eliminates an entire server to manage.

### 7. Authentication & Authorization

**Decision: Firebase Authentication (email/password + Google OAuth)**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Firebase Auth** | 50K free MAUs, built-in Google/GitHub/email login, integrates with Firestore security rules, drop-in UI components | Tied to Firebase ecosystem | **Winner** — free, fast to implement, native integration |
| Supabase Auth | Good RLS, PostgreSQL-native | Outside Firebase ecosystem | Not using Supabase |
| Clerk | Beautiful UI | Extra vendor, cost | Overkill |
| Auth.js | Full control | Slow to set up | Too slow for 24-hour MVP |

**Auth flow**:
1. User signs up/logs in via Firebase Auth (email or Google)
2. Board creation generates a unique ID — shareable via URL
3. Firebase Security Rules enforce: only authenticated users can read/write boards
4. Board metadata stores `ownerId` for ownership

**RBAC model (simple)**:
- `owner`: created the board — can delete, rename, share
- `collaborator`: authenticated user with the board link — can draw, edit objects
- `viewer` (stretch): read-only access

### 8. Database & Data Layer

**Decision: Firestore (board data + persistence) + Realtime Database (presence + cursors)**

| Concern | Solution | Reasoning |
|---------|----------|-----------|
| Board metadata | **Firestore** | Document model fits: `{ name, ownerId, createdAt }` |
| Board objects (sticky notes, shapes, etc.) | **Firestore subcollection** | Each object = a document in `boards/{boardId}/objects/{objectId}`. Real-time sync via `onSnapshot` |
| Cursor positions | **Firebase Realtime Database** | Lower latency than Firestore for high-frequency updates (50ms target). Path: `presence/{boardId}/{userId}` |
| Presence (who's online) | **Firebase Realtime Database** | Built-in `onDisconnect()` handler auto-cleans stale presence |
| Board state persistence | **Firestore** (objects are already persisted) | No separate persistence step needed — Firestore IS the persistence layer |
| AI command history | **Firestore subcollection** | `boards/{boardId}/ai-commands/{commandId}` for audit trail |

**Why this dual-database approach**:
- **Firestore** excels at structured data with complex queries and scales well
- **Realtime Database** excels at lightweight, high-frequency ephemeral data (cursors, presence)
- Firebase officially recommends this hybrid pattern for presence + data applications

**Firestore structure**:
```
boards/{boardId}
  ├── name: string
  ├── ownerId: string
  ├── createdAt: timestamp
  └── objects/{objectId}
        ├── type: "sticky-note" | "rectangle" | "circle" | "line" | "text" | "frame" | "connector"
        ├── x: number
        ├── y: number
        ├── width: number
        ├── height: number
        ├── text: string (optional)
        ├── color: string
        ├── rotation: number
        ├── zIndex: number
        ├── connectedTo: string (optional, for connectors)
        └── updatedAt: timestamp
```

**Realtime Database structure**:
```
presence/{boardId}/{userId}
  ├── name: string
  ├── cursor: { x: number, y: number }
  ├── color: string
  └── lastSeen: timestamp
```

**Read/write ratio**: Heavy writes during active collaboration, read-heavy on board load. Firestore handles this well with its listener model — initial load is a read, subsequent changes are streamed.

**Conflict resolution**: Last-write-wins at the individual object level. Since each object is a separate Firestore document, two users editing different objects never conflict. Two users editing the same object: latest `updatedAt` wins. This is acceptable per the spec ("last-write-wins acceptable, document your approach").

### 9. Backend/API Architecture

**Decision: Serverless (Firebase-native) — no custom backend server for MVP**

| Dimension | Decision | Reasoning |
|-----------|----------|-----------|
| Architecture | **Serverless / client-first** | Firestore + Realtime DB handle data layer. Cloud Functions handle AI agent. No Express server needed |
| API for AI agent | **Cloud Functions (2nd gen)** | Receives natural language command, calls Claude/GPT-4 with function calling, writes results to Firestore |
| REST endpoints | **Not needed for MVP** | Client SDK talks directly to Firestore. Security rules handle authorization |
| Background jobs | **Cloud Functions triggers** | `onWrite` triggers for AI command processing, board cleanup |

**Why no backend server**: Firebase's client SDKs + security rules eliminate the need for a REST API for CRUD operations. The only server-side logic needed is AI command processing, which fits perfectly in a Cloud Function.

**AI Agent architecture**:
```
Client sends AI command → Cloud Function triggered
  → Parse natural language with Claude/GPT-4 function calling
  → Execute tool calls (createStickyNote, moveObject, etc.)
  → Write results directly to Firestore
  → All clients see changes via onSnapshot listeners (real-time)
```

**Tool schema (from spec)**:
```typescript
createStickyNote(text, x, y, color)
createShape(type, x, y, width, height, color)
createFrame(title, x, y, width, height)
createConnector(fromId, toId, style)
moveObject(objectId, x, y)
resizeObject(objectId, width, height)
updateText(objectId, newText)
changeColor(objectId, color)
getBoardState() // reads current board objects for context
```

### 10. Frontend Framework & Rendering

**Decision: Next.js (React) + Konva.js for canvas rendering**

| Dimension | Decision | Reasoning |
|-----------|----------|-----------|
| Framework | **Next.js** (App Router) | Best React DX, can deploy to Firebase App Hosting, file-based routing |
| Rendering mode | **SPA behavior** (client-side canvas) | Canvas can't be server-rendered. Next.js handles routing + auth pages |
| Canvas library | **Konva.js** (via react-konva) | Scene graph architecture with automatic memory management — critical for long collaboration sessions |
| PWA/offline | Not for MVP | Add later if needed |
| SEO | Not needed | Whiteboards are behind auth |

**Why Konva.js over alternatives**:

| Library | Strengths | Weaknesses | Verdict |
|---------|-----------|------------|---------|
| **Konva.js** | Auto memory cleanup, scene graph (nodes track relationships), great performance, react-konva bindings | No SVG export | **Winner** — best fit for collaborative canvas |
| Fabric.js | Rich object model, SVG support, extensive filters | Manual memory management (leaks in long sessions), larger bundle | Good but riskier for real-time collaboration |
| PixiJS | Fastest rendering (WebGL), great for games | Overkill for whiteboard, steeper learning curve | Too heavy |
| Raw Canvas API | Maximum control, smallest bundle | Must build scene graph, hit-testing, event system from scratch | Too slow to build in 24 hours |
| tldraw/Excalidraw embed | Full whiteboard out of the box | They're products, not libraries. Fighting their opinions limits customization | Doesn't meet "build it" requirement |

**Infinite canvas approach**: Use Konva's `Stage` with `draggable: true` and `scaleX/scaleY` for pan/zoom. Track viewport offset and scale in state.

### 11. Third-Party Integrations

| Service | Purpose | Cost | Rate Limits | Lock-in Risk |
|---------|---------|------|-------------|--------------|
| **Firebase** (Auth + Firestore + RTDB + Hosting + Functions) | Entire backend | Free tier (Spark) or Blaze pay-as-you-go | 50K reads, 20K writes, 20K deletes per day (free) | Medium — Firestore data is exportable, auth is replaceable |
| **Claude API** (Anthropic) or **GPT-4** (OpenAI) | AI Board Agent — function calling for natural language commands | ~$3/1M input tokens, ~$15/1M output tokens (Claude Sonnet) | Rate limits vary by tier | Low — can swap between providers, same function calling pattern |

**AI API choice**: Claude Sonnet 4.5 or GPT-4o-mini for function calling. Both support tool use / function calling well. Go with whichever API key is available first. Claude Sonnet is cheaper for similar quality.

**Pricing cliff to watch**: Firestore free tier is 50K reads/day. With 5 concurrent users each having `onSnapshot` listeners on a board with 100 objects, initial load = 100 reads per user = 500 reads per session. Well within limits. But if boards grow to 500+ objects with frequent refreshes, paid tier may be needed.

---

## Phase 3: Post-Stack Refinement

### 12. Security Vulnerabilities

| Risk | Mitigation |
|------|------------|
| **Firestore security rules bypass** | Write comprehensive rules: only authenticated users can read/write. Only owner can delete boards. Test rules with Firebase emulator |
| **AI prompt injection** | Sanitize user input before sending to LLM. Constrain AI output to only call predefined tool functions — never execute arbitrary code |
| **Board enumeration** | Use Firestore auto-generated IDs (random, not sequential). Don't expose board listing to non-owners |
| **XSS via board content** | Konva renders to canvas (not DOM), so XSS surface is minimal. Still sanitize text inputs before storage |
| **Realtime DB abuse** | Rate limit presence updates client-side (max 30/sec per user). Security rules on Realtime DB paths |
| **Dependency supply chain** | Use `npm audit`, lock dependencies with `package-lock.json`, review Firebase SDK updates |
| **API key exposure** | Firebase client config is safe to expose (secured by rules). AI API keys go in Cloud Function environment variables only, never in client code |

### 13. File Structure & Project Organization

**Decision: Single Next.js project deployed to Firebase**

```
collabboard/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing / dashboard (list user's boards)
│   ├── login/page.tsx            # Auth page
│   ├── board/[id]/page.tsx       # Whiteboard canvas
│   └── layout.tsx                # Root layout with auth provider
├── components/
│   ├── canvas/
│   │   ├── Board.tsx             # Main Konva Stage (infinite canvas)
│   │   ├── StickyNote.tsx        # Sticky note Konva component
│   │   ├── Shape.tsx             # Rectangle, circle, line components
│   │   ├── Connector.tsx         # Line/arrow between objects
│   │   ├── Frame.tsx             # Grouping frame
│   │   ├── TextElement.tsx       # Standalone text
│   │   └── Cursors.tsx           # Remote cursor overlay
│   ├── toolbar/
│   │   ├── Toolbar.tsx           # Drawing tool selector
│   │   └── AIChat.tsx            # AI command input
│   └── ui/
│       ├── PresenceBar.tsx       # Who's online indicator
│       └── AuthGuard.tsx         # Route protection
├── hooks/
│   ├── useBoard.ts               # Firestore board CRUD + real-time listeners
│   ├── usePresence.ts            # RTDB cursor + presence
│   ├── useAuth.ts                # Firebase auth state
│   └── useAI.ts                  # AI command submission
├── lib/
│   ├── firebase.ts               # Firebase client initialization
│   ├── types.ts                  # Shared TypeScript types
│   └── constants.ts              # Colors, sizes, defaults
├── functions/                    # Cloud Functions (deployed separately)
│   ├── src/
│   │   ├── index.ts              # Function exports
│   │   └── ai-agent.ts           # AI command processing with function calling
│   ├── package.json
│   └── tsconfig.json
├── public/                       # Static assets
├── firebase.json                 # Firebase project config
├── firestore.rules               # Firestore security rules
├── database.rules.json           # Realtime DB security rules
├── .env.local                    # Local environment variables (AI API key)
├── package.json
├── tsconfig.json
├── next.config.js
└── pre-search-checklist.md       # This document
```

**Why single project (not monorepo)**: Solo dev, one-week sprint. Cloud Functions live in a `functions/` subdirectory — this is Firebase's standard pattern. No need for Turborepo/Nx overhead.

### 14. Naming Conventions & Code Style

| Convention | Standard |
|------------|----------|
| Variables/functions | `camelCase` |
| Types/interfaces | `PascalCase` |
| React components | `PascalCase.tsx` |
| Hooks | `use*.ts` |
| Utility files | `camelCase.ts` |
| Firestore collections | `kebab-case` or `camelCase` |
| CSS approach | **Tailwind CSS** (utility-first, fastest to prototype) |
| Constants | `UPPER_SNAKE_CASE` |
| Formatter | **Prettier** (default config) |
| Linter | **ESLint** with `@typescript-eslint` |

### 15. Testing Strategy

| Layer | Tool | MVP Target |
|-------|------|------------|
| **Manual multi-browser testing** | 2+ browser windows side-by-side | **Primary testing method** for real-time sync |
| Unit tests | **Vitest** | Core logic only: object CRUD helpers, AI tool schema validation |
| Integration | **Firebase Emulator Suite** | Test security rules, Cloud Functions locally |
| E2E | **Skip for MVP** | Add Playwright later if time permits |
| Coverage target | ~20% for MVP | Focus on sync correctness, not UI coverage |

**What to test first (highest risk)**:
1. Two users editing simultaneously — both see each other's changes
2. One user refreshes mid-edit — state persists
3. Rapid creation/movement of sticky notes — sync performance under load
4. Network throttle — graceful degradation and reconnect
5. 5+ concurrent users — no performance degradation
6. AI commands from multiple users simultaneously — no conflicts

**Testing with Firebase Emulator**: Run `firebase emulators:start` for local Firestore + RTDB + Auth. Test security rules without hitting production.

### 16. Recommended Tooling & DX

| Tool | Purpose |
|------|---------|
| **VS Code** | Primary editor |
| **Claude Code** (CLI) | AI-first development — code generation, debugging, refactoring |
| **Cursor** | AI-assisted editing (satisfies "2+ AI tools" requirement) |
| **Firebase Emulator Suite** | Local development — Firestore, RTDB, Auth, Functions |
| **ESLint + Prettier** (VS Code extensions) | Auto-format on save |
| **Firebase Explorer** (VS Code extension) | Browse Firestore data |
| **React Developer Tools** (browser) | Component debugging |
| **Network throttling** (Chrome DevTools) | Test sync under poor network conditions |
| **Multiple browser profiles** | Test multi-user collaboration locally |

---

## Architecture Summary

```
┌─────────────────────────────────────────────┐
│              FRONTEND                        │
│  Next.js + React + Konva.js (react-konva)   │
│  Deployed on Firebase App Hosting           │
├─────────────────────────────────────────────┤
│           REAL-TIME SYNC LAYER              │
│  Firestore onSnapshot (objects)             │
│  Realtime Database (cursors + presence)     │
├─────────────────────────────────────────────┤
│            AI AGENT LAYER                    │
│  Cloud Function → Claude/GPT-4 function     │
│  calling → writes to Firestore              │
├─────────────────────────────────────────────┤
│            DATA & AUTH LAYER                 │
│  Firebase Auth (email + Google)             │
│  Firestore (boards, objects, AI history)    │
│  Realtime DB (presence, cursors)            │
└─────────────────────────────────────────────┘

Estimated monthly cost: $0-55
```

---

## AI Cost Analysis (Projections)

**Assumptions**:
- Average 3 AI commands per user per session
- Average 4 sessions per user per month
- ~800 input tokens + ~400 output tokens per command (includes `getBoardState()` context)
- Using Claude Sonnet 4.5: $3/1M input, $15/1M output

| Scale | Users | AI Commands/mo | Input Tokens | Output Tokens | AI API Cost | Firebase Cost | **Total/mo** |
|-------|-------|---------------|-------------|--------------|------------|--------------|-------------|
| Small | 100 | 1,200 | 960K | 480K | ~$10 | $0-5 | **~$10-15** |
| Medium | 1,000 | 12,000 | 9.6M | 4.8M | ~$100 | $5-25 | **~$105-125** |
| Large | 10,000 | 120,000 | 96M | 48M | ~$1,000 | $50-200 | **~$1,050-1,200** |
| Very Large | 100,000 | 1,200,000 | 960M | 480M | ~$10,000 | $500-2,000 | **~$10,500-12,000** |

**Cost optimization levers**: Use GPT-4o-mini for simple commands (90% cheaper), cache `getBoardState()` responses, batch Firestore reads.

---

## Performance Targets (from spec)

| Metric | Target | How We'll Hit It |
|--------|--------|-----------------|
| Frame rate | 60 FPS | Konva's efficient scene graph + requestAnimationFrame. Batch renders |
| Object sync latency | <100ms | Firestore `onSnapshot` typically delivers in 20-80ms |
| Cursor sync latency | <50ms | Realtime Database is optimized for this — typically 10-30ms |
| Object capacity | 500+ objects | Each object is a separate Firestore doc. Konva handles 1000+ nodes. Virtualize off-screen objects if needed |
| Concurrent users | 5+ | Firestore scales automatically. RTDB handles presence for hundreds |
| AI response latency | <2 seconds | Claude Sonnet function calling typically responds in 1-2s |

---

## Key Tradeoffs & Decisions Defended

1. **Firebase over Supabase/custom server**: Firebase provides auth + database + hosting + real-time sync + cloud functions in one ecosystem. Zero server management. Fastest path to deployed MVP in 24 hours.

2. **Firestore listeners over WebSockets (Socket.IO/Yjs)**: Eliminates an entire server to build and deploy. Firestore `onSnapshot` handles real-time sync natively. Trade-off: less control over sync granularity, 1 write/sec per document limit. Mitigation: each board object is its own document, so the limit is per-object, not per-board.

3. **Konva.js over Fabric.js**: Better memory management for long-running sessions. Scene graph architecture maps naturally to collaborative objects (each Konva node = one board object). Trade-off: no SVG export. Acceptable — not needed for this project.

4. **Last-write-wins over CRDTs**: CRDTs (Yjs/Automerge) add complexity and require a sync server. For a whiteboard where objects are independent documents, last-write-wins at the object level is sufficient. Two users rarely edit the exact same sticky note text simultaneously. Spec explicitly allows this approach.

5. **Dual database (Firestore + RTDB)**: Firestore for structured board data (complex queries, persistence). RTDB for ephemeral high-frequency data (cursors at 30Hz, presence with `onDisconnect`). This is Firebase's officially recommended pattern.

6. **Cloud Functions for AI (not client-side)**: AI API keys must never touch the client. Cloud Functions keep the key server-side, handle rate limiting, and write results directly to Firestore so all clients see changes via existing listeners.

---

## Sources & Research

**Firebase & Real-Time Collaboration**:
- [Firebase App Hosting GA](https://firebase.blog/posts/2025/04/apphosting-general-availability/)
- [Firebase Hosting - Next.js Integration](https://firebase.google.com/docs/hosting/frameworks/nextjs)
- [Firebase Database Comparison - Firestore vs Realtime](https://firebase.google.com/docs/firestore/rtdb-vs-firestore)
- [Cloud Run WebSocket Support](https://docs.cloud.google.com/run/docs/triggering/websockets)
- [y-fire (Yjs + Firebase)](https://github.com/podraven/y-fire)

**Canvas Libraries**:
- [Konva.js vs Fabric.js Comparison](https://medium.com/@www.blog4j.com/konva-js-vs-fabric-js-in-depth-technical-comparison-and-use-case-analysis-9c247968dd0f)
- [Fabric.js vs Konva | StackShare](https://stackshare.io/stackups/fabricjs-vs-konva)

**Real-Time Collaboration Architecture**:
- [Building Excalidraw's P2P Collaboration](https://plus.excalidraw.com/blog/building-excalidraw-p2p-collaboration-feature)
- [tldraw Multiplayer Collaboration](https://tldraw.dev/features/composable-primitives/multiplayer-collaboration)
- [Best CRDT Libraries 2025 | Velt](https://velt.dev/blog/best-crdt-libraries-real-time-data-sync)

**Hosting & Infrastructure**:
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Cloudflare Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Railway vs Fly.io vs Render](https://medium.com/ai-disruption/railway-vs-fly-io-vs-render-which-cloud-gives-you-the-best-roi-2e3305399e5b)

**Authentication**:
- [Clerk vs Supabase Auth vs NextAuth.js](https://medium.com/better-dev-nextjs-react/clerk-vs-supabase-auth-vs-nextauth-js-the-production-reality-nobody-tells-you-a4b8f0993e1b)
- [Firebase Authentication Pricing](https://www.metacto.com/blogs/the-complete-guide-to-firebase-auth-costs-setup-integration-and-maintenance)
