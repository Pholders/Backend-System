const http = require('http');

async function testVerifyOTP() {
  console.log('\n=== Testing OTP Verification ===\n');
  
  const verifyData = JSON.stringify({
    email: 'princengwakomashumu@gmail.com',
    otp_code: '428264'
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/users/verify-otp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': verifyData.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('\nResponse:');
        
        try {
          const jsonData = JSON.parse(data);
          console.log(JSON.stringify(jsonData, null, 2));
          
          if (jsonData.success) {
            console.log('\n✅ OTP Verification Successful!');
            console.log('🎫 JWT Token:', jsonData.data.token.substring(0, 50) + '...');
            console.log('\n👤 User Profile:');
            console.log('   Name:', jsonData.data.user.first_name, jsonData.data.user.last_name);
            console.log('   Email:', jsonData.data.user.email);
            console.log('   Phone:', jsonData.data.user.phone);
            console.log('   Nationality:', jsonData.data.user.nationality);
            console.log('\n🎉 Login Complete! You can now use the token for authenticated requests.');
          } else {
            console.log('\n❌ Verification failed:', jsonData.message);
          }
        } catch (error) {
          console.log(data);
        }
        
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });

    req.write(verifyData);
    req.end();
  });
}

testVerifyOTP().catch(console.error);
