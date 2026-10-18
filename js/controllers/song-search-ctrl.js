/**
 * @file song-search-ctrl.js
 * @description Multi-Mode Song Search Controller for ProPresenter 7+.
 * Features in-memory indexing with controlled batch fetching (chunk size 8),
 * bilingual NFC title segmentation (Tamil/English/Hindi), 5-tier strict priority
 * search with Fuse.js fuzzy fallback, Library & Author/Artist filtering,
 * and presentation live triggering.
 *
 * @version 1.0.0
 * @license MIT
 */

/**
 * Controller for modal-based multi-mode song search.
 *
 * @class ProSongSearchController
 */
class ProSongSearchController {
  /**
   * Initializes the Song Search Controller.
   *
   * @param {ApiClient} apiClient - REST API client instance.
   * @param {StateStore} store - Centralized reactive state store.
   * @param {Object} [options={}] - Custom configuration options.
   */
  constructor(apiClient, store, options = {}) {
    /** @type {ApiClient} */
    this.api = apiClient;

    /** @type {StateStore} */
    this.store = store;

    /** @type {number} */
    this.batchSize = options.batchSize || 8;

    /** @type {number} */
    this.debounceMs = options.debounceMs || 120;

    /** @type {number} */
    this.resultLimit = options.resultLimit || 48;

    /**
     * Flattened, normalized in-memory song index.
     * @type {Array<Object>}
     */
    this.songs = [];

    /**
     * Discovered library metadata.
     * @type {Array<{ id: string, name: string, count: number }>}
     */
    this.libraries = [];

    /**
     * Discovered distinct authors/artists with avatars & counts.
     * @type {Array<{ name: string, count: number, initials: string, color: string }>}
     */
    this.authors = [];

    /**
     * Active search mode: 'free' | 'library' | 'author'
     * @type {string}
     */
    this.activeMode = 'free';

    /** @type {string|null} */
    this.selectedLibraryId = null;

    /** @type {string|null} */
    this.selectedAuthor = null;

    /** @type {string} */
    this.query = '';

    /** @type {Fuse|null} */
    this.fuse = null;

    /** @type {boolean} */
    this.isOpen = false;

    /** @type {number|null} */
    this.debounceTimer = null;

    /** @type {number} */
    this.selectedIndex = -1;

    // DOM Elements
    this.modalEl = document.getElementById('proSongSearchModal');
    this.inputEl = document.getElementById('proSongSearchInput');
    this.clearBtnEl = document.getElementById('proSongSearchClearBtn');
    this.closeBtnEl = document.getElementById('proSongSearchCloseBtn');
    this.filterBarEl = document.getElementById('proSearchActiveFilterBar');
    this.filterPillEl = document.getElementById('proSearchActiveFilterPill');
    this.filterTextEl = document.getElementById('proSearchActiveFilterText');
    this.filterRemoveBtnEl = document.getElementById('proSearchFilterRemoveBtn');
    this.gridEl = document.getElementById('proSearchResultsGrid');
    this.statsTextEl = document.getElementById('proSearchCountText');
    this.loadingViewEl = document.getElementById('proSearchLoadingView');
    this.emptyViewEl = document.getElementById('proSearchEmptyView');
    this.emptyMsgEl = document.getElementById('proSearchEmptyMessage');
    this.resetFiltersBtnEl = document.getElementById('proSearchResetFiltersBtn');
    this.libraryTrayEl = document.getElementById('proSearchLibraryTray');
    this.librarySelectEl = document.getElementById('proSearchLibrarySelect');
    this.authorTrayEl = document.getElementById('proSearchAuthorTray');
    this.authorCarouselEl = document.getElementById('proSearchAuthorCarousel');
    this.authorCountTextEl = document.getElementById('proSearchAuthorCountText');
    this.indexingStatusEl = document.getElementById('proSearchIndexingStatus');

    this.init();
  }

  /**
   * Initializes listeners, shortcuts, and begins in-memory library indexing.
   */
  async init() {
    this.bindEvents();
    this.bindKeyboardShortcuts();
    this.store.subscribe('change:libraries', (libs) => {
      if (Array.isArray(libs) && libs.length > 0) {
        this.buildIndex();
      }
    });
    await this.buildIndex();
  }

  // =========================================================================
  // 1. IN-MEMORY INDEXING & DATA NORMALIZATION
  // =========================================================================

