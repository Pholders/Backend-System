const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Step 3 (Doctor): View Pending Appointments
 * Lists all pending appointments for the doctor
 * Saves first pending appointment ID for prescription creation
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

async function viewPendingAppointments() {
  console.log('\n═'.repeat(60));
  console.log('👨‍⚕️  DOCTOR FLOW - STEP 3: VIEW PENDING APPOINTMENTS');
  console.log('═'.repeat(60));

  if (!fs.existsSync(TEST_DATA_FILE)) {
    console.log('\n❌ Error: .test-data-doctor.json not found');
    console.log('👉 Please run test-pres-01-doctor-login.js first');
    return false;
  }

  const testData = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
  const token = testData.token;

  if (!token) {
    console.log('\n❌ Error: Token not found. Please verify OTP first');
    return false;
  }

  console.log('\n📋 Fetching pending appointments...');

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      '/api/appointments/doctor/pending',
      'GET',
      null,
      { 'Authorization': `Bearer ${token}` }
    );

    console.log(`\nStatus: ${response.statusCode}`);

    if (response.statusCode === 200 && response.data.success) {
      const appointments = response.data.data || [];

      console.log(`\n✅ Retrieved ${appointments.length} pending appointment(s)`);

      if (appointments.length > 0) {
        console.log('\n📋 Pending Appointments:');
        console.log('═'.repeat(60));
        
        appointments.forEach((apt, index) => {
          console.log(`\n${index + 1}. Appointment ID: ${apt.id || apt.appointment_id}`);
          console.log(`   Patient: ${apt.patient_name || 'N/A'}`);
          console.log(`   Date: ${apt.appointment_date || 'N/A'}`);
          console.log(`   Time: ${apt.time_period || 'N/A'} - ${apt.time_slot || 'N/A'}`);
          console.log(`   Reason: ${apt.reason_for_visit || 'General checkup'}`);
          console.log(`   Status: ${apt.status || 'Scheduled'}`);
        });

        // Save first appointment for prescription creation
        const firstAppointment = appointments[0];
        testData.appointmentId = firstAppointment.id || firstAppointment.appointment_id;
        testData.patientId = firstAppointment.patient_id;
        testData.patientName = firstAppointment.patient_name;
        testData.appointmentDate = firstAppointment.appointment_date;
        fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(testData, null, 2));

        console.log('\n═'.repeat(60));
        console.log(`📁 First appointment ID saved to .test-data-doctor.json`);
        console.log('\n👉 Next step: Run test-pres-04-create-prescription.js to create a prescription');
        
        return true;
      } else {
        console.log('\n⚠️  No pending appointments found');
        console.log('💡 TIP: Book an appointment as a patient first, then view it here');
        return false;
      }
    } else {
      console.log('\n❌ Failed to fetch pending appointments');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

viewPendingAppointments();
