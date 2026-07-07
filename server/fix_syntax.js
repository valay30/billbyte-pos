const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
files.push('../database/seed.js');
files.push('../database/schema.js');

for (const file of files) {
    const filePath = path.join(routesDir, file);
    let code = fs.readFileSync(filePath, 'utf8');

    // Find any db.prepare('...datetime('now')...') and change outer quotes to `
    code = code.replace(/db\.prepare\('([^']*?)datetime\('now'\)([^']*?)'\)/g, "db.prepare(`$1datetime('now')$2`)");
    code = code.replace(/pdb\.prepare\('([^']*?)datetime\('now'\)([^']*?)'\)/g, "pdb.prepare(`$1datetime('now')$2`)");
    code = code.replace(/db\.prepare\('([^']*?)date\('now'\)([^']*?)'\)/g, "db.prepare(`$1date('now')$2`)");

    fs.writeFileSync(filePath, code);
    console.log('Fixed syntax in ' + file);
}
