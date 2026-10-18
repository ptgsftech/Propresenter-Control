/**
 * @file bible-service.js
 * @description Cloudflare D1 Bible Engine & RSS Feed Generator for ProPresenter Studio.
 * Handles parallel multi-version queries, reference parsing, full-text keyword searches,
 * and standards-compliant RSS 2.0 feeds for ProPresenter dynamic text layers.
 *
 * @version 1.0.0
 * @license MIT
 */

const BOOK_ALIASES = {
  // Old Testament
  'GEN': ['GEN', 'GENESIS', 'ஆதியாகமம்', 'ஆதி'],
  'EXO': ['EXO', 'EXODUS', 'யாத்திராகமம்', 'யாத்'],
  'LEV': ['LEV', 'LEVITICUS', 'லேவியராகமம்', 'லேவி'],
  'NUM': ['NUM', 'NUMBERS', 'எண்ணாகமம்', 'எண்'],
  'DEU': ['DEU', 'DEUTERONOMY', 'உபாகமம்', 'உபா'],
  'JOS': ['JOS', 'JOSHUA', 'யோசுவா', 'யோசு'],
  'JDG': ['JDG', 'JUDGES', 'நியாயாதிபதிகள்', 'நியா'],
  'RUT': ['RUT', 'RUTH', 'ரூத்'],
  '1SA': ['1SA', '1 SAMUEL', '1SAMUEL', '1 சாமுவேல்', '1சாமு'],
  '2SA': ['2SA', '2 SAMUEL', '2SAMUEL', '2 சாமுவேல்', '2சாமு'],
  '1KI': ['1KI', '1 KINGS', '1KINGS', '1 இராஜாக்கள்', '1இரா'],
  '2KI': ['2KI', '2 KINGS', '2KINGS', '2 இராஜாக்கள்', '2இரா'],
  '1CH': ['1CH', '1 CHRONICLES', '1CHRONICLES', '1 நாளாகமம்', '1நாளா'],
  '2CH': ['2CH', '2 CHRONICLES', '2CHRONICLES', '2 நாளாகமம்', '2நாளா'],
  'EZR': ['EZR', 'EZRA', 'எஸ்றா'],
  'NEH': ['NEH', 'NEHEMIAH', 'நெகேமியா'],
  'EST': ['EST', 'ESTHER', 'எஸ்தர்'],
  'JOB': ['JOB', 'யோபு'],
  'PSA': ['PSA', 'PSALM', 'PSALMS', 'சங்கீதம்', 'சங்'],
  'PRO': ['PRO', 'PROVERBS', 'நீதிமொழிகள்', 'நீதி'],
  'ECC': ['ECC', 'ECCLESIASTES', 'பிரசங்கி'],
  'SNG': ['SNG', 'SONG OF SOLOMON', 'CANTICLES', 'உன்னதப்பாட்டு', 'உன்ன'],
  'ISA': ['ISA', 'ISAIAH', 'ஏசாயா'],
  'JER': ['JER', 'JEREMIAH', 'எரேமியா'],
  'LAM': ['LAM', 'LAMENTATIONS', 'புலம்பல்'],
  'EZK': ['EZK', 'EZEKIEL', 'எசேக்கியேல்'],
  'DAN': ['DAN', 'DANIEL', 'தானியேல்'],
  'HOS': ['HOS', 'HOSEA', 'ஓசியா'],
  'JOL': ['JOL', 'JOEL', 'யோவேல்'],
  'AMO': ['AMO', 'AMOS', 'ஆமோஸ்'],
  'OBA': ['OBA', 'OBADIAH', 'ஒபதியா'],
  'JON': ['JON', 'JONAH', 'யோனா'],
  'MIC': ['MIC', 'MICAH', 'மீகா'],
  'NAM': ['NAM', 'NAHUM', 'நாகூம்'],
  'HAB': ['HAB', 'HABAKKUK', 'ஆபகூக்'],
  'ZEP': ['ZEP', 'ZEPHANIAH', 'செப்பனியா'],
  'HAG': ['HAG', 'HAGGAI', 'ஆகாய்'],
  'ZEC': ['ZEC', 'ZECHARIAH', 'சகரியா'],
  'MAL': ['MAL', 'MALACHI', 'மல்கியா'],

  // New Testament
  'MAT': ['MAT', 'MATTHEW', 'மத்தேயு', 'மத்'],
  'MRK': ['MRK', 'MARK', 'மாற்கு', 'மாற்'],
  'LUK': ['LUK', 'LUKE', 'லூக்கா', 'லூக்'],
  'JHN': ['JHN', 'JOHN', 'யோவான்', 'யோவா'],
  'ACT': ['ACT', 'ACTS', 'அப்போஸ்தலர்', 'அப்'],
  'ROM': ['ROM', 'ROMANS', 'ரோமர்', 'ரோம'],
  '1CO': ['1CO', '1 CORINTHIANS', '1CORINTHIANS', '1 கொரிந்தியர்', '1கொரி'],
  '2CO': ['2CO', '2 CORINTHIANS', '2CORINTHIANS', '2 கொரிந்தியர்', '2கொரி'],
  'GAL': ['GAL', 'GALATIANS', 'கலாத்தியர்', 'கலா'],
  'EPH': ['EPH', 'EPHESIANS', 'எபேசியர்', 'எபே'],
  'PHP': ['PHP', 'PHILIPPIANS', 'பிலிப்பியர்', 'பிலி'],
  'COL': ['COL', 'COLOSSIANS', 'கொலோசெயர்', 'கொலோ'],
  '1TH': ['1TH', '1 THESSALONIANS', '1THESSALONIANS', '1 தெசலோனிக்கேயர்', '1தெச'],
  '2TH': ['2TH', '2 THESSALONIANS', '2THESSALONIANS', '2 தெசலோனிக்கேயர்', '2தெச'],
  '1TI': ['1TI', '1 TIMOTHY', '1TIMOTHY', '1 தீமோத்தேயு', '1தீமோ'],
  '2TI': ['2TI', '2 TIMOTHY', '2TIMOTHY', '2 தீமோத்தேயு', '2தீமோ'],
  'TIT': ['TIT', 'TITUS', 'தீத்து'],
  'PHM': ['PHM', 'PHILEMON', 'பிலேமோன்'],
  'HEB': ['HEB', 'HEBREWS', 'எபிரெயர்', 'எபி'],
  'JAS': ['JAS', 'JAMES', 'யாக்கோபு', 'யாக்'],
  '1PE': ['1PE', '1 PETER', '1PETER', '1 பேதுரு', '1பேது'],
  '2PE': ['2PE', '2 PETER', '2PETER', '2 பேதுரு', '2பேது'],
  '1JN': ['1JN', '1 JOHN', '1JOHN', '1 யோவான்', '1யோவா'],
  '2JN': ['2JN', '2 JOHN', '2JOHN', '2 யோவான்', '2யோவா'],
  '3JN': ['3JN', '3 JOHN', '3JOHN', '3 யோவான்', '3யோவா'],
  'JUD': ['JUD', 'JUDE', 'யூதா'],
  'REV': ['REV', 'REVELATION', 'வெளிப்படுத்தின விசேஷம்', 'வெளிப்படுத்தல்', 'வெளி']
};

