# CollabBoard Demo Video Script (3-5 min)

## Intro (~15 sec)
- "This is CollabBoard — a real-time collaborative whiteboard with an AI assistant built on Next.js, Firebase, and Anthropic Claude"
- Show the deployed URL: collabboard-nu-gules.vercel.app

## Authentication (~20 sec)
- Show the login page (light/dark theme toggle)
- Sign up with email/password or Google OAuth
- Log in and land on the dashboard

## Dashboard (~30 sec)
- Show the board list with thumbnail previews
- Filter between All Boards / My Boards / Shared
- Search for a board by name
- Create a new board
- Show rename and delete options on hover

## Canvas Basics (~45 sec)
- Pan around the infinite canvas (Space+drag or H tool)
- Zoom in/out with scroll wheel
- Create a sticky note (N key), edit text by double-clicking, change color
- Create shapes — rectangle (R) and circle (O)
- Draw freehand (D key), show stroke width options
- Add a text element (T key)
- Draw a line (L) and a connector (C) between two objects
- Create a frame to group content
- Show move, resize, and rotate on an object
- Delete an object (Del key)
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z)

## Multi-Select & Alignment (~20 sec)
- Drag to marquee-select multiple objects
- Show the alignment toolbar (align left, center, right, distribute)
- Demonstrate snapping with smart guides

## Real-Time Collaboration (~45 sec)
- Open the same board in a second browser/incognito window with a different account
- Show both cursors moving with name labels
- Create a sticky note in one browser, watch it appear instantly in the other
- Move an object in one browser, show it syncing in real time
- Show the presence bar with both users listed
- Send a cursor chat message from one user, show it appearing at the cursor
- Refresh one browser, show state persists

## AI Assistant (~60 sec)
- Open the AI chat panel
- Type: "Create a SWOT analysis" — show 4 quadrants generated with frames and sticky notes
- Type: "Add 3 yellow sticky notes about user research" — show notes created
- Type: "Arrange these sticky notes in a grid" — show layout applied
- Type: "Create a sprint retrospective board" — show template generated
- Show that AI results appear in real-time for both users

## Collaboration Tools (~30 sec)
- **Voting:** Toggle voting mode, set 5 votes, vote on sticky notes, show vote counts
- **Comments:** Add a comment pin on the canvas, type a message, reply in thread, resolve it
- **Timer:** Start a 1-minute shared timer, show it ticking for both users
- **Reactions:** Add emoji reactions to an object

## Presentation Mode (~20 sec)
- Create 3-4 frames with content
- Click the presentation mode button
- Step through frames with arrow keys
- Show smooth zoom animation between slides
- Exit with Escape

## Export & Polish (~15 sec)
- Export the board as PNG
- Export as PDF
- Toggle dark mode
- Show the minimap navigation
- Toggle grid overlay

## Architecture Wrap-up (~20 sec)
- "Next.js 16 with React 19 and TypeScript"
- "Konva.js for HTML5 canvas rendering"
- "Firebase Firestore for persistent board data, Realtime Database for cursors and presence"
- "Anthropic Claude with function calling for the AI agent"
- "Deployed on Vercel"
