# ProPresenter Web Studio Controller

A studio-grade, responsive, multi-device web controller and stage confidence monitor for **ProPresenter 7+**.

Built using vanilla modern web technologies, ProPresenter 7's dark slate design language, and an event-driven **Chunk Streaming Engine** that connects directly to ProPresenter's native OpenAPI HTTP server.

---

## Key Features

1. **Multi-Screen Live Output Monitor**:
   - Visual cards showing what is live on every extended display:
     - **Audience Displays (e.g., Sony TV)**: Live slide thumbnail preview (`quality=500`), current lyrics text snippet, active background media, and layer indicators (`Slide`, `Media`, `Props`).
     - **Stage Displays (e.g., Stage Screen, ATEM)**: Current slide vs. Next cue text, stage layout thumbnail, active stage messages, and countdown timers.
   - Master power toggle switches for Audience and Stage screens.

2. **Real-Time Chunk Streaming Engine**:
   - Uses `POST /v1/status/updates` to aggregate all live ProPresenter event feeds into a single persistent connection.
   - Zero-polling default: slide changes, timer ticks, layer updates, and stage messages are pushed instantaneously with sub-millisecond latency.
   - Solves browser 6-connection pool exhaustion.

3. **Active Presentation Cue Grid**:
   - Groups slides by song section (Verse, Chorus, Bridge, Tag) with dynamic RGB color tags.
   - High-resolution slide thumbnails with loading spinners and error fallbacks.
   - Active cue indicator with glowing ProPresenter orange ring and smooth auto-scroll into view.
   - Next / Previous slide buttons and timeline scrubbers.

4. **Dedicated Stage Confidence Monitor (`pages/stageMonitor.html`)**:
   - Full-screen high-contrast display for singers, pastors, and musicians.
   - Dynamic font size adjustment (`+` and `-`).
   - Flashing live stage message alert banner.
   - QR code sharing modal for musicians and singers to open the monitor on their smartphone or iPad.

5. **Tactile Quick-Clear Bar**:
   - Dedicated buttons: **Clear All**, **Slide**, **Media**, **Props**, **Messages**, **Audio**.

6. **Service Sets & Song Library Navigator**:
   - Instant search across songs and playlists.
   - One-click trigger to load any song into the active presentation grid.

7. **Media Bin & Production Clocks**:
   - Video countdown timer progress bar.
   - Sermon timers with start, stop, reset, and **+1m** increment buttons.
   - Media background loop grid with live thumbnail previews.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **Space** or **Arrow Right** or **Page Down** | Advance to Next Slide |
| **Arrow Left** or **Page Up** | Step back to Previous Slide |
| **F** (on Stage Monitor) | Toggle Full-Screen Mode |

---

## Quick Start (Node.js)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env` and configure your ProPresenter IP and port:
```bash
# In .env:
PORT=8080
PROPRESENTER_HOST=192.168.0.200
PROPRESENTER_PORT=1025
```

### 3. Start Server
* **Production**:
  ```bash
  npm start
  ```
* **Development (Auto-reload on file changes)**:
  ```bash
  npm run dev
  ```

---

## Access URLs

| Route | Destination |
| :--- | :--- |
| `http://localhost:8080/` | Initial Login & Connection Validator |
| `http://localhost:8080/controller` | Full Web Studio Controller Dashboard (Show & Bible workspace) |
| `http://localhost:8080/stage` | Fullscreen Stage Confidence Monitor |
| `http://localhost:8080/api/health` | Health Check Endpoint |
| `http://localhost:8080/api/config` | ProPresenter Host Config Endpoint |
| `http://localhost:8080/api/bible/verses` | Parallel Bible Scripture API (Cloudflare D1) |
| `http://localhost:8080/api/bible/rss` | ProPresenter RSS 2.0 Feed (`?type=verse` or `?type=reference`) |
| `http://localhost:8080/api/bible/rss/live` | Dynamic Auto-Updating Live Scripture Feed for ProPresenter |
| `http://localhost:8080/exec` | Google Apps Script Drop-in Compatibility Endpoint |

---

## Project Structure

```
├── package.json                 # Node.js manifest & dependencies (Express, CORS, dotenv)
├── server.js                    # Production Express web server & reverse proxy
├── .env                         # Local environment configuration
├── .env.example                 # Environment configuration template
├── PROJECT_SUMMARY.md           # Comprehensive handover & developer continuation manual
├── CODE_DOCUMENTATION.md        # Deep technical architecture documentation
├── README.md                    # Quick-start guide
├── pages/
│   ├── index.html               # Main Studio Controller (Show & Bible modes)
│   ├── stageMonitor.html        # Stage Confidence Monitor with QR sharing
│   └── login.html               # Connection settings & validator
├── css/
│   ├── theme.css                # ProPresenter 7 dark tokens
│   ├── layout.css               # Responsive multi-device flex/grid layout
│   ├── components.css           # Cues, clear buttons, cards, modals
│   └── song-search.css          # Multi-mode search modal styles
└── js/
    ├── config.js                # AppConfig (localStorage & query parameters)
    ├── app.js                   # Application bootstrap & coordinator
    ├── api/
    │   ├── api-client.js        # REST client (212 ProPresenter endpoints)
    │   └── stream-client.js     # Chunked Stream Multiplexer Engine
    ├── state/
    │   └── store.js             # Reactive central Pub/Sub state store
    └── controllers/
        ├── song-search-ctrl.js  # Multi-mode search controller (Fuse.js)
        ├── screen-monitor.js    # Multi-screen live output monitor
        ├── presentation-ctrl.js # Presentation slide grid & cues
        ├── stage-ctrl.js        # Stage layouts, messages & chord charts
        ├── quick-clear-ctrl.js  # Quick-clear bar, looks & macros
        ├── playlist-ctrl.js     # 2-tier 75/25 sidebar navigator
        ├── media-ctrl.js        # Background video loops
        └── timer-ctrl.js        # Video countdown & timers
```

---

## License

MIT License. Designed for church and live event production environments.
