const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Step 4 (Doctor): Create Prescription
 * Creates a new prescription for the pending appointment
 * Saves prescription ID for adding medicines
 */

const TEST_DATA_FILE = path.join(__dirname, '.test-data-doctor.json');

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

async function createPrescription() {
  console.log('\n═'.repeat(60));
  console.log('👨‍⚕️  DOCTOR FLOW - STEP 4: CREATE PRESCRIPTION');
  console.log('═'.repeat(60));

  if (!fs.existsSync(TEST_DATA_FILE)) {
    console.log('\n❌ Error: .test-data-doctor.json not found');
    console.log('👉 Please run test-pres-01-doctor-login.js first');
    return false;
  }

  const testData = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
  const token = testData.token;
  const appointmentId = testData.appointmentId;

  if (!token) {
    console.log('\n❌ Error: Token not found. Please verify OTP first');
    return false;
  }

  if (!appointmentId) {
    console.log('\n❌ Error: Appointment ID not found. Please view pending appointments first');
    return false;
  }

  console.log('\n📋 Creating prescription...');
  console.log(`Appointment ID: ${appointmentId}`);

  const prescriptionData = {
    appointment_id: appointmentId,
    diagnosis: 'Hypertension and elevated cholesterol',
    clinical_notes: 'Patient presenting with elevated BP readings and lipid levels above normal. Lifestyle modifications recommended along with medication.'
  };

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      '/api/prescriptions',
      'POST',
      prescriptionData,
      { 'Authorization': `Bearer ${token}` }
    );

    console.log(`\nStatus: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if ((response.statusCode === 200 || response.statusCode === 201) && response.data.success) {
      const prescription = response.data.data;
      
      // Save prescription details
      testData.prescriptionId = prescription.id;
      testData.prescriptionNumber = prescription.prescription_number;
      testData.prescriptionStatus = prescription.status;
      testData.diagnosis = prescription.diagnosis;
      fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(testData, null, 2));

      console.log('\n✅ Prescription created successfully!');
      console.log(`📋 Prescription ID: ${prescription.id}`);
      console.log(`📝 Prescription Number: ${prescription.prescription_number}`);
      console.log(`📊 Status: ${prescription.status}`);
      console.log(`🏥 Diagnosis: ${prescription.diagnosis}`);
      console.log(`\n📁 Prescription ID saved to .test-data-doctor.json`);
      console.log('\n👉 Next step: Run test-pres-05-add-medicines.js to add medicines');
      
      return true;
    } else {
      console.log('\n❌ Failed to create prescription');
      console.log('Error:', response.data.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

createPrescription();
