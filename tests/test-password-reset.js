#!/usr/bin/env node

/**
 * Password Reset Feature - Test Script
 * Tests both endpoints of the password reset system
 * 
 * Usage:
 *   node test-password-reset.js          # Interactive mode
 *   node test-password-reset.js test     # Run default tests
 */

const http = require('http');
const readline = require('readline');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const API_BASE = '/api/auth';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Test 1: Request Password Reset
async function testForgotPassword(email) {
  logSection('TEST 1: Request Password Reset');
  
  logInfo(`Email: ${email}`);
  log('\n📤 Sending request to POST /auth/forgot-password\n', 'blue');

  try {
    const response = await makeRequest(
      'POST',
      `${API_BASE}/forgot-password`,
      { email }
    );

    log(`Response Status: ${response.status}`, 'cyan');
    console.log(JSON.stringify(response.body, null, 2));

    if (response.status === 200 && response.body.success) {
      logSuccess('Password reset email request successful!');
      
      if (response.body.dev_token) {
        logWarning('Development Mode - Token included in response:');
        logInfo(`Token: ${response.body.dev_token}`);
        logInfo(`Link: ${response.body.dev_link}`);
        return response.body.dev_token;
      }
    } else {
      logError(`Request failed: ${response.body.message}`);
    }
  } catch (error) {
    logError(`Error: ${error.message}`);
  }

  return null;
}

// Test 2: Reset Password
async function testResetPassword(token, password) {
  logSection('TEST 2: Reset Password with Token');
  
  logInfo(`Token: ${token}`);
  logInfo(`New Password: ${'*'.repeat(password.length)}`);
  log('\n📤 Sending request to POST /auth/reset-password\n', 'blue');

  try {
    const response = await makeRequest(
      'POST',
      `${API_BASE}/reset-password`,
      {
        token,
        new_password: password,
        confirm_password: password
      }
    );

    log(`Response Status: ${response.status}`, 'cyan');
    console.log(JSON.stringify(response.body, null, 2));

    if (response.status === 200 && response.body.success) {
      logSuccess('Password reset successful!');
    } else {
      logError(`Reset failed: ${response.body.message}`);
    }
  } catch (error) {
    logError(`Error: ${error.message}`);
  }
}

// Test 3: Validate email format
async function testInvalidEmail() {
  logSection('TEST 3: Invalid Email Format');
  
  const invalidEmail = 'notanemail';
  logWarning(`Testing with invalid email: ${invalidEmail}`);
  log('\n📤 Sending request...\n', 'blue');

  try {
    const response = await makeRequest(
      'POST',
      `${API_BASE}/forgot-password`,
      { email: invalidEmail }
    );

    log(`Response Status: ${response.status}`, 'cyan');
    console.log(JSON.stringify(response.body, null, 2));

    if (response.status === 400) {
      logSuccess('Invalid email properly rejected!');
    }
  } catch (error) {
    logError(`Error: ${error.message}`);
  }
}

// Test 4: Weak password
async function testWeakPassword(token) {
  logSection('TEST 4: Weak Password Validation');
  
  const weakPassword = '123';
  logWarning(`Testing with weak password: ${weakPassword}`);
  log('\n📤 Sending request...\n', 'blue');

  try {
    const response = await makeRequest(
      'POST',
      `${API_BASE}/reset-password`,
      {
        token,
        new_password: weakPassword,
        confirm_password: weakPassword
      }
    );

    log(`Response Status: ${response.status}`, 'cyan');
    console.log(JSON.stringify(response.body, null, 2));

    if (response.status === 400) {
      logSuccess('Weak password properly rejected!');
      if (response.body.errors) {
        logInfo('Validation errors:');
        response.body.errors.forEach(err => {
          logInfo(`  - ${err}`);
        });
      }
    }
  } catch (error) {
    logError(`Error: ${error.message}`);
  }
}

