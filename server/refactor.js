const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
files.push('../database/seed.js');

for (const file of files) {
    const filePath = path.join(routesDir, file);
    let code = fs.readFileSync(filePath, 'utf8');

    // Revert the failed replacements if any, and just do a blind replace of db.run( to db.prepare( if we can capture the args.
    // Actually, it's easier to find `db.run(` and find the matching `)` manually, or just use a generic regex that captures up to the array bracket.
    // Let's use a simpler approach: 
    // db.run( SQL_STRING, PARAMS_ARRAY ) -> db.prepare( SQL_STRING ).run( PARAMS_ARRAY )
    // A regex that matches everything up to `, [`:
    // But wait, what if there are no params? 
    
    // 1. Let's fix the ones with params: db.run(something, [something])
    code = code.replace(/db\.run\(([\s\S]*?),\s*(\[[\s\S]*?\])\)/g, 'db.prepare($1).run($2)');
    
    // 2. Let's fix the ones without params: db.run(something) where something is NOT an array.
    // This is trickier with regex. We can just do:
    code = code.replace(/db\.run\(([^,]+?)\)(?![\s\S]*?\.run)/g, (match, p1) => {
        // if it already has .prepare in the line, don't touch it
        return `db.prepare(${p1}).run()`;
    });

    fs.writeFileSync(filePath, code);
    console.log('Fixed db.run in ' + file);
}
