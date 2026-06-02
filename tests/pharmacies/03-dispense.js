const http = require('http');
const fs = require('fs');

function makeRequest(method, path, token = null, data = null) {
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
    console.log('\n🏥 PHARMACY WORKFLOW - STEP 3: DISPENSE PRESCRIPTION');
    console.log('════════════════════════════════════════════════════════════\n');

    // Load pharmacy and prescription data
    if (!fs.existsSync('tests/pharmacies/.test-data-pharmacy.json')) {
      console.log('❌ Pharmacy not logged in. Run 01-login.js first');
      process.exit(1);
    }

    if (!fs.existsSync('tests/pharmacies/.test-claimed-prescription.json')) {
      console.log('❌ No claimed prescription found. Run 02-view-claimed.js first');
      process.exit(1);
    }

    const pharmacyData = JSON.parse(fs.readFileSync('tests/pharmacies/.test-data-pharmacy.json', 'utf8'));
    const prescriptionData = JSON.parse(fs.readFileSync('tests/pharmacies/.test-claimed-prescription.json', 'utf8'));
    const token = pharmacyData.token;

    console.log('📋 Dispensing prescription...');
    console.log(`Pharmacy: ${pharmacyData.pharmacyName}`);
    console.log(`Prescription #: ${prescriptionData.prescriptionNumber}`);
    console.log(`Patient: ${prescriptionData.patientName}\n`);

    const dispenseData = {
      notes: 'All medicines in stock and dispensed successfully'
    };

    const response = await makeRequest(
      'POST',
      `/api/users/pharmacy/prescriptions/${prescriptionData.prescriptionId}/dispense`,
      token,
      dispenseData
    );

    console.log(`Status: ${response.status}`);

    if (response.status !== 200) {
      console.log(`❌ Failed to dispense prescription`);
      console.log('Response:', JSON.stringify(response.body, null, 2));
      process.exit(1);
    }

    const { data } = response.body;

    console.log(`\n✅ Prescription dispensed successfully!`);
    console.log(`Prescription #: ${data.prescriptionNumber}`);
    console.log(`Patient ID: ${data.patientId}`);
    console.log(`Dispensed at: ${data.dispensedAt}`);
    console.log(`Dispensed by: ${data.dispensedBy}`);
    console.log(`Pharmacy: ${data.pharmacy}`);

    // Save dispensed prescription data
    fs.writeFileSync('tests/pharmacies/.test-dispensed-prescription.json', JSON.stringify({
      prescriptionId: data.prescriptionId,
      prescriptionNumber: data.prescriptionNumber,
      dispensedAt: data.dispensedAt
    }, null, 2));

    console.log('\n📁 Dispensed prescription data saved\n');
    console.log('👉 Next step: View dispensing history (04-view-history.js)\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();
