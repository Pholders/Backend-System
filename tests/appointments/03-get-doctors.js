const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Step 3: Get Available Doctors
 * Reads token from .test-data.json and fetches doctor list
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

async function getDoctors() {
  console.log('\n═'.repeat(60));
  console.log('🏥 STEP 3: GET AVAILABLE DOCTORS');
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

  console.log('\n👨‍⚕️  Fetching available doctors...');

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      '/api/users/appointments/available-doctors',
      'GET',
      null,
      { 'Authorization': `Bearer ${token}` }
    );
    
    console.log(`\nStatus: ${response.statusCode}`);

    if (response.data.success && response.data.data) {
      const doctors = response.data.data;
      console.log(`\n✅ Found ${doctors.length} available doctors\n`);

      doctors.forEach((doc, index) => {
        console.log(`${index + 1}. Dr. ${doc.firstName} ${doc.lastName}`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   Specialization: ${doc.specialization}`);
        console.log(`   Experience: ${doc.experience} years`);
        console.log(`   Fee: $${doc.consultationFee}`);
        console.log(`   Rating: ⭐ ${doc.rating.averageRating} (${doc.rating.totalReviews} reviews)`);
        console.log(`   Clinic: ${doc.clinicName}, ${doc.city}`);
        console.log('');
      });

      if (doctors.length > 0) {
        // Save first doctor ID for next step
        testData.selectedDoctorId = doctors[0].id;
        testData.selectedDoctorName = `${doctors[0].firstName} ${doctors[0].lastName}`;
        fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(testData, null, 2));
        
        console.log(`📌 Selected Doctor: Dr. ${testData.selectedDoctorName} (ID: ${testData.selectedDoctorId})`);
        console.log(`\n📁 Doctor info saved to .test-data.json`);
        console.log('\n👉 Next step: Run test-apt-04-get-time-slots.js to see available time slots');
      }

      return true;
    } else {
      console.log('\n❌ Failed to get doctors');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

getDoctors();
