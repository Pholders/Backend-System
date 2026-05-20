const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Refresh Token Helper
 * Uses refreshToken to get a new accessToken without re-login
 * Works for both patient and doctor flows
 */

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

async function refreshToken(testDataFile) {
  console.log('\n═'.repeat(60));
  console.log('🔄 REFRESHING TOKEN');
  console.log('═'.repeat(60));

  if (!fs.existsSync(testDataFile)) {
    console.log('\n❌ Error: Test data file not found');
    console.log(`Expected: ${testDataFile}`);
    return false;
  }

  const testData = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
  const refreshToken = testData.refreshToken;

  if (!refreshToken) {
    console.log('\n❌ Error: No refresh token found in test data');
    console.log('👉 Please run OTP verification step first');
    return false;
  }

  console.log('\n🔐 Using refresh token to get new access token...');

  const refreshData = {
    refreshToken: refreshToken
  };

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      '/api/users/refresh-token',
      'POST',
      refreshData
    );
    
    console.log(`Status: ${response.statusCode}`);

    if (response.data.success && response.data.data) {
      const newAccessToken = response.data.data.accessToken || response.data.data.token;
      
      if (!newAccessToken) {
        console.log('\n❌ Error: No new access token in response');
        return false;
      }

      // Update the token in test data
      testData.token = newAccessToken;
      testData.tokenRefreshedAt = new Date().toISOString();
      fs.writeFileSync(testDataFile, JSON.stringify(testData, null, 2));
      
      console.log('\n✅ Token refreshed successfully!');
      console.log(`📱 New Token: ${newAccessToken.substring(0, 20)}...`);
      console.log(`⏰ Refreshed at: ${testData.tokenRefreshedAt}`);
      console.log('\n📁 Updated in test data file');
      console.log('\n👉 Now you can continue with your tests!');
      
      return true;
    } else {
      console.log('\n❌ Token refresh failed');
      console.log('Error:', response.data.message || 'Unknown error');
      console.log('\nℹ️  You may need to re-login:');
      console.log('   - Patient: node tests/test-apt-01-login.js');
      console.log('   - Doctor: node tests/test-doc-01-login.js');
      return false;
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    return false;
  }
}

// Main logic to determine which test data file to use
const args = process.argv[2];
let testDataFile = null;

if (args === '--patient' || args === '-p') {
  testDataFile = path.join(__dirname, '.test-data.json');
  console.log('Using patient test data');
} else if (args === '--doctor' || args === '-d') {
  testDataFile = path.join(__dirname, '.test-data-doctor.json');
  console.log('Using doctor test data');
} else {
  // Try to auto-detect - check which file exists and is more recent
  const patientFile = path.join(__dirname, '.test-data.json');
  const doctorFile = path.join(__dirname, '.test-data-doctor.json');
  
  const patientExists = fs.existsSync(patientFile);
  const doctorExists = fs.existsSync(doctorFile);
  
  if (patientExists && !doctorExists) {
    testDataFile = patientFile;
  } else if (doctorExists && !patientExists) {
    testDataFile = doctorFile;
  } else if (patientExists && doctorExists) {
    // Use the more recently modified one
    const patientStat = fs.statSync(patientFile);
    const doctorStat = fs.statSync(doctorFile);
    testDataFile = patientStat.mtime > doctorStat.mtime ? patientFile : doctorFile;
  } else {
    console.log('\n═'.repeat(60));
    console.log('📋 USAGE: node refresh-token.js [--patient|-p | --doctor|-d]');
    console.log('═'.repeat(60));
    console.log('\nExamples:');
    console.log('  node refresh-token.js --patient  (or -p)');
    console.log('  node refresh-token.js --doctor   (or -d)');
    console.log('  node refresh-token.js             (auto-detect)');
    process.exit(1);
  }
}

refreshToken(testDataFile);
