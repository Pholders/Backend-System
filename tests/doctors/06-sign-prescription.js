const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Step 6 (Doctor): Sign Prescription with OTP
 * Requests OTP for signing and then signs the prescription
 * Requires OTP code from email
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

async function signPrescription() {
  console.log('\n═'.repeat(60));
  console.log('👨‍⚕️  DOCTOR FLOW - STEP 6: SIGN PRESCRIPTION');
  console.log('═'.repeat(60));

  if (!fs.existsSync(TEST_DATA_FILE)) {
    console.log('\n❌ Error: .test-data-doctor.json not found');
    console.log('👉 Please run test-pres-01-doctor-login.js first');
    return false;
  }

  const testData = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
  const token = testData.token;
  const prescriptionId = testData.prescriptionId;
  const otpCode = process.argv[2];

  if (!token) {
    console.log('\n❌ Error: Token not found. Please verify OTP first');
    return false;
  }

  if (!prescriptionId) {
    console.log('\n❌ Error: Prescription ID not found. Please create a prescription first');
    return false;
  }

  // If no OTP provided, request one first
  if (!otpCode) {
    console.log('\n📋 Step 1: Requesting OTP for signature...');
    console.log(`Prescription ID: ${prescriptionId}`);

    try {
      const response = await makeRequest(
        'localhost',
        3000,
        `/api/prescriptions/${prescriptionId}/request-otp`,
        'POST',
        {},
        { 'Authorization': `Bearer ${token}` }
      );

      console.log(`\nStatus: ${response.statusCode}`);
      
      if ((response.statusCode === 200 || response.statusCode === 201) && response.data.success) {
        console.log('\n✅ OTP requested successfully!');
        console.log('📧 An OTP code has been sent to your email');
        console.log('\n👉 Next: Run this command with the OTP code:');
        console.log(`   node test-pres-06-sign-prescription.js <OTP_CODE>`);
        console.log('\nExample:');
        console.log(`   node test-pres-06-sign-prescription.js 123456`);
        
        return false;
      } else {
        console.log('\n❌ Failed to request OTP');
        console.log('Error:', response.data.message || 'Unknown error');
        return false;
      }
    } catch (error) {
      console.error('❌ Request failed:', error.message);
      return false;
    }
  }

  // Sign prescription with OTP
  console.log('\n📋 Step 2: Signing prescription with OTP...');
  console.log(`Prescription ID: ${prescriptionId}`);
  console.log(`OTP: ${otpCode}`);

  const signData = {
    otp_code: otpCode,
    signature_method: 'RSA-SHA256'
  };

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      `/api/prescriptions/${prescriptionId}/sign`,
      'POST',
      signData,
      { 'Authorization': `Bearer ${token}` }
    );

    console.log(`\nStatus: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    if ((response.statusCode === 200 || response.statusCode === 201) && response.data.success) {
      const prescription = response.data.data;
      
      // Save signed prescription details
      testData.prescriptionSigned = true;
      testData.prescriptionStatus = prescription.status;
      testData.signedAt = prescription.signed_at;
      testData.digitalSignature = prescription.digital_signature ? '***' : null;
      fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(testData, null, 2));

      console.log('\n✅ Prescription signed successfully!');
      console.log(`📊 Status: ${prescription.status}`);
      console.log(`🔐 Digital Signature: Generated (RSA-SHA256)`);
      console.log(`📁 Signed prescription details saved`);
      console.log('\n👉 Next step: Patient can now view and download the prescription');
      
      return true;
    } else {
      console.log('\n❌ Failed to sign prescription');
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
  console.log('📋 USAGE: node test-pres-06-sign-prescription.js [OTP_CODE]');
  console.log('═'.repeat(60));
  console.log('\nExample:');
  console.log('  node test-pres-06-sign-prescription.js 123456');
  console.log('\nSteps:');
  console.log('  1. Run without OTP to request one: node test-pres-06-sign-prescription.js');
  console.log('  2. Check your email for the OTP code');
  console.log('  3. Run with OTP to sign: node test-pres-06-sign-prescription.js 123456');
  process.exit(0);
}

signPrescription();