class BibleService {
  constructor() {
    this.queryUrl = process.env.CLOUDFLARE_QUERY_URL || '';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
    this.versionsCache = null;
    this.booksCache = new Map();
    this.activeLiveVerse = {
      version: 'TAM',
      book: 'GEN',
      book_name: 'ஆதியாகமம்',
      chapter: 1,
      verse: 1,
      verse_text: 'ஆதியிலே தேவன் வானத்தையும் பூமியையும் சிருஷ்டித்தார்.',
      timestamp: new Date().toISOString()
    };
    this.aliasMap = null;
  }

  /**
   * Executes a parameterized SQL query against Cloudflare D1.
   * @param {string} sql
   * @param {Array<any>} params
   * @returns {Promise<Array<any>>}
   */
  async queryD1(sql, params = []) {
    if (!this.queryUrl || !this.apiToken) {
      throw new Error('Cloudflare D1 is not configured. Check CLOUDFLARE_QUERY_URL and CLOUDFLARE_API_TOKEN in .env');
    }

    const payload = {
      sql: sql.trim(),
      params: params
    };

    const response = await fetch(this.queryUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloudflare D1 HTTP Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(`Cloudflare D1 Query Failed: ${JSON.stringify(data.errors || data.messages)}`);
    }

    if (!data.result || !data.result.length || !data.result[0].results) {
      return [];
    }

    return data.result[0].results;
  }

