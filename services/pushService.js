/**
 * Push Service - thin wrapper around Firebase Cloud Messaging.
 *
 * Required environment variables (set in .env):
 *   FCM_PROJECT_ID
 *   FCM_CLIENT_EMAIL
 *   FCM_PRIVATE_KEY          (paste the multi-line key; escape newlines as \n)
 *
 *   OR, alternatively:
 *   GOOGLE_APPLICATION_CREDENTIALS=/abs/path/to/serviceAccount.json
 *
 * Install once: `npm install firebase-admin`
 *
 * Test in isolation (one-off):
 *   node -e "require('./services/pushService').sendToToken('<TOKEN>', {title:'Test', body:'Hello'}).then(console.log)"
 */

let admin = null;
let initialized = false;
let initError = null;

function init() {
  if (initialized) return admin;
  initialized = true;

  try {
    // eslint-disable-next-line global-require
    admin = require('firebase-admin');
  } catch (err) {
    initError = new Error(
      'firebase-admin is not installed. Run `npm install firebase-admin` to enable push.'
    );
    console.warn(`⚠️  Push disabled: ${initError.message}`);
    return null;
  }

  try {
    if (admin.apps.length === 0) {
      let credential;
      if (process.env.FCM_PROJECT_ID && process.env.FCM_CLIENT_EMAIL && process.env.FCM_PRIVATE_KEY) {
        credential = admin.credential.cert({
          projectId: process.env.FCM_PROJECT_ID,
          clientEmail: process.env.FCM_CLIENT_EMAIL,
          privateKey: process.env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        credential = admin.credential.applicationDefault();
      } else {
        initError = new Error(
          'FCM credentials missing. Set FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY (or GOOGLE_APPLICATION_CREDENTIALS).'
        );
        console.warn(`⚠️  Push disabled: ${initError.message}`);
        admin = null;
        return null;
      }
      admin.initializeApp({ credential });
      console.log('✅ Firebase Admin initialized for push notifications');
    }
  } catch (err) {
    initError = err;
    console.warn(`⚠️  Push disabled: failed to init firebase-admin: ${err.message}`);
    admin = null;
  }

  return admin;
}

/**
 * Send a push to a single device token.
 * @param {string} token       FCM device token
 * @param {object} payload     { title, body, data? }
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string, invalidToken?: boolean }>}
 */
async function sendToToken(token, { title, body, data } = {}) {
  if (!token) return { ok: false, error: 'no token' };

  const sdk = init();
  if (!sdk) {
    return { ok: false, error: initError ? initError.message : 'push disabled' };
  }

  const message = {
    token,
    notification: { title: title || '', body: body || '' },
    data: data ? Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v == null ? '' : String(v)])
    ) : undefined,
  };

  try {
    const messageId = await sdk.messaging().send(message);
    return { ok: true, messageId };
  } catch (err) {
    const code = err && err.errorInfo && err.errorInfo.code;
    const invalidToken =
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token';
    return { ok: false, error: err.message, invalidToken };
  }
}

/**
 * Send the same push to many tokens. Returns per-token results.
 */
async function sendToTokens(tokens, payload) {
  const list = Array.isArray(tokens) ? tokens.filter(Boolean) : [];
  if (list.length === 0) return [];
  const results = await Promise.all(list.map((t) => sendToToken(t, payload)));
  return list.map((token, i) => ({ token, ...results[i] }));
}

module.exports = {
  init,
  sendToToken,
  sendToTokens,
};
