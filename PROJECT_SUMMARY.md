# ProPresenter Web Studio Controller: AI Agent Project Summary & Architectural Context

> **Document Type**: AI Chat & Agent Context Guide  
> **Target Audience**: AI Agents (Antigravity, Cursor, Claude, ChatGPT, Windsurf, Copilot) & Software Engineers  
> **System Name**: ProPresenter Web Studio Controller & Scripture Live Engine  
> **Maintainer**: PTGSF Tech  
> **License**: MIT  
> **Target Software**: Renewed Vision ProPresenter 7+ (v7.12+ OpenAPI on port `1025`)  
> **Backend Server**: Node.js v20+ / Express.js on port `8080`  

---

## 1. Executive Summary & Purpose

The **ProPresenter Web Studio Controller** is a broadcast-grade remote command center, bilingual scripture engine, and musician stage confidence monitor engineered specifically for **Renewed Vision ProPresenter 7+**.

### Dual Core Responsibilities:
1. **Remote Broadcast Command Center**:
   - Control slide transport, song presentations, playlists, media bins, stage displays, timers, audio tracks, props, and macros from any device (Desktop, iPad/Tablet, Mobile).
   - Real-time bi-directional synchronization with ProPresenter desktop software via chunked streaming (`POST /v1/status/updates`) and REST endpoints.
   - Live multi-screen preview feeds (Audience output and Musician stage displays).
2. **Dynamic Scripture Live Engine**:
   - Queries Cloudflare D1 serverless SQLite for multi-version parallel Bible verses (Tamil `TAM`, English `KJV`, etc.).
   - Provides dynamic RSS 2.0 streaming feeds (`/api/bible/rss/:version`) and 0ms local file links (`C:\ProPresenter Files\Bible_Verse.txt`) that ProPresenter text layers link to directly.
   - Includes strict content validation to prevent song lyrics or presentation text from ever contaminating Bible feeds.

---

## 2. High-Level Architecture & Network Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER (WEB BROWSERS)                         │
│   Desktop / iPad / Android Tablets / Stage Pulip Monitors / Mobile Phones    │
│   ├── Show Mode: Song Cues, Transport, Sets, Bilingual Search, Quick-Clears │
│   ├── Bible Mode: 1-to-3 Version Comparison Grid, Smart Search, Tray History │
│   ├── Screen Monitor: Audience (Sony TV) & Stage Output Real-Time Previews  │
│   └── Stage Monitor: Fullscreen High-Contrast Confidence Display with Chords│
└───────────────────────▲─────────────────────────────▲───────────────────────┘
                        │ HTTP (Port 8080)            │ REST / RSS / Local Files
                        ▼                             ▼
┌───────────────────────────────────────┐   ┌─────────────────────────────────┐
│     NODE.JS / EXPRESS.JS SERVER       │   │      CLOUDFLARE D1 (SQLITE)     │
│             (Port 8080)               │   │      Multi-Version Database     │
│  ├── Reverse Proxy to ProPresenter    │   │  ├── bible_version (TAM, KJV...)│
│  ├── Unified Config Loader            │◄──┼──┤ bible_book (66 Books)        │
│  ├── Cloudflare D1 Bible Engine       │   │  └── bible_verse (Parallel text)│
│  ├── Dynamic RSS 2.0 Feed Generator   │   └─────────────────────────────────┘
│  ├── Strict Non-Bible Content Blocker │
│  └── 0ms Local Text File Writer       │
└───────────────────▲───────────────────┘
                    │ REST API (:1025) / Slide Trigger / Chunked Push Stream
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 RENEWED VISION PROPRESENTER 7+ DESKTOP                      │
│                           (192.168.0.200:1025)                              │
│  ├── Library: Songs, Liturgy, Media, Playlists, Sets                        │
│  ├── Library: "Resource" -> Presentation: "Bible"                           │
│  │     └── Slide 1: Linked to dynamic RSS / Local Text File feeds           │
│  └── Visual Layer Engine: Audience Output (Sony TV) & Stage Outputs (ATEM)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Configuration Management (`config.json`)

