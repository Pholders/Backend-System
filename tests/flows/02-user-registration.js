const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Test User Registration Flow
 * Creates a new patient account
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

async function testRegistration() {
  console.log('\n═'.repeat(60));
  console.log('📝 USER REGISTRATION FLOW TEST');
  console.log('═'.repeat(60));

  const email = process.argv[2] || `patient_${Date.now()}@example.com`;
  const firstName = process.argv[3] || 'Test';
  const lastName = process.argv[4] || 'Patient';
  const phone = process.argv[5] || '+27123456789';
  const password = 'TestPassword123!';

  console.log('\n📋 Creating new patient account...');
  console.log(`Email: ${email}`);
  console.log(`Name: ${firstName} ${lastName}`);
  console.log(`Phone: ${phone}`);

  const registrationData = {
    first_name: firstName,
    last_name: lastName,
    email: email,
    phone: phone,
    password: password,
    confirm_password: password,
    user_type: 'patient'
  };

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      '/api/users/register',
      'POST',
      registrationData
    );

    console.log(`\nStatus: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if ((response.statusCode === 200 || response.statusCode === 201) && response.data.success) {
      // Save registration data
      const testData = {
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        registeredAt: new Date().toISOString()
      };
      
      fs.writeFileSync(
        path.join(__dirname, '.test-data-new-user.json'),
        JSON.stringify(testData, null, 2)
      );

      console.log('\n✅ Registration successful!');
      console.log('📧 Verification email has been sent');
      console.log(`\n📁 New user credentials saved to .test-data-new-user.json`);
      console.log('\n👉 Next steps:');
      console.log('   1. Verify email address');
      console.log('   2. Login with credentials');
      console.log('   3. Complete profile setup');
      
      return true;
    } else {
      console.log('\n❌ Registration failed');
      console.log('Error:', response.data.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

// Show usage
if (process.argv[2] === '--help') {
  console.log('\n═'.repeat(60));
  console.log('📋 USAGE: node test-flow-02-user-registration.js [EMAIL] [FIRST_NAME] [LAST_NAME] [PHONE]');
  console.log('═'.repeat(60));
  console.log('\nExample:');
  console.log('  node test-flow-02-user-registration.js');
  console.log('  node test-flow-02-user-registration.js john@example.com John Doe +27123456789');
  console.log('\nDefaults:');
  console.log('  - Email: Random (patient_TIMESTAMP@example.com)');
  console.log('  - Name: Test Patient');
  console.log('  - Phone: +27123456789');
  process.exit(0);
}

testRegistration();
