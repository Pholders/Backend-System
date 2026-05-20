const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Step 1: Patient Login
 * Saves email to file for next steps
 */

const TEST_DATA_FILE = path.join(__dirname, '.test-data.json');

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

async function login() {
  console.log('\n═'.repeat(60));
  console.log('🏥 STEP 1: PATIENT LOGIN');
  console.log('═'.repeat(60));

  const email = 'princengwakomashumu@gmail.com';
  const password = 'secure123';

  console.log('\n📋 Logging in...');
  console.log(`Email: ${email}`);

  const loginData = {
    email: email,
    password: password
  };

  try {
    const response = await makeRequest('localhost', 3000, '/api/users/login', 'POST', loginData);
    
    console.log(`\nStatus: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.data) {
      // Save email to file for next steps
      fs.writeFileSync(TEST_DATA_FILE, JSON.stringify({ email: email }, null, 2));
      
      console.log('\n✅ Login successful!');
      console.log('📧 OTP has been sent to your email');
      console.log(`\n📁 Email saved to .test-data.json for next steps`);
      console.log('\n👉 Next step: Run test-apt-02-verify-otp.js with the OTP code');
      
      return true;
    } else {
      console.log('\n❌ Login failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

login();