To resolve GitHub push protection and secret scanning rejections caused by committing `.env` files or raw Cloudflare API tokens, configuration is managed through standard JSON configuration files loaded by `src/config.js`.

### 3.1 Loading Priority Hierarchy:
1. `config.local.json` (Local machine overrides containing private church credentials, ignored by git)
2. `config.json` (Main project configuration tracked by git, contains safe placeholders)
3. `process.env` (Operating system environment variables)
4. Built-in defaults

### 3.2 Configuration Parameters:

| Key | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Local Express web server and RSS feed port |
| `PROPRESENTER_HOST` | `192.168.0.200` | IP address of desktop running ProPresenter 7 |
| `PROPRESENTER_PORT` | `1025` | ProPresenter OpenAPI port (Preferences -> Network) |
| `CLOUDFLARE_QUERY_URL`| *(Cloudflare URL)* | Endpoint for Cloudflare D1 SQL query API |
| `CLOUDFLARE_API_TOKEN`| *(Cloudflare Token)* | Cloudflare API Bearer token for D1 database access |

### 3.3 Safe Version Control Strategy:
- `config.json`: Tracked in git with placeholder token (`"your_cloudflare_api_token_here"`).
- `config.local.json`: Local production credentials file, automatically excluded via `.gitignore`.
- `.gitignore`: Retains ignore rules for `.env` and `config.local.json`.

### 3.4 Client-Side Configuration Resolution (`js/config.js`):
- Priority 1: URL Query Parameters (`?ip=192.168.0.200&port=1025`)
- Priority 2: HTML5 `localStorage` (`proPresenterIP`, `proPresenterPort`)
- Priority 3: Static Defaults (`192.168.0.200:1025`)

---

## 4. Complete Repository File Structure & Module Index

```
Propresenter-Control/
├── config.json                  # Main JSON configuration (safe placeholders, tracked in git)
├── config.local.json            # Local private credentials override (Git ignored)
├── server.js                    # Express.js server, RSS feeds, reverse proxy, network discovery
├── allow-firewall-8080.bat      # 1-Click batch script to open Windows Firewall for port 8080
├── package.json                 # Project manifest, dependencies, and npm scripts
├── README.md                    # Primary human documentation and volunteer setup guide
├── PROJECT_SUMMARY.md           # Machine & AI agent context document (this file)
├── LICENSE                      # MIT Open-Source License
├── index.html                   # Root entry router (redirects to /pages/login.html or /pages/index.html)
│
├── src/
│   ├── config.js                # Centralized configuration loader (Properties / JSON / env)
│   ├── background-image.png     # Application presentation asset
│   ├── Propresenter.jpg         # Application logo asset
│   └── services/
│       └── bible-service.js     # Cloudflare D1 SQL engine, alias resolver & RSS 2.0 generator
│
├── pages/
│   ├── index.html               # Main Web Studio Controller workspace (Show & Bible deck)
│   ├── login.html               # Connection settings, ProPresenter /version test & session validator
│   └── stageMonitor.html        # High-contrast fullscreen Musician Stage Confidence Monitor
│
├── css/
│   ├── theme.css                # ProPresenter 7 Dark Slate design tokens and CSS custom properties
│   ├── layout.css               # Fixed-height desktop, tablet & mobile responsive grid systems
│   ├── components.css           # Slide cue cards, buttons, modals, badges, history tray
│   ├── bible.css                # Scripture 1-3 version parallel grid, badges, search bar
│   ├── song-search.css          # Bilingual fuzzy search modal, avatar carousel, priority chips
│   └── login.css                # Connection settings page styling
│
└── js/
    ├── app.js                   # Application coordinator, session guard, mode router, shortcuts
    ├── config.js                # Browser AppConfig (LocalStorage & query parameters)
    ├── login.js                 # Login connection tester & session guard
    │
    ├── api/
    │   ├── api-client.js        # REST client implementing 22 ProPresenter OpenAPI categories
    │   └── stream-client.js     # Persistent chunked stream engine on POST /v1/status/updates
    │
    ├── state/
    │   └── store.js             # Reactive central Pub/Sub StateStore
    │
    └── controllers/
        ├── playlist-ctrl.js     # 2-Tier 75/25 sidebar (Libraries with 5s polling + Playlists/Sets)
        ├── presentation-ctrl.js # Active presentation slide cues grid, thumbnails & transport
        ├── bible-ctrl.js        # Bible comparison engine, dual-path live push, auto-trigger lifecycle
        ├── song-search-ctrl.js  # In-memory bilingual fuzzy search modal with Fuse.js fallback
        ├── screen-monitor.js    # Multi-screen live output monitor (Audience Sony TV & Stage ATEM)
        ├── stage-ctrl.js        # Stage layouts, musician alert messages & chord charts
        ├── quick-clear-ctrl.js  # Layer clears (All, Slide, Media, Props, Audio), Looks, Macros
        ├── media-ctrl.js        # Background video loop bin
        ├── timer-ctrl.js        # Production countdown clocks & video timers
        └── right-tabs-ctrl.js   # 6-tab right utility drawer coordinator
```

