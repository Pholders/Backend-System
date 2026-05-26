const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Error Handling Test: Invalid Input Data
 * Tests API validation with various invalid inputs
 */

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

async function testInvalidInputs() {
  console.log('\n═'.repeat(60));
  console.log('🧪 INPUT VALIDATION TESTS');
  console.log('═'.repeat(60));

  const tests = [
    {
      name: 'Missing Required Fields - Login',
      path: '/api/users/login',
      method: 'POST',
      data: { email: 'test@example.com' }, // Missing password
      expectError: true
    },
    {
      name: 'Invalid Email Format - Login',
      path: '/api/users/login',
      method: 'POST',
      data: { email: 'not-an-email', password: 'password123' },
      expectError: true
    },
    {
      name: 'Empty Email - Login',
      path: '/api/users/login',
      method: 'POST',
      data: { email: '', password: 'password123' },
      expectError: true
    },
    {
      name: 'Invalid OTP Length',
      path: '/api/users/verify-otp',
      method: 'POST',
      data: { email: 'test@example.com', otp_code: '123' }, // Should be 6 digits
      expectError: true
    },
    {
      name: 'Invalid Date Format - Appointments',
      path: '/api/appointments/available-slots?doctor_id=123&appointment_date=invalid-date&time_period=morning',
      method: 'GET',
      expectError: true
    }
  ];

  let passCount = 0;
  let failCount = 0;

  for (const test of tests) {
    console.log(`\n📝 Test: ${test.name}`);

    try {
      const response = await makeRequest(
        'localhost',
        3000,
        test.path,
        test.method || 'GET',
        test.data || null,
        {}
      );

      if (test.expectError) {
        if (response.statusCode >= 400) {
          console.log(`   ✅ Correctly rejected (Status: ${response.statusCode})`);
          console.log(`   Error: ${response.data.message || 'N/A'}`);
          passCount++;
        } else {
          console.log(`   ❌ Should have been rejected (Status: ${response.statusCode})`);
          failCount++;
        }
      } else {
        if (response.statusCode < 400) {
          console.log(`   ✅ Accepted (Status: ${response.statusCode})`);
          passCount++;
        } else {
          console.log(`   ❌ Should have been accepted (Status: ${response.statusCode})`);
          failCount++;
        }
      }
    } catch (error) {
      console.log(`   ❌ Request error: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 RESULTS: ${passCount}/${tests.length} passed`);
  console.log(`   ✅ Passed: ${passCount}`);
  console.log(`   ❌ Failed: ${failCount}`);

  if (failCount === 0) {
    console.log('\n🎉 All input validation tests passed!');
  }
}

testInvalidInputs();
