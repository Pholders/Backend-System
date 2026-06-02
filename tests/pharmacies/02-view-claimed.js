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
    console.log('\n🏥 PHARMACY WORKFLOW - STEP 2: VIEW CLAIMED PRESCRIPTIONS');
    console.log('════════════════════════════════════════════════════════════\n');

    // Load pharmacy data
    if (!fs.existsSync('tests/pharmacies/.test-data-pharmacy.json')) {
      console.log('❌ Pharmacy not logged in. Run 01-login.js first');
      process.exit(1);
    }

    const pharmacyData = JSON.parse(fs.readFileSync('tests/pharmacies/.test-data-pharmacy.json', 'utf8'));
    const token = pharmacyData.token;

    console.log('📋 Getting claimed prescriptions...');
    console.log(`Pharmacy: ${pharmacyData.pharmacyName}\n`);

    const response = await makeRequest(
      'GET',
      '/api/users/pharmacy/prescriptions/claimed?limit=50&offset=0',
      token
    );

    console.log(`Status: ${response.status}`);

    if (response.status !== 200) {
      console.log(`❌ Failed to retrieve claimed prescriptions`);
      console.log('Response:', JSON.stringify(response.body, null, 2));
      process.exit(1);
    }

    const { data } = response.body;

    console.log(`\n✅ Retrieved claimed prescriptions`);
    console.log(`Total available: ${data.total}`);
    console.log(`Count: ${data.prescriptions.length}\n`);

    if (data.prescriptions.length === 0) {
      console.log('ℹ️  No prescriptions claimed yet');
      return;
    }

    data.prescriptions.forEach((p, idx) => {
      console.log(`\n📋 Prescription #${idx + 1}`);
      console.log(`  ID: ${p.prescriptionId}`);
      console.log(`  Prescription #: ${p.prescriptionNumber}`);
      console.log(`  Patient: ${p.patientName}`);
      console.log(`  Email: ${p.patientEmail}`);
      console.log(`  Diagnosis: ${p.diagnosis}`);
      console.log(`  Claimed at: ${p.claimedAt}`);
      console.log(`  Medicines: ${p.medicineCount}`);
      if (p.medicines && p.medicines.length > 0) {
        p.medicines.forEach(m => {
          console.log(`    • ${m.medicine_name} ${m.dosage} (${m.frequency})`);
        });
      }

      // Save first prescription for dispensing test
      if (idx === 0) {
        fs.writeFileSync('tests/pharmacies/.test-claimed-prescription.json', JSON.stringify({
          prescriptionId: p.prescriptionId,
          prescriptionNumber: p.prescriptionNumber,
          patientName: p.patientName
        }, null, 2));
      }
    });

    console.log('\n📁 First prescription saved for dispensing test\n');
    console.log('👉 Next step: Run dispensing test (03-dispense.js)\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();