---

## 5. Core Data Flows & Execution Lifecycles

### 5.1 Presentation Transport Workflow (Show Mode)
```
User clicks cue / presses Space
       │
       ▼
presentation-ctrl.js -> ApiClient.triggerSlide(uuid, index)
       │
       ▼
HTTP GET /v1/presentation/{uuid}/{index}/trigger -> ProPresenter 7
       │
       ▼
ProPresenter triggers slide -> Emits push event on POST /v1/status/updates
       │
       ▼
stream-client.js parses chunk -> store.setState({ activeSlideIndex: index })
       │
       ▼
store emits "presentation:slide_index" -> presentation-ctrl.js updates UI glow & auto-scrolls
```

### 5.2 Scripture Presentation Workflow (Bible Mode)
```
Operator clicks verse row in UI
       │
       ├──────────────────────────────────────────────┐
       ▼                                              ▼
POST /api/bible/live (Express Server)       ApiClient.triggerSlide(bibleUuid, 0)
       │                                              │
       ├─────────────────────────┐                    ▼
       ▼                         ▼          ProPresenter triggers Slide 1
Updates in-memory verse   Writes local files:         │
       │                  - C:\ProPresenter Files\    │
       ▼                    Bible_Verse.txt           │ (Wait 75ms)
Serves updated dynamic    - C:\ProPresenter Files\    ▼
RSS 2.0 Feeds               Bible_Reference.txt     Micro-pulse re-trigger
/api/bible/rss/TAM?type=verse                       /v1/presentation/active/trigger
       │                                              │
       └───────────────────────┬──────────────────────┘
                               ▼
        ProPresenter Slide 1 repaints text layers immediately!
```

### 5.3 Bible Polling Lifecycle
- **Entering Bible Mode (`bibleCtrl.onEnterBibleView`)**:
  1. Switches UI container from `#presentationWorkspace` to `#bibleWorkspace`.
  2. Discovers the Bible presentation UUID in the "Resource" library.
  3. Fires Slide 1 (index 0) of the Bible presentation.
  4. Starts an active 1-second interval (`1000ms`) polling `/v1/presentation/slide_index` to monitor if an operator manually changed slides.
- **Leaving Bible Mode (`bibleCtrl.onLeaveBibleView`)**:
  1. Immediately clears the 1-second polling interval.
  2. Restores normal song presentation transport listeners.

