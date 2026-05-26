const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Step 2 (Doctor): Verify OTP
 * Reads email from .test-data-doctor.json and verifies OTP
 * Saves token for prescription operations
 */

const TEST_DATA_FILE = path.join(__dirname, '.test-data-doctor.json');

function makeRequest(hostname, port, pathname, method = 'GET', data = null) {
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

async function verifyOTP(otp) {
  console.log('\n═'.repeat(60));
  console.log('👨‍⚕️  DOCTOR FLOW - STEP 2: VERIFY OTP');
  console.log('═'.repeat(60));

  // Check if test data file exists
  if (!fs.existsSync(TEST_DATA_FILE)) {
    console.log('\n❌ Error: .test-data-doctor.json not found');
    console.log('👉 Please run test-pres-01-doctor-login.js first');
    return false;
  }

  const testData = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
  const email = testData.email;

  if (!email) {
    console.log('\n❌ Error: Email not found in test data');
    return false;
  }

  console.log('\n🔐 Verifying OTP...');
  console.log(`Email: ${email}`);
  console.log(`OTP: ${otp}`);

  const otpData = {
    email: email,
    otp_code: otp
  };

  try {
    const response = await makeRequest('localhost', 3000, '/api/users/verify-otp', 'POST', otpData);
    
    console.log(`\nStatus: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.data) {
      const token = response.data.data.tokens?.accessToken || response.data.data.token;
      const refreshToken = response.data.data.tokens?.refreshToken;
      
      if (!token) {
        console.log('\n❌ OTP verification failed - No token in response');
        return false;
      }
      
      // Save token and refresh token to file for next steps
      testData.token = token;
      testData.refreshToken = refreshToken;
      testData.tokenTimestamp = new Date().toISOString();
      testData.tokenExpiresIn = response.data.data.tokens?.expiresIn || 900;
      fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(testData, null, 2));
      
      console.log('\n✅ OTP verified successfully!');
      console.log(`📱 Token: ${token.substring(0, 20)}...`);
      console.log(`⏳ Expires in: ${testData.tokenExpiresIn} seconds (~${Math.round(testData.tokenExpiresIn/60)} minutes)`);
      console.log(`\n📁 Token saved to .test-data-doctor.json for next steps`);
      console.log('\n👉 Next steps:');
      console.log('   - test-pres-03-pending-appointments.js (view pending appointments)');
      console.log('   - test-pres-04-create-prescription.js (create prescription)');
      console.log('\n⚠️  Token expires soon? Use: node refresh-token.js --doctor');
      
      return true;
    } else {
      console.log('\n❌ OTP verification failed');
      console.log('Error:', response.data.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

// Get OTP from command line argument or prompt
const otp = process.argv[2];

if (!otp) {
  console.log('\n═'.repeat(60));
  console.log('📋 USAGE: node test-pres-02-verify-otp.js <OTP_CODE>');
  console.log('═'.repeat(60));
  console.log('\nExample:');
  console.log('  node test-pres-02-verify-otp.js 253849');
  console.log('\n⚠️  Replace 253849 with the OTP code from your email');
  process.exit(1);
}

verifyOTP(otp);