  /**
   * Retrieves active Bible versions.
   */
  async getVersions() {
    if (this.versionsCache) return this.versionsCache;

    const sql = `
      SELECT
        bible_version_pk,
        version_code,
        version_name,
        language_code,
        language_name
      FROM bible_version
      WHERE is_active = 1
      ORDER BY version_code;
    `;

    const results = await this.queryD1(sql);
    this.versionsCache = results;
    return results;
  }

  /**
   * Retrieves all books for a specific version.
   * @param {string} versionCode
   */
  async getBooks(versionCode = 'TAM') {
    const ver = String(versionCode).toUpperCase();
    if (this.booksCache.has(ver)) return this.booksCache.get(ver);

    const sql = `
      SELECT
        bd.book_global_id,
        bb.book_name,
        bb.book_short_name,
        bv.version_code,
        t.testament_name,
        c.category_name
      FROM book_details bd
      INNER JOIN bible_book bb ON bb.book_details_fk = bd.book_details_pk
      INNER JOIN bible_version bv ON bv.bible_version_pk = bb.bible_version_fk
      INNER JOIN testament t ON t.testament_pk = bd.testament_fk
      INNER JOIN category c ON c.category_pk = bd.category_fk
      WHERE bv.version_code = ?
      ORDER BY bd.book_details_pk;
    `;

    const results = await this.queryD1(sql, [ver]);
    if (results.length > 0) {
      this.booksCache.set(ver, results);
    }
    return results;
  }

  /**
   * Loads all book aliases and book titles from D1 database (book_alias, book_details, bible_book)
   * into a fast in-memory map for comprehensive multi-lingual lookup.
   */
  async ensureAliasesLoaded() {
    if (this.aliasMap) return this.aliasMap;
    this.aliasMap = new Map();

    const addEntry = (key, globalId) => {
      if (!key) return;
      const norm = String(key).trim().toLowerCase().replace(/\s+/g, '');
      if (norm) {
        this.aliasMap.set(norm, globalId);
        // If starts with book number (1, 2, 3), add version with space as well
        const numMatch = norm.match(/^([1-3])(.*)/);
        if (numMatch) {
          this.aliasMap.set(`${numMatch[1]} ${numMatch[2]}`, globalId);
        }
      }
    };

    try {
      // 1. Fetch from book_alias table joined with book_details
      const aliasRows = await this.queryD1(`
        SELECT ba.alias, bd.book_global_id
        FROM book_alias ba
        INNER JOIN book_details bd ON bd.book_details_pk = ba.book_details_fk;
      `);
      aliasRows.forEach(r => addEntry(r.alias, r.book_global_id));

      // 2. Fetch from bible_book table (book_name, book_short_name) joined with book_details
      const bookRows = await this.queryD1(`
        SELECT bb.book_name, bb.book_short_name, bd.book_global_id
        FROM bible_book bb
        INNER JOIN book_details bd ON bd.book_details_pk = bb.book_details_fk;
      `);
      bookRows.forEach(r => {
        addEntry(r.book_name, r.book_global_id);
        addEntry(r.book_short_name, r.book_global_id);
      });
    } catch (err) {
      console.warn('[BibleService] Warning loading D1 aliases, falling back to static aliases:', err.message);
    }

    // 3. Fallback extra aliases for common typos and abbreviations
    const typoExtras = {
      'gensis': 'GEN',
      'genisis': 'GEN',
      'revelation': 'REV',
      'revelations': 'REV',
      'psalm': 'PSA',
      'psalms': 'PSA',
      'ps': 'PSA',
      'phil': 'PHP',
      'philippians': 'PHP',
      '1thess': '1TH',
      '2thess': '2TH',
      '1tim': '1TI',
      '2tim': '2TI',
      '1pet': '1PE',
      '2pet': '2PE',
      '1jn': '1JN',
      '2jn': '2JN',
      '3jn': '3JN',
      '1co': '1CO',
      '2co': '2CO',
      '1ch': '1CH',
      '2ch': '2CH',
      '1sa': '1SA',
      '2sa': '2SA',
      '1ki': '1KI',
      '2ki': '2KI'
    };
    Object.entries(typoExtras).forEach(([k, v]) => addEntry(k, v));

    // 4. Merge static BOOK_ALIASES dictionary
    for (const [gid, list] of Object.entries(BOOK_ALIASES)) {
      addEntry(gid, gid);
      for (const item of list) {
        addEntry(item, gid);
      }
    }

    return this.aliasMap;
  }

