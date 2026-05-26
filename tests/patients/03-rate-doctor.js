const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Patient: Rate Doctor
 * Creates or updates a review/rating for a doctor after appointment
 * Uses patient token and doctor ID from appointment
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

async function rateDoctor() {
  console.log('\n═'.repeat(60));
  console.log('⭐ PATIENT: RATE DOCTOR');
  console.log('═'.repeat(60));

  if (!fs.existsSync(TEST_DATA_FILE)) {
    console.log('\n❌ Error: .test-data.json not found');
    console.log('👉 Please complete the appointment booking flow first');
    return false;
  }

  const testData = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
  const token = testData.token;
  const doctorId = testData.doctorId;
  const appointmentId = testData.appointmentId;

  if (!token) {
    console.log('\n❌ Error: Token not found. Please verify OTP first');
    return false;
  }

  if (!doctorId) {
    console.log('\n❌ Error: Doctor ID not found. Please book an appointment first');
    return false;
  }

  const rating = parseInt(process.argv[2]) || 5;
  const review = process.argv[3] || 'Excellent doctor, very professional and caring.';

  if (rating < 1 || rating > 5) {
    console.log('\n❌ Error: Rating must be between 1 and 5');
    process.exit(1);
  }

  console.log('\n⭐ Rating doctor...');
  console.log(`Doctor ID: ${doctorId}`);
  console.log(`Appointment ID: ${appointmentId || 'N/A'}`);
  console.log(`Rating: ${rating}/5`);
  console.log(`Review: ${review}`);

  const reviewData = {
    doctor_id: doctorId,
    appointment_id: appointmentId,
    rating: rating,
    review: review
  };

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      '/api/reviews',
      'POST',
      reviewData,
      { 'Authorization': `Bearer ${token}` }
    );

    console.log(`\nStatus: ${response.statusCode}`);

    if ((response.statusCode === 200 || response.statusCode === 201) && response.data.success) {
      const savedReview = response.data.data;
      
      testData.reviewId = savedReview.id;
      testData.ratedDoctor = true;
      fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(testData, null, 2));

      console.log('\n✅ Review submitted successfully!');
      console.log(`⭐ Rating: ${savedReview.rating}/5`);
      console.log(`📝 Review ID: ${savedReview.id}`);
      console.log(`\n📁 Review saved to .test-data.json`);
      
      return true;
    } else {
      console.log('\n❌ Failed to submit review');
      console.log('Error:', response.data.message || 'Unknown error');
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
  console.log('📋 USAGE: node test-patient-03-rate-doctor.js [RATING] [REVIEW]');
  console.log('═'.repeat(60));
  console.log('\nExample:');
  console.log('  node test-patient-03-rate-doctor.js 5 \"Great experience!\"');
  console.log('  node test-patient-03-rate-doctor.js 4 \"Professional doctor\"');
  console.log('\nRating: 1-5 (default: 5)');
  console.log('Review: Text description (default: standard message)');
  process.exit(0);
}

rateDoctor();
