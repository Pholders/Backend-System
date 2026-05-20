const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Step 6: View Patient Appointments
 * Reads token from .test-data.json and fetches all appointments
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

async function viewAppointments() {
  console.log('\n═'.repeat(60));
  console.log('🏥 STEP 6: VIEW MY APPOINTMENTS');
  console.log('═'.repeat(60));

  // Check if test data file exists
  if (!fs.existsSync(TEST_DATA_FILE)) {
    console.log('\n❌ Error: .test-data.json not found');
    console.log('👉 Please run test-apt-01-login.js first');
    return false;
  }

  const testData = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
  const token = testData.token;

  if (!token) {
    console.log('\n❌ Error: Token not found in test data');
    console.log('👉 Please run test-apt-02-verify-otp.js first');
    return false;
  }

  console.log(`\n📋 Fetching your appointments...`);

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      '/api/users/appointments/my-appointments',
      'GET',
      null,
      { 'Authorization': `Bearer ${token}` }
    );
    
    console.log(`\nStatus: ${response.statusCode}`);

    if (response.data.success && response.data.data) {
      const appointments = response.data.data;
      console.log(`\n✅ Retrieved ${appointments.length} appointments\n`);

      if (appointments.length === 0) {
        console.log('ℹ️  No appointments found');
      } else {
        appointments.forEach((apt, index) => {
          console.log(`${index + 1}. Appointment ID: ${apt.id}`);
          console.log(`   Doctor: Dr. ${apt.doctor_first_name} ${apt.doctor_last_name}`);
          console.log(`   Specialization: ${apt.doctor_specialization}`);
          console.log(`   Date: ${apt.appointment_date}`);
          console.log(`   Time: ${apt.time_slot}`);
          console.log(`   Status: ${apt.status}`);
          console.log(`   Symptoms: ${apt.symptoms}`);
          console.log('');
        });
      }

      return true;
    } else {
      console.log('\n❌ Failed to get appointments');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

viewAppointments();