// Test 5: Password mismatch
async function testPasswordMismatch(token) {
  logSection('TEST 5: Password Mismatch');
  
  const password1 = 'ValidPassword123!';
  const password2 = 'DifferentPassword123!';
  logWarning(`Testing with mismatched passwords`);
  log('\n📤 Sending request...\n', 'blue');

  try {
    const response = await makeRequest(
      'POST',
      `${API_BASE}/reset-password`,
      {
        token,
        new_password: password1,
        confirm_password: password2
      }
    );

    log(`Response Status: ${response.status}`, 'cyan');
    console.log(JSON.stringify(response.body, null, 2));

    if (response.status === 400) {
      logSuccess('Password mismatch properly rejected!');
    }
  } catch (error) {
    logError(`Error: ${error.message}`);
  }
}

// Test 6: Invalid token
async function testInvalidToken() {
  logSection('TEST 6: Invalid Token');
  
  const invalidToken = 'invalidtokenvalue123';
  logWarning(`Testing with invalid token: ${invalidToken}`);
  log('\n📤 Sending request...\n', 'blue');

  try {
    const response = await makeRequest(
      'POST',
      `${API_BASE}/reset-password`,
      {
        token: invalidToken,
        new_password: 'ValidPassword123!',
        confirm_password: 'ValidPassword123!'
      }
    );

    log(`Response Status: ${response.status}`, 'cyan');
    console.log(JSON.stringify(response.body, null, 2));

    if (response.status === 401) {
      logSuccess('Invalid token properly rejected!');
    }
  } catch (error) {
    logError(`Error: ${error.message}`);
  }
}

// Interactive mode
async function interactiveMode() {
  logSection('🔐 Password Reset Feature - Test Suite');
  
  console.log('\nSelect test to run:');
  console.log('1. Request password reset (forgot-password)');
  console.log('2. Reset password with token (reset-password)');
  console.log('3. Test invalid email format');
  console.log('4. Test weak password');
  console.log('5. Test password mismatch');
  console.log('6. Test invalid token');
  console.log('7. Run all tests');
  console.log('0. Exit\n');

  const choice = await prompt('Enter your choice (0-7): ');

  switch (choice) {
    case '1':
      const email1 = await prompt('Enter email address: ');
      await testForgotPassword(email1);
      break;

    case '2':
      const token = await prompt('Enter reset token: ');
      const password = await prompt('Enter new password: ');
      await testResetPassword(token, password);
      break;

    case '3':
      await testInvalidEmail();
      break;

    case '4':
      const token4 = await prompt('Enter reset token: ');
      await testWeakPassword(token4);
      break;

    case '5':
      const token5 = await prompt('Enter reset token: ');
      await testPasswordMismatch(token5);
      break;

    case '6':
      await testInvalidToken();
      break;

    case '7':
      const email7 = await prompt('Enter test email: ');
      const token7 = await testForgotPassword(email7);
      if (token7) {
        const password7 = 'TestPassword123!';
        await testResetPassword(token7, password7);
      }
      await testInvalidEmail();
      await testInvalidToken();
      break;

    case '0':
      logInfo('Exiting...');
      rl.close();
      return;

    default:
      logError('Invalid choice');
  }

  const continueTest = await prompt('\nRun another test? (y/n): ');
  if (continueTest.toLowerCase() === 'y') {
    await interactiveMode();
  } else {
    logInfo('Exiting...');
    rl.close();
  }
}

// Automated tests
async function runAutomatedTests() {
  logSection('🔐 Running Automated Tests');

  const testEmail = 'test@example.com';
  logInfo(`Using test email: ${testEmail}`);

  // Test 1: Request reset
  logSection('Test 1: Valid Email');
  const token = await testForgotPassword(testEmail);

  if (token) {
    // Test 2: Valid reset
    logSection('Test 2: Valid Password Reset');
    await testResetPassword(token, 'NewPassword123!');
  }

  // Test 3: Invalid email
  await testInvalidEmail();

  // Test 4: Invalid token
  await testInvalidToken();

  logSection('✅ Automated Tests Complete');
  rl.close();
}

// Main
const args = process.argv.slice(2);

if (args[0] === 'test') {
  runAutomatedTests();
} else {
  interactiveMode();
}
