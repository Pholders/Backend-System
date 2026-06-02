const http = require('http');
const fs = require('fs');

function makeRequest(method, path, token = null) {
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
    req.end();
  });
}

async function test() {
  try {
    console.log('\n🏥 PHARMACY WORKFLOW - STEP 4: VIEW DISPENSING HISTORY & STATS');
    console.log('════════════════════════════════════════════════════════════\n');

    // Load pharmacy data
    if (!fs.existsSync('tests/pharmacies/.test-data-pharmacy.json')) {
      console.log('❌ Pharmacy not logged in. Run 01-login.js first');
      process.exit(1);
    }

    const pharmacyData = JSON.parse(fs.readFileSync('tests/pharmacies/.test-data-pharmacy.json', 'utf8'));
    const token = pharmacyData.token;

    // Get dispensing stats
    console.log('📊 Getting dispensing statistics...\n');
    const statsResponse = await makeRequest(
      'GET',
      '/api/users/pharmacy/dispense-stats',
      token
    );

    console.log(`Status: ${statsResponse.status}`);

    if (statsResponse.status === 200) {
      const stats = statsResponse.body.data;
      console.log(`\n✅ Dispensing Statistics`);
      console.log(`  Pending dispense: ${stats.pendingDispense}`);
      console.log(`  Total dispensed: ${stats.dispensedCount}`);
      console.log(`  Unique patients served: ${stats.uniquePatients}`);
      console.log(`  Dispensed this week: ${stats.dispensedThisWeek}`);
      console.log(`  Dispensed this month: ${stats.dispensedThisMonth}`);
    } else {
      console.log('❌ Failed to get statistics');
      console.log('Response:', JSON.stringify(statsResponse.body, null, 2));
    }

    // Get dispensing history
    console.log('\n\n📋 Getting dispensing history...\n');
    const historyResponse = await makeRequest(
      'GET',
      '/api/users/pharmacy/dispense-history?limit=10&offset=0',
      token
    );

    console.log(`Status: ${historyResponse.status}`);

    if (historyResponse.status === 200) {
      const { data } = historyResponse.body;
      console.log(`\n✅ Dispensing History`);
      console.log(`  Total records: ${data.dispensedCount}\n`);

      if (data.history.length === 0) {
        console.log('ℹ️  No dispensing history yet');
        return;
      }

      data.history.forEach((h, idx) => {
        console.log(`\n📋 Record #${idx + 1}`);
        console.log(`  Prescription #: ${h.prescriptionNumber}`);
        console.log(`  Patient: ${h.patientName}`);
        console.log(`  Email: ${h.patientEmail}`);
        console.log(`  Diagnosis: ${h.diagnosis}`);
        console.log(`  Dispensed at: ${h.dispensedAt}`);
        console.log(`  Medicines: ${h.medicineCount}`);
        if (h.medicines && h.medicines.length > 0) {
          h.medicines.forEach(m => {
            console.log(`    • ${m.medicine_name}`);
          });
        }
        if (h.notes) {
          console.log(`  Notes: ${h.notes}`);
        }
      });
    } else {
      console.log('❌ Failed to get dispensing history');
      console.log('Response:', JSON.stringify(historyResponse.body, null, 2));
    }

    console.log('\n\n✅ Pharmacy dispensing workflow complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();
