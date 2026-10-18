# ProPresenter Web Studio Controller: Comprehensive Project Summary & Handover Document

> **Document Version**: 2.0.0  
> **Target Environment**: ProPresenter 7+ OpenAPI (`http://192.168.0.200:1025`)  
> **Local Server Entry**: `http://localhost:8080/`  
> **Created Date**: October 2026  
> **Status**: Active & Complete  

---

## 1. Executive Summary & Purpose

The **ProPresenter Web Studio Controller** is a high-performance, responsive web application engineered to operate as a remote broadcast command center for **Renewed Vision ProPresenter 7+**. It interfaces directly with ProPresenter's native OpenAPI HTTP REST and chunked streaming endpoints.

The application allows operators, directors, and technical teams to:
1. Control slide presentations, media layers, stage layouts, timers, audio, props, and macros from any device (Desktop, iPad/Tablet, Smartphone).
2. Monitor real-time screen outputs (Audience Sony TV, Stage Screen, ATEM switcher).
3. Synchronize bi-directionally with the desktop software in real time: actions taken on the web trigger in software, and manual actions taken in the ProPresenter software automatically update and focus on the web interface.

---

## 2. Technology Stack & Design Architecture

### 2.1 Core Technologies
* **Backend Core**: Node.js (v20+), Express.js server, CORS middleware, dotenv configuration.
* **Frontend Core**: Vanilla HTML5, Vanilla JavaScript (ES6+ Classes, async/await, Fetch API, ReadableStream).
* **Styling & Theming**: Custom Vanilla CSS design system coupled with **Bootstrap 5.3.3** for layout utilities.
* **ProPresenter 7 Dark Slate Aesthetic**:
  - Background Canvas: `#0c0d10` (Studio Black)
  - Surface Background: `#14161c` / `#1c1f26`
  - Signature Amber Accent: `#ff9f0a` (Active slides, focus badges, primary buttons)
  - Audience Cyan: `#38bdf8` (Audience displays, playlist badges)
  - Stage Purple: `#c084fc` (Stage displays, confidence monitors, chord charts)
  - Success Green: `#10b981` (Connected status, screen active, live stream)
  - Danger Red: `#ef4444` (Clear all, screen off, disconnect)

### 2.2 Architectural Layers
```
┌────────────────────────────────────────────────────────┐
│               USER INTERFACE LAYER                     │
│  Login Page  │  Master Header  │  3-Tier Left Sidebar   │
│  Show View   │   Bible View    │  Right 6-Tab Drawer   │
│  Tactical Row│  Stage Monitor  │  Mobile QR Modals     │
└───────────────────────────▲────────────────────────────┘
                            │ Pub/Sub Events
┌───────────────────────────┴────────────────────────────┐
│              CONTROLLER ORCHESTRATION                  │
│  PlaylistController    │ PresentationController        │
│  ScreenMonitorCtrl     │ RightTabsController           │
│  StageController       │ QuickClearController          │
└───────────────────────────▲────────────────────────────┘
                            │ Mutations & State Ingestion
┌───────────────────────────┴────────────────────────────┐
│              REACTIVE CENTRAL STATE STORE              │
│       StateStore (js/state/store.js - Pub/Sub)         │
└───────────────────────────▲────────────────────────────┘
              ▲                             ▲
   REST Data  │                  Push Chunks│
┌─────────────┴───────────┐   ┌─────────────┴────────────┐
│       ApiClient         │   │       StreamClient       │
│   (22 API Domains /     │   │   (Chunk Stream Engine   │
│    212 Endpoints)       │   │    POST /status/updates) │
└─────────────▲───────────┘   └─────────────▲────────────┘
              │                             │
              └──────────────┬──────────────┘
                             │ HTTP Port 1025
              ┌──────────────┴──────────────┐
              │    ProPresenter 7 Host      │
              │   (192.168.0.200:1025)      │
              └─────────────────────────────┘
```

---

## 3. Configuration & Network Setup

