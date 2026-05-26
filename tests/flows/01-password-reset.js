const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Test Password Reset Flow
 * Tests complete password reset process
 */

function makeRequest(hostname, port, pathname, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      defaultHeaders['Content-Length'] = jsonData.length;
    }

    const options = {
      hostname: hostname,
      port: port,
      path: pathname,
      method: method,
      headers: defaultHeaders
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testPasswordReset() {
  console.log('\n═'.repeat(60));
  console.log('🔐 PASSWORD RESET FLOW TEST');
  console.log('═'.repeat(60));

  const email = process.argv[2] || 'princengwakomashumu@gmail.com';
  const resetToken = process.argv[3]; // Token from email link
  const newPassword = process.argv[4] || 'newSecurePassword123';

  console.log('\n📋 Step 1: Request Password Reset');
  console.log(`Email: ${email}`);

  const requestData = { email: email };

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      '/api/users/request-password-reset',
      'POST',
      requestData
    );

    console.log(`Status: ${response.statusCode}`);
    
    if ((response.statusCode === 200 || response.statusCode === 201) && response.data.success) {
      console.log('✅ Password reset email sent');
      console.log('📧 Check your email for the reset link');
      console.log('\n👉 Next: Extract token from email link and run:');
      console.log(`   node test-flow-01-password-reset.js ${email} <TOKEN> ${newPassword}`);
      
      return true;
    } else {
      console.log('❌ Failed to request password reset');
      console.log('Error:', response.data.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }

  // If reset token provided, complete the reset
  if (resetToken) {
    console.log('\n📋 Step 2: Reset Password with Token');
    console.log(`New Password: ***`);

    const resetData = {
      token: resetToken,
      new_password: newPassword,
      confirm_password: newPassword
    };

    try {
      const response = await makeRequest(
        'localhost',
        3000,
        '/api/users/reset-password',
        'POST',
        resetData
      );

      console.log(`\nStatus: ${response.statusCode}`);

      if ((response.statusCode === 200 || response.statusCode === 201) && response.data.success) {
        console.log('\n✅ Password reset successful!');
        console.log('🔐 Your password has been changed');
        console.log('\n👉 Next: Login with your new password');
        console.log(`   node tests/test-apt-01-login.js`);
        
        return true;
      } else {
        console.log('\n❌ Failed to reset password');
        console.log('Error:', response.data.message || 'Unknown error');
        return false;
      }
    } catch (error) {
      console.error('❌ Request failed:', error.message);
      return false;
    }
  }
}

// Show usage
if (process.argv[2] === '--help') {
  console.log('\n═'.repeat(60));
  console.log('📋 USAGE: node test-flow-01-password-reset.js [EMAIL] [TOKEN] [NEW_PASSWORD]');
  console.log('═'.repeat(60));
  console.log('\nExample:');
  console.log('  node test-flow-01-password-reset.js user@example.com');
  console.log('  node test-flow-01-password-reset.js user@example.com abc123def456 newPass123');
  console.log('\nSteps:');
  console.log('  1. Run with just email to request reset');
  console.log('  2. Check email for reset link');
  console.log('  3. Extract token from link');
  console.log('  4. Run again with token and new password');
  process.exit(0);
}

testPasswordReset();
