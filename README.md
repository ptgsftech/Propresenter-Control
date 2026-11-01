# ProPresenter Web Studio Controller & Scripture Live Engine

[![Developed by PTGSF Tech](https://img.shields.io/badge/Developer-PTGSF%20Tech-blue.svg)](https://github.com/ptgsftech)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![ProPresenter](https://img.shields.io/badge/ProPresenter-7.12+-orange.svg)](https://renewedvision.com/propresenter/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-4.19+-lightgrey.svg)](https://expressjs.com/)
[![Cloudflare D1](https://img.shields.io/badge/Database-Cloudflare%20D1-F38020.svg)](https://developers.cloudflare.com/d1/)

> **Developed by PTGSF Tech**  
> An open-source, broadcast-grade remote command center, bilingual scripture comparison engine, and musician stage confidence monitor engineered for **Renewed Vision ProPresenter 7+**. Anyone is free to download, customize, and deploy this software for their own church or live production environment.

Interfaces directly with ProPresenter's native OpenAPI HTTP server (`http://192.168.0.200:1025`) and Cloudflare D1 multi-version Bible database, delivering real-time bi-directional synchronization, dynamic RSS 2.0 streaming, 0ms local text file link synchronization, and low-latency slide transport.

---

## Table of Contents
1. [Executive Summary & Architecture](#1-executive-summary--architecture)
2. [Technology Stack & Design System](#2-technology-stack--design-system)
3. [Setup & Installation Guide](#3-setup--installation-guide)
4. [Workspace & UI Layout Architecture](#4-workspace--ui-layout-architecture)
5. [Feature Modules Breakdown](#5-feature-modules-breakdown)
   - [5.1 Show Mode (Song Presentation Deck)](#51-show-mode-song-presentation-deck)
   - [5.2 Bilingual Song Search Engine](#52-bilingual-song-search-engine)
   - [5.3 Bible Scripture & Parallel Comparison Engine](#53-bible-scripture--parallel-comparison-engine)
   - [5.4 Dynamic RSS 2.0 Feed Engine](#54-dynamic-rss-20-feed-engine)
   - [5.5 Dedicated Stage Confidence Monitor](#55-dedicated-stage-confidence-monitor)
   - [5.6 Quick-Clear & Global Production Controls](#56-quick-clear--global-production-controls)
   - [5.7 Multi-Screen Output Monitor](#57-multi-screen-output-monitor)
6. [ProPresenter OpenAPI Endpoints Implemented](#6-propresenter-openapi-endpoints-implemented)
7. [Backend REST API & RSS Feeds Reference](#7-backend-rest-api--rss-feeds-reference)
8. [Core Client Services & Controllers Architecture](#8-core-client-services--controllers-architecture)
9. [Keyboard Shortcuts](#9-keyboard-shortcuts)
10. [Repository File Map](#10-repository-file-map)
11. [Developer & AI Maintenance Guidelines](#11-developer--ai-maintenance-guidelines)

---

## 1. Executive Summary & Architecture

The **ProPresenter Web Studio Controller** operates as a remote broadcast command center for **Renewed Vision ProPresenter 7+**. It interfaces directly with ProPresenter's native OpenAPI HTTP REST and chunked streaming endpoints.

### High-Level System Architecture
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PROPRESENTER WEB STUDIO CONTROLLER                    │
│                                                                             │
│   Web Browser Clients (Desktop / iPad / Android Tablet / Mobile / Stage)    │
│   ├── Show Mode: Song Cues, Transport, Sets, Bilingual Search, Quick-Clear │
│   ├── Bible Mode: 1-to-3 Version Comparison, Free Search, Click History    │
│   ├── Screen Monitor: Audience (Sony TV) & Stage Output Real-Time Previews  │
│   └── Stage Monitor: Fullscreen High-Contrast Confidence Display with Chords│
└───────────────────────▲─────────────────────────────▲───────────────────────┘
                        │ HTTP / WebSocket            │ REST / RSS / Files
                        ▼                             ▼
┌───────────────────────────────────────┐   ┌─────────────────────────────────┐
│     NODE.JS / EXPRESS.JS SERVER       │   │      CLOUDFLARE D1 (SQLITE)     │
│             (Port 8080)               │   │      Multi-Version Database     │
│  ├── Reverse Proxy to ProPresenter    │   │  ├── bible_version (TAM, KJV...)│
│  ├── Cloudflare D1 Bible Engine       │◄──┼──┤ bible_book (66 Books)        │
│  ├── Dynamic RSS 2.0 Feed Generator   │   │  └── bible_verse (Parallel text)│
│  ├── Strict Non-Bible Content Blocker │   └─────────────────────────────────┘
│  └── 0ms Local Text File Writer       │
└───────────────────▲───────────────────┘
                    │ REST API (:1025) / Slide Trigger / Polling
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 RENEWED VISION PROPRESENTER 7+ DESKTOP                      │
│                           (192.168.0.200:1025)                              │
│  ├── Library: Songs, Liturgy, Media, Sets                                   │
│  ├── Library: "Resource" -> Presentation: "Bible" (UUID: cf32ba94...)       │
│  │     └── Slide 1: Linked to dynamic RSS / Local Text File feeds           │
│  └── Visual Layer Engine: Audience Output (Sony TV) & Stage Outputs (ATEM)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Bi-Directional Synchronization Workflow:
1. **Operator clicks a Bible verse in UI**:
   - `BibleController.presentVerse()` extracts the verse from the parallel database grid.
   - Concurrently executes two zero-latency calls:
     1. `POST /api/bible/live`: Updates active in-memory verse and writes to `C:\ProPresenter Files\Bible_Verse.txt` and `Bible_Reference.txt`.
     2. `ApiClient.triggerSlide(biblePresentationUuid, 0)`: Triggers Slide 1 of the Bible presentation in ProPresenter, followed by a 75ms micro-pulse repaint.
2. **ProPresenter repaints the verse**:
   - ProPresenter's Slide 1 text layers automatically pull from the active RSS stream (`/api/bible/rss/TAM?type=verse` and `?type=reference`) or local linked text files.
3. **Operator switches to Songs**:
   - Song deck cues operate directly on song presentation UUIDs via ProPresenter REST API.
   - Backend validation blocks non-Bible data from ever entering the RSS feed.
   - Bible polling pauses or runs in background without clobbering song lyrics.

---

## 2. Technology Stack & Design System

### Technology Stack Table

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend Runtime** | **Node.js** | v20+ | Asynchronous event-driven server runtime |
| **Web Server** | **Express.js** | v4.19.2 | Reverse proxy, static file server, and REST API |
| **Database** | **Cloudflare D1** | Serverless SQLite | 66 canonical books across parallel translations |
| **Frontend Framework**| **Vanilla HTML5 & ES6+**| ES2022+ | Zero-dependency, framework-free modular architecture |
| **Layout & Grid** | **Bootstrap** | v5.3.3 | CSS flexbox and responsive layout utilities |
| **Styling & Theming** | **Vanilla CSS Tokens** | Custom | ProPresenter 7 Dark Slate aesthetic |
| **Icons & Fonts** | **FontAwesome & Google Fonts** | 6.5.1 | Inter, Roboto, Noto Sans Tamil |
| **Search Engine** | **Fuse.js** | v7.0.0 | Client-side fuzzy search with bilingual token priority |
| **Target Software** | **Renewed Vision ProPresenter** | 7.12+ (v7.12) | OpenAPI HTTP server on port 1025 |

### ProPresenter 7 Design Tokens (`css/theme.css`)
```css
:root {
  --bg-canvas: #0f1013;            /* Deep studio black */
  --bg-surface: #181a20;           /* Panel background */
  --bg-surface-elevated: #22252e;  /* Elevated card */
  --border-subtle: #262933;        /* 1px hairline border */
  --border-strong: #383d4c;        /* Active border */

  --accent-orange: #ff9f0a;        /* ProPresenter signature amber */
  --accent-orange-glow: rgba(255, 159, 10, 0.4);

  --accent-cyan: #38bdf8;          /* Audience displays & song titles */
  --accent-purple: #c084fc;        /* Stage displays & confidence monitor */
  --color-success: #10b981;        /* Connected / Capture active / Audio playing */
  --color-danger: #ef4444;         /* Clear all / Disconnected / Stop capture */

  --font-sans: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', Consolas, monospace;
}
```

---

## 3. Setup & Installation Guide

### Prerequisites
- **Node.js**: Version 20.x or higher installed.
- **ProPresenter**: Version 7.12+ running on macOS or Windows.
- **Network**: Host computer and remote devices connected to the same LAN / church Wi-Fi.

### Step 1: Install Dependencies
Open PowerShell or Terminal in the project root:
```bash
npm install
```

### Step 2: Configuration (`config.json`)

To prevent GitHub push rejection (GitHub blocks `.env` files and detects live Cloudflare tokens via Push Protection), this project standardizes exclusively on **`config.json`**.

#### 1. Repository Configuration (`config.json`):
This file is tracked by git and contains church network settings with sanitized token placeholders:
```json
{
  "PORT": 8080,
  "PROPRESENTER_HOST": "192.168.0.200",
  "PROPRESENTER_PORT": 1025,
  "CLOUDFLARE_QUERY_URL": "https://api.cloudflare.com/client/v4/accounts/<YOUR_ACCOUNT_ID>/d1/database/<YOUR_DATABASE_ID>/query",
  "CLOUDFLARE_API_TOKEN": "your_cloudflare_api_token_here"
}
```

#### 2. Local Private Overrides (`config.local.json`):
To use live Cloudflare API credentials on your local machine without ever exposing them to GitHub, create `config.local.json` in the root folder. It is automatically ignored by `.gitignore`:
```json
{
  "CLOUDFLARE_QUERY_URL": "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT/d1/database/YOUR_DB/query",
  "CLOUDFLARE_API_TOKEN": "cfut_your_actual_private_token"
}
```

> [!TIP]
> `src/config.js` automatically loads `config.json` and merges `config.local.json` over it, so your private secrets stay 100% on your local machine while GitHub accepts all git pushes cleanly!

### Step 3: ProPresenter Desktop Configuration
1. Open **ProPresenter Preferences** (`Ctrl+,` or `Cmd+,`).
2. Go to the **Network** tab:
   - Check **Enable Network**.
   - Check **Enable ProPresenter API**.
   - Set **Port** to `1025`.
   - Disable or note the password (if password is set, provide it in the web login screen).
3. Under **Libraries**:
   - Ensure a Library named **Resource** exists (case-insensitive).
   - Ensure a Presentation named **Bible** exists inside the Resource library.
   - Note: The system automatically discovers this UUID (`cf32ba94-2b67-4571-8c58-52c6953d987d`).

### Step 4: ProPresenter RSS Text Layer Setup
To display Bible verses on your church screen using RSS:
1. Open the **Bible** presentation in ProPresenter.
2. Select **Slide 1** -> Click **Edit Slide**.
3. Select your Scripture text box -> In the right Inspector, go to **Text**:
   - Check **Linked Text**.
   - Set Source to **RSS Feed**.
   - Paste the RSS URL:
     ```
     http://192.168.0.200:8080/api/bible/rss/TAM?type=verse
     ```
   - Set Update Frequency to **1 second** or **Automatic**.
4. (Optional) For the Reference citation text box:
   - Check **Linked Text** -> Set Source to **RSS Feed**.
   - Paste URL:
     ```
     http://192.168.0.200:8080/api/bible/rss/TAM?type=reference
     ```

*(Alternative 0ms Instant Mode: Link text boxes directly to `C:\ProPresenter Files\Bible_Verse.txt` and `C:\ProPresenter Files\Bible_Reference.txt` via File Link).*

### Step 5: Windows Firewall Setup (LAN Devices)
To allow iPads, mobile phones, and laptops on church Wi-Fi to access port 8080, run the included batch file as Administrator:
```cmd
allow-firewall-8080.bat
```
Or manually run PowerShell as Administrator:
```powershell
New-NetFirewallRule -DisplayName "ProPresenter Web Controller (8080)" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

### Step 6: Start the Server
* **Production Run**:
  ```bash
  npm start
  ```
* **Development (Auto-reload on file edits)**:
  ```bash
  npm run dev
  ```

Once started, the console displays:
```
=================================================================
  PROPRESENTER WEB STUDIO CONTROLLER - NODE.JS SERVER READY
=================================================================
  * Config Source:      config.properties (or config.json)
  * Local Access:       http://localhost:8080/controller
  * Standard Login:     http://localhost:8080/
  * Stage Monitor:      http://localhost:8080/stage

  LAN Network Access (for iPads / Mobile devices on church Wi-Fi):
  * http://192.168.0.200:8080/controller
  * http://192.168.0.200:8080/stage
=================================================================
```

---

## 4. Workspace & UI Layout Architecture

The application layout is engineered with fixed screen-based viewport heights, completely eliminating outer page scrollbars and keeping the command center stationary:

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ MASTER HEADER BAR: Status Dot, App Title, Mode Switcher (Show/Bible), Tools  │
├───────────────┬───────────────────────────────────────────────┬───────────────┤
│ LEFT SIDEBAR  │               MIDDLE WORKSPACE                │ RIGHT SIDEBAR │
│    (320px)    │            (calc(100vh - 175px))              │    (390px)    │
│               ├───────────────────────────────────────────────┤               │
│ Tier 1:       │ ROW 1: TACTICAL BAR (Clears, Screens, Clock)  │ Screen Monitor│
│ Libraries     ├───────────────────────────────────────────────┤ Dropdown &    │
│ (75% height)  │ ROW 2 ("Show" Mode):                          │ Live Preview  │
│ 5s Polling    │ Active Presentation Cues Grid & Thumbnails    ├───────────────┤
│               │ - OR -                                        │ 6 Feature Tabs│
│ Tier 2:       │ ROW 3 ("Bible" Mode):                         │ (Audio, Stage,│
│ Playlists     │ 1-to-3 Version Comparison Grid & D1 Search    │  Timers, Msg, │
│ (25% height)  │                                               │  Props, Macro)│
└───────────────┴───────────────────────────────────────────────┴───────────────┘
```

### Viewport Heights:
```css
height: calc(100vh - 175px);
max-height: calc(100vh - 175px);
min-height: 380px;
```
- **1080p Desktop (1920×1080)**: Fixed at **`905px`**.
- **900p Display (1600×900)**: Fixed at **`725px`**.
- **768p Laptop (1366×768)**: Fixed at **`593px`**.

---

## 5. Feature Modules Breakdown

### 5.1 Show Mode (Song Presentation Deck)
- **2-Tier 75/25 Sidebar Navigator (`playlist-ctrl.js`)**:
  - Top 75% displays song libraries with live counter badge (`#librariesCountBadge`).
  - **Dynamic 5-Second Library Polling**: Automatically discovers newly created, deleted, or renamed libraries in ProPresenter without browser refresh.
  - Bottom 25% houses service playlists and sets with count badge (`#playlistsCountBadge`).
- **Active Presentation Slide Cues Grid (`presentation-ctrl.js`)**:
  - Flattens presentation groups (Verse, Chorus, Bridge, Tag) into an array of slide cues with group color indicators.
  - High-resolution slide JPEG thumbnails loaded asynchronously via `/v1/presentation/{uuid}/thumbnail/{index}`.
  - Active cue indicator with glowing ProPresenter amber border and smooth auto-scroll into view.
  - Untitled presentation guard automatically filters out placeholder documents ("Untitled Presentation").
- **Transport Controls**:
  - Tactile **Next Slide** (`Space` / `ArrowRight`), **Previous Slide** (`ArrowLeft`), **Retrigger** (`Ctrl+R`).
  - Timeline operation controls: **Play**, **Pause**, **Rewind**.

### 5.2 Bilingual Song Search Engine (`song-search-ctrl.js`)
- Activated by header search button or pressing `Ctrl+F` / `Ctrl+K`.
- **In-Memory Indexing & Concurrency Control**:
  - Batch chunk loading (`chunkSize = 8`) preventing browser network choke.
  - `.normalize('NFC')` for accurate multi-lingual character comparisons (Tamil, Hindi, English).
  - Bilingual title segmentation on delimiters (`-`, `–`, `—`, `|`, `/`, parentheses).
  - Distinct author/artist avatar carousel with initials and song counts.
- **5-Tier Strict Priority Matching**:
  1. Priority 1 (Exact Match): Query strictly equals full title or segment.
  2. Priority 2 (Starts With): Full title or segment starts with query.
  3. Priority 3 (Ends With): Full title or segment ends with query.
  4. Priority 4 (Contains): Query is contained anywhere within title or segment.
  5. Priority 5 (Fuzzy Fallback): Runs Fuse.js (`threshold: 0.35`) excluding items already gathered.

### 5.3 Bible Scripture & Parallel Comparison Engine (`bible-ctrl.js` & `bible-service.js`)
- **Cloudflare D1 Multi-Version Engine**:
  - Connects to Cloudflare D1 using parameterized SQL queries. Houses 31,102 Tamil Bible verses (`TAM`) and English (`KJV`).
  - Dynamically loads bilingual book aliases directly from Cloudflare D1 database (`book_alias`, `bible_book`, and `book_details` tables) into an in-memory map on server startup, recognizing Tamil names (`ஆதியாகமம்`, `யோவான்`), English names (`Genesis`, `John`), abbreviations (`Gen`, `Jn`, `1Sa`), and typo variants (`gensis`, `ps`).
- **1-to-3 Version Comparison Grid**:
  - Dropdown selection for Version 1 (Primary, e.g., TAM), Version 2 (Optional, e.g., KJV), and Version 3 (Optional, e.g., TBS/NIV).
  - Auto-adjusts column layout: 1 Version = 100%, 2 Versions = 50%/50%, 3 Versions = 33%/33%/33%.
- **Smart Reference & Keyword Search**:
  - Accepts `Gen 1:1`, `Gen 1 1`, `1Cor 13 4`, `யோவா 3 16`, or free-text keywords like `grace` or `அன்பு`.
- **Auto-Trigger & Polling Lifecycle**:
  - **On Enter Bible View**: Automatically triggers Slide 1 (index 0) of the Bible presentation (`UUID: cf32ba94-2b67-4571-8c58-52c6953d987d`) in ProPresenter and starts active 1-second slide polling.
  - **On Leave Bible View**: Immediately halts the polling interval, freeing network resources.
- **Dual-Path Instant Scripture Push**:
  - Clicking any verse row concurrently triggers ProPresenter slide 1 and updates the active live verse in memory.
  - Writes live text to `C:\ProPresenter Files\Bible_Verse.txt` and `Bible_Reference.txt` for instantaneous 0ms local file-linked presentation.
- **Verse History Tray**:
  - Bottom history bar storing previously presented verses with one-click instant recall.

### 5.4 Dynamic RSS 2.0 Feed Engine
The server provides 3 specialized sets of RSS 2.0 feeds per Bible version:
1. **Full Verse Feed** (`/api/bible/rss/:version`): Reference in `<title>` (e.g., `யோவான் 3:16`), Scripture in `<description>` and `<content:encoded>`.
2. **Verse Text Only Feed** (`/api/bible/rss/:version?type=verse`): Only scripture text in `<title>`. Ideal for main congregation display layers.
3. **Reference Only Feed** (`/api/bible/rss/:version?type=reference`): Only citation reference in `<title>`. Ideal for subtitle or lower-third badges.
4. **Google Apps Script Compatibility** (`/exec`): Drop-in replacement for existing legacy Google Apps Script feeds.

#### Strict Non-Bible Content Isolation:
- RSS feeds strictly stream Bible section scripture.
- `POST /api/bible/live` validates incoming data against the 66 canonical Bible books. Any song lyrics or presentation text submitted is rejected with **HTTP 400 Bad Request**.
- When the screen is cleared via the "Clear" button, the RSS feed generates blank `<title></title>` tags, cleanly wiping the text off ProPresenter's screens.

### 5.5 Dedicated Stage Confidence Monitor (`pages/stageMonitor.html`)
- Full-screen high-contrast display designed for musician iPads and pulpit TV screens.
- Subscribes to `/v1/status/slide` and `/v1/stage/message` to display current vs next slide text and alert messages.
- Dynamic font size adjustment (`+` and `-`).
- Built-in mobile QR code modal in master header allows musicians to scan with their phones to open the monitor over church Wi-Fi.

### 5.6 Quick-Clear & Global Production Controls (`quick-clear-ctrl.js`)
- **Tactile Layer Clears**: Clear All (`F1` or button), Slide, Media, Props, Messages, Audio.
- **Audience Looks**: Preset chips with active look highlighting.
- **Macros Pad**: Color-coded automation macro trigger buttons.
- **Livestream / Recording**: Status badge and elapsed timer.

### 5.7 Multi-Screen Output Monitor (`screen-monitor.js`)
- Dropdown selector displaying all detected ProPresenter outputs:
  - **Audience Displays** (e.g., Sony TV Output): Live slide thumbnail preview (`quality=450`), current text overlay, active layer chips (`Slide`, `Media`, `Props`), and power button.
  - **Stage Displays** (e.g., Musician Stage Screen / ATEM): Current vs Next cue text, active stage layout, stage message alert, and power button.
- Subscribes to `presentation:slide_index` and `slide:status` to update previews in real time without page reload.

---

## 6. ProPresenter OpenAPI Endpoints Implemented

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

---

## 7. Backend REST API & RSS Feeds Reference

### Web Application Routes

| Route | Destination |
| :--- | :--- |
| `http://localhost:8080/` | Initial Login & Connection Validator (`pages/login.html`) |
| `http://localhost:8080/controller` | Full Web Studio Controller Dashboard (`pages/index.html?bypass=true`) |
| `http://localhost:8080/stage` | Fullscreen Musician Stage Confidence Monitor (`pages/stageMonitor.html`) |

### Server API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Server health check and uptime. |
| `GET` | `/api/config` | Returns target ProPresenter host IP and port. |
| `GET` | `/api/bible/versions` | Lists available Bible versions from Cloudflare D1 (`TAM`, `KJV`, `TBS`...). |
| `GET` | `/api/bible/books?version=TAM` | Lists 66 canonical books with Tamil and English names. |
| `GET` | `/api/bible/verses` | Retrieves parallel verses aligned across up to 3 versions (`?versions=TAM,KJV&book=JHN&chapter=3`). |
| `GET` | `/api/bible/search?q=...` | Bilingual reference or full-text keyword search across Cloudflare D1. |
| `POST` | `/api/bible/live` | Sets active live verse for RSS stream (Strictly rejects non-Bible content). |
| `GET` | `/api/bible/live` | Returns currently active live scripture object. |
| `GET` | `/api/bible/rss-info` | Returns LAN IP addresses and port configuration for ProPresenter RSS setup. |

### Dynamic RSS 2.0 Feeds

| Method | Feed URL | Output Format |
| :--- | :--- | :--- |
| `GET` | `/api/bible/rss/:version` | Full Verse: Reference in `<title>`, Scripture in `<description>`. |
| `GET` | `/api/bible/rss/:version?type=verse` | Verse Text Only: Only scripture text in `<title>`. |
| `GET` | `/api/bible/rss/:version?type=reference` | Reference Only: Only citation in `<title>`. |
| `GET` | `/api/bible/rss/live` | Dynamic auto-updating feed mirroring live scripture. |
| `GET` | `/exec` | Google Apps Script drop-in compatibility endpoint. |

### ProPresenter Proxy Gateway
Requests to `/v1/*` are forwarded directly to ProPresenter on port 1025 with CORS headers attached.

---

## 8. Core Client Services & Controllers Architecture

### Core Services
- **`AppConfig` (`js/config.js`)**: Manages IP/port configuration with fallback hierarchy: URL query parameters (`?ip=...&port=...`) -> `localStorage` -> Static Defaults (`192.168.0.200:1025`).
- **`ApiClient` (`js/api/api-client.js`)**: Complete REST API client covering all 22 ProPresenter OpenAPI categories with automatic timeout handling.
- **`StreamClient` (`js/api/stream-client.js`)**: Solves the browser 6-connection concurrency limit by aggregating all real-time events into a single persistent HTTP connection via `POST /v1/status/updates`. Reconnects automatically with exponential backoff (`1.5s` to `15s`).
- **`StateStore` (`js/state/store.js`)**: Centralized reactive state store using a Publish/Subscribe pattern:
  - `screens:updated`, `screen:audience`, `screen:stage`
  - `slide:status`, `presentation:slide_index`, `presentation:active`
  - `stage:message`, `timer:video_countdown`, `capture:status`, `look:current`, `layers:updated`

---

## 9. Keyboard Shortcuts

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| **Space** / **Arrow Right** / **Page Down** | Global | Advance to Next Slide |
| **Arrow Left** / **Page Up** | Global | Return to Previous Slide |
| **Ctrl + 1** | Global | Switch to **Show Mode** (Song & Presentation Deck) |
| **Ctrl + 2** / **Ctrl + B** | Global | Switch to **Bible Mode** (Scripture Engine) |
| **Ctrl + F** | Global | Open Multi-Mode Bilingual Song Search Modal |
| **Ctrl + R** | Show Deck | Retrigger Active Presentation from Start |
| **Ctrl + /** | Global | Open Keyboard Shortcuts Reference Guide |
| **F** | Stage Monitor | Toggle Browser Fullscreen Mode |

*(Shortcuts are automatically suppressed when typing inside search inputs or text fields).*

---

## 10. Repository File Map

```
Propresenter-Control/
├── config.json                  # Main JSON configuration (tracked in git, safe tokens)
├── config.local.json            # Local machine private overrides (Git ignored)
├── PROJECT_SUMMARY.md           # Machine-readable AI agent context & handover guide
├── .gitignore                   # Git exclusion rules
├── allow-firewall-8080.bat      # 1-Click Windows Firewall rule creator
├── package.json                 # Project manifest & npm scripts
├── server.js                    # Express.js reverse proxy & RSS scripture server
├── README.md                    # Single master documentation & human usage guide
├── index.html                   # Root entry router (redirects to controller or login)
├── pages/
│   ├── index.html               # Main Web Studio Controller (Show & Bible workspace)
│   ├── login.html               # Connection settings & connection test validator
│   └── stageMonitor.html        # High-contrast Stage Confidence Monitor with QR sharing
├── css/
│   ├── theme.css                # Dark slate design tokens & base resets
│   ├── layout.css               # Flexbox & grid multi-device layouts
│   ├── components.css           # Cues, clear buttons, cards, modals, history tray
│   ├── bible.css                # Bible comparison grid, live badges, search styling
│   ├── song-search.css          # Bilingual modal search styles
│   └── login.css                # Connection settings page styling
├── js/
│   ├── config.js                # AppConfig: LocalStorage & query param resolution
│   ├── app.js                   # Application coordinator & workspace view router
│   ├── login.js                 # Login connection tester & session guard
│   ├── api/
│   │   ├── api-client.js        # REST client wrapping 212 ProPresenter endpoints
│   │   └── stream-client.js     # Chunked Stream Multiplexer Engine (`/status/updates`)
│   ├── state/
│   │   └── store.js             # Reactive central Pub/Sub StateStore
│   └── controllers/
│       ├── bible-ctrl.js        # Bible comparison engine, live push, auto-trigger
│       ├── presentation-ctrl.js # Presentation slide cues grid & thumbnail loader
│       ├── screen-monitor.js    # Audience (Sony TV) & Stage screen output monitor
│       ├── song-search-ctrl.js  # Bilingual song search with Fuse.js fallback
│       ├── playlist-ctrl.js     # 2-Tier 75/25 service set & playlist navigator
│       ├── stage-ctrl.js        # Stage layouts, messages & chord charts
│       ├── quick-clear-ctrl.js  # Tactile layer clears, looks, and macros
│       ├── media-ctrl.js        # Background video loop bin
│       └── timer-ctrl.js        # Production clocks & video countdown timers
└── src/
    ├── config.js                # Universal configuration loader (Properties / JSON / env)
    └── services/
        └── bible-service.js     # Cloudflare D1 SQL query engine & RSS 2.0 generator
```

---

## 11. Developer & AI Maintenance Guidelines

When continuing development or performing AI pair-programming on this repository:

1. **Human vs. AI Documentation Alignment**:
   - `README.md` is the primary human-facing guide for church tech teams, sound operators, and production setup.
   - `PROJECT_SUMMARY.md` is the dedicated context document for AI agents (Cursor, Claude, Copilot, Antigravity, etc.) when running in separate agent environments or starting fresh chats.
2. **Central Configuration System**:
   - Always load backend settings via `const config = require('./src/config')` or `process.env`.
   - Never commit raw live secrets to public repositories; keep templates in `.example` files.
3. **Reactive State Pattern**:
   - Use `store.subscribe('eventName', handler)` in controllers.
   - Use `store.setState({ key: value })` to notify subscribers across views.
3. **Strict Bible & RSS Content Isolation**:
   - Never allow song lyrics or slide text to be posted to `/api/bible/live`.
   - In `pollBibleSlide()`, always verify `isBibleActive` before updating Bible output badges.
   - Cleared scripture must always output blank `<title></title>` and `<description></description>` in RSS.
4. **Bible Auto-Trigger & Polling Lifecycle**:
   - Switching to the Bible view in UI calls `window.bibleCtrl.onEnterBibleView()`, which auto-triggers Slide 1 of the Bible presentation and polls every 1 second (`1000ms`).
   - Leaving the Bible view calls `window.bibleCtrl.onLeaveBibleView()`, which immediately stops the interval.
5. **ProPresenter REST API Quirks**:
   - Slide index in ProPresenter OpenAPI is **0-indexed** (Slide 1 has `index: 0`).
   - Library and presentation name comparisons must always be case-insensitive (`toLowerCase()`).
   - To force ProPresenter to repaint an RSS slide immediately without waiting for background cache refresh, send a micro-pulse trigger to `/v1/presentation/active/trigger` 75ms after the primary slide trigger.
6. **Port & Process Management**:
   - Node server runs on port `8080`.
   - If an `EADDRINUSE: address already in use 0.0.0.0:8080` error occurs, find and terminate the existing Node process using:
     ```powershell
     Get-Process node | Stop-Process -Force
     ```
     Then restart with `npm start` or `npm run dev`.

---

## License & Open-Source Distribution

This project is open-source software licensed under the **[MIT License](LICENSE)**.

**Copyright (c) 2026 PTGSF Tech**

Permission is hereby granted, free of charge, to anyone who downloads this code:
- **Download & Deploy**: You are completely free to download, install, modify, customize, and deploy this software for your own church, ministry, or live broadcast environment.
- **Adaptation & Integration**: You can modify the code, build new features, or integrate it into your own church production infrastructure without restriction.
- **Attribution**: The code is provided *"as is"*, without warranty of any kind. See the [LICENSE](LICENSE) file for the full legal text.

Developed with ❤️ for churches and technical ministries by **PTGSF Tech**.