### 3.1 Configuration Resolution (`js/config.js`)
Configuration is managed through `AppConfig`:
- **Default IP**: `"192.168.0.200"`
- **Default Port**: `"1025"`
- **Base URL**: Computed dynamically as `http://<IP>:<PORT>`.
- **Resolution Priority**:
  1. URL Query Parameters (e.g. `?ip=192.168.0.200&port=1025`)
  2. Browser `localStorage` (`proPresenterHostIp`, `proPresenterHostPort`)
  3. Static Defaults (`192.168.0.200:1025`)

### 3.2 Authentication & Login-First Workflow
1. **Entry Point Redirect**: Accessing the root URL (`http://localhost:8080/`) or opening `index.html` immediately redirects to `pages/login.html`.
2. **Login Page (`pages/login.html`)**:
   - Host IP & Port input fields with a live **"Test Connection"** feature that checks `GET /version`.
   - Future authentication fields (**Username** and **Password**) stored in `localStorage` for upcoming credentialed releases.
   - Upon successful verification, stores `localStorage.setItem('proPresenterConnected', 'true')` and navigates to `pages/index.html`.
3. **Session Guard (`js/app.js`)**:
   - Every page load verifies `localStorage.getItem('proPresenterConnected') === 'true'`.
   - If missing or false, automatically bounces to `login.html` (can be bypassed for testing with `?bypass=true`).
4. **Disconnect Action**:
   - Dedicated red power button in the master header prompts confirmation, cleanly aborts streams and background polling intervals, clears session flags, and returns to `login.html`.

---

## 4. ProPresenter OpenAPI Endpoints Implemented

Below is the complete reference of all native ProPresenter 7 APIs integrated into this controller:

