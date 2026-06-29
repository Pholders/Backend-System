/**
 * Profile feature smoke test — runs the 6 core checks end-to-end.
 *
 * Usage:
 *   1) Trigger login first (sends OTP to email):
 *        node tests/profile-sanity-check.js login <email> <password>
 *   2) Grab OTP from email / dev console, then:
 *        node tests/profile-sanity-check.js run <email> <otp> [doctorId]
 *
 * Optional env: BASE_URL (default http://localhost:3000)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ---------- HTTP helpers ----------
function request(method, urlStr, { headers = {}, body, raw = false } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      headers: { ...headers },
    };
    if (body && !Buffer.isBuffer(body) && typeof body !== 'string') {
      body = JSON.stringify(body);
      opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
    }
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);

    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (raw) return resolve({ status: res.statusCode, headers: res.headers, body: buf });
        const text = buf.toString('utf8');
        let parsed = text;
        try { parsed = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function multipart(urlStr, headers, fields) {
  // fields: [{ name, filename?, contentType?, value (Buffer|string) }]
  const boundary = '----smoke' + Date.now();
  const parts = [];
  for (const f of fields) {
    parts.push(Buffer.from(`--${boundary}\r\n`));
    if (f.filename) {
      parts.push(Buffer.from(
        `Content-Disposition: form-data; name="${f.name}"; filename="${f.filename}"\r\n` +
        `Content-Type: ${f.contentType || 'application/octet-stream'}\r\n\r\n`
      ));
    } else {
      parts.push(Buffer.from(`Content-Disposition: form-data; name="${f.name}"\r\n\r\n`));
    }
    parts.push(Buffer.isBuffer(f.value) ? f.value : Buffer.from(String(f.value)));
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);
  return request('PUT', urlStr, {
    headers: { ...headers, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

// ---------- Result tracking ----------
const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const tag = ok ? '✅ PASS' : '❌ FAIL';
  console.log(`${tag}  ${name}${detail ? '  — ' + detail : ''}`);
}

function summarize() {
  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  console.log('\n──────────────────────────────────────────');
  console.log(`Summary: ${pass} passed, ${fail} failed (${results.length} total)`);
  process.exit(fail === 0 ? 0 : 1);
}

// ---------- Step 1: trigger login ----------
async function doLogin(email, password) {
  console.log(`\n→ POST /api/users/login (${email})`);
  const r = await request('POST', `${BASE_URL}/api/users/login`, {
    body: { email, password },
  });
  console.log(`  status=${r.status}`);
  console.log(`  body=${typeof r.body === 'string' ? r.body : JSON.stringify(r.body, null, 2)}`);
  if (r.status === 200) {
    console.log('\n✅ OTP sent. Check your email (or dev console) for the 6-digit code,');
    console.log('   then run:');
    console.log(`     node tests/profile-sanity-check.js run ${email} <OTP> [doctorId]`);
  } else {
    console.log('\n❌ Login failed. Fix credentials / server before running smoke tests.');
    process.exit(1);
  }
}

// ---------- Step 2: verify OTP + run profile sanity check tests ----------
async function runSmoke(email, otp, doctorId) {
  // 0. Verify OTP → grab session-tracked token
  console.log('\n=== 0. Verify OTP ===');
  const v = await request('POST', `${BASE_URL}/api/users/verify-otp`, {
    body: { email, otp_code: otp },
  });
  if (v.status !== 200 || !v.body || !v.body.success) {
    console.log(`status=${v.status}`);
    console.log(JSON.stringify(v.body, null, 2));
    record('verify-otp', false, `status ${v.status}`);
    return summarize();
  }
  const token = v.body.data && v.body.data.tokens && v.body.data.tokens.token;
  if (!token) {
    record('verify-otp', false, 'no tokens.token in response');
    console.log(JSON.stringify(v.body, null, 2));
    return summarize();
  }
  record('verify-otp', true, `got session token (len=${token.length})`);
  const auth = { Authorization: `Bearer ${token}` };

  // 1. GET /api/profile
  console.log('\n=== 1. Profile routes mounted ===');
  const p = await request('GET', `${BASE_URL}/api/profile`, { headers: auth });
  record('GET /api/profile', p.status === 200 && p.body && p.body.success,
    `status ${p.status}` + (p.body && p.body.message ? ` — ${p.body.message}` : ''));

  // 2. GET /api/profile/security
  console.log('\n=== 2. Security routes mounted ===');
  const s = await request('GET', `${BASE_URL}/api/profile/security`, { headers: auth });
  record('GET /api/profile/security', s.status === 200 && s.body && s.body.success,
    `status ${s.status}` + (s.body && s.body.message ? ` — ${s.body.message}` : ''));

  // 3. Linked services — link a doctor + list
  console.log('\n=== 3. Linked Services (Phase 5) ===');
  if (!doctorId) {
    record('link doctor', false, 'no doctorId arg supplied — skipped');
  } else {
    const link = await request('POST', `${BASE_URL}/api/profile/linked-services/doctors`, {
      headers: auth,
      body: { doctor_id: Number(doctorId) },
    });
    const linkOk = (link.status === 200 || link.status === 201) && link.body && link.body.success;
    record('POST link doctor', linkOk, `status ${link.status}` +
      (link.body && link.body.message ? ` — ${link.body.message}` : ''));

    const list = await request('GET', `${BASE_URL}/api/profile/linked-services/doctors`, { headers: auth });
    record('GET linked doctors', list.status === 200 && list.body && list.body.success,
      `status ${list.status}`);
  }

  // 4. Public routes (Support FAQ + Legal terms)
  // NOTE: Medical Aid tests (scheme + card upload + signed URL) are intentionally
  // skipped here — pending team review of the Phase 6 encryption flow.
  console.log('\n=== 4. Public routes (Support + Legal) ===');
  const faq = await request('GET', `${BASE_URL}/api/support/faq`);
  record('GET /api/support/faq', faq.status === 200 && faq.body && faq.body.success,
    `status ${faq.status}`);

  const terms = await request('GET', `${BASE_URL}/api/legal/terms`);
  record('GET /api/legal/terms (json)', terms.status === 200 && terms.body && terms.body.success,
    `status ${terms.status}`);

  const termsMd = await request('GET', `${BASE_URL}/api/legal/terms?format=md`);
  const mdOk = termsMd.status === 200 &&
    (typeof termsMd.body === 'string' || (termsMd.headers['content-type'] || '').includes('markdown'));
  record('GET /api/legal/terms?format=md', mdOk, `status ${termsMd.status}`);

  summarize();
}

// ---------- CLI ----------
(async function main() {
  const [, , cmd, a, b, c] = process.argv;
  try {
    if (cmd === 'login') {
      if (!a || !b) {
        console.log('Usage: node tests/profile-sanity-check.js login <email> <password>');
        process.exit(1);
      }
      await doLogin(a, b);
    } else if (cmd === 'run') {
      if (!a || !b) {
        console.log('Usage: node tests/profile-sanity-check.js run <email> <otp> [doctorId]');
        process.exit(1);
      }
      await runSmoke(a, b, c);
    } else {
      console.log('Profile sanity check\n');
      console.log('  Step 1:  node tests/profile-sanity-check.js login <email> <password>');
      console.log('  Step 2:  node tests/profile-sanity-check.js run   <email> <otp> [doctorId]');
      console.log('\nOptional env: BASE_URL (default http://localhost:3000)');
      process.exit(1);
    }
  } catch (e) {
    console.error('Smoke test crashed:', e);
    process.exit(2);
  }
})();