  /**
   * Resolves raw text into a book_global_id (e.g. "யோவான்", "1சாமு", "Gen", "Gensis" -> "GEN").
   * @param {string} raw
   * @returns {Promise<string|null>}
   */
  async resolveBook(raw) {
    if (!raw) return null;
    await this.ensureAliasesLoaded();
    const clean = String(raw).trim().toLowerCase().replace(/\s+/g, '');
    let resolved = this.aliasMap.get(clean);

    if (!resolved) {
      // Check for numbered book e.g. 1சாமு vs 1 சாமு
      const numMatch = clean.match(/^([1-3])(.*)/);
      if (numMatch) {
        resolved = this.aliasMap.get(`${numMatch[1]} ${numMatch[2]}`) || this.aliasMap.get(numMatch[2]);
      }
    }

    return resolved || null;
  }

  /**
   * Synchronous fallback resolver using static aliases if needed.
   * @param {string} raw
   * @returns {string|null}
   */
  resolveBookGlobalId(raw) {
    if (!raw) return null;
    const clean = String(raw).trim().toUpperCase().replace(/\s+/g, '');

    for (const [globalId, aliases] of Object.entries(BOOK_ALIASES)) {
      if (globalId === clean) return globalId;
      for (const alias of aliases) {
        if (alias.toUpperCase().replace(/\s+/g, '') === clean) return globalId;
      }
    }
    return null;
  }

