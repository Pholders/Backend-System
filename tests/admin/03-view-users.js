const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Admin: View all users in the system
 * Lists patients, doctors, and pharmacists
 */

const TEST_DATA_FILE = path.join(__dirname, '.test-data-admin.json');

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

async function viewUsers() {
  console.log('\n═'.repeat(60));
  console.log('👨‍💼 ADMIN: VIEW ALL USERS');
  console.log('═'.repeat(60));

  if (!fs.existsSync(TEST_DATA_FILE)) {
    console.log('\n❌ Error: .test-data-admin.json not found');
    console.log('👉 Please run test-admin-01-login.js first');
    return false;
  }

  const testData = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
  const token = testData.token;

  if (!token) {
    console.log('\n❌ Error: Token not found. Please verify OTP first');
    return false;
  }

  console.log('\n📋 Fetching all users...');

  try {
    const response = await makeRequest(
      'localhost',
      3000,
      '/api/admin/users',
      'GET',
      null,
      { 'Authorization': `Bearer ${token}` }
    );

    console.log(`\nStatus: ${response.statusCode}`);

    if (response.statusCode === 200 && response.data.success) {
      const users = response.data.data || [];

      console.log(`\n✅ Retrieved ${users.length} user(s)`);

      // Group by role
      const groupedUsers = {
        patients: users.filter(u => u.role === 'patient'),
        doctors: users.filter(u => u.role === 'doctor'),
        pharmacists: users.filter(u => u.role === 'pharmacist'),
        admins: users.filter(u => u.role === 'admin')
      };

      console.log('\n👥 USERS BY ROLE:');
      console.log('═'.repeat(60));
      
      console.log(`\n👨 Patients: ${groupedUsers.patients.length}`);
      groupedUsers.patients.slice(0, 5).forEach((user, idx) => {
        console.log(`   ${idx + 1}. ${user.email || 'N/A'} - Verified: ${user.email_verified ? 'Yes' : 'No'}`);
      });

      console.log(`\n👨‍⚕️  Doctors: ${groupedUsers.doctors.length}`);
      groupedUsers.doctors.slice(0, 5).forEach((doctor, idx) => {
        console.log(`   ${idx + 1}. ${doctor.full_name || 'N/A'} (${doctor.specialization || 'N/A'})`);
      });

      console.log(`\n💊 Pharmacists: ${groupedUsers.pharmacists.length}`);
      groupedUsers.pharmacists.slice(0, 5).forEach((pharma, idx) => {
        console.log(`   ${idx + 1}. ${pharma.full_name || 'N/A'}`);
      });

      console.log(`\n👨‍💼 Admins: ${groupedUsers.admins.length}`);

      console.log('\n═'.repeat(60));
      console.log('\n👉 Other admin operations:');
      console.log('   - test-admin-04-view-appointments.js (view all appointments)');
      console.log('   - test-admin-05-system-stats.js (view system statistics)');
      
      return true;
    } else {
      console.log('\n❌ Failed to fetch users');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

viewUsers();
