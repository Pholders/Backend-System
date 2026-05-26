const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Step 5 (Doctor): Add Medicines to Prescription
 * Adds multiple medicines to the prescription
 * Optional parameter: number of medicines to add
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

const MEDICINES = [
  {
    name: 'Atorvastatin',
    dosage: '20mg',
    frequency: 'Once daily',
    route: 'oral',
    form: 'tablet',
    schedule: 'Schedule 2',
    instructions: 'Take in the evening with food'
  },
  {
    name: 'Lisinopril',
    dosage: '10mg',
    frequency: 'Once daily',
    route: 'oral',
    form: 'tablet',
    schedule: 'Schedule 2',
    instructions: 'Take in the morning on an empty stomach'
  },
  {
    name: 'Metformin',
    dosage: '500mg',
    frequency: 'Twice daily',
    route: 'oral',
    form: 'tablet',
    schedule: 'Schedule 1',
    instructions: 'Take with meals'
  }
];

async function addMedicines() {
  console.log('\n═'.repeat(60));
  console.log('👨‍⚕️  DOCTOR FLOW - STEP 5: ADD MEDICINES TO PRESCRIPTION');
  console.log('═'.repeat(60));

  if (!fs.existsSync(TEST_DATA_FILE)) {
    console.log('\n❌ Error: .test-data-doctor.json not found');
    console.log('👉 Please run test-pres-01-doctor-login.js first');
    return false;
  }

  const testData = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
  const token = testData.token;
  const prescriptionId = testData.prescriptionId;

  if (!token) {
    console.log('\n❌ Error: Token not found. Please verify OTP first');
    return false;
  }

  if (!prescriptionId) {
    console.log('\n❌ Error: Prescription ID not found. Please create a prescription first');
    return false;
  }

  const numMedicines = parseInt(process.argv[2]) || MEDICINES.length;
  const medicinesToAdd = MEDICINES.slice(0, Math.min(numMedicines, MEDICINES.length));

  console.log('\n📋 Adding medicines to prescription...');
  console.log(`Prescription ID: ${prescriptionId}`);
  console.log(`Adding ${medicinesToAdd.length} medicine(s)`);

  let successCount = 0;
  const addedMedicines = [];

  for (let i = 0; i < medicinesToAdd.length; i++) {
    const medicine = medicinesToAdd[i];
    
    console.log(`\n  ${i + 1}. Adding ${medicine.name}...`);

    const medicineData = {
      medicine_name: medicine.name,
      dosage: medicine.dosage,
      frequency: medicine.frequency,
      route: medicine.route,
      form: medicine.form,
      schedule: medicine.schedule,
      instructions: medicine.instructions
    };

    try {
      const response = await makeRequest(
        'localhost',
        3000,
        `/api/prescriptions/${prescriptionId}/medicines`,
        'POST',
        medicineData,
        { 'Authorization': `Bearer ${token}` }
      );

      if ((response.statusCode === 200 || response.statusCode === 201) && response.data.success) {
        console.log(`     ✅ ${medicine.name} added successfully`);
        successCount++;
        addedMedicines.push({
          name: medicine.name,
          dosage: medicine.dosage,
          frequency: medicine.frequency
        });
      } else {
        console.log(`     ❌ Failed to add ${medicine.name}`);
      }
    } catch (error) {
      console.log(`     ❌ Error adding ${medicine.name}: ${error.message}`);
    }
  }

  if (successCount > 0) {
    // Save medicine details
    testData.medicinesAdded = addedMedicines;
    testData.medicineCount = successCount;
    fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(testData, null, 2));

    console.log('\n' + '═'.repeat(60));
    console.log(`\n✅ Successfully added ${successCount} out of ${medicinesToAdd.length} medicine(s)`);
    
    console.log('\n📝 Added Medicines:');
    addedMedicines.forEach((med, idx) => {
      console.log(`   ${idx + 1}. ${med.name} - ${med.dosage} - ${med.frequency}`);
    });

    console.log(`\n📁 Medicine details saved to .test-data-doctor.json`);
    console.log('\n👉 Next step: Run test-pres-06-sign-prescription.js to sign the prescription');
    
    return true;
  } else {
    console.log('\n❌ Failed to add any medicines');
    return false;
  }
}

// Show usage
if (process.argv[2] === '--help') {
  console.log('\n═'.repeat(60));
  console.log('📋 USAGE: node test-pres-05-add-medicines.js [NUMBER_OF_MEDICINES]');
  console.log('═'.repeat(60));
  console.log('\nExample:');
  console.log('  node test-pres-05-add-medicines.js 3 (add all 3 medicines)');
  console.log('  node test-pres-05-add-medicines.js 1 (add only first medicine)');
  console.log('\n✅ Default: Add all available medicines');
  process.exit(0);
}

addMedicines();