  /**
   * Retrieves parallel verses aligned across up to 3 versions.
   * @param {Object} options
   * @param {Array<string>} options.versions
   * @param {string} options.book
   * @param {number} options.chapter
   * @param {number|null} [options.verse]
   */
  async getParallelVerses({ versions = ['TAM'], book = 'GEN', chapter = 1, verse = null }) {
    const requestedVersions = (Array.isArray(versions) ? versions : String(versions).split(','))
      .map(v => String(v).trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 3);

    if (requestedVersions.length === 0) requestedVersions.push('TAM');

    const resolved = await this.resolveBook(book);
    const bookGlobalId = resolved || this.resolveBookGlobalId(book) || String(book).trim().toUpperCase();
    const ch = parseInt(chapter, 10) || 1;
    const vNum = verse ? parseInt(verse, 10) : null;

    // Fetch verses for each version in parallel
    const queries = requestedVersions.map(ver => {
      let sql = `
        SELECT
          bv.version_code AS version,
          bd.book_global_id AS book_global_id,
          bb.book_name AS book_name,
          bb.book_short_name AS book_short_name,
          v.chapter_num AS chapter,
          v.verse_num AS verse,
          v.verse AS verse_text
        FROM bible_verse v
        INNER JOIN bible_book bb ON bb.bible_book_pk = v.bible_book_fk
        INNER JOIN bible_version bv ON bv.bible_version_pk = bb.bible_version_fk
        INNER JOIN book_details bd ON bd.book_details_pk = bb.book_details_fk
        WHERE
          bv.version_code = ?
          AND bd.book_global_id = ?
          AND v.chapter_num = ?
      `;
      const params = [ver, bookGlobalId, ch];

      if (vNum !== null && !isNaN(vNum)) {
        sql += ` AND v.verse_num = ? `;
        params.push(vNum);
      }
      sql += ` ORDER BY v.verse_num; `;

      return this.queryD1(sql, params).then(rows => ({ version: ver, rows }));
    });

    const results = await Promise.all(queries);

    // Group and align by verse_num
    const verseMap = new Map();

    for (const { version, rows } of results) {
      for (const row of rows) {
        if (!verseMap.has(row.verse)) {
          verseMap.set(row.verse, {
            verse: row.verse,
            chapter: row.chapter,
            book_global_id: row.book_global_id,
            versions: {}
          });
        }
        verseMap.get(row.verse).versions[version] = {
          book_name: row.book_name,
          book_short_name: row.book_short_name,
          text: row.verse_text
        };
      }
    }

    // Sort verses numerically
    const alignedRows = Array.from(verseMap.values()).sort((a, b) => a.verse - b.verse);

    return {
      book: bookGlobalId,
      chapter: ch,
      requested_versions: requestedVersions,
      total_verses: alignedRows.length,
      rows: alignedRows
    };
  }

  /**
   * Common / Free search: checks for reference format first, then keyword search.
   * @param {Object} options
   * @param {string} options.query
   * @param {Array<string>} [options.versions]
   * @param {number} [options.limit]
   */
  async search({ query = '', versions = ['TAM'], limit = 30 }) {
    const raw = String(query || '').trim();
    if (!raw) return { type: 'empty', results: [] };

    const requestedVersions = (Array.isArray(versions) ? versions : String(versions).split(','))
      .map(v => String(v).trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 3);
    if (requestedVersions.length === 0) requestedVersions.push('TAM');

    // 1. Try Flexible Reference Matching
    // Handles formats: "Gen 1 1", "Gensis 1 1", "Gen1 1", "Gen1:1", "Gen 1:1", "1Cor 13 4", "1சாமு 2 3", "யோவா 3 16", "Gen 1", "Gen1"
    let candidateBook = null;
    let chapter = null;
    let verse = null;

    // Pattern 1: Book + Chapter + Verse (Space, colon, or dot separator)
    const p1 = /^([1-3]?\s*[\p{L}\p{M}]+?)\s*(\d+)[\s:.]+(\d+)$/u;
    const m1 = raw.match(p1);

    if (m1) {
      candidateBook = m1[1].trim();
      chapter = parseInt(m1[2], 10);
      verse = parseInt(m1[3], 10);
    } else {
      // Pattern 2: Book + Chapter (No verse)
      const p2 = /^([1-3]?\s*[\p{L}\p{M}]+?)\s*(\d+)$/u;
      const m2 = raw.match(p2);
      if (m2) {
        candidateBook = m2[1].trim();
        chapter = parseInt(m2[2], 10);
        verse = null;
      }
    }

    if (candidateBook && chapter) {
      const resolvedBook = await this.resolveBook(candidateBook);

      if (resolvedBook) {
        const parallelData = await this.getParallelVerses({
          versions: requestedVersions,
          book: resolvedBook,
          chapter: chapter,
          verse: verse
        });

        return {
          type: 'reference',
          matched_book: resolvedBook,
          chapter: chapter,
          verse: verse,
          data: parallelData
        };
      }
    }

    // 2. Keyword Search across Bible text
    const primaryVersion = requestedVersions[0] || 'TAM';
    const keywordSql = `
      SELECT
        bv.version_code AS version,
        bd.book_global_id AS book_global_id,
        bb.book_name AS book_name,
        bb.book_short_name AS book_short_name,
        v.chapter_num AS chapter,
        v.verse_num AS verse,
        v.verse AS verse_text
      FROM bible_verse v
      INNER JOIN bible_book bb ON bb.bible_book_pk = v.bible_book_fk
      INNER JOIN bible_version bv ON bv.bible_version_pk = bb.bible_version_fk
      INNER JOIN book_details bd ON bd.book_details_pk = bb.book_details_fk
      WHERE
        bv.version_code = ?
        AND v.verse LIKE ?
      ORDER BY bd.book_details_pk, v.chapter_num, v.verse_num
      LIMIT ?;
    `;

    const keywordResults = await this.queryD1(keywordSql, [primaryVersion, `%${raw}%`, limit]);

    return {
      type: 'keyword',
      query: raw,
      version: primaryVersion,
      total_found: keywordResults.length,
      results: keywordResults
    };
  }

