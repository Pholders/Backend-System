const { pool } = require('./config/db');

async function fixPrescriptions() {
  try {
    console.log('🔄 Fixing prescription claim expiry dates...\n');
    
    const result = await pool.query(`
      UPDATE prescriptions
      SET claim_expires_at = created_at + INTERVAL '30 days'
      WHERE claim_expires_at IS NULL
      RETURNING id, prescription_number, claim_expires_at;
    `);
    
    console.log('✅ Updated', result.rows.length, 'prescriptions');
    result.rows.forEach(p => {
      console.log(`  - RX ${p.prescription_number} → expires: ${p.claim_expires_at}`);
    });
    
    // Also check if any prescriptions have already expired
    const expired = await pool.query(`
      SELECT id, prescription_number, claim_expires_at
      FROM prescriptions
      WHERE claim_expires_at < CURRENT_TIMESTAMP
      AND claimed = FALSE
      LIMIT 5;
    `);
    
    if (expired.rows.length > 0) {
      console.log('\n⚠️ Found', expired.rows.length, 'already-expired prescriptions:');
      expired.rows.forEach(p => {
        console.log(`  - RX ${p.prescription_number} (expired: ${p.claim_expires_at})`);
      });
    }
    
    console.log('\n✅ Fix completed!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    process.exit(0);
  }
}

fixPrescriptions();
