const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Patient: View prescription details
 * Displays complete prescription information including medicines
 * Optional parameter: prescription ID
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

async function viewPrescriptionDetails() {
  console.log('\n═'.repeat(60));
  console.log('👤 PATIENT: VIEW PRESCRIPTION DETAILS');
  console.log('═'.repeat(60));

  if (!fs.existsSync(TEST_DATA_FILE)) {
    console.log('\n❌ Error: .test-data.json not found');
    console.log('👉 Please complete the appointment booking flow first');
    return false;
  }

  const testData = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
  const token = testData.token;
  const prescriptionId = process.argv[2] || testData.latestPrescriptionId;

  if (!token) {
    console.log('\n❌ Error: Token not found. Please verify OTP first');
    return false;
  }

  if (!prescriptionId) {
    console.log('\n❌ Error: Prescription ID not found. Please view prescriptions first');
    return false;
  }

  console.log('\n📋 Fetching prescription details...');
  console.log(`Prescription ID: ${prescriptionId}`);

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      `/api/prescriptions/${prescriptionId}`,
      'GET',
      null,
      { 'Authorization': `Bearer ${token}` }
    );

    console.log(`\nStatus: ${response.statusCode}`);

    if (response.statusCode === 200 && response.data.success) {
      const prescription = response.data.data;

      console.log('\n✅ Prescription Details Retrieved');
      console.log('═'.repeat(60));
      
      console.log('\n📋 PRESCRIPTION INFORMATION:');
      console.log(`  Prescription ID: ${prescription.id}`);
      console.log(`  Prescription #: ${prescription.prescription_number}`);
      console.log(`  Status: ${prescription.status}`);
      console.log(`  Date Issued: ${prescription.created_at ? prescription.created_at.split('T')[0] : 'N/A'}`);
      
      console.log('\n👨‍⚕️  DOCTOR INFORMATION:');
      console.log(`  Doctor: ${prescription.doctor_name || 'N/A'}`);
      console.log(`  Specialization: ${prescription.doctor_specialization || 'N/A'}`);
      console.log(`  License: ${prescription.doctor_license || 'N/A'}`);
      
      console.log('\n🏥 CLINICAL INFORMATION:');
      console.log(`  Diagnosis: ${prescription.diagnosis || 'N/A'}`);
      console.log(`  Clinical Notes: ${prescription.clinical_notes || 'N/A'}`);
      
      console.log('\n💊 MEDICINES:');
      if (prescription.medicines && prescription.medicines.length > 0) {
        prescription.medicines.forEach((med, idx) => {
          console.log(`\n  ${idx + 1}. ${med.medicine_name}`);
          console.log(`     Dosage: ${med.dosage}`);
          console.log(`     Frequency: ${med.frequency}`);
          console.log(`     Route: ${med.route}`);
          console.log(`     Form: ${med.form}`);
          console.log(`     Schedule: ${med.schedule}`);
          console.log(`     Instructions: ${med.instructions}`);
          
          if (med.interactions && med.interactions.length > 0) {
            console.log(`     ⚠️  Interactions: ${med.interactions.join(', ')}`);
          }
        });
      } else {
        console.log('  No medicines prescribed yet');
      }
      
      if (prescription.digital_signature) {
        console.log('\n🔐 DIGITAL SIGNATURE:');
        console.log(`  Signed: Yes`);
        console.log(`  Method: RSA-SHA256`);
        console.log(`  Signed At: ${prescription.signed_at || 'N/A'}`);
      }
      
      console.log('\n═'.repeat(60));
      console.log('\n👉 Next steps:');
      console.log('   - test-patient-03-share-prescription.js (share prescription)');
      console.log('   - test-patient-04-download-prescription.js (download as PDF)');
      
      return true;
    } else {
      console.log('\n❌ Failed to fetch prescription details');
      console.log('Response:', JSON.stringify(response.data, null, 2));
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
  console.log('📋 USAGE: node test-patient-02-prescription-details.js [PRESCRIPTION_ID]');
  console.log('═'.repeat(60));
  console.log('\nExample:');
  console.log('  node test-patient-02-prescription-details.js 123abc456');
  console.log('\n✅ Default: Uses latest prescription ID from .test-data.json');
  process.exit(0);
}

viewPrescriptionDetails();