  /**
   * Sets the currently active live verse for ProPresenter live push and dynamic RSS feeds.
   * @param {Object} verseData
   */
  setActiveLiveVerse(verseData) {
    if (verseData) {
      this.activeLiveVerse = {
        ...verseData,
        timestamp: new Date().toISOString()
      };
    }
    return this.activeLiveVerse;
  }

  /**
   * Returns the currently active live verse.
   */
  getActiveLiveVerse() {
    return this.activeLiveVerse;
  }

  /**
   * Retrieves the active live verse formatted specifically for the requested version.
   * If the active live verse already contains data for this version in all_versions, uses it.
   * Otherwise, fetches the verse for this version from D1 to ensure language accuracy.
   * @param {string} versionCode
   * @returns {Promise<Object>}
   */
  async getActiveLiveVerseForVersion(versionCode = 'TAM') {
    const ver = String(versionCode || 'TAM').toUpperCase();
    const live = this.activeLiveVerse;
    if (!live) {
      return {
        version: ver,
        book: 'PSA',
        book_name: ver === 'TAM' ? 'சங்கீதம்' : 'Psalms',
        chapter: 23,
        verse: 1,
        verse_text: ver === 'TAM'
          ? 'கர்த்தர் என் மேய்ப்பராயிருக்கிறார், நான் தாழ்ச்சியடையேன்.'
          : 'The LORD is my shepherd; I shall not want.'
      };
    }

    // 1. Check if all_versions has this version text
    if (live.all_versions && live.all_versions[ver] && live.all_versions[ver].text) {
      return {
        version: ver,
        book: live.book,
        book_name: live.all_versions[ver].book_name || live.book_name || live.book,
        chapter: live.chapter,
        verse: live.verse,
        verse_text: live.all_versions[ver].text
      };
    }

    // 2. If current active verse already matches this version
    if (live.version === ver && live.verse_text) {
      return live;
    }

    // 3. Otherwise, query D1 for this verse in the requested version
    try {
      const parallel = await this.getParallelVerses({
        versions: [ver],
        book: live.book,
        chapter: live.chapter,
        verse: live.verse
      });
      const row = parallel.rows.find(r => r.verse === live.verse) || parallel.rows[0];
      if (row && row.versions && row.versions[ver]) {
        return {
          version: ver,
          book: live.book,
          book_name: row.versions[ver].book_name || live.book,
          chapter: live.chapter,
          verse: live.verse,
          verse_text: row.versions[ver].text
        };
      }
    } catch (e) {
      console.warn(`[BibleService] Live verse translation error for ${ver}:`, e.message);
    }

    return live;
  }

  // =========================================================================
  // RSS 2.0 GENERATORS (3 Sets: Full Verse, Verse Text Only, Reference Only)
  // =========================================================================

