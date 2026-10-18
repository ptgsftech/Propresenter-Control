/**
 * @file server.js
 * @description Production Express Web Server for ProPresenter Web Studio Controller.
 * Serves broadcast controller dashboard, stage confidence monitor, static assets,
 * configuration endpoints, and an optional CORS reverse proxy for local church networks.
 *
 * @version 1.0.0
 * @license MIT
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const os = require('os');
require('dotenv').config();

const bibleService = require('./src/services/bible-service');

const app = express();

// ==============================================================================
// 1. CONFIGURATION
// ==============================================================================
const PORT = parseInt(process.env.PORT, 10) || 8080;
const PROPRESENTER_HOST = process.env.PROPRESENTER_HOST || '192.168.0.200';
const PROPRESENTER_PORT = process.env.PROPRESENTER_PORT || '1025';
const PROPRESENTER_BASE_URL = `http://${PROPRESENTER_HOST}:${PROPRESENTER_PORT}`;

// ==============================================================================
// 2. MIDDLEWARE
// ==============================================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lightweight request logging (excluding static asset noise)
app.use((req, res, next) => {
  const isStatic = req.url.match(/\.(css|js|png|jpg|jpeg|svg|ico|woff|woff2|ttf|map)$/i);
  if (!isStatic) {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  }
  next();
});

// ==============================================================================
// 3. API & HEALTH ENDPOINTS
// ==============================================================================

/**
 * Health check endpoint for container / service monitoring.
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'ProPresenter Web Studio Controller'
  });
});

/**
 * Provides default host configuration to frontend clients.
 */
app.get('/api/config', (req, res) => {
  res.json({
    host: PROPRESENTER_HOST,
    port: PROPRESENTER_PORT,
    baseURL: PROPRESENTER_BASE_URL
  });
});

/**
 * Optional CORS Reverse Proxy for ProPresenter OpenAPI.
 * Routes /api/proxy/* directly to target ProPresenter machine.
 * Useful when client devices encounter cross-origin or local network routing blocks.
 */
