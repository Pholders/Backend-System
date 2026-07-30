const { query } = require('./config/db');
(async () => {
  console.log('\n--- appointments columns ---');
  const cols = await query(
    "SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name='appointments' ORDER BY ordinal_position"
  );
  console.table(cols.rows);

  console.log('\n--- existing appointments ---');
  const appts = await query('SELECT id, patient_id, doctor_id FROM appointments ORDER BY id DESC LIMIT 10');
  console.table(appts.rows);

  process.exit();
})();
