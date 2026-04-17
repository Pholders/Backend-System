const http = require('http');

async function testLogin() {
  console.log('\n=== Testing Login Endpoint ===\n');
  
  const loginData = JSON.stringify({
    email: 'princengwakomashumu@gmail.com',
    password: 'secure123'
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/users/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
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
            console.log('\n✅ Login request successful!');
            console.log('📧 Check your email for the OTP code');
          } else {
            console.log('\n❌ Login failed:', jsonData.message);
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

    req.write(loginData);
    req.end();
  });
}

testLogin().catch(console.error);