  /**
   * Queries /v1/libraries, fetches presentations in batches of 8 via /v1/library/{id},
   * normalizes Unicode strings, splits bilingual titles, and extracts authors.
   */
  async buildIndex() {
    this.setIndexingStatus('Indexing libraries...', 'streaming');
    if (this.loadingViewEl && this.isOpen) {
      this.loadingViewEl.style.display = 'flex';
      if (this.gridEl) this.gridEl.style.display = 'none';
    }

    try {
      let rawLibraries = [];
      try {
        rawLibraries = await this.api.getLibraries();
      } catch (e) {
        console.warn('[SongSearch] Unable to fetch /v1/libraries:', e.message);
      }

      if (!Array.isArray(rawLibraries) || rawLibraries.length === 0) {
        // Fallback to sample/demo library dataset for offline or testing mode
        rawLibraries = this.getFallbackLibraries();
      }

      this.libraries = rawLibraries.map(lib => ({
        id: lib.id ? (lib.id.uuid || lib.id.name) : (lib.uuid || lib.name || 'lib'),
        name: lib.id ? lib.id.name : (lib.name || 'Library'),
        raw: lib
      }));

      // Controlled concurrency batch fetching (chunk size: 8)
      const allIndexedSongs = [];
      const authorCountMap = new Map();

      for (let i = 0; i < this.libraries.length; i += this.batchSize) {
        const chunk = this.libraries.slice(i, i + this.batchSize);
        const settledResults = await Promise.allSettled(
          chunk.map(lib => this.fetchLibrarySongs(lib))
        );

        settledResults.forEach((result, idx) => {
          if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            const libSongs = result.value;
            chunk[idx].count = libSongs.length;
            allIndexedSongs.push(...libSongs);
          } else {
            console.warn(`[SongSearch] Batch failed for library ${chunk[idx].name}`);
          }
        });
      }

      this.songs = allIndexedSongs;

      // Extract & sort distinct authors
      this.songs.forEach(song => {
        const author = song.author || 'General Worship';
        authorCountMap.set(author, (authorCountMap.get(author) || 0) + 1);
      });

      const vibrantGradients = [
        'linear-gradient(135deg, #f59e0b, #ef4444)',
        'linear-gradient(135deg, #8b5cf6, #3b82f6)',
        'linear-gradient(135deg, #10b981, #06b6d4)',
        'linear-gradient(135deg, #ec4899, #8b5cf6)',
        'linear-gradient(135deg, #ff9f0a, #d946ef)',
        'linear-gradient(135deg, #0ea5e9, #6366f1)',
        'linear-gradient(135deg, #14b8a6, #3b82f6)'
      ];

      this.authors = Array.from(authorCountMap.entries())
        .map(([name, count], index) => {
          const initials = this.computeInitials(name);
          const color = vibrantGradients[index % vibrantGradients.length];
          return { name, count, initials, color };
        })
        .sort((a, b) => b.count - a.count);

      // Initialize Fuse.js instance
      this.initFuse();

      // Populate Library Select Dropdown & Author Avatar Carousel
      this.populateLibraryDropdown();
      this.populateAuthorCarousel();

      this.setIndexingStatus(`${this.songs.length} Songs Indexed`, 'connected');
      console.log(`[SongSearch] Index ready: ${this.songs.length} songs across ${this.libraries.length} libraries.`);

      if (this.loadingViewEl) this.loadingViewEl.style.display = 'none';
      if (this.gridEl) this.gridEl.style.display = 'grid';

      // Perform initial render
      this.executeSearch();

    } catch (err) {
      console.error('[SongSearch] Indexing failed:', err);
      this.setIndexingStatus('Index Error', 'error');
      if (this.loadingViewEl) this.loadingViewEl.style.display = 'none';
    }
  }

  /**
   * Fetches and normalizes all items inside a single library.
   *
   * @param {{ id: string, name: string, raw: Object }} lib
   * @returns {Promise<Array<Object>>}
   */
  async fetchLibrarySongs(lib) {
    try {
      let data = null;
      try {
        data = await this.api.getLibrary(lib.id);
      } catch (e) {
        // Fallback for demo/offline items
        data = lib.raw.items ? lib.raw : null;
      }

      const rawItems = (data && data.items) ? data.items : (Array.isArray(data) ? data : []);

      return rawItems
        .filter(item => {
          const name = item.id ? item.id.name : (item.name || '');
          if (!name) return false;
          const lower = name.trim().toLowerCase();
          return lower !== 'untitled presentation' && lower !== 'untitled' && lower !== 'untitled document';
        })
        .map((item, idx) => this.normalizeSongItem(item, lib, idx));
    } catch (err) {
      console.warn(`[SongSearch] Error fetching songs for ${lib.name}:`, err.message);
      return [];
    }
  }

  /**
   * Normalizes a song presentation item with NFC encoding, bilingual title segmentation,
   * and author extraction.
   *
   * @param {Object} item
   * @param {{ id: string, name: string }} lib
   * @param {number} index
   * @returns {Object}
   */
  normalizeSongItem(item, lib, index) {
    const rawUuid = item.id ? (item.id.uuid || item.uuid) : (item.uuid || `song-${lib.id}-${index}`);
    const rawTitle = (item.id ? item.id.name : (item.name || 'Untitled Song')).trim();

    // 1. Unicode NFC Normalization (crucial for Tamil, Hindi & multi-lingual comparisons)
    const normalizedTitle = rawTitle.normalize('NFC');

    // 2. Bilingual segmentation on delimiters: -, –, —, |, /
    const rawSegments = normalizedTitle.split(/\s*[-–—|\/]\s*/u).filter(Boolean);
    let segments = [];

    if (rawSegments.length > 1) {
      segments = rawSegments.map(s => s.trim().normalize('NFC'));
    } else {
      // Check for parentheses: "Song Title (பாடல் தலைப்பு)"
      const parenMatch = normalizedTitle.match(/^(.*?)\s*\((.*?)\)$/u);
      if (parenMatch && parenMatch[1] && parenMatch[2]) {
        segments = [parenMatch[1].trim().normalize('NFC'), parenMatch[2].trim().normalize('NFC')];
      } else {
        segments = [normalizedTitle];
      }
    }

    const primaryTitle = segments[0] || normalizedTitle;
    const secondaryTitle = segments.length > 1 ? segments.slice(1).join(' • ') : '';

    // 3. Author Extraction (from metadata, delimiters, or known worship leaders)
    const author = this.extractAuthor(item, normalizedTitle, lib.name);

    return {
      uuid: rawUuid,
      rawTitle,
      normalizedTitle,
      segments,
      primaryTitle,
      secondaryTitle,
      author,
      libraryId: String(lib.id),
      libraryName: lib.name,
      index
    };
  }

  /**
   * Extracts author/artist from item metadata, title conventions, or library names.
   *
   * @param {Object} item
   * @param {string} title
   * @param {string} libName
   * @returns {string}
   */
  extractAuthor(item, title, libName) {
    // 1. Direct metadata fields
    if (item.author && typeof item.author === 'string' && item.author.trim()) return item.author.trim();
    if (item.artist && typeof item.artist === 'string' && item.artist.trim()) return item.artist.trim();
    if (item.composer && typeof item.composer === 'string' && item.composer.trim()) return item.composer.trim();
    if (item.metadata && item.metadata.author) return item.metadata.author.trim();

    // 2. Title regex e.g. "Song Name - Fr. Berchmans" or "[Gersson Edinbaro] Song"
    const byMatch = title.match(/(?:by|feat\.?|artist)\s+([a-zA-Z\s\.\u0B80-\u0BFF]+)$/i);
    if (byMatch && byMatch[1].trim()) return byMatch[1].trim();

    const bracketMatch = title.match(/^\[([a-zA-Z\s\.\u0B80-\u0BFF]+)\]/);
    if (bracketMatch && bracketMatch[1].trim()) return bracketMatch[1].trim();

    // 3. Known worship artists detection in title or library name
    const knownArtists = [
      'Gersson Edinbaro',
      'Father Berchmans',
      'Fr. Berchmans',
      'Stephen Samuel',
      'John Jebaraj',
      'David Reuban',
      'Alwin Thomas',
      'Paul Dhinakaran',
      'D.G.S. Dhinakaran',
      'Hillsong Worship',
      'Hillsong',
      'Bethel Music',
      'Chris Tomlin',
      'Matt Redman',
      'Don Moen',
      'Sinach',
      'Phil Wickham',
      'Elevation Worship',
      'Casting Crowns',
      'Kari Jobe',
      'Benny Joshua'
    ];

    for (const artist of knownArtists) {
      if (title.toLowerCase().includes(artist.toLowerCase()) || libName.toLowerCase().includes(artist.toLowerCase())) {
        return artist;
      }
    }

    // 4. Default to library name if meaningful
    if (libName && !libName.toLowerCase().includes('default') && !libName.toLowerCase().includes('presentation')) {
      return libName;
    }

    return 'General Worship';
  }

  /**
   * Computes a 1-2 character initials badge for author avatar bubbles.
   *
   * @param {string} name
   * @returns {string}
   */
  computeInitials(name) {
    if (!name) return 'W';
    const clean = name.replace(/^(Fr\.|Dr\.|Pastor|Pr\.|Rev\.)\s*/i, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }

  /**
   * Initializes or updates the Fuse.js instance for Tier 5 fuzzy searches.
   */
  initFuse() {
    if (typeof Fuse !== 'undefined') {
      this.fuse = new Fuse(this.songs, {
        keys: [
          { name: 'normalizedTitle', weight: 0.6 },
          { name: 'segments', weight: 0.4 },
          { name: 'author', weight: 0.2 },
          { name: 'libraryName', weight: 0.1 }
        ],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2
      });
    } else {
      console.warn('[SongSearch] Fuse.js not loaded on page. Using built-in fuzzy fallback.');
      this.fuse = null;
    }
  }

  // =========================================================================
  // 2. STRICT PRIORITY-BASED MATCHING (Tiers 1 to 5)
  // =========================================================================

  /**
   * Executes strict multi-tier priority search over candidate songs.
   *
   * @param {string} query - Search text.
   * @returns {Array<Object>} Sorted matching songs.
   */
  search(query = '') {
    const rawQuery = String(query || '').trim();
    const q = rawQuery.normalize('NFC').toLowerCase();

    // 1. Filter candidates by active Library or Author/Artist constraints
    let candidates = this.songs;

    if (this.selectedLibraryId) {
      candidates = candidates.filter(s => s.libraryId === this.selectedLibraryId);
    }

    if (this.selectedAuthor) {
      const selectedAuthorLower = this.selectedAuthor.toLowerCase();
      candidates = candidates.filter(s => s.author.toLowerCase() === selectedAuthorLower);
    }

    // 2. Empty query: return candidates up to limit
    if (!q) {
      return candidates.slice(0, this.resultLimit);
    }

    // 3. Strict 4-Tier Matching
    const tier1 = []; // Exact Match (full title or any segment)
    const tier2 = []; // Starts With (full title or any segment)
    const tier3 = []; // Ends With (full title or any segment)
    const tier4 = []; // Contains (anywhere in title or segment)
    const seenUuids = new Set();

    /**
     * Checks if normalized title or any segment satisfies predicate.
     * @param {Object} song
     * @param {Function} predicate
     * @returns {boolean}
     */
    const matchesSegment = (song, predicate) => {
      if (predicate(song.normalizedTitle.toLowerCase())) return true;
      return song.segments.some(seg => predicate(seg.toLowerCase()));
    };

    // Classify each candidate into the highest matching priority tier
    for (const song of candidates) {
      // Priority 1: Exact Match
      if (matchesSegment(song, s => s === q)) {
        tier1.push(song);
        seenUuids.add(song.uuid);
        continue;
      }

      // Priority 2: Starts With
      if (matchesSegment(song, s => s.startsWith(q))) {
        tier2.push(song);
        seenUuids.add(song.uuid);
        continue;
      }

      // Priority 3: Ends With
      if (matchesSegment(song, s => s.endsWith(q))) {
        tier3.push(song);
        seenUuids.add(song.uuid);
        continue;
      }

      // Priority 4: Contains
      if (matchesSegment(song, s => s.includes(q)) || song.author.toLowerCase().includes(q)) {
        tier4.push(song);
        seenUuids.add(song.uuid);
      }
    }

    const gatheredResults = [...tier1, ...tier2, ...tier3, ...tier4];

    // Priority 5: Fuzzy Fallback via Fuse.js (if fewer than resultLimit gathered)
    if (gatheredResults.length < this.resultLimit) {
      const remainingCandidates = candidates.filter(s => !seenUuids.has(s.uuid));

      if (this.fuse && typeof Fuse !== 'undefined') {
        const fuzzyFuse = new Fuse(remainingCandidates, {
          keys: [
            { name: 'normalizedTitle', weight: 0.6 },
            { name: 'segments', weight: 0.4 },
            { name: 'author', weight: 0.2 }
          ],
          threshold: 0.35,
          ignoreLocation: true,
          minMatchCharLength: 2
        });

        const fuzzyMatches = fuzzyFuse.search(q);
        for (const match of fuzzyMatches) {
          if (gatheredResults.length >= this.resultLimit) break;
          gatheredResults.push(match.item);
          seenUuids.add(match.item.uuid);
        }
      } else {
        // Built-in offline fallback fuzzy matching (subsequence & edit distance heuristic)
        for (const song of remainingCandidates) {
          if (gatheredResults.length >= this.resultLimit) break;
          if (this.builtinFuzzyMatch(song.normalizedTitle.toLowerCase(), q)) {
            gatheredResults.push(song);
            seenUuids.add(song.uuid);
          }
        }
      }
    }

    return gatheredResults.slice(0, this.resultLimit);
  }

  /**
   * Lightweight offline fuzzy matcher for resilience without external CDN.
   *
   * @param {string} text
   * @param {string} pattern
   * @returns {boolean}
   */
  builtinFuzzyMatch(text, pattern) {
    if (pattern.length > text.length) return false;
    let pIdx = 0;
    for (let tIdx = 0; tIdx < text.length && pIdx < pattern.length; tIdx++) {
      if (text[tIdx] === pattern[pIdx]) {
        pIdx++;
      }
    }
    return pIdx === pattern.length;
  }

  // =========================================================================
  // 3. UI RENDERING & STATE UPDATES
  // =========================================================================

  /**
   * Executes search using current state and re-renders results grid.
   */
  executeSearch() {
    const results = this.search(this.query);
    this.renderResults(results);
    this.updateStats(results.length);
    this.updateFilterPill();
  }

  /**
   * Renders song result cards in the responsive grid.
   *
   * @param {Array<Object>} results
   */
  renderResults(results) {
    if (!this.gridEl) return;

    if (!results || results.length === 0) {
      this.gridEl.style.display = 'none';
      if (this.emptyViewEl) {
        this.emptyViewEl.style.display = 'flex';
        if (this.emptyMsgEl) {
          if (this.query) {
            this.emptyMsgEl.textContent = `No songs match "${this.query}". Try another spelling or reset filters.`;
          } else {
            this.emptyMsgEl.textContent = 'No presentations found in this filter selection.';
          }
        }
      }
      return;
    }

    if (this.emptyViewEl) this.emptyViewEl.style.display = 'none';
    this.gridEl.style.display = 'grid';

    this.gridEl.innerHTML = results.map((song, idx) => `
      <div class="pro-song-card ${idx === this.selectedIndex ? 'selected' : ''}" data-uuid="${song.uuid}" data-idx="${idx}">
        <div class="song-card-header">
          <span class="song-lib-tag" title="Library: ${this.escape(song.libraryName)}">
            <i class="fas fa-book-bookmark"></i> ${this.escape(song.libraryName)}
          </span>
          <span class="song-cue-badge">
            <i class="fas fa-play"></i> LIVE
          </span>
        </div>
        <div class="song-card-body">
          <h4 class="song-primary-title font-tamil" title="${this.escape(song.primaryTitle)}">${this.escape(song.primaryTitle)}</h4>
          ${song.secondaryTitle ? `<p class="song-secondary-title font-tamil" title="${this.escape(song.secondaryTitle)}">${this.escape(song.secondaryTitle)}</p>` : ''}
        </div>
        <div class="song-card-footer">
          <span class="song-author-tag" title="Author: ${this.escape(song.author)}">
            <i class="fas fa-user-circle"></i> ${this.escape(song.author)}
          </span>
          <button type="button" class="btn-song-trigger" title="Load presentation into ProPresenter & Show view">
            <i class="fas fa-folder-open"></i> Load
          </button>
        </div>
      </div>
    `).join('');

    // Wire click triggers for cards and trigger buttons
    this.gridEl.querySelectorAll('.pro-song-card').forEach(card => {
      card.addEventListener('click', () => {
        const uuid = card.getAttribute('data-uuid');
        const song = this.songs.find(s => s.uuid === uuid);
        if (song) {
          this.triggerSong(song);
        }
      });
    });
  }

  /**
   * Updates result stats text.
   * @param {number} count
   */
  updateStats(count) {
    if (!this.statsTextEl) return;
    this.statsTextEl.textContent = `${count} song${count === 1 ? '' : 's'}`;
  }

  /**
   * Updates or hides the active filter badge pill.
   */
  updateFilterPill() {
    if (!this.filterBarEl || !this.filterPillEl || !this.filterTextEl) return;

    if (this.selectedAuthor) {
      this.filterBarEl.style.display = 'flex';
      this.filterPillEl.className = 'pro-search-filter-pill author-filter';
      this.filterTextEl.textContent = `Author: ${this.selectedAuthor}`;
    } else if (this.selectedLibraryId) {
      const lib = this.libraries.find(l => l.id === this.selectedLibraryId);
      const name = lib ? lib.name : 'Selected Library';
      this.filterBarEl.style.display = 'flex';
      this.filterPillEl.className = 'pro-search-filter-pill library-filter';
      this.filterTextEl.textContent = `Library: ${name}`;
    } else {
      this.filterBarEl.style.display = 'none';
    }
  }

  /**
   * Populates the Mode 2 Library Select Dropdown.
   */
  populateLibraryDropdown() {
    if (!this.librarySelectEl) return;

    const options = [
      '<option value="">-- All Libraries --</option>',
      ...this.libraries.map(lib => `
        <option value="${lib.id}" ${this.selectedLibraryId === lib.id ? 'selected' : ''}>
          ${this.escape(lib.name)} (${lib.count || 0})
        </option>
      `)
    ];

    this.librarySelectEl.innerHTML = options.join('');
  }

  /**
   * Populates the Mode 3 Author Avatar Carousel.
   */
  populateAuthorCarousel() {
    if (!this.authorCarouselEl) return;

    if (this.authorCountTextEl) {
      this.authorCountTextEl.textContent = `${this.authors.length} artists`;
    }

    if (!this.authors.length) {
      this.authorCarouselEl.innerHTML = '<div class="text-secondary small p-2">No authors detected.</div>';
      return;
    }

    this.authorCarouselEl.innerHTML = this.authors.map(author => {
      const isSelected = this.selectedAuthor && this.selectedAuthor.toLowerCase() === author.name.toLowerCase();
      return `
        <button type="button" class="pro-author-bubble ${isSelected ? 'active' : ''}" data-author="${this.escape(author.name)}" title="${this.escape(author.name)} (${author.count} songs)">
          <div class="pro-author-bubble-circle" style="background: ${author.color};">
            ${author.initials}
            <span class="pro-author-count-badge">${author.count}</span>
          </div>
          <span class="pro-author-bubble-name font-tamil">${this.escape(author.name)}</span>
        </button>
      `;
    }).join('');

    // Wire avatar click handlers
    this.authorCarouselEl.querySelectorAll('.pro-author-bubble').forEach(btn => {
      btn.addEventListener('click', () => {
        const authorName = btn.getAttribute('data-author');
        if (this.selectedAuthor === authorName) {
          // Toggle off
          this.setAuthorFilter(null);
        } else {
          this.setAuthorFilter(authorName);
        }
      });
    });
  }

  /**
   * Sets mode: 'free' | 'library' | 'author'
   *
   * @param {string} mode
   */
  setMode(mode) {
    this.activeMode = mode;

    // Update active tab buttons
    document.querySelectorAll('.pro-search-tab').forEach(tab => {
      if (tab.getAttribute('data-mode') === mode) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Toggle contextual drawers
    if (this.libraryTrayEl) {
      this.libraryTrayEl.style.display = mode === 'library' ? 'block' : 'none';
    }
    if (this.authorTrayEl) {
      this.authorTrayEl.style.display = mode === 'author' ? 'block' : 'none';
    }

    // Adjust filters based on mode selection
    if (mode === 'free') {
      this.selectedLibraryId = null;
      this.selectedAuthor = null;
      if (this.librarySelectEl) this.librarySelectEl.value = '';
      this.deselectAllAuthorBubbles();
    }

    this.executeSearch();
  }

  /**
   * Sets active library filter and updates search.
   *
   * @param {string|null} libId
   */
  setLibraryFilter(libId) {
    this.selectedLibraryId = libId || null;
    this.selectedAuthor = null; // Mutually exclusive filter view
    this.deselectAllAuthorBubbles();

    if (this.librarySelectEl && libId) {
      this.librarySelectEl.value = libId;
    }

    const libLabel = document.getElementById('selectedLibLabel');
    if (libLabel) {
      const lib = this.libraries.find(l => l.id === libId);
      libLabel.textContent = lib ? lib.name : 'Select';
    }

    this.executeSearch();
  }

  /**
   * Sets active author filter and updates search.
   *
   * @param {string|null} authorName
   */
  setAuthorFilter(authorName) {
    this.selectedAuthor = authorName || null;
    this.selectedLibraryId = null; // Mutually exclusive filter view
    if (this.librarySelectEl) this.librarySelectEl.value = '';

    // Update bubble active highlights
    this.authorCarouselEl?.querySelectorAll('.pro-author-bubble').forEach(bubble => {
      if (authorName && bubble.getAttribute('data-author') === authorName) {
        bubble.classList.add('active');
      } else {
        bubble.classList.remove('active');
      }
    });

    const authorLabel = document.getElementById('selectedAuthorLabel');
    if (authorLabel) {
      authorLabel.textContent = authorName ? authorName : 'Select';
    }

    this.executeSearch();
  }

  /**
   * Deselects all author bubbles in carousel.
   */
  deselectAllAuthorBubbles() {
    this.authorCarouselEl?.querySelectorAll('.pro-author-bubble').forEach(b => b.classList.remove('active'));
    const authorLabel = document.getElementById('selectedAuthorLabel');
    if (authorLabel) authorLabel.textContent = 'Select';
  }

  /**
   * Clears all filters and resets search mode to Free Search.
   */
  resetFilters() {
    this.selectedLibraryId = null;
    this.selectedAuthor = null;
    this.query = '';
    if (this.inputEl) this.inputEl.value = '';
    if (this.clearBtnEl) this.clearBtnEl.style.display = 'none';
    if (this.librarySelectEl) this.librarySelectEl.value = '';
    this.deselectAllAuthorBubbles();
    this.setMode('free');
  }

  // =========================================================================
  // 4. PRESENTATION LIVE TRIGGER FUNCTION
  // =========================================================================

  /**
   * Focuses the song presentation in ProPresenter desktop software (without triggering slides)
   * and loads all slides/groups into the Show section in the web remote UI.
   * Closes modal, clears search, and notifies user.
   *
   * @param {Object} song - The song presentation item.
   */
  async triggerSong(song) {
    if (!song || !song.uuid) return;

    const title = song.primaryTitle || song.normalizedTitle || song.rawTitle || 'Song';
    console.log(`[SongSearch] Selecting song presentation: "${title}" (${song.uuid})`);

    // 1. Close modal & reset input state immediately
    this.closeModal();
    this.clearInput();

    // 2. Load and focus in ProPresenter software and Show cues deck
    if (window.presentationCtrl && typeof window.presentationCtrl.loadAndFocusPresentation === 'function') {
      await window.presentationCtrl.loadAndFocusPresentation(song.uuid, title);
    } else {
      // Fallback
      if (typeof window.setWorkspaceView === 'function') {
        window.setWorkspaceView('show');
      } else {
        document.getElementById('viewModeShowBtn')?.click();
      }
      await this.api.focusPresentation(song.uuid).catch(() => {});
      const presData = await this.api.getPresentation(song.uuid).catch(() => null);
      const fullPres = (presData && presData.presentation) ? presData.presentation : (presData || {});
      if (!fullPres.name) fullPres.name = title;
      this.store.setState({
        activePresentation: fullPres,
        activePresentationUuid: song.uuid,
        currentSlideIndex: null
      });
      this.store.emit('presentation:active', fullPres);
      document.getElementById('cuesSectionWrapper')?.scrollIntoView({ behavior: 'smooth' });
    }

    // 3. Show visual confirmation toast
    this.showTriggerToast(title);
  }

  /**
   * Displays a floating toast notification upon loading/focusing a song.
   *
   * @param {string} songTitle
   */
  showTriggerToast(songTitle) {
    const existing = document.querySelector('.pro-search-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'pro-search-toast';
    toast.innerHTML = `
      <i class="fas fa-folder-open text-warning fs-5"></i>
      <div>
        <div class="fw-bold small text-warning">Song Presentation Loaded</div>
        <div class="small font-tamil text-light text-truncate" style="max-width: 260px;">${this.escape(songTitle)}</div>
        <div class="text-secondary" style="font-size: 10px;">Focused in ProPresenter • Ready to Trigger</div>
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px) scale(0.95)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 350);
    }, 2800);
  }

  // =========================================================================
  // 5. MODAL LIFECYCLE & EVENT BINDINGS
  // =========================================================================

  /**
   * Opens the search modal and focuses input.
   */
  openModal() {
    if (!this.modalEl) return;
    this.isOpen = true;
    this.modalEl.style.display = 'flex';
    // Force reflow for CSS animation
    this.modalEl.offsetHeight;
    this.modalEl.classList.add('open');

    this.selectedIndex = -1;

    setTimeout(() => {
      if (this.inputEl) {
        this.inputEl.focus();
        this.inputEl.select();
      }
    }, 60);

    this.executeSearch();
  }

  /**
   * Closes the search modal.
   */
  closeModal() {
    if (!this.modalEl) return;
    this.isOpen = false;
    this.modalEl.classList.remove('open');
    setTimeout(() => {
      if (!this.isOpen) {
        this.modalEl.style.display = 'none';
      }
    }, 220);
  }

  /**
   * Clears the search input and re-runs search.
   */
  clearInput() {
    this.query = '';
    if (this.inputEl) {
      this.inputEl.value = '';
      this.inputEl.focus();
    }
    if (this.clearBtnEl) this.clearBtnEl.style.display = 'none';
    this.selectedIndex = -1;
    this.executeSearch();
  }

  /**
   * Binds UI event listeners (debounced input, tabs, buttons, dropdowns).
   */
  bindEvents() {
    // 1. Debounced Search Input (120ms)
    this.inputEl?.addEventListener('input', (e) => {
      const val = e.target.value;
      if (this.clearBtnEl) {
        this.clearBtnEl.style.display = val ? 'flex' : 'none';
      }

      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.query = val;
        this.selectedIndex = -1;
        this.executeSearch();
      }, this.debounceMs);
    });

    // 2. Clear Button
    this.clearBtnEl?.addEventListener('click', () => this.clearInput());

    // 3. Close Button & Backdrop Click
    this.closeBtnEl?.addEventListener('click', () => this.closeModal());
    this.modalEl?.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.closeModal();
      }
    });

    // 4. Mode Tabs
    document.querySelectorAll('.pro-search-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-mode');
        this.setMode(mode);
      });
    });

    // 5. Library Select Dropdown
    this.librarySelectEl?.addEventListener('change', (e) => {
      this.setLibraryFilter(e.target.value);
    });

    // 6. Filter Pill Remove Button
    this.filterRemoveBtnEl?.addEventListener('click', () => {
      this.resetFilters();
    });

    // 7. Reset Filters Button on Empty State
    this.resetFiltersBtnEl?.addEventListener('click', () => {
      this.resetFilters();
    });

    // 8. Open Search Modal Buttons in Header and Sidebar
    document.getElementById('headerSongSearchBtn')?.addEventListener('click', () => this.openModal());
    document.getElementById('sidebarMasterSearchBtn')?.addEventListener('click', () => this.openModal());
  }

  /**
   * Binds global keyboard shortcuts (Ctrl+K, Cmd+K, Escape, Arrows, Enter).
   */
  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Shortcut: Ctrl+K or Cmd+K to open/toggle search modal
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (this.isOpen) {
          this.closeModal();
        } else {
          this.openModal();
        }
        return;
      }

      // If modal is not open, ignore other shortcuts
      if (!this.isOpen) return;

      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeModal();
        return;
      }

      // Keyboard navigation in results grid (Down / Up / Enter)
      const cards = this.gridEl?.querySelectorAll('.pro-song-card') || [];
      if (!cards.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % cards.length;
        this.highlightSelectedCard(cards);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + cards.length) % cards.length;
        this.highlightSelectedCard(cards);
      } else if (e.key === 'Enter') {
        if (this.selectedIndex >= 0 && this.selectedIndex < cards.length) {
          e.preventDefault();
          cards[this.selectedIndex]?.click();
        } else if (cards.length > 0 && this.query) {
          // Trigger first result on enter if none explicitly highlighted
          e.preventDefault();
          cards[0]?.click();
        }
      }
    });
  }

  /**
   * Highlights the card at selectedIndex and scrolls it into view.
   * @param {NodeList} cards
   */
  highlightSelectedCard(cards) {
    cards.forEach((c, idx) => {
      if (idx === this.selectedIndex) {
        c.classList.add('selected');
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        c.classList.remove('selected');
      }
    });
  }

  /**
   * Updates footer indexing status text.
   * @param {string} text
   * @param {'connected'|'streaming'|'error'} status
   */
  setIndexingStatus(text, status) {
    if (!this.indexingStatusEl) return;
    const dot = this.indexingStatusEl.querySelector('.live-dot');
    const span = this.indexingStatusEl.querySelector('span:not(.live-dot)');
    if (dot) {
      dot.className = `live-dot ${status}`;
    }
    if (span) {
      span.textContent = text;
    }
  }

  /**
   * Escapes HTML characters for safe rendering.
   * @param {string} str
   * @returns {string}
   */
  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // =========================================================================
  // 6. COMPREHENSIVE OFFLINE / TESTING DATASET
  // =========================================================================

  /**
   * Provides a rich set of bilingual Christian worship songs across 4 standard
   * libraries for demo/offline verification when live ProPresenter is disconnected.
   * @returns {Array<Object>}
   */
  getFallbackLibraries() {
    return [
      {
        id: { uuid: 'lib-tamil-worship', name: 'Tamil Worship' },
        items: [
          { id: { uuid: 'song-tw-1', name: 'Yesu Nallavar - இயேசு நல்லவர்' }, author: 'Gersson Edinbaro' },
          { id: { uuid: 'song-tw-2', name: 'Aarathanai Velai / ஆராதனை வேளை' }, author: 'Father Berchmans' },
          { id: { uuid: 'song-tw-3', name: 'En Uyirana Yesu - என் உயிரான இயேசு' }, author: 'Father Berchmans' },
          { id: { uuid: 'song-tw-4', name: 'Nandri Solli Ummai - நன்றி சொல்லி உம்மை' }, author: 'Stephen Samuel' },
          { id: { uuid: 'song-tw-5', name: 'Naanum En Veetarumovendraal - நானும் என் வீட்டாருமோவென்றால்' }, author: 'John Jebaraj' },
          { id: { uuid: 'song-tw-6', name: 'Ummai Pola Yaarum Illai - உம்மை போல யாரும் இல்லை' }, author: 'David Reuban' },
          { id: { uuid: 'song-tw-7', name: 'Aathumavae Kartharai Thothirime - ஆத்துமாவே கர்த்தரை தோத்திரிமே' }, author: 'Alwin Thomas' },
          { id: { uuid: 'song-tw-8', name: 'Thaabangalum Thuyarangalum - தாபங்களும் துயரங்களும்' }, author: 'Father Berchmans' },
          { id: { uuid: 'song-tw-9', name: 'Magimai Maatchimai - மகிமை மாட்சிமை நிறைந்தவரே' }, author: 'Gersson Edinbaro' },
          { id: { uuid: 'song-tw-10', name: 'Karthar Mel Baarathai Vaithuvidu - கர்த்தர் மேல் பாரத்தை வைத்துவிடு' }, author: 'Paul Dhinakaran' },
          { id: { uuid: 'song-tw-11', name: 'Neer Sonnal Pothum - நீர் சொன்னால் போதும்' }, author: 'Gersson Edinbaro' },
          { id: { uuid: 'song-tw-12', name: 'Tholgalin Meethu Sumanthey - தோள்களின் மீது சுமந்தே' }, author: 'John Jebaraj' }
        ]
      },
      {
        id: { uuid: 'lib-english-praise', name: 'English Praise & Worship' },
        items: [
          { id: { uuid: 'song-ep-1', name: 'Goodness of God - தேவ தயவு' }, author: 'Bethel Music' },
          { id: { uuid: 'song-ep-2', name: 'Way Maker - வழி உருவாக்குபவர்' }, author: 'Sinach' },
          { id: { uuid: 'song-ep-3', name: '10,000 Reasons (Bless The Lord) - என் ஆத்துமாவே' }, author: 'Matt Redman' },
          { id: { uuid: 'song-ep-4', name: 'How Great Is Our God - தேவன் பெரியவர்' }, author: 'Chris Tomlin' },
          { id: { uuid: 'song-ep-5', name: 'What A Beautiful Name - என்ன ஒரு அழகான நாமம்' }, author: 'Hillsong Worship' },
          { id: { uuid: 'song-ep-6', name: 'King of Kings - ராஜாதி ராஜா' }, author: 'Hillsong Worship' },
          { id: { uuid: 'song-ep-7', name: 'Living Hope - ஜீவனுள்ள நம்பிக்கை' }, author: 'Phil Wickham' },
          { id: { uuid: 'song-ep-8', name: 'Great Are You Lord - நீர் பெரியவர் ஆண்டவரே' }, author: 'All Sons & Daughters' },
          { id: { uuid: 'song-ep-9', name: 'God Will Make A Way - தேவன் வழி செய்வார்' }, author: 'Don Moen' },
          { id: { uuid: 'song-ep-10', name: 'Praise You In This Storm - இந்த புயலிலும் உம்மை துதிப்பேன்' }, author: 'Casting Crowns' }
        ]
      },
      {
        id: { uuid: 'lib-youth-sunday', name: 'Youth & Contemporary' },
        items: [
          { id: { uuid: 'song-yc-1', name: 'Echo - எக்கோ' }, author: 'Elevation Worship' },
          { id: { uuid: 'song-yc-2', name: 'Graves Into Gardens - கல்லறைகள் தோட்டங்களாக' }, author: 'Elevation Worship' },
          { id: { uuid: 'song-yc-3', name: 'This Is Amazing Grace - இது ஆச்சரியமான கிருபை' }, author: 'Phil Wickham' },
          { id: { uuid: 'song-yc-4', name: 'Oceans (Where Feet May Fail) - கடலின் மேலே' }, author: 'Hillsong' },
          { id: { uuid: 'song-yc-5', name: 'Jireh (You Are Enough) - யேகோவாயீரே நீர் போதும்' }, author: 'Elevation Worship' },
          { id: { uuid: 'song-yc-6', name: 'Reckless Love - அளவற்ற அன்பு' }, author: 'Bethel Music' }
        ]
      },
      {
        id: { uuid: 'lib-choir-hymns', name: 'Choir & Traditional Hymns' },
        items: [
          { id: { uuid: 'song-ch-1', name: 'Amazing Grace - ஆச்சரியமான கிருபை' }, author: 'John Newton' },
          { id: { uuid: 'song-ch-2', name: 'How Great Thou Art - என் ஆண்டவா நீர் செய்த' }, author: 'Stuart Hine' },
          { id: { uuid: 'song-ch-3', name: 'It Is Well With My Soul - என் ஆத்துமாவே சுகமாய் இரு' }, author: 'Horatio Spafford' },
          { id: { uuid: 'song-ch-4', name: 'Great Is Thy Faithfulness - உந்தன் உண்மை பெரியது' }, author: 'Thomas Chisholm' },
          { id: { uuid: 'song-ch-5', name: 'Blessed Assurance - பேரின்ப பாக்கியம்' }, author: 'Fanny Crosby' }
        ]
      }
    ];
  }
}

// Export to window global scope
window.ProSongSearchController = ProSongSearchController;
