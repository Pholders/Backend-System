require('dotenv').config();
const { query } = require('./config/db');

async function getLatestOTP() {
  console.log('\n=== Latest OTP Codes ===\n');
  
  try {
    const result = await query(`
      SELECT 
        o.id,
        o.otp_code,
        u.email,
        u.first_name,
        o.purpose,
        o.expires_at,
        o.is_used,
        o.created_at
      FROM otps o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      console.log('No OTP codes found');
      return;
    }
    
    console.log('Recent OTP Codes:');
    console.log('─'.repeat(80));
    
    result.rows.forEach((row, index) => {
      const isExpired = new Date(row.expires_at) < new Date();
      const status = row.is_used ? '❌ Used' : isExpired ? '⏰ Expired' : '✅ Valid';
      
      console.log(`\n${index + 1}. ${status}`);
      console.log(`   Email: ${row.email}`);
      console.log(`   Name: ${row.first_name}`);
      console.log(`   OTP Code: ${row.otp_code}`);
      console.log(`   Purpose: ${row.purpose}`);
      console.log(`   Expires: ${new Date(row.expires_at).toLocaleString()}`);
      console.log(`   Created: ${new Date(row.created_at).toLocaleString()}`);
    });
    
    console.log('\n' + '─'.repeat(80));
    
    // Find the latest valid OTP
    const validOTP = result.rows.find(row => {
      const isExpired = new Date(row.expires_at) < new Date();
      return !row.is_used && !isExpired;
    });
    
    if (validOTP) {
      console.log('\n✅ VALID OTP FOR TESTING:');
      console.log(`   Email: ${validOTP.email}`);
      console.log(`   Code: ${validOTP.otp_code}`);
      console.log(`\nTest verify-otp with:`);
      console.log(`POST http://localhost:3000/api/users/verify-otp`);
      console.log(JSON.stringify({
        email: validOTP.email,
        otp_code: validOTP.otp_code
      }, null, 2));
    } else {
      console.log('\n⚠️  No valid OTP found. Run login again to generate a new one.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

getLatestOTP();
