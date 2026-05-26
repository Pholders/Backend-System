const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Step 5: Book Appointment
 * Reads token, doctor ID, and slot info from .test-data.json
 * Accepts symptoms as argument
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

async function bookAppointment(symptoms) {
  console.log('\n═'.repeat(60));
  console.log('🏥 STEP 5: BOOK APPOINTMENT');
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
  const date = testData.selectedDate;
  const slot = testData.selectedTimeSlot;

  if (!token) {
    console.log('\n❌ Error: Token not found in test data');
    console.log('👉 Please run test-apt-02-verify-otp.js first');
    return false;
  }

  if (!doctorId || !date || !slot) {
    console.log('\n❌ Error: Missing appointment details in test data');
    console.log('👉 Please run test-apt-04-get-time-slots.js first');
    return false;
  }

  if (!symptoms) {
    symptoms = 'General checkup';
  }

  const bookingData = {
    doctorId: doctorId,
    appointmentDate: date,
    timeSlot: slot,
    symptoms: symptoms
  };

  console.log(`\n📅 Booking appointment...`);
  console.log(`Doctor: Dr. ${testData.selectedDoctorName}`);
  console.log(`Date: ${date}`);
  console.log(`Time: ${slot}`);
  console.log(`Symptoms: ${symptoms}`);

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      '/api/users/appointments/book',
      'POST',
      bookingData,
      { 'Authorization': `Bearer ${token}` }
    );
    
    console.log(`\nStatus: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      const appointmentId = response.data.data?.appointmentId;
      
      console.log('\n✅ Appointment booked successfully!');
      if (appointmentId) {
        console.log(`📌 Appointment ID: ${appointmentId}`);
        
        // Save appointment ID for next steps
        testData.appointmentId = appointmentId;
        fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(testData, null, 2));
        console.log(`📁 Appointment info saved to .test-data.json`);
      }
      
      console.log('\n👉 Next step: Run test-apt-06-view-appointments.js to see all your appointments');

      return true;
    } else {
      console.log('\n❌ Booking failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

// Get symptoms from command line argument
const symptoms = process.argv[2];

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('\n═'.repeat(60));
  console.log('📋 USAGE: node test-apt-05-book-appointment.js [SYMPTOMS]');
  console.log('═'.repeat(60));
  console.log('\nArguments:');
  console.log('  SYMPTOMS - Description of symptoms (default: "General checkup")');
  console.log('\nExamples:');
  console.log('  node test-apt-05-book-appointment.js');
  console.log('  node test-apt-05-book-appointment.js "Fever and cough"');
  console.log('  node test-apt-05-book-appointment.js "Persistent headache"');
  process.exit(0);
}

bookAppointment(symptoms);
