const { query } = require('./config/db');
(async () => {
  const r = await query(
    "SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name='prescriptions' ORDER BY ordinal_position"
  );
  console.table(r.rows);
  process.exit();
})();
