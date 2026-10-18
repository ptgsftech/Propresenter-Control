function parseReference(raw) {
  if (!raw) return null;
  const str = raw.trim();

  // Pattern 1: Book + Chapter + Verse
  // Can have space or no space between book and chapter
  // Can have space, colon, or dot between chapter and verse
  // E.g. "Gen 1 1", "Gen1 1", "Gen1:1", "Gen 1:1", "1Cor 13 4", "1சாமு 2 3", "1சாமு2:3"
  const p1 = /^([1-3]?\s*[\p{L}\p{M}]+?)\s*(\d+)[\s:.]+(\d+)$/u;
  const m1 = str.match(p1);
  if (m1) {
    return {
      bookRaw: m1[1].trim(),
      chapter: parseInt(m1[2], 10),
      verse: parseInt(m1[3], 10)
    };
  }

  // Pattern 2: Book + Chapter (No verse)
  // E.g. "Gen 1", "Gen1", "1Cor 13", "1Cor13", "யோவான் 3"
  const p2 = /^([1-3]?\s*[\p{L}\p{M}]+?)\s*(\d+)$/u;
  const m2 = str.match(p2);
  if (m2) {
    return {
      bookRaw: m2[1].trim(),
      chapter: parseInt(m2[2], 10),
      verse: null
    };
  }

  return null;
}

const tests = [
  'Gen 1 1',
  'Gensis 1 1',
  'Gen1 1',
  'Gen1:1',
  'Gen 1:1',
  'Genesis 1:1',
  'Ge 1 1',
  'Gen 1',
  'Gen1',
  '1Cor 13 4',
  '1Cor13:4',
  '1Cor 13',
  '1Cor13',
  '1 கொரி 13 4',
  '1சாமு 2 3',
  '1சாமு2:3',
  '1சாமு 2',
  'யோவா 3 16',
  'யோவான் 3 16',
  'யோவான் 3:16',
  'யோவான் 3',
  'Ps 23 1',
  'Psalm 23:1',
  'சங் 23 1',
  'சங்கீதம் 23:1',
  // Non-references (should be null -> fallback to keyword search)
  'love',
  'தேவன் அன்பாகவே இருக்கிறார்',
  'grace'
];

for (const t of tests) {
  const res = parseReference(t);
  console.log(`${t} =>`, res ? `Book: "${res.bookRaw}", Ch: ${res.chapter}, V: ${res.verse}` : 'KEYWORD SEARCH');
}