### 5.4 Strict Content Barrier (Non-Bible Blocker)
- In `server.js` and `bible-service.js`, `POST /api/bible/live` strictly verifies that submitted text matches one of the 66 canonical Bible books (`hasBibleBook && hasVerseText && hasValidNumbers`).
- Any song lyric, sermon slide, or custom presentation text sent to this endpoint is rejected with **HTTP 400 Bad Request**.
- Clearing the Bible display outputs blank XML tags (`<title></title>`) to cleanly clear ProPresenter screens without leaving residual text.

---

## 6. ProPresenter 7 Native OpenAPI Integration

ProPresenter 7 exposes an HTTP OpenAPI server running on port `1025` by default.

### Key API Invariants:
1. **0-Indexed Slides**: Slide 1 is index `0`, Slide 2 is index `1`, etc.
2. **Case-Insensitive Library & Document Discovery**: ProPresenter library names (`Resource`) and document names (`Bible`) must be matched case-insensitively using `.toLowerCase()`.
3. **Single Multiplexed Stream**: Browsers limit HTTP connections per origin to 6. ProPresenter's multiple streaming endpoints (`/status/updates`, `/status/slide`, `/status/screens`) can exhaust sockets. `stream-client.js` maintains a **single** multiplexed persistent connection on `POST /v1/status/updates`.
4. **Micro-Pulse Repaint**: After triggering a slide whose text is linked to RSS or local files, ProPresenter occasionally takes seconds to repaint. Sending a lightweight trigger pulse to `/v1/presentation/active/trigger` after `75ms` forces an immediate GPU layer repaint.

### OpenAPI Category Reference:

| Category | Key Endpoints | Client Implementation |
| :--- | :--- | :--- |
| **System** | `GET /version` | `ApiClient.getVersion()` |
| **Streaming** | `POST /v1/status/updates` | `StreamClient.connect()` |
| **Screens** | `GET /v1/status/screens`, `GET /v1/status/audience_screens` | `ApiClient.getScreens()`, `ApiClient.setAudienceScreenStatus()` |
| **Layers** | `GET /v1/status/layers`, `GET /v1/clear/layer/{layer}` | `ApiClient.getLayers()`, `ApiClient.clearLayer()` |
| **Presentations** | `GET /v1/presentation/active`, `GET /v1/presentation/{uuid}` | `ApiClient.getActivePresentation()`, `ApiClient.getPresentation()` |
| **Triggering** | `GET /v1/presentation/{uuid}/{index}/trigger` | `ApiClient.triggerSlide(uuid, index)` |
| **Thumbnails** | `GET /v1/presentation/{uuid}/thumbnail/{index}?quality=360` | `ApiClient.getSlideThumbnailUrl()` |
| **Libraries** | `GET /v1/libraries`, `GET /v1/library/{id}` | `ApiClient.getLibraries()`, `ApiClient.getLibrary()` |
| **Playlists** | `GET /v1/playlists`, `GET /v1/playlist/{id}` | `ApiClient.getPlaylists()`, `ApiClient.getPlaylist()` |
| **Stage** | `GET /v1/stage/layouts`, `PUT /v1/stage/layout/{id}`, `/v1/stage/message` | `ApiClient.getStageLayouts()`, `ApiClient.setStageMessage()` |
| **Timers** | `GET /v1/timers`, `GET /v1/timer/{id}/start`, `/stop`, `/reset` | `ApiClient.getTimers()`, `ApiClient.startTimer()` |
| **Audio** | `GET /v1/audio/playlists`, `GET /v1/audio/{uuid}/trigger` | `ApiClient.getAudioPlaylists()`, `ApiClient.triggerAudioItem()` |
| **Looks** | `GET /v1/looks`, `GET /v1/look/{id}/trigger` | `ApiClient.getLooks()`, `ApiClient.triggerLook()` |
| **Macros** | `GET /v1/macros`, `GET /v1/macro/{id}/trigger` | `ApiClient.getMacros()`, `ApiClient.triggerMacro()` |

---

## 7. Backend REST API & Dynamic RSS 2.0 Feeds

