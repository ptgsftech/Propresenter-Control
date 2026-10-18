require('dotenv').config();
const bible = require('../src/services/bible-service.js');

async function test() {
  const queries = [
    'Gen 1 1',
    'Gensis 1 1',
    'Gen1 1',
    'Gen1:1',
    'Gen 1:1',
    '1Cor 13 4',
    '1Cor13:4',
    '1சாமு 2 3',
    '1சாமு2:3',
    'யோவா 3 16',
    'Gen 1',
    'Gen1',
    'love'
  ];

  console.log('Testing queries against Bible Service...');
  for (const q of queries) {
    const res = await bible.search({ query: q, versions: ['TAM', 'KJV'] });
    console.log(`Query "${q}" => Type: ${res.type}, Book: ${res.matched_book || 'N/A'}, Chapter: ${res.chapter || 'N/A'}, Verse: ${res.verse || 'N/A'}, Total: ${res.data?.total_verses || res.total_found || 0}`);
  }
}

test().catch(console.error);