| API Endpoint | HTTP Method | Implementation Location | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| `/version` | `GET` | `ApiClient.getVersion()` | Retrieves host software version, OS version, and server name. |
| `/v1/status/updates` | `POST` | `StreamClient.connect()` | Multiplexed chunked JSON push stream subscribing to real-time status events. |
| `/v1/status/screens` | `GET` | `ApiClient.getScreens()` | Retrieves screen topology (Sony TV, Stage Screen, ATEM) and dimensions. |
| `/v1/status/audience_screens` | `GET` | `ApiClient.getAudienceScreenStatus()` | Reads master power state of Audience displays (`true`/`false`). |
| `/v1/status/audience_screens` | `POST`/`PUT` | `ApiClient.setAudienceScreenStatus()` | Toggles Audience screens ON/OFF using boolean payload (`true`/`false`). |
| `/v1/status/stage_screens` | `GET` | `ApiClient.getStageScreenStatus()` | Reads master power state of Stage displays (`true`/`false`). |
| `/v1/status/stage_screens` | `POST`/`PUT` | `ApiClient.setStageScreenStatus()` | Toggles Stage screens ON/OFF using boolean payload (`true`/`false`). |
| `/v1/status/layers` | `GET` | `ApiClient.getLayers()` | Requests active status of visual projection layers (`slide`, `media`, `props`, `messages`, `audio`). |
| `/v1/status/slide` | `GET` | `StreamClient` Subscription | Live stream frame of current vs next slide text and notes. |
| `/v1/presentation/active` | `GET` | `ApiClient.getActivePresentation()` | Fetches current presentation document with group hierarchy and slide metadata. |
| `/v1/presentation/slide_index` | `GET` | `ApiClient.getSlideIndex()` | Polled every 1s and streamed; returns `{ presentation_index: { index, presentation_id } }` for live software sync. |
| `/v1/presentation/{uuid}` | `GET` | `ApiClient.getPresentation(uuid)` | Loads full slide deck for a specific presentation UUID. |
| `/v1/presentation/{uuid}/focus`| `GET` | `ApiClient.focusPresentation(uuid)` | Selects and opens a document without triggering slides. |
| `/v1/presentation/{uuid}/{index}/trigger` | `GET`/`POST` | `ApiClient.triggerSlide(uuid, index)` | Fires a specific slide cue into live output. |
| `/v1/presentation/{uuid}/thumbnail/{index}` | `GET` | `ApiClient.getSlideThumbnailUrl()` | Returns live thumbnail image URL for slide cards (dimension 360px). |
| `/v1/presentation/{uuid}/chord_chart` | `GET` | `ApiClient.getChordChartUrl()` | Returns live chord chart image for musician viewing (dimension 900px). |
| `/v1/presentation/active/timeline/play` | `GET` | `ApiClient.timelinePlay()` | Starts presentation timeline playback. |
| `/v1/presentation/active/timeline/pause` | `GET` | `ApiClient.timelinePause()` | Pauses presentation timeline playback. |
| `/v1/presentation/active/timeline/rewind` | `GET` | `ApiClient.timelineRewind()` | Rewinds presentation timeline to zero. |
| `/v1/clear/layer/{layer}` | `GET` | `ApiClient.clearLayer(layer)` | Clears specific layer: `all`, `slide`, `media`, `props`, `messages`, `audio`. |
| `/v1/libraries` | `GET` | `ApiClient.getLibraries()` | Fetches all song libraries. Polled every 5s for auto-discovery. |
| `/v1/library/{id}` | `GET` | `ApiClient.getLibrary(id)` | Fetches presentation list inside a chosen library. |
| `/v1/playlists` | `GET` | `ApiClient.getPlaylists()` | Fetches service orders and playlist folders. |
| `/v1/playlist/{id}` | `GET` | `ApiClient.getPlaylist(id)` | Fetches items and presentations inside a playlist set. |
| `/v1/looks` | `GET` | `ApiClient.getLooks()` | Fetches configured Audience Look presets. |
| `/v1/look/current` | `GET` | `ApiClient.getCurrentLook()` | Reads currently active Audience Look. |
| `/v1/look/{id}/trigger` | `GET` | `ApiClient.triggerLook(id)` | Activates an Audience Look preset. |
| `/v1/stage/layouts` | `GET` | `ApiClient.getStageLayouts()` | Retrieves all stage screen layouts. |
| `/v1/stage/layout/{id}` | `PUT` | `ApiClient.setStageLayout(id)` | Switches stage layout preset. |
| `/v1/stage/message` | `GET`/`PUT` | `ApiClient.setStageMessage(msg)` | Reads and posts stage alert messages to confidence monitors. |
| `/v1/stage/message/clear` | `GET` | `ApiClient.clearStageMessage()` | Clears current stage alert message. |
| `/v1/audio/playlists` | `GET` | `ApiClient.getAudioPlaylists()` | Fetches audio playlist collections. |
| `/v1/audio/playlist/{id}` | `GET` | `ApiClient.getAudioPlaylist(id)` | Fetches audio tracks inside a playlist. |
| `/v1/audio/{uuid}/trigger` | `GET` | `ApiClient.triggerAudioItem(uuid)`| Triggers playback of an audio track. |
| `/v1/timers` | `GET` | `ApiClient.getTimers()` | Fetches configured countdowns and production timers. |
| `/v1/timer/{id}/start` | `GET` | `ApiClient.startTimer(id)` | Starts a countdown timer. |
| `/v1/timer/{id}/stop` | `GET` | `ApiClient.stopTimer(id)` | Stops a countdown timer. |
| `/v1/timer/{id}/reset` | `GET` | `ApiClient.resetTimer(id)` | Resets a countdown timer to initial duration. |
| `/v1/timer/{id}/increment` | `PUT` | `ApiClient.incrementTimer(id, sec)` | Adjusts timer value (+60s button). |
| `/v1/props` | `GET` | `ApiClient.getProps()` | Fetches list of overlay graphic props. |
| `/v1/prop/{id}/trigger` | `GET` | `ApiClient.triggerProp(id)` | Toggles an overlay graphic prop. |
| `/v1/props/clear` | `GET` | `ApiClient.clearProps()` | Clears all overlay graphic props. |
| `/v1/macros` | `GET` | `ApiClient.getMacros()` | Fetches configured automation macros. |
| `/v1/macro/{id}/trigger` | `GET` | `ApiClient.triggerMacro(id)` | Triggers an automation macro. |

### 4.1 Detailed Request & Response Schemas for Core Workflows

