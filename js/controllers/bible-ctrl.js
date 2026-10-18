/**
 * @file bible-ctrl.js
 * @description Bible Presenter & Dynamic Parallel Comparison Controller.
 * Manages Cloudflare D1 Bible data retrieval, 1-to-3 version comparison grid,
 * common reference & keyword search, and ProPresenter live RSS feed integration.
 *
 * @version 1.0.0
 * @license MIT
 */

class BibleController {
  constructor() {
    this.selectedVersions = ['TAM'];
    this.availableVersions = [];
    this.books = [];
    this.currentBook = 'GEN';
    this.currentChapter = 1;
    this.currentVerse = null;
    this.versesData = [];
    this.activeLiveVerse = null;

    // DOM Elements
    this.v1Select = document.getElementById('bibleVersion1');
    this.v2Select = document.getElementById('bibleVersion2');
    this.v3Select = document.getElementById('bibleVersion3');
    this.bookSelect = document.getElementById('bibleBookSelect');
    this.chapterInput = document.getElementById('bibleChapterInput');
    this.verseInput = document.getElementById('bibleVerseInput');
    this.loadBtn = document.getElementById('bibleLoadBtn');
    this.prevChapterBtn = document.getElementById('biblePrevChapterBtn');
    this.nextChapterBtn = document.getElementById('bibleNextChapterBtn');

    // Search DOM
    this.searchInput = document.getElementById('bibleSearchInput');
    this.searchBtn = document.getElementById('bibleSearchBtn');

    // Table DOM
    this.tableHeaderRow = document.getElementById('bibleTableHeaderRow');
    this.tableBody = document.getElementById('bibleTableBody');
    this.tableWrapper = document.getElementById('bibleTableWrapper');
    this.tableStatusText = document.getElementById('bibleTableStatusText');

    // Live Badge & Actions
    this.liveBadge = document.getElementById('bibleActiveLiveBadge');
    this.liveRefText = document.getElementById('bibleActiveVerseRef');
    this.toggleRssSectionBtn = document.getElementById('bibleToggleRssSectionBtn');
    this.rssModalBtn = this.toggleRssSectionBtn || document.getElementById('bibleRssModalBtn');

    // Verse History DOM
    this.historyTray = document.getElementById('bibleHistoryTray');
    this.historyList = document.getElementById('bibleHistoryList');
    this.historyCount = document.getElementById('bibleHistoryCount');
    this.clearHistoryBtn = document.getElementById('bibleClearHistoryBtn');
    this.history = this.loadHistory();

    // ProPresenter RSS Feeds Modal Popup DOM
    this.rssModal = document.getElementById('bibleRssModal');
    this.rssModalVersionList = document.getElementById('rssModalVersionList');
    this.rssModalVersionCount = document.getElementById('rssModalVersionCount');
    this.rssModalActiveVerCode = document.getElementById('rssModalActiveVerCode');
    this.rssModalActiveVerName = document.getElementById('rssModalActiveVerName');
    this.rssModalActiveVerLang = document.getElementById('rssModalActiveVerLang');
    this.rssHostLanBtn = document.getElementById('rssHostLanBtn');
    this.rssHostLocalBtn = document.getElementById('rssHostLocalBtn');
    this.rssLanIpLabel = document.getElementById('rssLanIpLabel');
    this.rssFeedCardsRow = document.getElementById('rssFeedCardsRow');
    this.rssSelectedVersion = 'TAM';
    this.rssUseLan = true;
    this.networkInfo = null;

    // Feed Configuration Settings State & DOM
    this.feedConfig = {
      enabled: true,
      toggles: true,
      slides: 1,
      speed: 1,
      limit: 0
    };
    this.rssCfgMainToggle = document.getElementById('rssCfgMainToggle');
    this.rssCfgToggles = document.getElementById('rssCfgToggles');
    this.rssCfgSlides = document.getElementById('rssCfgSlides');
    this.rssCfgSlidesVal = document.getElementById('rssCfgSlidesVal');
    this.rssCfgSpeed = document.getElementById('rssCfgSpeed');
    this.rssCfgSpeedVal = document.getElementById('rssCfgSpeedVal');
    this.rssCfgLimit = document.getElementById('rssCfgLimit');
    this.rssCfgApplyBtn = document.getElementById('rssCfgApplyBtn');
  }

  /**
   * Initializes the Bible controller, loads metadata, and populates the initial view.
   */
  async init() {
    console.log('[BibleCtrl] Initializing Cloudflare D1 Bible Scripture Engine...');

    this.bindEvents();
    this.renderHistory();
    await this.loadVersions();
    await this.loadBooks();
    await this.loadRssInfo();
    await this.loadCurrentChapter();
  }

  /**
   * Loads available Bible versions from Node.js / D1 backend.
   */
  async loadVersions() {
    try {
      const res = await fetch('/api/bible/versions');
      const data = await res.json();
      if (data.success && Array.isArray(data.versions)) {
        this.availableVersions = data.versions;
        this.populateVersionDropdowns();
      }
    } catch (err) {
      console.error('[BibleCtrl] Failed to load versions:', err);
    }
  }

