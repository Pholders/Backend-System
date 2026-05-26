const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Patient: View all prescriptions
 * Uses patient token from appointment booking flow
 * Displays all signed and pending prescriptions
 */

const TEST_DATA_FILE = path.join(__dirname, '.test-data.json');

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

async function viewPrescriptions() {
  console.log('\n═'.repeat(60));
  console.log('👤 PATIENT: VIEW ALL PRESCRIPTIONS');
  console.log('═'.repeat(60));

  if (!fs.existsSync(TEST_DATA_FILE)) {
    console.log('\n❌ Error: .test-data.json not found');
    console.log('👉 Please complete the appointment booking flow first');
    return false;
  }

  const testData = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
  const token = testData.token;

  if (!token) {
    console.log('\n❌ Error: Token not found. Please verify OTP first');
    return false;
  }

  console.log('\n📋 Fetching prescriptions...');

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      '/api/prescriptions',
      'GET',
      null,
      { 'Authorization': `Bearer ${token}` }
    );

    console.log(`\nStatus: ${response.statusCode}`);

    if (response.statusCode === 200 && response.data.success) {
      const prescriptions = response.data.data || [];

      console.log(`\n✅ Retrieved ${prescriptions.length} prescription(s)`);

      if (prescriptions.length > 0) {
        console.log('\n📋 Your Prescriptions:');
        console.log('═'.repeat(60));
        
        prescriptions.forEach((pres, index) => {
          console.log(`\n${index + 1}. Prescription ID: ${pres.id}`);
          console.log(`   Prescription #: ${pres.prescription_number}`);
          console.log(`   Doctor: ${pres.doctor_name || 'N/A'}`);
          console.log(`   Date: ${pres.created_at ? pres.created_at.split('T')[0] : 'N/A'}`);
          console.log(`   Diagnosis: ${pres.diagnosis || 'N/A'}`);
          console.log(`   Status: ${pres.status || 'pending'}`);
          
          if (pres.medicines && pres.medicines.length > 0) {
            console.log(`   Medicines (${pres.medicines.length}):`);
            pres.medicines.forEach((med, idx) => {
              console.log(`      ${idx + 1}. ${med.medicine_name} - ${med.dosage}`);
            });
          }
        });

        // Save first prescription for further operations
        if (prescriptions.length > 0) {
          testData.latestPrescriptionId = prescriptions[0].id;
          testData.latestPrescriptionNumber = prescriptions[0].prescription_number;
          fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(testData, null, 2));
        }

        console.log('\n═'.repeat(60));
        console.log(`📁 Latest prescription ID saved to .test-data.json`);
        console.log('\n👉 Next steps:');
        console.log('   - test-patient-02-prescription-details.js (view prescription details)');
        console.log('   - test-patient-03-share-prescription.js (share prescription)');
        console.log('   - test-patient-04-download-prescription.js (download as PDF)');
        
        return true;
      } else {
        console.log('\n⚠️  No prescriptions found');
        console.log('💡 TIP: Have a doctor create and sign a prescription first');
        return false;
      }
    } else {
      console.log('\n❌ Failed to fetch prescriptions');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

viewPrescriptions();