#### 1. Software-to-Web Slide Live Sync (`GET /v1/presentation/slide_index`)
* **Endpoint**: `/v1/presentation/slide_index`
* **Method**: `GET`
* **Polling Rate**: Every 1,000 ms (1 second) via `PresentationController.startSlideSyncPolling()`
* **Sample Response**:
```json
{
  "presentation_index": {
    "index": 6,
    "presentation_id": {
      "uuid": "c65ce713-649d-437e-9795-632b326f28dd",
      "name": "Naanum En Veetarumovendraal",
      "index": 0
    }
  }
}
```
* **Handling Logic**:
  1. Inspects `presentation_id.uuid`. If different from `this.currentPresentationUuid`, automatically executes `GET /v1/presentation/{uuid}` to load the presentation cues.
  2. Identifies the live slide index `presentation_index.index`.
  3. Updates UI by removing `.active` from previous cards and adding `.active` + amber border + `LIVE` badge to `#slide-card-${index}`.
  4. Calls `card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` so operators immediately see the active slide.

#### 2. Audience Screen Power Control (`GET` & `POST /v1/status/audience_screens`)
* **Read Status**: `GET /v1/status/audience_screens` $\rightarrow$ returns raw boolean `true` or `false`.
* **Set Status**: `POST /v1/status/audience_screens`
* **Request Headers**: `Content-Type: application/json`
* **Request Body**: `true` or `false` (Raw JSON boolean)
* **Response**: `200 OK` or `204 No Content`
* **Toggle Sequence**:
  ```javascript
  const current = await ApiClient.getAudienceScreenStatus(); // e.g. true
  const next = !current;                                      // false
  await ApiClient.setAudienceScreenStatus(next);              // sends false
  ```

#### 3. Stage Screen Power Control (`GET` & `POST /v1/status/stage_screens`)
* **Read Status**: `GET /v1/status/stage_screens` $\rightarrow$ returns raw boolean `true` or `false`.
* **Set Status**: `POST /v1/status/stage_screens` (with `PUT` fallback)
* **Request Headers**: `Content-Type: application/json`
* **Request Body**: `true` or `false`
* **Response**: `200 OK` or `204 No Content`

#### 4. Song Selection: Focus vs Trigger
* **Focus Song (Library/Playlist click)**:
  - `GET /v1/presentation/{uuid}/focus`
  - Loads document into ProPresenter's edit/preview pane without affecting the audience screen.
* **Trigger Slide (User clicks a slide card)**:
  - `GET /v1/presentation/{uuid}/{index}/trigger`
  - Instantly cuts/transitions slide index `{index}` to the live audience output screen.

#### 5. Dynamic Library Auto-Discovery (`GET /v1/libraries`)
* **Endpoint**: `/v1/libraries`
* **Method**: `GET`
* **Polling Rate**: Every 5,000 ms (5 seconds) via `PlaylistController.startLibraryPolling()`
* **Sample Response**:
```json
[
  {
    "id": { "uuid": "7a3b...", "name": "Default Songs", "index": 0 },
    "path": "/ProPresenter/Libraries/Default Songs"
  },
  {
    "id": { "uuid": "9c1d...", "name": "Tamil Worship", "index": 1 },
    "path": "/ProPresenter/Libraries/Tamil Worship"
  }
]
```
* **Handling Logic**: Hashes or compares IDs; if new libraries exist, re-renders the list and updates `#librariesCountBadge` seamlessly.

---

## 5. Detailed Breakdown of Completed Functionality