### 7.1 Server Endpoints (Port 8080)

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Redirects to `/pages/login.html` |
| `GET` | `/controller` | Serves main workspace (`/pages/index.html?bypass=true`) |
| `GET` | `/stage` | Fullscreen Musician Stage Confidence Monitor (`/pages/stageMonitor.html`) |
| `GET` | `/api/health` | Health status and uptime |
| `GET` | `/api/config` | Returns target ProPresenter host IP, port, and baseURL |
| `GET` | `/api/bible/versions` | Returns available translations from Cloudflare D1 (`TAM`, `KJV`...) |
| `GET` | `/api/bible/books?version=TAM` | Lists 66 canonical books with bilingual aliases |
| `GET` | `/api/bible/verses` | Fetches parallel verses (`?versions=TAM,KJV&book=JHN&chapter=3`) |
| `GET` | `/api/bible/search?q=...` | Smart reference or full-text keyword search across Cloudflare D1 |
| `POST`| `/api/bible/live` | Sets current live scripture for RSS & local files (Blocks non-Bible content) |
| `GET` | `/api/bible/live` | Retrieves currently active presented verse |
| `GET` | `/api/bible/rss-info` | Metadata helper providing LAN IP addresses for 1-click ProPresenter RSS setup |
| `ALL` | `/api/proxy/*` | CORS reverse proxy routing `/api/proxy/*` directly to ProPresenter on port 1025 |

### 7.2 Dynamic RSS 2.0 Feeds

| Feed URL | Description | Title Element | Description Element |
| :--- | :--- | :--- | :--- |
| `/api/bible/rss/:version` | Full Verse Feed | Reference (e.g. `யோவான் 3:16`) | Scripture text |
| `/api/bible/rss/:version?type=verse` | Verse Text Only Feed | Scripture text only | Blank |
| `/api/bible/rss/:version?type=reference` | Reference Citation Feed | Reference citation only | Blank |
| `/exec` | Google Apps Script Drop-in | Compatible with existing Google Sheets / GAS feeds | Dynamic |

---

## 8. AI Agent Invariants & Maintenance Rules

When editing, refactoring, or extending this repository, AI agents MUST respect the following invariants:

1. **Do NOT Break Slide 0-Indexing**:
   - Always remember ProPresenter OpenAPI slide indices start at `0`. Never convert to 1-based indexing when making API calls.
2. **Never Mix Songs and Bible Content**:
   - The RSS feed and `C:\ProPresenter Files\Bible_Verse.txt` MUST remain pure Scripture. Do not allow song lyrics to be routed to `/api/bible/live`.
3. **Preserve Configuration Fallbacks**:
   - In `src/config.js`, preserve loading priority: `config.json` -> `config.properties` -> `.env` -> `process.env`.
   - Never commit private Cloudflare tokens or plain passwords to public repositories.
4. **Maintain Reactive Central State**:
   - UI components must communicate through `store.subscribe('event', handler)` and `store.setState({ key: val })` rather than tightly-coupled cross-controller method invocations.
5. **Honor Viewport Geometry**:
   - The UI middle workspace uses fixed screen heights (`calc(100vh - 175px)`). Do not introduce outer body scrollbars; scrollable overflow belongs exclusively inside internal cue containers (`#presentationSlideCues`, `#bibleVersesContainer`).
6. **Bypass Flag for Direct Testing**:
   - The session guard redirects to `login.html` if `localStorage.getItem('proPresenterConnected') !== 'true'`. Appending `?bypass=true` to URLs bypasses the check for testing and direct browser bookmarks.

---

## 9. Developer Runbook & Common Commands

```powershell
# Install Node dependencies
npm install

# Start production server (Port 8080)
npm start

# Start development server with auto-reload
npm run dev

# Open Windows Firewall for mobile and iPad access (Run as Administrator)
.\allow-firewall-8080.bat

# If Port 8080 is blocked by an orphaned Node process:
Get-Process node | Stop-Process -Force
```