  /**
   * Escapes XML characters.
   */
  xmlEscape(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Gets language code from version code.
   */
  getLanguageCode(version) {
    const langMap = {
      'TAM': 'ta',
      'TBS': 'ta',
      'KJV': 'en',
      'NIV': 'en',
      'ESV': 'en'
    };
    return langMap[String(version).toUpperCase()] || 'en';
  }

  /**
   * Helper to format scripture text according to feed configuration options.
   * Handles Content Filters (toggles), Character Limits, and quotation marks.
   */
  formatScriptureText(text, options = {}) {
    if (!text) return '';
    let result = String(text).trim();

    // Content Filters & Toggles: If toggles === false, strip verse number prefixes
    if (options.toggles === false || options.verseNumbers === false) {
      result = result.replace(/^\d+[\s.:]*/, '').trim();
    }

    // Scripture Limits: Cap character count if limit > 0
    const limit = parseInt(options.limit || options.maxChars, 10) || 0;
    if (limit > 0 && result.length > limit) {
      result = result.substring(0, limit).trim() + '...';
    }

    return result;
  }

  /**
   * Splits scripture text into multiple slide chunks for auto-pagination in ProPresenter.
   */
  splitIntoSlides(text, slideCount = 1) {
    if (!text || slideCount <= 1) return [text];
    const words = text.split(/\s+/);
    if (words.length <= slideCount) return [text];
    const chunkSize = Math.ceil(words.length / slideCount);
    const slides = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      slides.push(words.slice(i, i + chunkSize).join(' '));
    }
    return slides.length > 0 ? slides : [text];
  }

