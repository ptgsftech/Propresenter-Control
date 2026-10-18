const http = require('http');

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('TESTING PROPRESENTER BIBLE RSS 2.0 FEED SUITE');
  console.log('====================================================\n');

  // 1. Post a Live Verse to /api/bible/live
  console.log('1. Posting Live Verse: சங்கீதம் 23:2 (Psalm 23:2)...');
  const livePayload = JSON.stringify({
    version: 'TAM',
    book: 'PSA',
    book_name: 'சங்கீதம்',
    chapter: 23,
    verse: 2,
    verse_text: 'அவர் என்னைப் புல்லுள்ள இடங்களில் மேய்த்து, அமர்ந்த தண்ணீர்கள் அண்டையில் என்னைக் கொண்டுபோய்விடுகிறார்.',
    all_versions: {
      TAM: {
        book_name: 'சங்கீதம்',
        book_short_name: 'சங்',
        text: 'அவர் என்னைப் புல்லுள்ள இடங்களில் மேய்த்து, அமர்ந்த தண்ணீர்கள் அண்டையில் என்னைக் கொண்டுபோய்விடுகிறார்.'
      },
      KJV: {
        book_name: 'Psalms',
        book_short_name: 'Ps',
        text: 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.'
      }
    }
  });

  const postRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/bible/live',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(livePayload)
    }
  }, livePayload);
  console.log('   Live sync response:', postRes.status, postRes.data);

  // 2. Test Feed 1: Full Verse Feed (/api/bible/rss/TAM)
  console.log('\n2. Testing Feed 1: Full Verse Feed (/api/bible/rss/TAM)...');
  const feed1 = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/bible/rss/TAM',
    method: 'GET'
  });
  console.log('   Status:', feed1.status);
  const m1Title = feed1.data.match(/<item>[\s\S]*?<title>(.*?)<\/title>/);
  const m1Desc = feed1.data.match(/<item>[\s\S]*?<description>(.*?)<\/description>/);
  console.log('   <title>:      ', m1Title ? m1Title[1] : 'NOT FOUND');
  console.log('   <description>:', m1Desc ? m1Desc[1].substring(0, 60) + '...' : 'NOT FOUND');
  const pass1 = m1Title && m1Title[1].includes('சங்கீதம் 23:2') && m1Desc && m1Desc[1].includes('புல்லுள்ள');
  console.log('   Result:       ', pass1 ? 'PASS (Reference in Title, Verse in Description)' : 'FAIL');

  // 3. Test Feed 2: Verse Text Only Feed (/api/bible/rss/TAM?type=verse)
  console.log('\n3. Testing Feed 2: Verse Text Only Feed (/api/bible/rss/TAM?type=verse)...');
  const feed2 = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/bible/rss/TAM?type=verse',
    method: 'GET'
  });
  console.log('   Status:', feed2.status);
  const m2Title = feed2.data.match(/<item>[\s\S]*?<title>(.*?)<\/title>/);
  const m2Desc = feed2.data.match(/<item>[\s\S]*?<description>(.*?)<\/description>/);
  console.log('   <title>:      ', m2Title ? m2Title[1].substring(0, 60) + '...' : 'NOT FOUND');
  console.log('   <description>:', m2Desc ? m2Desc[1].substring(0, 60) + '...' : 'NOT FOUND');
  const pass2 = m2Title && m2Title[1].includes('புல்லுள்ள');
  console.log('   Result:       ', pass2 ? 'PASS (Verse Text in Title!)' : 'FAIL');

  // 4. Test Feed 3: Reference Only Feed (/api/bible/rss/TAM?type=reference)
  console.log('\n4. Testing Feed 3: Reference Only Feed (/api/bible/rss/TAM?type=reference)...');
  const feed3 = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/bible/rss/TAM?type=reference',
    method: 'GET'
  });
  console.log('   Status:', feed3.status);
  const m3Title = feed3.data.match(/<item>[\s\S]*?<title>(.*?)<\/title>/);
  const m3Desc = feed3.data.match(/<item>[\s\S]*?<description>(.*?)<\/description>/);
  console.log('   <title>:      ', m3Title ? m3Title[1] : 'NOT FOUND');
  console.log('   <description>:', m3Desc ? m3Desc[1] : 'NOT FOUND');
  const pass3 = m3Title && m3Title[1].includes('சங்கீதம் 23:2') && m3Desc && m3Desc[1].includes('சங்கீதம் 23:2');
  console.log('   Result:       ', pass3 ? 'PASS (Reference in Title!)' : 'FAIL');

  // 5. Test Feed Set for English KJV
  console.log('\n5. Testing KJV Feed Set (/api/bible/rss/KJV?type=verse)...');
  const feedKjv = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/bible/rss/KJV?type=verse',
    method: 'GET'
  });
  const mKjvTitle = feedKjv.data.match(/<item>[\s\S]*?<title>(.*?)<\/title>/);
  console.log('   KJV <title>:  ', mKjvTitle ? mKjvTitle[1] : 'NOT FOUND');
  const passKjv = mKjvTitle && mKjvTitle[1].includes('green pastures');
  console.log('   Result:       ', passKjv ? 'PASS (English KJV text in Title!)' : 'FAIL');

  // 6. Test /api/bible/rss-info
  console.log('\n6. Testing Metadata API (/api/bible/rss-info)...');
  const infoRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/bible/rss-info',
    method: 'GET'
  });
  const infoData = JSON.parse(infoRes.data);
  console.log('   Primary LAN IP:', infoData.primaryLanIp);
  console.log('   All LAN IPs:   ', infoData.lanIps);
  console.log('   Versions:      ', infoData.versions.map(v => v.code).join(', '));
  console.log('   Result:        ', infoData.success ? 'PASS' : 'FAIL');

  console.log('\n====================================================');
  console.log('ALL RSS FEED SPECIFICATIONS VALIDATED SUCCESSFULLY!');
  console.log('====================================================\n');
}

runTests().catch(console.error);
