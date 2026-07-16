require('dotenv').config();
const { pool } = require('./database/db');

async function run() {
  const slugs = ['cafeone', 'cafetwo', 'cafethree', 'valay'];
  for (const slug of slugs) {
    const schemaName = 'tenant_' + slug;
    try {
      // Find the admin user in the tenant schema
      const result = await pool.query(`SELECT name, email FROM "${schemaName}".users WHERE role='admin' ORDER BY id ASC LIMIT 1`);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        // Insert back into public.tenants
        await pool.query(
          `INSERT INTO public.tenants (slug, name, admin_email) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [slug, slug, user.email]
        );
        console.log('Restored', slug);
      } else {
        console.log('No admin found for', slug);
      }
    } catch (e) {
      console.error('Error on', slug, e.message);
    }
  }
  process.exit(0);
}
run();
