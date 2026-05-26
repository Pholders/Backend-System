# 🧪 Error Handling Tests

## Overview
Comprehensive test suite for API error handling, validation, and security.

## Tests Included

### 1. **01-invalid-tokens.js** - Token Validation
Tests API security with various invalid token scenarios:

```bash
node 01-invalid-tokens.js
```

**Scenarios Tested:**
- ❌ No token provided
- ❌ Invalid token format
- ❌ Malformed auth header
- ❌ Invalid endpoint
- ✅ Correct error responses (401/403)

---

### 2. **02-invalid-inputs.js** - Input Validation
Tests API input validation with invalid data:

```bash
node 02-invalid-inputs.js
```

**Scenarios Tested:**
- ❌ Missing required fields
- ❌ Invalid email format
- ❌ Empty email
- ❌ Invalid OTP length
- ❌ Invalid date format
- ✅ Proper error messages
- ✅ HTTP error codes

---

## 🔄 Complete Test Run

```bash
# Test token validation
node 01-invalid-tokens.js

# Test input validation
node 02-invalid-inputs.js
```

---

## 📊 Test Coverage

### Token Validation Tests
```
Test 1: No Token Provided
Test 2: Invalid Token Format
Test 3: Malformed Auth Header
Test 4: Invalid Endpoint
```

### Input Validation Tests
```
Test 1: Missing Required Fields - Login
Test 2: Invalid Email Format - Login
Test 3: Empty Email - Login
Test 4: Invalid OTP Length
Test 5: Invalid Date Format - Appointments
```

---

## ✅ Expected Results

All tests should show:

```
📝 Test: [Test Name]
   ✅ Correctly rejected (Status: 400/401/403)
   Error: [Error message]

📊 RESULTS: X/Y passed
   ✅ Passed: X
   ❌ Failed: 0

🎉 All error handling tests passed!
```

---

## ⏱️ Timing

- **Complete Suite:** 10 minutes
- **Token Tests:** 5 minutes
- **Input Validation Tests:** 5 minutes

---

## 🔑 Security Tests

✅ Authentication Security  
✅ Authorization Checks  
✅ Input Sanitization  
✅ Error Message Safety  
✅ HTTP Status Codes  
✅ Malformed Request Handling  
✅ Missing Field Detection  
✅ Format Validation  

---

## 📋 Expected Error Codes

- **400** - Bad Request (invalid input)
- **401** - Unauthorized (no/invalid token)
- **403** - Forbidden (access denied)
- **404** - Not Found (invalid endpoint)
- **500** - Server Error

---

## 📝 Notes

- Tests verify proper error responses
- Security-focused validation
- Intentional bad requests
- All errors should be handled gracefully
- No sensitive data in error messages

---

## 🚀 Quick Help

```bash
# Get help for any test
node 01-invalid-tokens.js --help
node 02-invalid-inputs.js --help
```

---

## 📊 Test Results Interpretation

**✅ Green Check** = Test passed, error handled correctly  
**❌ Red X** = Test failed, error not handled properly  
**⚠️ Warning** = Important security issue found  

---

## 📂 File References

All tests reference the original implementation:
- Actual test files: `../test-errors-*.js`
- This folder provides organized shortcuts
- Both locations work identically

To run from root:
```bash
node test-errors-01-invalid-tokens.js
```

To run from errors folder:
```bash
cd errors
node 01-invalid-tokens.js
```

---

**Category:** Error Handling & Security  
**Tests:** 2  
**Test Cases:** 10+  
**Status:** ✅ Complete
