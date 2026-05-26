const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Pharmacy Login
 * Saves pharmacist credentials for pharmacy operations
 */

const TEST_DATA_FILE = path.join(__dirname, '.test-data-pharmacy.json');

function makeRequest(hostname, port, path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      defaultHeaders['Content-Length'] = jsonData.length;
    }

    const options = {
      hostname: hostname,
      port: port,
      path: path,
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

async function pharmacyLogin() {
  console.log('\n═'.repeat(60));
  console.log('💊 PHARMACY LOGIN');
  console.log('═'.repeat(60));

  const email = process.argv[2] || 'pharmacy@example.com';
  const password = process.argv[3] || 'secure123';

  console.log('\n📋 Pharmacy login...');
  console.log(`Email: ${email}`);

  const loginData = {
    email: email,
    password: password
  };

  try {
    const response = await makeRequest('localhost', 3000, '/api/users/login', 'POST', loginData);
    
    console.log(`\nStatus: ${response.statusCode}`);

    if (response.data.success && response.data.data) {
      fs.writeFileSync(TEST_DATA_FILE, JSON.stringify({ 
        email: email,
        role: 'pharmacy',
        loginTime: new Date().toISOString()
      }, null, 2));
      
      console.log('\n✅ Pharmacy login successful!');
      console.log('📧 OTP has been sent to pharmacy email');
      console.log(`\n📁 Email saved to .test-data-pharmacy.json`);
      console.log('\n👉 Next step: Run test-pharmacy-02-verify-otp.js with the OTP code');
      
      return true;
    } else {
      console.log('\n❌ Pharmacy login failed');
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
  console.log('📋 USAGE: node test-pharmacy-01-login.js [EMAIL] [PASSWORD]');
  console.log('═'.repeat(60));
  console.log('\nExample:');
  console.log('  node test-pharmacy-01-login.js pharmacy@example.com secure123');
  console.log('\n✅ Default: pharmacy@example.com / secure123');
  process.exit(0);
}

pharmacyLogin();
