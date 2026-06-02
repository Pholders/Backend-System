const http = require('http');
const fs = require('fs');

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: responseData ? JSON.parse(responseData) : {}
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: responseData
          });
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

async function test() {
  try {
    console.log('\n🏥 PHARMACY WORKFLOW - STEP 1: LOGIN');
    console.log('════════════════════════════════════════════════════════════\n');

    // Pharmacy login
    console.log('📋 Logging in as pharmacy...');
    console.log('Email: seed.pharm1@seed.test');

    const loginData = {
      email: 'seed.pharm1@seed.test',
      password: 'Pharmacy@123456'
    };

    const loginResponse = await makeRequest('POST', '/api/users/pharmacy/login', loginData);

    if (loginResponse.status !== 200) {
      console.log(`\n❌ Login failed with status ${loginResponse.status}`);
      console.log('Response:', JSON.stringify(loginResponse.body, null, 2));
      process.exit(1);
    }

    const token = loginResponse.body.data.token;
    const pharmacyId = loginResponse.body.data.pharmacyId;

    console.log(`\nStatus: ${loginResponse.status}`);
    console.log(`✅ Pharmacy login successful!`);
    console.log(`🏪 Pharmacy: ${loginResponse.body.data.pharmacy_name}`);
    console.log(`📧 Email: ${loginResponse.body.data.email}`);
    console.log(`📁 Session expires in: ${loginResponse.body.data.sessionInfo.expiresIn}`);

    // Save pharmacy data to file for use in other scripts
    fs.writeFileSync('tests/pharmacies/.test-data-pharmacy.json', JSON.stringify({
      token: token,
      pharmacyId: pharmacyId,
      pharmacyName: loginResponse.body.data.pharmacy_name,
      email: loginResponse.body.data.email
    }, null, 2));

    console.log('\n📁 Pharmacy login data saved to tests/pharmacies/.test-data-pharmacy.json');
    console.log('\n👉 Next step: Run pharmacy prescription retrieval tests');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();
