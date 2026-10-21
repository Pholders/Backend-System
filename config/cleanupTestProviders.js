const { pool, query } = require('./db');
const { DOCTORS, PHARMACIES } = require('./seedTestProviders');

async function cleanupTestProviders() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run provider cleanup script in production');
  }

  const client = await pool.connect();

  try {
    const doctorEmails = DOCTORS.map((doctor) => doctor.email);
    const pharmacyEmails = PHARMACIES.map((pharmacy) => pharmacy.email);

    await client.query('BEGIN');

    const doctorResult = await client.query(
      'DELETE FROM doctors WHERE email = ANY($1::text[])',
      [doctorEmails]
    );

    const pharmacyResult = await client.query(
      'DELETE FROM pharmacies WHERE email = ANY($1::text[])',
      [pharmacyEmails]
    );

    await client.query('COMMIT');

    console.log('✅ Test provider cleanup complete.');
    console.log(`   Doctors removed: ${doctorResult.rowCount}`);
    console.log(`   Pharmacies removed: ${pharmacyResult.rowCount}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  cleanupTestProviders()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Provider cleanup failed:', error);
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = { cleanupTestProviders };