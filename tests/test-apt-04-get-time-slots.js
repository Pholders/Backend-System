const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Step 4: Get Available Time Slots
 * Reads token and doctor ID from .test-data.json
 * Accepts date and timePeriod as arguments
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

async function getTimeSlots(dateStr, timePeriod) {
  console.log('\n═'.repeat(60));
  console.log('🏥 STEP 4: GET AVAILABLE TIME SLOTS');
  console.log('═'.repeat(60));

  // Check if test data file exists
  if (!fs.existsSync(TEST_DATA_FILE)) {
    console.log('\n❌ Error: .test-data.json not found');
    console.log('👉 Please run test-apt-01-login.js first');
    return false;
  }

  const testData = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
  const token = testData.token;
  const doctorId = testData.selectedDoctorId;

  if (!token) {
    console.log('\n❌ Error: Token not found in test data');
    console.log('👉 Please run test-apt-02-verify-otp.js first');
    return false;
  }

  if (!doctorId) {
    console.log('\n❌ Error: Doctor ID not found in test data');
    console.log('👉 Please run test-apt-03-get-doctors.js first');
    return false;
  }

  // If date not provided, use tomorrow
  if (!dateStr) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateStr = tomorrow.toISOString().split('T')[0];
  }

  // Default time period
  if (!timePeriod) {
    timePeriod = 'morning';
  }

  console.log(`\n⏰ Fetching available time slots...`);
  console.log(`Doctor: Dr. ${testData.selectedDoctorName}`);
  console.log(`Date: ${dateStr}`);
  console.log(`Time Period: ${timePeriod}`);

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      `/api/users/appointments/available-slots?doctorId=${doctorId}&date=${dateStr}&timePeriod=${timePeriod}`,
      'GET',
      null,
      { 'Authorization': `Bearer ${token}` }
    );
    
    console.log(`\nStatus: ${response.statusCode}`);

    if (response.data.success && response.data.data) {
      const slots = response.data.data;
      console.log(`\n✅ Found ${slots.length} available time slots:\n`);
      
      slots.forEach((slot, index) => {
        console.log(`${index + 1}. ${slot}`);
      });

      if (slots.length > 0) {
        // Save slot info for next step
        testData.selectedDate = dateStr;
        testData.selectedTimePeriod = timePeriod;
        testData.selectedTimeSlot = slots[0];
        fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(testData, null, 2));
        
        console.log(`\n📌 Selected Slot: ${testData.selectedTimeSlot}`);
        console.log(`📁 Slot info saved to .test-data.json`);
        console.log('\n👉 Next step: Run test-apt-05-book-appointment.js to book the appointment');
      }

      return true;
    } else {
      console.log('\n❌ Failed to get time slots');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

// Get date and time period from command line arguments
const dateArg = process.argv[2];
const timePeriodArg = process.argv[3];

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('\n═'.repeat(60));
  console.log('📋 USAGE: node test-apt-04-get-time-slots.js [DATE] [TIME_PERIOD]');
  console.log('═'.repeat(60));
  console.log('\nArguments:');
  console.log('  DATE - Date in YYYY-MM-DD format (default: tomorrow)');
  console.log('  TIME_PERIOD - morning, afternoon, evening, night (default: morning)');
  console.log('\nExamples:');
  console.log('  node test-apt-04-get-time-slots.js                    (tomorrow morning)');
  console.log('  node test-apt-04-get-time-slots.js 2026-05-21         (May 21 morning)');
  console.log('  node test-apt-04-get-time-slots.js 2026-05-21 afternoon (May 21 afternoon)');
  process.exit(0);
}

getTimeSlots(dateArg, timePeriodArg);
