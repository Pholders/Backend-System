const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Step 1 (Doctor): Doctor Login
 * Saves doctor email to file for next prescription steps
 */

const TEST_DATA_FILE = path.join(__dirname, '.test-data-doctor.json');

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

async function doctorLogin() {
  console.log('\n═'.repeat(60));
  console.log('👨‍⚕️  DOCTOR FLOW - STEP 1: DOCTOR LOGIN');
  console.log('═'.repeat(60));

  // Use a default doctor email from seed data or command line
  const email = process.argv[2] || 'doctor@example.com';
  const password = 'secure123';

  console.log('\n📋 Logging in as doctor...');
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
      // Save email and other info to file for next steps
      fs.writeFileSync(TEST_DATA_FILE, JSON.stringify({ 
        email: email,
        role: 'doctor',
        loginTime: new Date().toISOString()
      }, null, 2));
      
      console.log('\n✅ Doctor login successful!');
      console.log('📧 OTP has been sent to your email');
      console.log(`\n📁 Email saved to .test-data-doctor.json for next steps`);
      console.log('\n👉 Next step: Run test-pres-02-verify-otp.js with the OTP code');
      
      return true;
    } else {
      console.log('\n❌ Doctor login failed');
      console.log('Message:', response.data.message || 'Unknown error');
      console.log('\n⚠️  Make sure the doctor account exists in the system');
      console.log('💡 TIP: Run seed-test-doctors.js first to create test doctors');
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
  console.log('📋 USAGE: node test-pres-01-doctor-login.js [EMAIL]');
  console.log('═'.repeat(60));
  console.log('\nExample:');
  console.log('  node test-pres-01-doctor-login.js sam.smith@example.com');
  console.log('  node test-pres-01-doctor-login.js lerato.moloi@example.com');
  console.log('\n✅ Default: doctor@example.com');
  console.log('\n💡 Use seeded doctors:');
  console.log('   - sam.smith@example.com (General Practitioner)');
  console.log('   - lerato.moloi@example.com (Paediatrician)');
  console.log('   - thabo.ndlela@example.com (Cardiologist)');
  process.exit(0);
}

doctorLogin();