  /**
   * Populates the 3 version selection dropdowns.
   */
  populateVersionDropdowns() {
    const populate = (selectEl, defaultVal, isOptional = false) => {
      if (!selectEl) return;
      selectEl.innerHTML = '';

      if (isOptional) {
        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = '— None —';
        selectEl.appendChild(noneOpt);
      }

      this.availableVersions.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.version_code;
        opt.textContent = `${v.version_code} (${v.version_name})`;
        if (v.version_code === defaultVal) opt.selected = true;
        selectEl.appendChild(opt);
      });
    };

    populate(this.v1Select, 'TAM', false);
    populate(this.v2Select, '', true);
    populate(this.v3Select, '', true);
  }

  /**
   * Loads 66 books from Node.js / D1 backend and groups by Old / New Testament.
   */
  async loadBooks() {
    try {
      const res = await fetch('/api/bible/books?version=TAM');
      const data = await res.json();
      if (data.success && Array.isArray(data.books)) {
        this.books = data.books;
        this.populateBookDropdown();
      }
    } catch (err) {
      console.error('[BibleCtrl] Failed to load books:', err);
    }
  }

  /**
   * Populates the Book dropdown grouped by Testament.
   */
  populateBookDropdown() {
    if (!this.bookSelect) return;
    this.bookSelect.innerHTML = '';

    const otGroup = document.createElement('optgroup');
    otGroup.label = 'Old Testament (பழைய ஏற்பாடு)';

    const ntGroup = document.createElement('optgroup');
    ntGroup.label = 'New Testament (புதிய ஏற்பாடு)';

    this.books.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.book_global_id;
      opt.textContent = `${b.book_name} (${b.book_global_id})`;
      if (b.book_global_id === this.currentBook) opt.selected = true;

      if (b.testament_name === 'Old Testament') {
        otGroup.appendChild(opt);
      } else {
        ntGroup.appendChild(opt);
      }
    });

    this.bookSelect.appendChild(otGroup);
    this.bookSelect.appendChild(ntGroup);
  }

  /**
   * Gathers active version list from the 3 dropdowns (max 3).
   * @returns {Array<string>}
   */
  getActiveVersions() {
    const list = [];
    if (this.v1Select && this.v1Select.value) list.push(this.v1Select.value);
    if (this.v2Select && this.v2Select.value && !list.includes(this.v2Select.value)) list.push(this.v2Select.value);
    if (this.v3Select && this.v3Select.value && !list.includes(this.v3Select.value)) list.push(this.v3Select.value);
    return list.length > 0 ? list : ['TAM'];
  }

  /**
   * Loads verses for current book, chapter, and active versions.
   */
  async loadCurrentChapter() {
    this.selectedVersions = this.getActiveVersions();
    const book = this.currentBook;
    const chapter = this.currentChapter;
    const verse = this.currentVerse;

    this.setTableLoading(true);

    try {
      const queryParams = new URLSearchParams({
        versions: this.selectedVersions.join(','),
        book: book,
        chapter: chapter
      });
      if (verse) queryParams.set('verse', verse);

      const res = await fetch(`/api/bible/verses?${queryParams.toString()}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.rows)) {
        this.versesData = data.rows;
        this.renderParallelTable(data);
      } else {
        this.renderEmptyState(`No verses found for ${book} ${chapter}.`);
      }
    } catch (err) {
      console.error('[BibleCtrl] Error loading verses:', err);
      this.renderEmptyState(`Failed to load verses: ${err.message}`);
    } finally {
      this.setTableLoading(false);
    }
  }

  /**
   * Renders the dynamic parallel comparison table (1, 2, or 3 columns).
   * @param {Object} data
   */
  renderParallelTable(data) {
    if (!this.tableHeaderRow || !this.tableBody) return;

    const versions = data.requested_versions || this.selectedVersions;
    const totalCols = versions.length;

    // 1. Build Header
    this.tableHeaderRow.innerHTML = `
      <th class="col-verse-num text-center">#</th>
      ${versions.map(v => `
        <th class="col-version text-uppercase letter-spacing-1">
          <i class="fas fa-book-bible text-warning me-1"></i> ${v}
        </th>
      `).join('')}
      <th class="col-actions text-center">Action</th>
    `;

    // 2. Build Rows
    if (!data.rows || data.rows.length === 0) {
      this.renderEmptyState('No verses returned for this selection.');
      return;
    }

    this.tableBody.innerHTML = '';

    data.rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = 'verse-row';
      tr.dataset.verseNum = row.verse;

      // Check if this row is currently LIVE
      const isLive = this.activeLiveVerse &&
        this.activeLiveVerse.book === data.book &&
        this.activeLiveVerse.chapter === data.chapter &&
        this.activeLiveVerse.verse === row.verse;

      if (isLive) tr.classList.add('row-live');

      // Primary version for display fallback
      const primaryV = versions[0];
      const primaryInfo = row.versions[primaryV] || {};

      let html = `
        <td class="verse-num-cell">
          <span class="verse-num-badge">${row.verse}</span>
        </td>
      `;

      versions.forEach(v => {
        const vInfo = row.versions[v];
        const text = vInfo ? vInfo.text : '<span class="text-secondary opacity-50 fst-italic">Verse unavailable</span>';
        const isTamil = (vInfo && (v === 'TAM' || /[\u0B80-\u0BFF]/.test(text)));

        html += `
          <td class="verse-text-cell">
            <div class="verse-text-content ${isTamil ? 'lang-tamil' : ''}">${text}</div>
          </td>
        `;
      });

      html += `
        <td class="text-center align-middle">
          <button type="button" class="btn btn-sm ${isLive ? 'btn-warning text-dark fw-bold' : 'btn-outline-warning'} btn-verse-live" title="Push verse to Live Screen and RSS feed">
            <i class="fas ${isLive ? 'fa-check' : 'fa-paper-plane'} me-1"></i> ${isLive ? 'Live' : 'Present'}
          </button>
        </td>
      `;

      tr.innerHTML = html;

      // Row click or Present button click handler
      tr.addEventListener('click', (e) => {
        this.presentVerse(row, data.book, data.chapter, primaryInfo.book_name);
      });

      this.tableBody.appendChild(tr);
    });

    if (this.tableStatusText) {
      const currentBookObj = this.books.find(b => b.book_global_id === data.book);
      const bookTitle = currentBookObj ? currentBookObj.book_name : data.book;
      this.tableStatusText.textContent = `${bookTitle} ${data.chapter} (${data.total_verses} verses in ${versions.join(', ')})`;
    }
  }

  /**
   * Triggers a verse to Live Screen, updates live state on server, and glows row.
   * @param {Object} row
   * @param {string} bookGlobalId
   * @param {number} chapter
   * @param {string} bookName
   */
  async presentVerse(row, bookGlobalId, chapter, bookName) {
    const versions = this.selectedVersions;
    const primaryV = versions[0] || 'TAM';
    const primaryText = row.versions[primaryV] ? row.versions[primaryV].text : '';
    const resolvedName = (row.versions[primaryV] && row.versions[primaryV].book_name) || bookName || bookGlobalId;

    const liveData = {
      version: primaryV,
      book: bookGlobalId,
      book_name: resolvedName,
      chapter: chapter,
      verse: row.verse,
      verse_text: primaryText,
      all_versions: row.versions
    };

    this.activeLiveVerse = liveData;

    // Update active row visual glow
    document.querySelectorAll('#bibleTableBody tr').forEach(r => {
      r.classList.remove('row-live');
      const btn = r.querySelector('.btn-verse-live');
      if (btn) {
        btn.className = 'btn btn-sm btn-outline-warning btn-verse-live';
        btn.innerHTML = '<i class="fas fa-paper-plane me-1"></i> Present';
      }
    });

    const activeRow = document.querySelector(`#bibleTableBody tr[data-verse-num="${row.verse}"]`);
    if (activeRow) {
      activeRow.classList.add('row-live');
      const btn = activeRow.querySelector('.btn-verse-live');
      if (btn) {
        btn.className = 'btn btn-sm btn-warning text-dark fw-bold btn-verse-live';
        btn.innerHTML = '<i class="fas fa-check me-1"></i> Live';
      }
    }

    // Update Header Live Badge
    if (this.liveRefText) {
      this.liveRefText.textContent = `${resolvedName} ${chapter}:${row.verse}`;
    }

    // Add to Verse History and refresh history tray
    this.addToHistory(liveData);

    // Update RSS Hub previews in real-time if open
    if (this.rssHubSection && this.rssHubSection.style.display !== 'none') {
      this.renderRssCards();
    }

    // Sync live state to Node.js backend for the dynamic live RSS feed
    try {
      await fetch('/api/bible/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(liveData)
      });
    } catch (err) {
      console.warn('[BibleCtrl] Live state sync warning:', err);
    }
  }

  // =========================================================================
  // VERSE HISTORY MANAGEMENT (Tracks Clicked & Presented Verses)
  // =========================================================================

  /**
   * Loads verse click history from localStorage.
   * @returns {Array<Object>}
   */
  loadHistory() {
    try {
      const saved = localStorage.getItem('proPresenterBibleVerseHistory');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn('[BibleCtrl] Failed to load history from storage:', e);
      return [];
    }
  }

  /**
   * Saves history to localStorage and updates UI.
   */
  saveHistory() {
    try {
      localStorage.setItem('proPresenterBibleVerseHistory', JSON.stringify(this.history));
    } catch (e) {
      console.warn('[BibleCtrl] Failed to save history to storage:', e);
    }
    this.renderHistory();
  }

  /**
   * Adds a clicked/presented verse to history tray.
   * Deduplicates by book, chapter, verse and moves to front.
   * @param {Object} verseData
   */
  addToHistory(verseData) {
    if (!verseData || !verseData.book || !verseData.chapter || !verseData.verse) return;

    // Filter out existing duplicate
    this.history = this.history.filter(item =>
      !(item.book === verseData.book &&
        item.chapter === verseData.chapter &&
        item.verse === verseData.verse &&
        item.version === verseData.version)
    );

    // Push newest to front
    this.history.unshift({
      book: verseData.book,
      book_name: verseData.book_name,
      chapter: verseData.chapter,
      verse: verseData.verse,
      version: verseData.version,
      verse_text: (verseData.verse_text || '').substring(0, 120),
      timestamp: new Date().toISOString()
    });

    // Limit to 30 items
    if (this.history.length > 30) {
      this.history = this.history.slice(0, 30);
    }

    this.saveHistory();
  }

  /**
   * Removes a single history item by index.
   * @param {number} index
   * @param {Event} [event]
   */
  removeFromHistory(index, event) {
    if (event) event.stopPropagation();
    if (index >= 0 && index < this.history.length) {
      this.history.splice(index, 1);
      this.saveHistory();
    }
  }

  /**
   * Clears all verse history.
   */
  clearHistory() {
    this.history = [];
    this.saveHistory();
  }

  /**
   * Renders the interactive history pills in the Verse History section.
   */
  renderHistory() {
    if (!this.historyList) return;

    if (this.historyCount) {
      this.historyCount.textContent = this.history.length;
    }

    if (this.history.length === 0) {
      this.historyList.innerHTML = `
        <span class="text-secondary small fst-italic bible-history-empty" style="font-size: 11px;">
          No verse clicked yet. Click any verse to trigger live and add to history.
        </span>
      `;
      return;
    }

    this.historyList.innerHTML = '';

    this.history.forEach((item, idx) => {
      const pill = document.createElement('div');
      pill.className = 'bible-history-pill';
      pill.title = `${item.book_name} ${item.chapter}:${item.verse} (${item.version})\n"${item.verse_text}"\nClick to present immediately`;

      const isCurrentLive = this.activeLiveVerse &&
        this.activeLiveVerse.book === item.book &&
        this.activeLiveVerse.chapter === item.chapter &&
        this.activeLiveVerse.verse === item.verse;

      if (isCurrentLive) pill.classList.add('is-active');

      const refLabel = `${item.book_name || item.book} ${item.chapter}:${item.verse}`;

      pill.innerHTML = `
        <i class="fas fa-play text-warning" style="font-size: 8.5px;"></i>
        <span class="pill-ref">${refLabel}</span>
        <span class="pill-ver">${item.version}</span>
        <span class="pill-remove" title="Remove from history">&times;</span>
      `;

      // Click pill -> Navigate & present
      pill.addEventListener('click', async (e) => {
        if (e.target.classList.contains('pill-remove')) return;
        await this.handleHistorySelect(item);
      });

      // Click close icon
      const removeBtn = pill.querySelector('.pill-remove');
      removeBtn?.addEventListener('click', (e) => {
        this.removeFromHistory(idx, e);
      });

      this.historyList.appendChild(pill);
    });
  }

  /**
   * Handles clicking on a history item to re-trigger that verse to Live Screen.
   * @param {Object} item
   */
  async handleHistorySelect(item) {
    this.currentBook = item.book;
    this.currentChapter = item.chapter;
    this.currentVerse = item.verse;

    if (this.bookSelect) this.bookSelect.value = item.book;
    if (this.chapterInput) this.chapterInput.value = item.chapter;
    if (this.verseInput) this.verseInput.value = item.verse;

    // Load the chapter if needed
    await this.loadCurrentChapter();

    // Find row in table
    const targetRow = this.versesData.find(r => r.verse === item.verse);
    if (targetRow) {
      this.presentVerse(targetRow, item.book, item.chapter, item.book_name);
    } else {
      const mockRow = {
        verse: item.verse,
        versions: { [item.version]: { book_name: item.book_name, text: item.verse_text } }
      };
      this.presentVerse(mockRow, item.book, item.chapter, item.book_name);
    }

    // Scroll to the row in view
    setTimeout(() => {
      const activeEl = document.querySelector(`#bibleTableBody tr[data-verse-num="${item.verse}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  /**
   * Executes Common Search (Free Search) supporting flexible reference or keyword matching.
   */
  async handleSearch() {
    if (!this.searchInput) return;
    const q = this.searchInput.value.trim();
    if (!q) return;

    this.setTableLoading(true);

    try {
      const activeVerses = this.getActiveVersions().join(',');
      const res = await fetch(`/api/bible/search?q=${encodeURIComponent(q)}&versions=${activeVerses}`);
      const data = await res.json();

      if (!data.success) {
        this.renderEmptyState(`Search error: ${data.error || 'Unknown error'}`);
        return;
      }

      if (data.type === 'reference' && data.data) {
        // Matched reference! Update controls to match
        this.currentBook = data.matched_book;
        this.currentChapter = data.chapter;
        this.currentVerse = data.verse;
        if (this.bookSelect) this.bookSelect.value = data.matched_book;
        if (this.chapterInput) this.chapterInput.value = data.chapter;
        if (this.verseInput) this.verseInput.value = data.verse || '';

        this.versesData = data.data.rows || [];
        this.renderParallelTable(data.data);

        // If a specific verse was requested (e.g. Gen 1 1, Gen1:1, 1Cor 13 4), auto-present it live!
        if (data.verse && this.versesData.length > 0) {
          const matchRow = this.versesData.find(r => r.verse === data.verse) || this.versesData[0];
          const primaryV = (data.data.requested_versions || this.selectedVersions)[0] || 'TAM';
          const bookName = (matchRow.versions && matchRow.versions[primaryV]?.book_name) || data.matched_book;
          this.presentVerse(matchRow, data.matched_book, data.chapter, bookName);

          // Scroll into view
          setTimeout(() => {
            const activeEl = document.querySelector(`#bibleTableBody tr[data-verse-num="${data.verse}"]`);
            if (activeEl) {
              activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        }
      } else if (data.type === 'keyword' && Array.isArray(data.results)) {
        // Keyword Search Results
        this.renderKeywordResults(data);
      } else {
        this.renderEmptyState(`No matches found for "${q}".`);
      }
    } catch (err) {
      console.error('[BibleCtrl] Search failed:', err);
      this.renderEmptyState(`Search failed: ${err.message}`);
    } finally {
      this.setTableLoading(false);
    }
  }

  /**
   * Renders keyword search results list.
   * @param {Object} data
   */
  renderKeywordResults(data) {
    if (!this.tableHeaderRow || !this.tableBody) return;

    this.tableHeaderRow.innerHTML = `
      <th style="width: 140px;">Reference</th>
      <th>Scripture Text (${data.version})</th>
      <th style="width: 90px;" class="text-center">Action</th>
    `;

    if (!data.results || data.results.length === 0) {
      this.renderEmptyState(`No verses found containing "${data.query}".`);
      return;
    }

    this.tableBody.innerHTML = '';

    data.results.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = 'verse-row';

      const refText = `${r.book_name} ${r.chapter}:${r.verse}`;

      tr.innerHTML = `
        <td class="align-middle">
          <span class="badge bg-dark border border-secondary text-warning font-mono">${refText}</span>
        </td>
        <td class="verse-text-cell">
          <div class="verse-text-content lang-tamil">${r.verse_text}</div>
        </td>
        <td class="text-center align-middle">
          <button type="button" class="btn btn-sm btn-outline-warning btn-verse-live">
            <i class="fas fa-paper-plane me-1"></i> Live
          </button>
        </td>
      `;

      tr.addEventListener('click', () => {
        this.currentBook = r.book_global_id;
        this.currentChapter = r.chapter;
        this.currentVerse = r.verse;
        if (this.bookSelect) this.bookSelect.value = r.book_global_id;
        if (this.chapterInput) this.chapterInput.value = r.chapter;
        if (this.verseInput) this.verseInput.value = r.verse;

        const rowMock = {
          verse: r.verse,
          versions: { [r.version]: { book_name: r.book_name, text: r.verse_text } }
        };
        this.presentVerse(rowMock, r.book_global_id, r.chapter, r.book_name);
      });

      this.tableBody.appendChild(tr);
    });

    if (this.tableStatusText) {
      this.tableStatusText.textContent = `Found ${data.total_found} verses matching "${data.query}"`;
    }
  }

  /**
   * Renders empty state inside table wrapper.
   * @param {string} msg
   */
  renderEmptyState(msg) {
    if (this.tableBody) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="p-4 text-center text-secondary">
            <i class="fas fa-book-open-reader fa-2x mb-2 opacity-50"></i>
            <p class="mb-0 small">${msg}</p>
          </td>
        </tr>
      `;
    }
  }

  /**
   * Sets loading spinner in table status.
   * @param {boolean} loading
   */
  setTableLoading(loading) {
    if (this.loadBtn) {
      this.loadBtn.disabled = loading;
      this.loadBtn.innerHTML = loading
        ? '<i class="fas fa-spinner fa-spin"></i>'
        : '<i class="fas fa-book-open me-1"></i> Load';
    }
  }

  /**
   * Binds all user interaction handlers.
   */
  bindEvents() {
    // Version dropdown changes &rarr; refetch and re-flex table
    [this.v1Select, this.v2Select, this.v3Select].forEach(sel => {
      sel?.addEventListener('change', () => this.loadCurrentChapter());
    });

    // Book dropdown change
    this.bookSelect?.addEventListener('change', () => {
      this.currentBook = this.bookSelect.value;
      this.currentChapter = 1;
      this.currentVerse = null;
      if (this.chapterInput) this.chapterInput.value = 1;
      if (this.verseInput) this.verseInput.value = '';
      this.loadCurrentChapter();
    });

    // Chapter decrement/increment
    this.prevChapterBtn?.addEventListener('click', () => {
      if (this.currentChapter > 1) {
        this.currentChapter--;
        if (this.chapterInput) this.chapterInput.value = this.currentChapter;
        this.loadCurrentChapter();
      }
    });

    this.nextChapterBtn?.addEventListener('click', () => {
      this.currentChapter++;
      if (this.chapterInput) this.chapterInput.value = this.currentChapter;
      this.loadCurrentChapter();
    });

    // Chapter input blur/enter
    this.chapterInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = parseInt(this.chapterInput.value, 10);
        if (val > 0) {
          this.currentChapter = val;
          this.loadCurrentChapter();
        }
      }
    });

    // Verse input Enter
    this.verseInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = this.verseInput.value ? parseInt(this.verseInput.value, 10) : null;
        this.currentVerse = val;
        this.loadCurrentChapter();
      }
    });

    // Load button
    this.loadBtn?.addEventListener('click', () => {
      this.currentBook = this.bookSelect ? this.bookSelect.value : 'GEN';
      this.currentChapter = this.chapterInput ? (parseInt(this.chapterInput.value, 10) || 1) : 1;
      this.currentVerse = this.verseInput && this.verseInput.value ? parseInt(this.verseInput.value, 10) : null;
      this.loadCurrentChapter();
    });

    // Search input Enter & search button
    this.searchBtn?.addEventListener('click', () => this.handleSearch());
    this.searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSearch();
    });

    // Clear History button
    this.clearHistoryBtn?.addEventListener('click', () => this.clearHistory());

    // Clear Scripture action
    document.getElementById('bibleClearScreenBtn')?.addEventListener('click', () => {
      this.activeLiveVerse = null;
      if (this.liveRefText) this.liveRefText.textContent = 'Screen Cleared';
      document.querySelectorAll('#bibleTableBody tr').forEach(r => r.classList.remove('row-live'));
      document.querySelectorAll('.bible-history-pill').forEach(p => p.classList.remove('is-active'));

      // Sync clear to live RSS
      fetch('/api/bible/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 'TAM',
          book: '',
          book_name: '',
          chapter: 0,
          verse: 0,
          verse_text: ''
        })
      }).catch(() => {});
    });

    // ProPresenter RSS Feeds Modal Popup open & host buttons
    this.toggleRssSectionBtn?.addEventListener('click', () => {
      this.showRssModal();
    });

    // RSS Host Switcher (Church LAN IP vs Localhost)
    this.rssHostLanBtn?.addEventListener('click', () => this.setRssHostMode(true));
    this.rssHostLocalBtn?.addEventListener('click', () => this.setRssHostMode(false));

    // Feed Configuration Settings Popover controls
    this.rssCfgSlides?.addEventListener('input', (e) => {
      if (this.rssCfgSlidesVal) this.rssCfgSlidesVal.textContent = e.target.value;
    });
    this.rssCfgSpeed?.addEventListener('input', (e) => {
      if (this.rssCfgSpeedVal) this.rssCfgSpeedVal.textContent = `${e.target.value}s`;
    });
    this.rssCfgApplyBtn?.addEventListener('click', () => {
      this.applyFeedConfigSettings();
    });
    this.rssCfgMainToggle?.addEventListener('change', () => {
      this.feedConfig.enabled = !!this.rssCfgMainToggle.checked;
      this.renderRssCards();
    });
    this.rssCfgToggles?.addEventListener('change', () => {
      this.feedConfig.toggles = !!this.rssCfgToggles.checked;
      this.renderRssCards();
    });

    // Global Keyboard Shortcuts (Ctrl+B / Cmd+B and '/') for Bible Search
    window.addEventListener('keydown', (e) => {
      // Shortcut 1: Ctrl+B or Cmd+B to instantly switch to Bible View and focus search input
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (typeof window.setWorkspaceView === 'function') {
          window.setWorkspaceView('bible');
        }
        if (this.searchInput) {
          this.searchInput.focus();
          this.searchInput.select();
        }
        return;
      }

      // Shortcut 2: Forward slash '/' to focus Bible search when in Bible view and not typing in an input
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        const bibleSection = document.getElementById('middleRow3Bible');
        if (bibleSection && !bibleSection.classList.contains('d-none')) {
          e.preventDefault();
          this.searchInput?.focus();
          this.searchInput?.select();
        }
      }
    });
  }

  // =========================================================================
  // 5. PROPRESENTER DYNAMIC RSS FEEDS HUB METHODS
  // =========================================================================

  /**
   * Fetches server metadata (LAN IP addresses, available versions, port).
   */
  async loadRssInfo() {
    try {
      const res = await fetch('/api/bible/rss-info');
      const data = await res.json();
      if (data.success) {
        this.networkInfo = data;
        if (this.rssLanIpLabel) {
          this.rssLanIpLabel.textContent = data.primaryLanIp || window.location.hostname;
        }
        this.renderRssVersionTabs();
        this.renderRssCards();
      }
    } catch (err) {
      console.warn('[BibleCtrl] Failed to load RSS network info:', err);
    }
  }

  /**
   * Renders the left sidebar list of Bible versions in the popup modal.
   * Matches user reference mockup (KJV, TAM, etc.).
   */
  renderRssVersionSidebar() {
    const versions = (this.networkInfo && this.networkInfo.versions) || this.availableVersions || [
      { code: 'KJV', name: 'King James Version', language: 'English' },
      { code: 'TAM', name: 'Tamil Bible', language: 'Tamil' }
    ];

    if (!this.rssModalVersionList) return;
    this.rssModalVersionList.innerHTML = '';

    versions.forEach(v => {
      const isSel = v.code === this.rssSelectedVersion;
      const item = document.createElement('div');
      item.className = `rss-version-item ${isSel ? 'active' : ''}`;
      item.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <span class="rss-version-code-badge">${v.code}</span>
          <div>
            <strong class="d-block text-white" style="font-size: 13px;">${v.name || v.code}</strong>
            <span class="text-secondary" style="font-size: 11px;">${v.language || ''}</span>
          </div>
        </div>
        <i class="fas ${isSel ? 'fa-circle-check text-warning' : 'fa-chevron-right text-secondary'} small" style="${isSel ? 'font-size: 14px;' : 'font-size: 12px;'}"></i>
      `;
      item.addEventListener('click', () => {
        this.rssSelectedVersion = v.code;
        this.renderRssVersionSidebar();
        this.renderRssCards();
      });
      this.rssModalVersionList.appendChild(item);
    });
  }

  // Alias for backward compatibility
  renderRssVersionTabs() {
    this.renderRssVersionSidebar();
  }

  /**
   * Sets host mode: true for Church LAN IP, false for Localhost.
   * @param {boolean} useLan
   */
  setRssHostMode(useLan) {
    this.rssUseLan = useLan;
    if (this.rssHostLanBtn && this.rssHostLocalBtn) {
      if (useLan) {
        this.rssHostLanBtn.className = 'rss-host-pill-btn active';
        this.rssHostLocalBtn.className = 'rss-host-pill-btn';
      } else {
        this.rssHostLanBtn.className = 'rss-host-pill-btn';
        this.rssHostLocalBtn.className = 'rss-host-pill-btn active';
      }
    }
    this.renderRssCards();
  }

  /**
   * Applies Feed Configuration Settings and updates feed URLs and preview text.
   */
  applyFeedConfigSettings() {
    this.feedConfig.enabled = this.rssCfgMainToggle ? this.rssCfgMainToggle.checked : true;
    this.feedConfig.toggles = this.rssCfgToggles ? this.rssCfgToggles.checked : true;
    this.feedConfig.slides = this.rssCfgSlides ? (parseInt(this.rssCfgSlides.value, 10) || 1) : 1;
    this.feedConfig.speed = this.rssCfgSpeed ? (parseInt(this.rssCfgSpeed.value, 10) || 1) : 1;
    this.feedConfig.limit = this.rssCfgLimit ? (parseInt(this.rssCfgLimit.value, 10) || 0) : 0;

    // Save to localStorage for convenience
    try {
      localStorage.setItem('proPresenterFeedConfig', JSON.stringify(this.feedConfig));
    } catch (e) {}

    this.renderRssCards();

    // Visual button feedback
    if (this.rssCfgApplyBtn) {
      const origText = this.rssCfgApplyBtn.textContent;
      this.rssCfgApplyBtn.textContent = 'Applied ✓';
      this.rssCfgApplyBtn.style.background = '#ff9f0a';
      this.rssCfgApplyBtn.style.color = '#000000';
      setTimeout(() => {
        this.rssCfgApplyBtn.textContent = origText;
        this.rssCfgApplyBtn.style.background = '#ffffff';
        this.rssCfgApplyBtn.style.color = '#000000';
      }, 1200);
    }
  }

  /**
   * Renders the 3 set of RSS feed cards for the selected version in the right part.
   * Matches exact layout and tags of user's reference mockup.
   */
  renderRssCards() {
    if (!this.rssFeedCardsRow) return;

    const proto = window.location.protocol;
    const port = (this.networkInfo && this.networkInfo.port) || window.location.port || '8080';
    const host = this.rssUseLan && this.networkInfo && this.networkInfo.primaryLanIp
      ? `${this.networkInfo.primaryLanIp}:${port}`
      : window.location.host;
    const baseUrl = `${proto}//${host}`;
    const ver = this.rssSelectedVersion || 'KJV';

    // Update active version header banner in right part
    const versions = (this.networkInfo && this.networkInfo.versions) || this.availableVersions || [
      { code: 'KJV', name: 'King James Version', language: 'English' },
      { code: 'TAM', name: 'Tamil Bible', language: 'Tamil' }
    ];
    const activeVerObj = versions.find(v => v.code === ver) || { code: ver, name: ver, language: '' };
    if (this.rssModalActiveVerName) this.rssModalActiveVerName.textContent = activeVerObj.name || activeVerObj.code;
    if (this.rssModalActiveVerLang) this.rssModalActiveVerLang.textContent = `Language: ${activeVerObj.language || activeVerObj.code}`;

    // Helper to build feed URL query parameters reflecting Feed Configuration Settings
    const buildFeedUrl = (type) => {
      const params = [];
      if (type) params.push(`type=${encodeURIComponent(type)}`);

      if (this.feedConfig && this.feedConfig.enabled) {
        if (!this.feedConfig.toggles) params.push('toggles=0');
        if (this.feedConfig.slides > 1) params.push(`slides=${this.feedConfig.slides}`);
        if (this.feedConfig.speed > 1) params.push(`speed=${this.feedConfig.speed}`);
        if (this.feedConfig.limit > 0) params.push(`limit=${this.feedConfig.limit}`);
      }

      const qs = params.length > 0 ? `?${params.join('&')}` : '';
      return `${baseUrl}/api/bible/rss/${encodeURIComponent(ver)}${qs}`;
    };

    // Current verse details for live preview
    const live = this.activeLiveVerse || {
      book_name: ver === 'TAM' ? 'சங்கீதம்' : 'Psalms',
      chapter: 23,
      verse: 2,
      verse_text: ver === 'TAM'
        ? 'அவர் என்னைப் புல்லுள்ள இடங்களில் மேய்த்து, அமர்ந்த தண்ணீர்கள் அண்டையில் என்னைக் கொண்டுபோய்விடுகிறார்.'
        : 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.'
    };

    // Determine version-specific text & reference preview
    let liveBook = live.book_name;
    let liveText = live.verse_text;
    if (live.all_versions && live.all_versions[ver]) {
      liveBook = live.all_versions[ver].book_name || liveBook;
      liveText = live.all_versions[ver].text || liveText;
    } else if (ver === 'KJV' && live.version !== 'KJV') {
      liveBook = 'Psalms';
      liveText = 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.';
    }

    // Apply feed configuration formatting to live preview text
    let formattedPreviewText = liveText || 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.';
    if (this.feedConfig && this.feedConfig.enabled) {
      if (!this.feedConfig.toggles) {
        // Strip verse numbers
        formattedPreviewText = formattedPreviewText.replace(/^\d+[\s.:]*/, '').trim();
      }
      if (this.feedConfig.limit > 0 && formattedPreviewText.length > this.feedConfig.limit) {
        // Scripture limit
        formattedPreviewText = formattedPreviewText.substring(0, this.feedConfig.limit).trim() + '...';
      }
    }

    const ref = `${liveBook || 'Psalms'} ${live.chapter || 23}:${live.verse || 2}`;
    const txt = formattedPreviewText;

    const feeds = [
      {
        id: 'full',
        title: '1. Full Verse Feed',
        badge: 'Reference (Title) + Scripture (Description)',
        desc: 'ProPresenter receives Reference citation in &lt;title&gt; and raw Scripture text in &lt;description&gt;.',
        url: buildFeedUrl(''),
        previewTitle: ref,
        previewDesc: txt,
        recommended: 'Custom Templates / Lower Thirds'
      },
      {
        id: 'verse',
        title: '2. Verse Text Only Feed',
        badge: 'Title = Scripture Text Only',
        desc: 'Places raw scripture verse text directly into &lt;title&gt;. Ideal for ProPresenter primary scripture text layer!',
        url: buildFeedUrl('verse'),
        previewTitle: txt,
        previewDesc: txt,
        recommended: 'Main Screen Scripture Text Box'
      },
      {
        id: 'ref',
        title: '3. Reference Citation Only Feed',
        badge: 'Title = Reference Citation Only',
        desc: 'Places citation reference directly into &lt;title&gt;. Perfect for lower-third citation badge or subtitle layer.',
        url: buildFeedUrl('reference'),
        previewTitle: ref,
        previewDesc: ref,
        recommended: 'Lower-third citation badge or subtitle layer'
      }
    ];

    this.rssFeedCardsRow.innerHTML = feeds.map(f => `
      <div class="rss-feed-card">
        <div>
          <div class="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
            <div class="d-flex align-items-center">
              <strong class="text-white small fw-bold">${f.title}</strong>
              <span class="rss-pill-badge-orange ms-2">${f.badge}</span>
            </div>
            <span class="rss-best-for-text">
              <i class="fas fa-star me-1"></i>Best for: <span>${f.recommended}</span>
            </span>
          </div>
          <p class="text-secondary mb-1" style="font-size: 11.5px; line-height: 1.35;">${f.desc}</p>
          
          <!-- Live Preview Box (Exact Mockup Match) -->
          <div class="rss-preview-box">
            <div class="text-truncate">
              <strong class="text-secondary">&lt;TITLE&gt;: </strong><span class="rss-preview-title">${f.previewTitle}</span>
            </div>
            <div class="text-truncate">
              <strong class="text-secondary">&lt;DESCRIPTION&gt;: </strong><span>${f.previewDesc}</span>
            </div>
          </div>
        </div>

        <!-- URL Input and Copy Button -->
        <div class="mt-2">
          <div class="input-group input-group-sm">
            <input type="text" class="form-control rss-url-input" value="${f.url}" readonly id="rssUrl_${f.id}_${ver}">
            <button class="btn btn-rss-copy copy-rss-btn" data-url="${f.url}" title="Copy URL for ProPresenter">
              <i class="fas fa-copy"></i> Copy URL
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Attach copy button listeners with instant visual feedback
    this.rssFeedCardsRow.querySelectorAll('.copy-rss-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.getAttribute('data-url');
        if (!url) return;
        try {
          await navigator.clipboard.writeText(url);
          const origHtml = btn.innerHTML;
          btn.style.background = '#10b981';
          btn.style.color = '#ffffff';
          btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
          setTimeout(() => {
            btn.style.background = '#f59e0b';
            btn.style.color = '#000000';
            btn.innerHTML = origHtml;
          }, 2000);
        } catch (err) {
          const input = btn.previousElementSibling;
          if (input) {
            input.select();
            document.execCommand('copy');
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copy URL'; }, 2000);
          }
        }
      });
    });
  }

  /**
   * Opens the ProPresenter RSS configuration modal popup.
   */
  showRssModal() {
    this.renderRssVersionSidebar();
    this.renderRssCards();
    if (window.bootstrap && window.bootstrap.Modal) {
      const modalEl = document.getElementById('bibleRssModal');
      if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
      }
    }
  }

  // Alias for backward compatibility
  toggleRssHubSection() {
    this.showRssModal();
  }
}

// Instantiate and expose globally
window.BibleController = BibleController;
