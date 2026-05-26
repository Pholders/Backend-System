const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Step 8: Reschedule Appointment
 * Reads appointment ID from .test-data.json
 * Reschedules to a new date/time
 * Optional parameters: [DATE] [TIME_PERIOD]
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

function getNextAvailableDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3); // 3 days from now
  return date.toISOString().split('T')[0];
}

async function rescheduleAppointment() {
  console.log('\n═'.repeat(60));
  console.log('🏥 STEP 8: RESCHEDULE APPOINTMENT');
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

  // Get new date from argument or use default
  const newDate = process.argv[2] || getNextAvailableDate();
  const newTimePeriod = process.argv[3] || 'afternoon';

  console.log('\n📋 Rescheduling appointment...');
  console.log(`Appointment ID: ${appointmentId}`);
  console.log(`New Date: ${newDate}`);
  console.log(`New Time Period: ${newTimePeriod}`);

  const rescheduleData = {
    new_date: newDate,
    new_time_period: newTimePeriod
  };

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      `/api/appointments/${appointmentId}/reschedule`,
      'PUT',
      rescheduleData,
      { 'Authorization': `Bearer ${token}` }
    );

    console.log(`\nStatus: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if ((response.statusCode === 200 || response.statusCode === 201) && response.data.success) {
      const updatedAppointment = response.data.data;
      
      // Save updated appointment details
      testData.appointmentRescheduled = true;
      testData.previousDate = testData.date;
      testData.date = newDate;
      testData.timePeriod = newTimePeriod;
      if (updatedAppointment.time_slot) {
        testData.timeSlot = updatedAppointment.time_slot;
      }
      fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(testData, null, 2));

      console.log('\n✅ Appointment rescheduled successfully!');
      console.log(`📅 Previous Date: ${testData.previousDate}`);
      console.log(`📅 New Date: ${newDate}`);
      console.log(`⏰ New Time Period: ${newTimePeriod}`);
      console.log(`\n📁 Updated test data saved to .test-data.json`);
      console.log('\n👉 Next step: Run test-apt-06-view-appointments.js to verify reschedule');
      
      return true;
    } else {
      console.log('\n❌ Failed to reschedule appointment');
      console.log('Error:', response.data.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

// Usage info
if (process.argv[2] === '--help') {
  console.log('\n═'.repeat(60));
  console.log('📋 USAGE: node test-apt-08-reschedule-appointment.js [DATE] [TIME_PERIOD]');
  console.log('═'.repeat(60));
  console.log('\nExample:');
  console.log('  node test-apt-08-reschedule-appointment.js 2026-05-25 afternoon');
  console.log('  node test-apt-08-reschedule-appointment.js 2026-05-26 evening');
  console.log('\nTime periods: morning, afternoon, evening, night');
  console.log('Date format: YYYY-MM-DD');
  console.log('\n✅ Default: 3 days from now at afternoon');
  process.exit(0);
}

rescheduleAppointment();
