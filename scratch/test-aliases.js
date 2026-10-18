require('dotenv').config();
const bible = require('../src/services/bible-service.js');

async function testResolution() {
  // Fetch all book_details, book_alias, and bible_book into memory for ultra-fast matching
  const allAliases = await bible.queryD1(`
    SELECT 
      ba.alias,
      bd.book_global_id,
      bd.book_details_pk
    FROM book_alias ba
    INNER JOIN book_details bd ON bd.book_details_pk = ba.book_details_fk
  `);

  const allBibleBooks = await bible.queryD1(`
    SELECT 
      bb.book_name,
      bb.book_short_name,
      bd.book_global_id,
      bd.book_details_pk
    FROM bible_book bb
    INNER JOIN book_details bd ON bd.book_details_pk = bb.book_details_fk
  `);

  console.log(`Loaded ${allAliases.length} aliases and ${allBibleBooks.length} bible books`);

  // Print all distinct aliases & short names
  const testInputs = [
    'Gen 1 1',
    'Gensis 1 1',
    'Gen1 1',
    'Gen1:1',
    'Genesis 1:1',
    'Ge 1 1',
    'யோவா 3 16',
    'யோவான் 3 16',
    '1Cor 13 4',
    '1Cor13:4',
    '1 Cor 13 4',
    '1 கொரி 13 4',
    '1சாமு 2 3',
    '1சாமு2:3',
    '1 Sam 2 3',
    'Ps 23 1',
    'Psalm 23 1',
    'சங் 23 1',
    'சங்கீதம் 23 1'
  ];

  function parseInput(input) {
    const raw = input.trim();
    // Regex for: <book><chapter>[: ]<verse> OR <book> <chapter>[: ]<verse>
    // Note: Book might start with 1, 2, 3 (like 1 Cor, 1சாமு, 1Sam)
    // Followed by letters (Tamil / English / any Unicode letters/marks)
    // Then chapter, separator (space, colon, period), then verse
    
    // Pattern 1: Book + Chapter + Verse
    // Examples: "Gen 1 1", "Gen1 1", "Gen1:1", "1Cor 13 4", "1Cor13:4", "1சாமு 2 3", "1சாமு2:3"
    const p1 = /^([1-3]?\s*[\p{L}\p{M}]+?)\s*(\d+)[\s:.]+(\d+)$/u;
    const m1 = raw.match(p1);
    if (m1) {
      return { book: m1[1].trim(), chapter: parseInt(m1[2], 10), verse: parseInt(m1[3], 10) };
    }

    // Pattern 2: Book + Chapter (No verse)
    // Examples: "Gen 1", "Gen1", "1Cor 13", "1Cor13", "யோவான் 3"
    const p2 = /^([1-3]?\s*[\p{L}\p{M}]+?)\s*(\d+)$/u;
    const m2 = raw.match(p2);
    if (m2) {
      return { book: m2[1].trim(), chapter: parseInt(m2[2], 10), verse: null };
    }

    return null;
  }

  // Build an alias map
  const map = new Map();
  function add(key, globalId) {
    if (!key) return;
    const norm = key.trim().toLowerCase().replace(/\s+/g, '');
    map.set(norm, globalId);
  }

  allAliases.forEach(a => add(a.alias, a.book_global_id));
  allBibleBooks.forEach(b => {
    add(b.book_name, b.book_global_id);
    add(b.book_short_name, b.book_global_id);
  });

  // Additional common shortcuts and typo-handling:
  // e.g. 'gensis' -> 'GEN', 'psalms' -> 'PSA', 'ps' -> 'PSA'
  const typoExtras = {
    'gensis': 'GEN',
    'genisis': 'GEN',
    'revelations': 'REV',
    'psalms': 'PSA',
    'psalm': 'PSA',
    'ps': 'PSA',
    'phil': 'PHP',
    'philippians': 'PHP',
    '1thess': '1TH',
    '2thess': '2TH'
  };
  Object.entries(typoExtras).forEach(([k, v]) => map.set(k.toLowerCase().replace(/\s+/g, ''), v));

  console.log('\n--- Testing Reference Resolution ---');
  for (const input of testInputs) {
    const parsed = parseInput(input);
    if (!parsed) {
      console.log(`FAIL: Could not parse "${input}"`);
      continue;
    }
    const cleanBook = parsed.book.trim().toLowerCase().replace(/\s+/g, '');
    let resolved = map.get(cleanBook);

    // If not direct match, try fuzzy or normalizing number space (e.g. 1சாமு vs 1 சாமு)
    if (!resolved) {
      // Check if starts with number
      const numMatch = cleanBook.match(/^([1-3])(.*)/);
      if (numMatch) {
        resolved = map.get(`${numMatch[1]} ${numMatch[2]}`) || map.get(numMatch[2]);
      }
    }

    console.log(`"${input}" => Book: "${parsed.book}" (${resolved || 'UNRESOLVED'}), Ch: ${parsed.chapter}, V: ${parsed.verse}`);
  }
}

testResolution().catch(console.error);
