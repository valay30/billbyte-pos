require('dotenv').config({ path: './.env' });
const { getPlatformDb, queryPlatform } = require('./database/platform');

async function debugTenant(slug) {
  await getPlatformDb();
  
  console.log(`Querying for slug: "${slug}"`);
  const tenants = await queryPlatform('SELECT * FROM tenants WHERE slug = ?', [slug]);
  
  console.log('Result length:', tenants.length);
  if (tenants.length) {
    console.log('Found:', tenants[0]);
  } else {
    console.log('Not found!');
  }
  
  console.log('All tenants in DB:');
  const all = await queryPlatform('SELECT id, slug FROM tenants');
  console.log(all);
  
  process.exit(0);
}

debugTenant('cafetwo');
