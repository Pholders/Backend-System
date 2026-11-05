// A support ticket is forwarded to the support inbox by email. The template
// read ticket.type and ticket.body, which the ticket never has, so every
// forwarded ticket said "New undefined Ticket" with an empty message. These
// check the email now carries what the sender wrote. Nothing is sent.
//
// Run with: node tests/supportTicketEmail.test.js
const assert = require('assert');
const emailService = require('../services/emailService');

let passed = 0;
const failures = [];
const tests = [];
const it = (label, fn) => tests.push({ label, fn });

let mail;
emailService.transporter = { sendMail: async (options) => { mail = options; return { messageId: 'test' }; } };

// The shape submitTicket passes: the saved row plus what was typed.
const ticket = {
  id: 12,
  category: 'account',
  subject: 'Fee not showing',
  status: 'open',
  email: 'dr.check@pholders.test',
  message: 'Patients see no fee on my page.',
};
const sender = { id: null, email: 'dr.check@pholders.test', first_name: 'Thandi', last_name: 'Nkosi' };

it('the subject names the category, not undefined', async () => {
  await emailService.sendSupportTicket(ticket, sender);
  assert.strictEqual(mail.subject, '[Support][account] Fee not showing');
});

it('the message the sender typed is in both versions of the email', async () => {
  await emailService.sendSupportTicket(ticket, sender);
  assert.ok(mail.text.includes('Patients see no fee on my page.'));
  assert.ok(mail.html.includes('Patients see no fee on my page.'));
  assert.ok(!mail.html.includes('undefined'));
  assert.ok(!mail.text.includes('undefined'));
});

it('replies go to the sender, and a doctor is not called a patient', async () => {
  await emailService.sendSupportTicket(ticket, sender);
  assert.strictEqual(mail.replyTo, 'dr.check@pholders.test');
  assert.ok(mail.text.includes('Account: Not signed in (a doctor, or a visitor)'));
  await emailService.sendSupportTicket(ticket, { ...sender, id: 20 });
  assert.ok(mail.text.includes('Account: Patient 20'));
});

it('what the sender typed cannot inject HTML', async () => {
  await emailService.sendSupportTicket(
    { ...ticket, subject: '<b>hi</b>', message: '<img src=x onerror=alert(1)>' },
    { ...sender, first_name: '<script>' }
  );
  assert.ok(!mail.html.includes('<img src=x'));
  assert.ok(!mail.html.includes('<script>'));
  assert.ok(mail.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

(async () => {
  for (const { label, fn } of tests) {
    try {
      await fn();
      passed++;
    } catch (error) {
      failures.push({ label, message: error.message });
    }
  }
  for (const f of failures) console.log(`FAIL  ${f.label}\n      ${f.message}`);
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})();