  /**
   * 1. Full Verse RSS: Reference in <title>, Scripture text in <description>
   * URL: /api/bible/rss/:version
   */
  createFullVerseRSS(item, version, book, chapter, verse, baseUrl = '', options = {}) {
    const reference = `${item.book_name} ${chapter}:${verse}`;
    const feedUrl = `${baseUrl}/api/bible/rss/${encodeURIComponent(version)}`;
    const verseUrl = `${baseUrl}/api/bible/verses?versions=${encodeURIComponent(version)}&book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}&verse=${encodeURIComponent(verse)}`;
    const formattedText = this.formatScriptureText(item.verse_text, options);
    const ttl = parseInt(options.ttl || options.speed, 10) || 1;
    const slides = this.splitIntoSlides(formattedText, parseInt(options.slides, 10) || 1);

    const itemsXml = slides.map((slideText, idx) => {
      const slideTitle = slides.length > 1 ? `${reference} (${idx + 1}/${slides.length})` : reference;
      const guid = `verse-full-${version}-${book}-${chapter}-${verse}-s${idx + 1}`;
      return `    <item>
      <title>${this.xmlEscape(slideTitle)}</title>
      <description>${this.xmlEscape(slideText)}</description>
      <content:encoded>${this.xmlEscape(slideText)}</content:encoded>
      <link>${this.xmlEscape(verseUrl)}</link>
      <guid isPermaLink="false">${this.xmlEscape(guid)}</guid>
      <category>Bible</category>
      <category>FullVerse</category>
      <category>${this.xmlEscape(version)}</category>
    </item>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${this.xmlEscape(item.version + ' - Bible Verse')}</title>
    <description>${this.xmlEscape(reference + ' - ' + item.version)}</description>
    <link>${this.xmlEscape(feedUrl)}</link>
    <language>${this.xmlEscape(this.getLanguageCode(version))}</language>
    <generator>ProPresenter Node.js Bible RSS Generator</generator>
    <ttl>${ttl}</ttl>
${itemsXml}
  </channel>
</rss>`;
  }

  /**
   * 2. Verse Text Only RSS: Only verse scripture text in <title>
   * URL: /api/bible/rss/:version?type=verse
   */
  createVerseOnlyRSS(item, version, book, chapter, verse, baseUrl = '', options = {}) {
    const reference = `${item.book_name} ${chapter}:${verse}`;
    const feedUrl = `${baseUrl}/api/bible/rss/${encodeURIComponent(version)}?type=verse`;
    const verseUrl = `${baseUrl}/api/bible/verses?versions=${encodeURIComponent(version)}&book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}&verse=${encodeURIComponent(verse)}`;
    const formattedText = this.formatScriptureText(item.verse_text, options);
    const ttl = parseInt(options.ttl || options.speed, 10) || 1;
    const slides = this.splitIntoSlides(formattedText, parseInt(options.slides, 10) || 1);

    const itemsXml = slides.map((slideText, idx) => {
      const guid = `verse-text-${version}-${book}-${chapter}-${verse}-s${idx + 1}`;
      return `    <item>
      <title>${this.xmlEscape(slideText)}</title>
      <description>${this.xmlEscape(slideText)}</description>
      <content:encoded>${this.xmlEscape(slideText)}</content:encoded>
      <link>${this.xmlEscape(verseUrl)}</link>
      <guid isPermaLink="false">${this.xmlEscape(guid)}</guid>
      <category>Bible</category>
      <category>VerseText</category>
      <category>${this.xmlEscape(version)}</category>
    </item>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${this.xmlEscape(item.version + ' - Bible Verse (Verse Only)')}</title>
    <description>${this.xmlEscape(reference + ' - ' + item.version)}</description>
    <link>${this.xmlEscape(feedUrl)}</link>
    <language>${this.xmlEscape(this.getLanguageCode(version))}</language>
    <generator>ProPresenter Node.js Bible RSS Generator</generator>
    <ttl>${ttl}</ttl>
${itemsXml}
  </channel>
</rss>`;
  }

  /**
   * 3. Reference Only RSS: Only citation reference in <title>
   * URL: /api/bible/rss/:version?type=reference
   */
  createReferenceOnlyRSS(item, version, book, chapter, verse, baseUrl = '', options = {}) {
    const reference = `${item.book_name} ${chapter}:${verse}`;
    const feedUrl = `${baseUrl}/api/bible/rss/${encodeURIComponent(version)}?type=reference`;
    const ttl = parseInt(options.ttl || options.speed, 10) || 1;

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${this.xmlEscape(item.version + ' - Bible Reference')}</title>
    <description>${this.xmlEscape('Bible Reference: ' + reference + ' - ' + item.version)}</description>
    <link>${this.xmlEscape(feedUrl)}</link>
    <language>${this.xmlEscape(this.getLanguageCode(version))}</language>
    <generator>ProPresenter Node.js Bible RSS Generator</generator>
    <ttl>${ttl}</ttl>
    <item>
      <title>${this.xmlEscape(reference)}</title>
      <description>${this.xmlEscape(reference)}</description>
      <guid isPermaLink="false">${this.xmlEscape('reference-' + version + '-' + book + '-' + chapter + '-' + verse)}</guid>
      <category>Bible</category>
      <category>Reference</category>
      <category>${this.xmlEscape(version)}</category>
    </item>
  </channel>
</rss>`;
  }

  // Alias legacy methods for backwards compatibility
  createVerseRSS(item, version, book, chapter, verse, baseUrl = '') {
    return this.createFullVerseRSS(item, version, book, chapter, verse, baseUrl);
  }

  createReferenceRSS(item, version, book, chapter, verse, baseUrl = '') {
    return this.createReferenceOnlyRSS(item, version, book, chapter, verse, baseUrl);
  }

  /**
   * Creates Empty RSS XML feed when verse not found.
   */
  createEmptyFeed(version, book, chapter, verse, feedType, baseUrl = '') {
    const feedUrl = `${baseUrl}/api/bible/rss?type=${encodeURIComponent(feedType)}&version=${encodeURIComponent(version)}&book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}&verse=${encodeURIComponent(verse)}`;
    const reference = `${version} ${book} ${chapter}:${verse}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bible RSS</title>
    <description>No verse found</description>
    <link>${this.xmlEscape(feedUrl)}</link>
    <item>
      <title>No verse found</title>
      <description>No Bible verse was found for ${this.xmlEscape(reference)}</description>
      <guid isPermaLink="false">${this.xmlEscape('empty-' + version + '-' + book + '-' + chapter + '-' + verse)}</guid>
    </item>
  </channel>
</rss>`;
  }
}

module.exports = new BibleService();
