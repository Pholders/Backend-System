require('dotenv').config();
const emailService = require('./services/emailService');
const { query } = require('./config/db');

async function testEmail() {
  console.log('\n=== Testing Email Configuration ===\n');
  
  console.log('Email Service:', process.env.EMAIL_SERVICE || 'gmail');
  console.log('Email User:', process.env.EMAIL_USER);
  console.log('Email Password:', process.env.EMAIL_PASSWORD ? '✓ Set' : '✗ Not Set');
  
  try {
    console.log('\n1. Testing email connection...');
    const isConnected = await emailService.verifyConnection();
    
    if (isConnected) {
      console.log('✅ Email service is configured correctly\n');
      
      // Fetch first name from the database
      console.log('2. Fetching first name from database...');
      let firstName = 'User';
      try {
        const result = await query('SELECT first_name FROM users WHERE email = $1 LIMIT 1', [process.env.EMAIL_USER]);
        if (result.rows.length > 0 && result.rows[0].first_name) {
          firstName = result.rows[0].first_name;
          console.log(`   Found user: ${firstName}`);
        } else {
          console.log('   No user found in DB for this email, using default name.');
        }
      } catch (dbErr) {
        console.warn('   ⚠️ Could not fetch name from DB:', dbErr.message);
        console.log('   Using default name "User" for the test email.');
      }
      
      // Send test email
      console.log('3. Sending test OTP email...');
      const testEmail = process.env.EMAIL_USER; // Send to yourself
      const testOTP = '123456';
      
      await emailService.sendOTP(testEmail, testOTP, firstName);
      console.log(`✅ Test OTP email sent to ${testEmail}`);
      console.log('   Check your inbox for the test email\n');
      
    } else {
      console.log('❌ Email configuration error');
      console.log('\nPlease check:');
      console.log('1. EMAIL_USER is set correctly in .env');
      console.log('2. EMAIL_PASSWORD contains your Gmail App Password');
      console.log('3. You have enabled 2-Factor Authentication on Gmail');
      console.log('4. You generated an App Password from: https://myaccount.google.com/apppasswords\n');
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('Invalid login')) {
      console.log('\nThis error usually means:');
      console.log('- You are using your regular Gmail password instead of App Password');
      console.log('- Generate an App Password at: https://myaccount.google.com/apppasswords');
    } else if (error.message.includes('No recipients')) {
      console.log('\nPlease set EMAIL_USER in your .env file');
    }
    
    console.log('\nSee OTP_EMAIL_SETUP.md for detailed setup instructions\n');
  }
}

testEmail();
