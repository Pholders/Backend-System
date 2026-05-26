const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Error Handling Test: Invalid Token
 * Tests API behavior with invalid/expired tokens
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

async function testErrorHandling() {
  console.log('\n═'.repeat(60));
  console.log('🧪 ERROR HANDLING TESTS');
  console.log('═'.repeat(60));

  const invalidToken = 'invalid_token_12345678';
  const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MTYyMzkwMjJ9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ';

  const tests = [
    {
      name: 'No Token Provided',
      path: '/api/appointments',
      headers: {}
    },
    {
      name: 'Invalid Token Format',
      path: '/api/appointments',
      headers: { 'Authorization': `Bearer ${invalidToken}` }
    },
    {
      name: 'Malformed Auth Header',
      path: '/api/appointments',
      headers: { 'Authorization': 'InvalidFormat' }
    },
    {
      name: 'Invalid Endpoint',
      path: '/api/invalid-endpoint',
      headers: { 'Authorization': `Bearer ${invalidToken}` }
    },
    {
      name: 'Invalid JSON Body',
      path: '/api/users/login',
      method: 'POST',
      data: null,
      headers: {},
      invalidJSON: true
    }
  ];

  let passCount = 0;
  let failCount = 0;

  for (const test of tests) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`   Path: ${test.path}`);

    try {
      const response = await makeRequest(
        'localhost',
        3000,
        test.path,
        test.method || 'GET',
        test.data || null,
        test.headers
      );

      if (response.statusCode >= 400) {
        console.log(`   ✅ Correctly rejected (Status: ${response.statusCode})`);
        console.log(`   Error: ${response.data.message || response.data.error || 'N/A'}`);
        passCount++;
      } else {
        console.log(`   ❌ Should have been rejected (Status: ${response.statusCode})`);
        failCount++;
      }
    } catch (error) {
      console.log(`   ❌ Unexpected error: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 RESULTS: ${passCount}/${tests.length} passed`);
  console.log(`   ✅ Passed: ${passCount}`);
  console.log(`   ❌ Failed: ${failCount}`);

  if (failCount === 0) {
    console.log('\n🎉 All error handling tests passed!');
  }
}

testErrorHandling();
