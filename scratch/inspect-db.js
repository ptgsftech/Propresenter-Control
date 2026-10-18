require('dotenv').config();
const bible = require('../src/services/bible-service.js');

async function run() {
  try {
    const schema = await bible.queryD1("SELECT name, sql FROM sqlite_master WHERE type='table'");
    console.log('Tables:', schema.map(t => t.name));
    
    for (const t of schema) {
      console.log(`\n--- Table: ${t.name} ---`);
      console.log(t.sql);
    }

    const sampleAliases = await bible.queryD1("SELECT * FROM book_alias LIMIT 20");
    console.log('\n--- Sample Aliases (20) ---');
    console.log(sampleAliases);

    const aliasCount = await bible.queryD1("SELECT count(*) as cnt FROM book_alias");
    console.log('\nTotal aliases:', aliasCount[0].cnt);
    
    // Check aliases for Tamil and English
    const tamilAliases = await bible.queryD1("SELECT * FROM book_alias WHERE alias LIKE '%யோவா%' OR alias LIKE '%ஆதி%' OR alias LIKE '%Gen%' OR alias LIKE '%John%' LIMIT 20");
    console.log('\nSample Tamil/English aliases matched:', tamilAliases);

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
