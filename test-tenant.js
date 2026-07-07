const { getPlatformDb, queryPlatform } = require('./server/database/platform');
require('dotenv').config({ path: './server/.env' });

async function test() {
  await getPlatformDb();
  const allTenants = await queryPlatform('SELECT * FROM tenants');
  console.log('ALL TENANTS:', allTenants);
  
  const cafeone = await queryPlatform('SELECT * FROM tenants WHERE slug = ?', ['cafeone']);
  console.log('CAFEONE QUERY RESULT:', cafeone);
  
  process.exit(0);
}
test();
