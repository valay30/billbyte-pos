const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
files.push('../database/seed.js');
files.push('../database/schema.js');

for (const file of files) {
    const filePath = path.join(routesDir, file);
    let code = fs.readFileSync(filePath, 'utf8');

    // Replace datetime("now") -> datetime('now')
    code = code.replace(/datetime\("now"\)/g, "datetime('now')");
    code = code.replace(/date\("now"\)/g, "date('now')");

    fs.writeFileSync(filePath, code);
    console.log('Fixed quotes in ' + file);
}
