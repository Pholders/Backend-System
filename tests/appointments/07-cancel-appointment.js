const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Step 7: Cancel Appointment
 * Reads appointment ID from .test-data.json
 * Cancels the appointment
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

async function cancelAppointment() {
  console.log('\n═'.repeat(60));
  console.log('🏥 STEP 7: CANCEL APPOINTMENT');
  console.log('═'.repeat(60));

  if (!fs.existsSync(TEST_DATA_FILE)) {
    console.log('\n❌ Error: .test-data.json not found');
    console.log('👉 Please complete the appointment booking flow first');
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
    console.log('\n❌ Error: Appointment ID not found. Please book an appointment first');
    return false;
  }

  console.log('\n📋 Cancelling appointment...');
  console.log(`Appointment ID: ${appointmentId}`);

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      `/api/appointments/${appointmentId}`,
      'DELETE',
      null,
      { 'Authorization': `Bearer ${token}` }
    );

    console.log(`\nStatus: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.statusCode === 200 || response.data.success) {
      console.log('\n✅ Appointment cancelled successfully!');
      console.log(`\n📁 Updated test data saved to .test-data.json`);
      console.log('\n👉 Next step: Run test-apt-06-view-appointments.js to verify cancellation');
      return true;
    } else {
      console.log('\n❌ Failed to cancel appointment');
      console.log('Error:', response.data.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

cancelAppointment();