app.all('/api/proxy/*', async (req, res) => {
  const targetPath = req.url.replace(/^\/api\/proxy/, '');
  const targetUrl = `${PROPRESENTER_BASE_URL}${targetPath}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: { ...req.headers, host: `${PROPRESENTER_HOST}:${PROPRESENTER_PORT}` }
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
      fetchOptions.headers['content-type'] = 'application/json';
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.text();

    res.status(response.status);
    response.headers.forEach((val, key) => {
      if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    });

    res.send(data);
  } catch (err) {
    res.status(502).json({
      error: 'ProPresenter Proxy Gateway Error',
      message: err.message,
      target: targetUrl
    });
  }
});

// ==============================================================================
// 3.1 BIBLE ENGINE & PROPRESENTER RSS API
// ==============================================================================

/**
 * Returns available active Bible versions from Cloudflare D1.
 */
app.get('/api/bible/versions', async (req, res) => {
  try {
    const versions = await bibleService.getVersions();
    res.json({ success: true, versions });
  } catch (err) {
    console.error('[Bible API] Versions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Returns books for a selected Bible version.
 */
app.get('/api/bible/books', async (req, res) => {
  try {
    const version = req.query.version || 'TAM';
    const books = await bibleService.getBooks(version);
    res.json({ success: true, version, books });
  } catch (err) {
    console.error('[Bible API] Books error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Retrieves parallel verses aligned across up to 3 versions.
 */
app.get('/api/bible/verses', async (req, res) => {
  try {
    const versions = req.query.versions ? req.query.versions.split(',') : ['TAM'];
    const book = req.query.book || 'GEN';
    const chapter = parseInt(req.query.chapter, 10) || 1;
    const verse = req.query.verse ? parseInt(req.query.verse, 10) : null;

    const data = await bibleService.getParallelVerses({ versions, book, chapter, verse });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[Bible API] Verses error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Free / Common Search: Auto-detects reference or searches text keywords across D1.
 */
app.get('/api/bible/search', async (req, res) => {
  try {
    const query = req.query.q || req.query.query || '';
    const versions = req.query.versions ? req.query.versions.split(',') : ['TAM'];
    const limit = parseInt(req.query.limit, 10) || 40;

    const results = await bibleService.search({ query, versions, limit });
    res.json({ success: true, ...results });
  } catch (err) {
    console.error('[Bible API] Search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
/**
 * ProPresenter Dynamic & Parametric RSS 2.0 Scripture Feed Engine
 * Supports 3 sets of RSS feeds per version:
 *   1. Full Verse:     /api/bible/rss/:version               -> Reference (Title), Scripture (Description)
 *   2. Verse Text Only:/api/bible/rss/:version?type=verse     -> Only verse in Title
 *   3. Reference Only: /api/bible/rss/:version?type=reference -> Only reference in Title
 *
 * Automatically streams the active live verse in real-time, or serves static verses
 * if ?book=&chapter=&verse= parameters are supplied.
 */
const handleBibleRssRequest = async (req, res) => {
  try {
    const rawVersion = req.params.version || req.query.version || 'TAM';
    const version = String(rawVersion).toUpperCase();
    const feedType = String(req.query.type || 'full').toLowerCase(); // 'full' | 'verse' | 'reference'
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    let item = null;
    let book = req.query.book;
    let chapter = req.query.chapter ? parseInt(req.query.chapter, 10) : null;
    let verse = req.query.verse ? parseInt(req.query.verse, 10) : null;

    // 1. Parametric mode: If explicit book/chapter/verse parameters are given
    if (book && chapter && verse) {
      const parallelData = await bibleService.getParallelVerses({
        versions: [version],
        book: book,
        chapter: chapter,
        verse: verse
      });

      const targetRow = parallelData.rows.find(r => r.verse === verse) || parallelData.rows[0];
      if (targetRow && targetRow.versions[version]) {
        item = {
          version: version,
          book_name: targetRow.versions[version].book_name,
          verse_text: targetRow.versions[version].text
        };
        book = parallelData.book;
      }
    } else {
      // 2. Dynamic Live mode: stream currently active live verse translated for this version
      const liveData = await bibleService.getActiveLiveVerseForVersion(version);
      if (liveData) {
        item = {
          version: version,
          book_name: liveData.book_name,
          verse_text: liveData.verse_text
        };
        book = liveData.book;
        chapter = liveData.chapter;
        verse = liveData.verse;
      }
    }

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');

    if (!item) {
      const emptyXml = bibleService.createEmptyFeed(version, book || 'GEN', chapter || 1, verse || 1, feedType, baseUrl);
      return res.send(emptyXml);
    }

    // Parse Feed Configuration Settings from query parameters
    const feedOptions = {
      ttl: req.query.speed ? parseInt(req.query.speed, 10) : (req.query.ttl ? parseInt(req.query.ttl, 10) : 1),
      speed: req.query.speed ? parseInt(req.query.speed, 10) : 1,
      toggles: req.query.toggles !== '0' && req.query.toggles !== 'false',
      slides: req.query.slides ? parseInt(req.query.slides, 10) : (req.query.splitSlides ? parseInt(req.query.splitSlides, 10) : 1),
      limit: req.query.limit ? parseInt(req.query.limit, 10) : (req.query.maxChars ? parseInt(req.query.maxChars, 10) : 0)
    };

    // Generate output based on the requested feed type:
    let xml = '';
    if (feedType === 'verse') {
      // Only verse scripture text in <title>
      xml = bibleService.createVerseOnlyRSS(item, version, book, chapter, verse, baseUrl, feedOptions);
    } else if (feedType === 'reference') {
      // Only reference citation in <title>
      xml = bibleService.createReferenceOnlyRSS(item, version, book, chapter, verse, baseUrl, feedOptions);
    } else {
      // Full verse: Reference in <title>, Scripture in <description>
      xml = bibleService.createFullVerseRSS(item, version, book, chapter, verse, baseUrl, feedOptions);
    }

    return res.send(xml);
  } catch (err) {
    console.error('[Bible RSS] Error:', err);
    res.set('Content-Type', 'text/plain');
    res.status(500).send(`RSS error: ${err.message}`);
  }
};

// Route Registrations for RSS Feeds
app.get('/api/bible/rss/:version', handleBibleRssRequest);
app.get('/api/bible/rss', handleBibleRssRequest);
app.get('/api/bible/rss/live/:version', handleBibleRssRequest);
app.get('/api/bible/rss/live', handleBibleRssRequest);
app.get('/exec', handleBibleRssRequest); // Drop-in compatibility with user's Google Apps Script

/**
 * Metadata Endpoint for Frontend RSS URLs Hub
 * Provides available Bible versions, LAN network IPs, and port for 1-click ProPresenter configuration.
 */
app.get('/api/bible/rss-info', async (req, res) => {
  try {
    const versions = await bibleService.getVersions();
    const localIps = getLocalNetworkAddresses();
    const primaryLanIp = localIps[0] || 'localhost';

    res.json({
      success: true,
      protocol: req.protocol,
      port: PORT,
      currentHost: req.get('host'),
      primaryLanIp: primaryLanIp,
      lanIps: localIps,
      versions: versions.map(v => ({
        code: v.version_code,
        name: v.version_name,
        language: v.language_name
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Updates the active live presented verse.
 */
app.post('/api/bible/live', (req, res) => {
  try {
    const verseData = req.body;
    const active = bibleService.setActiveLiveVerse(verseData);
    res.json({ success: true, active_verse: active });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Gets the active live presented verse.
 */
app.get('/api/bible/live', (req, res) => {
  res.json({ success: true, active_verse: bibleService.getActiveLiveVerse() });
});

// ==============================================================================
// 4. CLEAN CONVENIENCE ROUTES
// ==============================================================================

// 1. Root path (localhost:8080) -> render from the login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'login.html'));
});

// 2. Controller path (localhost:8080/controller) -> show the control page
app.get('/controller', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'index.html'));
});

// Additional convenience aliases
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'login.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'index.html'));
});

app.get('/website', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'index.html'));
});

app.get('/stage', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'stageMonitor.html'));
});

app.get('/monitor', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'stageMonitor.html'));
});

// ==============================================================================
// 5. STATIC ASSET SERVING
// ==============================================================================
// Explicit mounts to guarantee reliable asset loading from both / and /controller
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));

// Fallback static serving for root folder
app.use(express.static(path.join(__dirname, '.')));

// Fallback 404 handler for missing routes
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'pages', 'login.html'));
});

// ==============================================================================
// 6. SERVER INITIALIZATION & NETWORK DISCOVERY
// ==============================================================================

/**
 * Discovers local IPv4 network interface addresses.
 * @returns {Array<string>}
 */
function getLocalNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

const server = app.listen(PORT, '0.0.0.0', () => {
  const localIps = getLocalNetworkAddresses();

  console.log('\n=================================================================');
  console.log('  PROPRESENTER WEB STUDIO CONTROLLER - NODE.JS SERVER READY');
  console.log('=================================================================');
  console.log(`  * Local Access:       http://localhost:${PORT}/pages/index.html?bypass=true`);
  console.log(`  * Standard Login:     http://localhost:${PORT}/`);
  console.log(`  * Stage Monitor:      http://localhost:${PORT}/stage`);
  if (localIps.length > 0) {
    console.log('\n  LAN Network Access (for iPads / Mobile devices on church Wi-Fi):');
    localIps.forEach(ip => {
      console.log(`  * http://${ip}:${PORT}/pages/index.html?bypass=true`);
      console.log(`  * http://${ip}:${PORT}/stage (Musician Confidence Monitor)`);
    });
  }
  console.log('\n  Target ProPresenter Host:');
  console.log(`  * OpenAPI URL:        ${PROPRESENTER_BASE_URL}`);
  console.log('=================================================================\n');
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully (SIGINT)...');
  server.close(() => {
    console.log('[Server] Closed all connections.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Shutting down gracefully (SIGTERM)...');
  server.close(() => {
    process.exit(0);
  });
});