### 5.1 Left Sidebar (2-Tier 75% / 25% Split & Auto-Refresh)
* **Width**: Fixed at **`320px`** in [css/layout.css](file:///e:/Church%20Projects/Propresenter-Control/css/layout.css).
* **Tier 1 — Libraries (75% Height)**:
  - Takes 75% of the sidebar height with internal vertical scroll (`overflow-y: auto`).
  - Displays all song databases with live counter badge (`#librariesCountBadge`).
  - **Dynamic 5-Second Polling (`startLibraryPolling`)**: [js/controllers/playlist-ctrl.js](file:///e:/Church%20Projects/Propresenter-Control/js/controllers/playlist-ctrl.js) polls `GET /v1/libraries` every 5 seconds. If a church technician adds a new library in the ProPresenter software, it automatically populates in the list without page reload.
  - Clicking any library opens the Multi-Mode Song Search Modal in "By Library" mode for instant browsing and triggering.
* **Tier 2 — Playlists (25% Height)**:
  - Takes 25% of the sidebar height with internal vertical scroll (`overflow-y: auto`).
  - Displays all service playlists with count badge (`#playlistsCountBadge`).
  - Clicking a playlist loads its active presentation set directly into the presenter cues deck.
* **Streamlined Layout**: The redundant inline search section was removed from the left sidebar, giving full priority to Library browsing (75%) and Playlist sets (25%). Global search is seamlessly accessed via the master header search button or `Ctrl+K` / `Cmd+K`.

---

### 5.2 Header Mode Switcher: "Show" vs "Bible"
* **Header Segmented Control**: Pinned in the master header (`pages/index.html`):
  - **"Show" Button**: Activates slide deck view (`#cuesSectionWrapper`).
  - **"Bible" Button**: Activates scripture feed view (`#middleRow3Bible`).
* **Strict Mutual Exclusivity**:
  - The switching function in [js/app.js](file:///e:/Church%20Projects/Propresenter-Control/js/app.js) (`setWorkspaceView()`) applies `display: flex !important;` to the selected section and `display: none !important;` + `.d-none` + `.workspace-view-hidden` to the inactive section, ensuring zero layout overlap or conflict.
* **Persistence**: Remembers active view in `localStorage.getItem('proPresenterWorkspaceView')`.

---

### 5.3 Middle Column: Tactical Bar & Dynamic Viewport Height
* **Row 1 (Tactical Operations Bar)**:
  - **Tactile Clears**: 6 tactile buttons (`Clear All`, `Slide`, `Media`, `Props`, `Msg`, `Audio`).
  - **Audience & Stage Screen Toggles**:
    - When clicked, calls `GET /v1/status/audience_screens` (or `stage_screens`), inverts boolean state (`true` $\rightarrow$ `false`, `false` $\rightarrow$ `true`), and sends updated state to `POST /v1/status/audience_screens` (or `stage_screens`).
  - **System Clock**: Real-time ticker showing current 12-hour time and service day.
* **Screen-Based Fixed Heights**:
  Both middle views are calculated from viewport height in [css/layout.css](file:///e:/Church%20Projects/Propresenter-Control/css/layout.css):
  ```css
  height: calc(100vh - 175px);
  max-height: calc(100vh - 175px);
  min-height: 380px;
  ```
  - **1080p Desktop (1920×1080)**: Fixed at **`905px`**.
  - **900p Display (1600×900)**: Fixed at **`725px`**.
  - **768p Laptop (1366×768)**: Fixed at **`593px`**.
  - The middle workspace never produces an outer page scrollbar; all scrolling is internal.

---

### 5.4 Presentation Section ("Show" Mode)
* **Slide Grid (`.slides-grid-container`)**:
  - Occupies all remaining height with internal vertical scrolling (`overflow-y: auto;`).
  - Slide cards display group color dots (Verse, Chorus, Bridge, Tag), slide labels, and thumbnails loaded asynchronously via `/v1/presentation/{uuid}/thumbnail/{index}`.
* **Untitled Presentation Guard**:
  - Automatically filters out placeholder documents ("Untitled Presentation", "Untitled", "Untitled Document") to keep the presentation area clean.
* **Bi-Directional Slide Synchronization**:
  - **Web $\rightarrow$ Software**: Clicking a slide card triggers `GET /v1/presentation/{uuid}/{index}/trigger` and highlights the slide as LIVE.
  - **Software $\rightarrow$ Web**: [js/controllers/presentation-ctrl.js](file:///e:/Church%20Projects/Propresenter-Control/js/controllers/presentation-ctrl.js) polls `GET /v1/presentation/slide_index` every **1 second**:
    1. Intercepts `{ presentation_index: { index, presentation_id } }`.
    2. If the presentation changed in software, automatically fetches and loads the new document.
    3. Finds `#slide-card-${index}` and adds `.active` (amber glow + `LIVE` pill badge).
    4. Smoothly scrolls the card into view inside the fixed container:
       ```javascript
       targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
       ```

---

### 5.5 Bible Presenter Section ("Bible" Mode)
* **Cloudflare D1 Backend Integration**:
  - Connects to Cloudflare D1 via [src/services/bible-service.js](file:///e:/Church%20Projects/Propresenter-Control/src/services/bible-service.js) using parameterized SQL queries.
  - Houses 31,102 Tamil Bible verses (`TAM`) and English (`KJV`).
* **Structured & Free Search**:
  - **Version Selectors**: Multi-version comparison supporting up to 3 simultaneous versions (`Version 1: TAM`, `Version 2: KJV`, `Version 3`).
  - **Book Dropdown**: All 66 books grouped by Old Testament and New Testament with bilingual titles.
  - **Chapter & Verse**: Numeric inputs with stepper buttons (`<` and `>`).
  - **Common / Free Search**: Automatically detects reference formats (`John 3:16`, `யோவான் 3:16`, `சங்கீதம் 23:1`) or searches across Bible text keywords with Unicode Tamil support.
* **Dynamic Parallel Comparison Table (`#bibleVersesTable`)**:
  - Auto-adjusts column layout based on selected versions:
    - 1 Version $\rightarrow$ Full width (100%)
    - 2 Versions $\rightarrow$ Split 50% / 50%
    - 3 Versions $\rightarrow$ Split 33.3% / 33.3% / 33.3%
  - Each row presents verse number pill, synchronized text across versions, and **Present Live** button.
  - Clicking any row highlights it as LIVE across all columns with studio amber glow.
* **ProPresenter RSS 2.0 Feed Engine**:
  - Generates standards-compliant XML feeds (`application/rss+xml; charset=utf-8`):
    - `GET /api/bible/rss?type=verse&version=TAM&book=GEN&chapter=1&verse=2`
    - `GET /api/bible/rss?type=reference&version=TAM&book=GEN&chapter=1&verse=2`
    - `GET /exec`: Drop-in compatibility with Google Apps Script RSS parameters.
    - `GET /api/bible/rss/live?type=verse&version=TAM`: Real-time dynamic feed that auto-updates whenever the operator clicks "Present" on any verse.
  - Dedicated **ProPresenter RSS Modal** with 1-click copy buttons for instant setup.

---

### 5.6 Right Sidebar (Screen Selector + 6 Feature Tabs)
* **Width**: Fixed at **`390px`** in [css/layout.css](file:///e:/Church%20Projects/Propresenter-Control/css/layout.css).
* **Screen Output Dropdown**:
  - Selects `Sony TV (Audience)`, `Stage Screen (Stage)`, or `ATEM (Stage)`.
  - Shows single dedicated live preview container.
* **6 Lazy-Loaded Feature Tabs** in [js/controllers/right-tabs-ctrl.js](file:///e:/Church%20Projects/Propresenter-Control/js/controllers/right-tabs-ctrl.js):
  1. **Audio**: Audio playlist browser with play triggers.
  2. **Stage**: Stage screens list, layout selector dropdown, stage message composer, chord chart modal (`/chord_chart`).
  3. **Timer**: Video countdown bar, system clock, and timer controls (+1m, start, stop, reset).
  4. **Message**: Stage alert messages.
  5. **Props**: Overlay graphic props with Clear All.
  6. **Macros**: Automation macro trigger pad.

---

### 5.7 Stage Confidence Monitor Page (`pages/stageMonitor.html`)
* Full-screen confidence monitor designed for musician iPads and pulpit TV screens.
* Subscribes to `/v1/status/slide` and `/v1/stage/message` to display current vs next slide text and alert messages in high-contrast typography.
* Built-in mobile QR code modal in master header allows musicians to scan with their phones to instantly open the monitor.

---

### 5.8 Modal-Based Multi-Mode Song Search Component
* **Global Shortcut & Header Button**:
  - Activated by clicking the header search button or pressing `Ctrl+K` / `Cmd+K` anywhere in the app.
  - Can be dismissed via `Escape`, clicking the backdrop, or clicking the close button (`×`).
* **In-Memory Indexing & Concurrency Control**:
  - Fetches `/v1/libraries` and chunks library item retrieval in controlled batches of **8** (`batchSize: 8`) via `GET /v1/library/{id}` to prevent server bottlenecks.
  - Flattens all presentations into an in-memory index with `.normalize('NFC')` for accurate multi-lingual character comparisons (Tamil, Hindi, English).
  - Splits bilingual titles on delimiters (`-`, `–`, `—`, `|`, `/`, and parentheses) into independent language `segments`.
  - Extracts and categorizes `author`/worship artist metadata, maintaining a distinct artist list with counts, initials, and gradient colors.
* **Three Search Modes**:
  1. **Mode 1: Free Search**: Simultaneous search across all libraries using strict priority sorting.
  2. **Mode 2: By Library**: Filter searches within a user-selected library from a dropdown populated via `/v1/libraries`.
  3. **Mode 3: By Author / Artist**: Interactive horizontal avatar carousel displaying artist bubbles with initials and song counts. Selecting an artist restricts the song search and card grid to that artist.
* **5-Tier Strict Priority Matching**:
  - **Priority 1 (Exact Match)**: Query strictly equals full title or any segmented title.
  - **Priority 2 (Starts With)**: Full title or any segmented title starts with query.
  - **Priority 3 (Ends With)**: Full title or any segmented title ends with query.
  - **Priority 4 (Contains)**: Query is contained anywhere within title or any segment.
  - **Priority 5 (Fuzzy Fallback via Fuse.js)**: If fewer than the requested result limit are found, runs `Fuse.js` (`threshold: 0.35`, `ignoreLocation: true`, `minMatchCharLength: 2`) excluding items already gathered in Tiers 1–4.
* **Responsive Card Grid Layout**:
  - Grid: `repeat(auto-fill, minmax(260px, 1fr))`.
  - Displays primary title, secondary bilingual subtitle, library tag, author tag, and trigger button.
* **Live Trigger on Select**:
  - Clicking any song card triggers ProPresenter using its UUID via `GET /v1/presentation/{uuid}/trigger` (with fallback to `GET /v1/presentation/{uuid}/0/trigger`).
  - Displays a live confirmation toast and closes the modal cleanly.
* **UI & State Management**:
  - Input debounced by **120ms**.
  - Active filter pill badge with remove (`×`) button when library or author filter is engaged.

---

## 6. Directory Structure & Key Files

```
Propresenter-Control/
├── package.json                 # Node.js project manifest & scripts (npm start, npm run dev)
├── server.js                    # Production Express web server & CORS reverse proxy
├── .env                         # Local network & host environment configuration
├── .env.example                 # Configuration template for deployment
├── index.html                   # Root entry point (redirects to pages/login.html)
├── PROJECT_SUMMARY.md           # This comprehensive summary and handover guide
├── CODE_DOCUMENTATION.md        # Deep-dive architecture and OpenAPI technical manual
├── README.md                    # Quick-start runbook for church operators
│
├── pages/
│   ├── index.html               # Main Web Studio Controller interface
│   ├── login.html               # Connection settings and authentication
│   └── stageMonitor.html        # High-contrast Stage Confidence Monitor
│
├── css/
│   ├── theme.css                # ProPresenter dark slate tokens & base resets
│   ├── layout.css               # 320px & 390px sidebars, screen-based fixed heights, grid
│   ├── components.css           # Cues, tactile buttons, view switchers, custom scrollbars
│   ├── song-search.css          # Multi-mode search modal, avatar tray, card grid
│   └── login.css                # Glassmorphic login styling
│
├── js/
│   ├── config.js                # AppConfig: LocalStorage and URL parameter manager
│   ├── login.js                 # Login connection test & validator
│   ├── app.js                   # Application coordinator, screen toggles, view switcher
│   │
│   ├── api/
│   │   ├── api-client.js        # ApiClient: Full REST wrapper for all 22 API domains
│   │   └── stream-client.js     # StreamClient: Multiplexed chunk stream reader
│   │
│   ├── state/
│   │   └── store.js             # StateStore: Reactive centralized Pub/Sub store
│   │
│   └── controllers/
│       ├── song-search-ctrl.js  # ProSongSearchController: Multi-mode search, Fuse.js, trigger
│       ├── screen-monitor.js    # Screen preview monitor and dropdown controller
│       ├── presentation-ctrl.js # Slide cues grid, 1s software sync, thumbnail loader
│       ├── playlist-ctrl.js     # 2-tier 75/25 sidebar navigator, 5s library auto-polling
│       ├── right-tabs-ctrl.js   # 6 interactive feature tabs controller
│       ├── stage-ctrl.js        # Stage layout & message controller
│       ├── quick-clear-ctrl.js  # Tactical clear layer controller
│       ├── media-ctrl.js        # Background loops & motion graphics controller
│       └── timer-ctrl.js        # Video countdown & production clocks controller
```

---

## 7. How to Run & Verify

### 7.1 Running via Node.js / NPM

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Production Server**:
   ```bash
   npm start
   ```

3. **Development Mode (Auto-reload on file edits)**:
   ```bash
   npm run dev
   ```

### 7.2 Access URLs
* **Web Studio Controller**: `http://localhost:8080/pages/index.html?bypass=true` (or `/controller`).
* **Standard Login Flow**: `http://localhost:8080/` (or `/login`).
* **Stage Confidence Monitor**: `http://localhost:8080/stage` (or `/pages/stageMonitor.html`).
* **Server Health Check**: `http://localhost:8080/api/health`.
* **Server Config Endpoint**: `http://localhost:8080/api/config`.
* **Bible Scripture API**:
  - Parallel Verses: `GET /api/bible/verses?versions=TAM,KJV&book=GEN&chapter=1&verse=1`
  - Flexible Search: `GET /api/bible/search?q=Gen1:1&versions=TAM,KJV`
  - Live Dynamic RSS: `GET /api/bible/rss/live?type=verse&version=TAM`
  - Live State Sync: `POST /api/bible/live`
* **ProPresenter Native Swagger Docs**: `http://192.168.0.200:1025/v1/doc/index.html`.

---

## 8. Bible Scripture & Dynamic Comparison Engine (Completed)

1. **Header & Live Display Indicator**:
   - Pinned title **"Bible Scripture"** with no Cloudflare badge.
   - Continuous glowing & pulsing live broadcast badge (`.bible-live-badge`) with synchronized blinking dot (`.live-dot`).
2. **Database-Backed Flexible Reference Search**:
   - Powered by Cloudflare D1 `book_alias` table joined with `book_details`, `bible_book`, and `bible_verse`.
   - Ultra-flexible multi-lingual format parser accepting:
     - `Gen 1 1`, `Gensis 1 1`, `Gen1 1`, `Gen1:1`, `Genesis 1:1`
     - `1Cor 13 4`, `1Cor13:4`, `1 Cor 13 4`, `1 கொரி 13 4`
     - `1சாமு 2 3`, `1சாமு2:3`, `1 Sam 2 3`
     - `யோவா 3 16`, `யோவான் 3:16`, `யோவான் 3`
     - `Gen 1`, `Gen1` (Chapter-only navigation)
   - Auto-triggers live broadcast and scrolls into view when a specific verse reference is queried.
3. **Interactive Verse History Section**:
   - Automatically tracks every clicked / presented scripture.
   - Deduplicates and persists history to `localStorage.getItem('proPresenterBibleVerseHistory')`.
   - Renders interactive history pills with reference, version badge, and 1-click re-presentation.
   - Includes individual remove (`×`) and bulk "Clear" actions.
4. **Keyboard Shortcut**:
   - `Ctrl+B` (and `Cmd+B`): Instantly activates Bible view and focuses the scripture search input.
   - `/` (Forward slash): Quick focus on Bible search when in Bible workspace.
5. **3 Sets of ProPresenter RSS 2.0 Feeds per Version**:
   - **Full Verse Feed** (`/api/bible/rss/:version`): Reference citation in `<title>`, Scripture text in `<description>` (All-in-one template).
   - **Verse Text Only Feed** (`/api/bible/rss/:version?type=verse`): Scripture text directly in `<title>` (Ideal for ProPresenter Main Screen slide text layers).
   - **Reference Citation Only Feed** (`/api/bible/rss/:version?type=reference`): Reference citation in `<title>` (Ideal for ProPresenter citation badges / subtitles).
   - Dynamic real-time broadcast: Feeds update immediately whenever any scripture verse is clicked or presented in the controller.
6. **ProPresenter RSS Feeds Hub Section**:
   - Pinned in-page hub (`#bibleRssHubSection`) toggleable via **"ProPresenter RSS URLs"** button in header toolbar.
   - Dynamic version switching (e.g. Tamil `TAM` and English `KJV`).
   - Network Host selector (Church LAN IP `192.168.0.200:8080` vs `localhost:8080`).
   - One-click URL copy buttons with instant visual feedback and direct browser test links.


