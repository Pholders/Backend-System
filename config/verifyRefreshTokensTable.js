const { query } = require('./db');

async function checkRefreshTokensTable() {
  try {
    console.log('🔍 Checking refresh_tokens table...\n');
    
    // Check table structure
    const result = await query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'refresh_tokens' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Table columns:');
    result.rows.forEach(row => {
      const length = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
      const nullable = row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL';
      const defaultVal = row.column_default ? `DEFAULT ${row.column_default}` : '';
      console.log(`  ${row.column_name}: ${row.data_type}${length} ${nullable} ${defaultVal}`);
    });
    
    // Check indexes
    const indexes = await query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'refresh_tokens'
    `);
    
    console.log('\n✅ Indexes:');
    indexes.rows.forEach(row => {
      console.log(`  ${row.indexname}`);
    });
    
    // Check constraints
    const constraints = await query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'refresh_tokens'::regclass
    `);
    
    console.log('\n✅ Constraints:');
    constraints.rows.forEach(row => {
      console.log(`  ${row.conname} (${row.contype})`);
    });
    
    console.log('\n🎉 refresh_tokens table is ready for use!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error checking table:', error.message);
    process.exit(1);
  }
}

checkRefreshTokensTable();