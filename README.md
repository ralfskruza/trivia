# Trivia (Erudīcijas Spēle)

Minimalist, real-time event trivia web application designed for live projection, tablet GM control, and phone/tablet participant buzzers. Built with React + TypeScript + Vite and zero-backend peer-to-peer WebRTC synchronization via PeerJS, deployable to GitHub Pages.

---

## 🎯 Architecture & Roles

- **GM Control Panel** (`#/gm/:boardId`):
  - Tablet-tailored touch interface for the quizmaster/host.
  - Acts as the authoritative WebRTC host peer (`trivia-lv-board-<BOARDID>`).
  - Launches questions directly from the grid with a single tap.
  - Large touch buttons: `🔔 ATVĒRT POGAS` (Open buzzers), `✓ PAREIZI (+PTS)`, `✗ NEPAREIZI (−PTS)`, `🔄 ATIESTATĪT POGU` (Reset buzzer), `💡 ATKLĀT ATBILDI` (Reveal answer), and `✕ Atgriezties pie režģa` (Return to grid).
  - Grid Editing Mode (`Rediģēt Režģi`): Edit categories, questions, answers, notes, point values, attach/upload images, and upload custom corner logos with live height scaling.
  - Slide-out `Dalībnieki` (Participants) drawer with quick point adjustments (`+50`, `+100`, `−50`, `−100`, custom `±`), team management, and team claiming status.
  - State persisted locally in `localStorage` + JSON export/import. Optional local PIN lock.

- **Audience Display Screen** (`#/board/:boardId`):
  - High-visibility projector view showing categories, point cards, and optional custom logo.
  - Keeps the board clean without player rosters or score summaries during the game.
  - Full-screen animated question overlay when launched by the GM.
  - **Instantly conceals question text and images the millisecond any participant buzzes in**, displaying the buzzing team's name and a bell notification.
  - Displays correct answer when revealed by the GM.

- **Participant Mobile Buzzer** (`#/dalibnieks` or `#/player/:boardId`):
  - Fast, low-latency mobile buzzer remote for individual phones.
  - Team claiming locks the team to one device (preventing multiple buzzers from fighting unless released by the GM).
  - Haptic feedback (device vibration) and visual state indicators (Waiting, Armed/SPIED, First/JŪS BIJĀT PIRMIE, Other first, Locked out).

- **Table Hub Remote** (`#/hub/:boardId`):
  - Shared multi-team buzzer hub for tabletop tablets or shared devices where multiple teams sit at the same table.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
npm install
```

### Local Development
```bash
npm run dev
```
Open `http://localhost:5180` (or the port Vite outputs) in your browser.

### Automated Tests
```bash
npm test
```
Runs 24 automated unit tests covering game state transitions, buzzer arbitration, scoring logic, view masking, and editing operations.

### Production Build
```bash
npm run build
```
Generates a static production bundle in `dist/` configured with relative base paths (`./`) ready for GitHub Pages or any static host.

---

## 🌐 Deployment to GitHub Pages

1. Push your repository to GitHub (`main` or `master` branch).
2. Go to **Settings** > **Pages** in your GitHub repository.
3. Under **Build and deployment** > **Source**, choose **GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` will automatically build, test, and deploy the application.

---

## ⚙️ Configuration & Networking

By default, the application connects via the public PeerJS cloud signaling broker and Google STUN servers.

To use a private or self-hosted PeerJS signaling server:
1. Run your server:
   ```bash
   npx peerjs --port 9000
   ```
2. Edit `src/config.ts` to point to your custom host, port, path, or TURN credentials:
   ```typescript
   export const PEER_OPTIONS: PeerOptions = {
     host: 'your-peer-server.example.com',
     port: 443,
     path: '/',
     secure: true,
     // iceServers: [...]
   };
   ```

---

## 🌐 Languages
Supports **Latvian** (default) and **English** with an instant toggle (`LV` / `EN`) in the navigation bar and settings modal.

