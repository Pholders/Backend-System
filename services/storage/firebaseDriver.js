/**
 * Firebase Cloud Storage.
 *
 * Shares the firebase-admin app with push notifications rather than
 * initialising a second one — firebase-admin throws on a duplicate default
 * app, and both features belong to the same project.
 *
 * Credentials follow the convention pushService already uses
 * (FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY, or
 * GOOGLE_APPLICATION_CREDENTIALS). The bucket is FIREBASE_STORAGE_BUCKET,
 * e.g. `pholders-dev.appspot.com`.
 *
 * Nothing here is made public. Objects are private and read back through our
 * own download route, which re-checks ownership first.
 */

let bucket = null;
let initError = null;

function getBucket() {
  if (bucket || initError) {
    if (initError) throw initError;
    return bucket;
  }

  let admin;
  try {
    admin = require('firebase-admin');
  } catch (err) {
    initError = new Error(
      'firebase-admin is not installed. Run `npm install firebase-admin`.'
    );
    throw initError;
  }

  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    initError = new Error(
      'FIREBASE_STORAGE_BUCKET is not set — storage cannot start.'
    );
    throw initError;
  }

  try {
    if (admin.apps.length === 0) {
      let credential;
      if (
        process.env.FCM_PROJECT_ID &&
        process.env.FCM_CLIENT_EMAIL &&
        process.env.FCM_PRIVATE_KEY
      ) {
        credential = admin.credential.cert({
          projectId: process.env.FCM_PROJECT_ID,
          clientEmail: process.env.FCM_CLIENT_EMAIL,
          privateKey: process.env.FCM_PRIVATE_KEY.replace(/\n/g, '\n'),
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        credential = admin.credential.applicationDefault();
      } else {
        initError = new Error(
          'Firebase credentials missing. Set FCM_PROJECT_ID / FCM_CLIENT_EMAIL / ' +
            'FCM_PRIVATE_KEY, or GOOGLE_APPLICATION_CREDENTIALS.'
        );
        throw initError;
      }
      admin.initializeApp({ credential, storageBucket: bucketName });
    }

    bucket = admin.storage().bucket(bucketName);
    return bucket;
  } catch (err) {
    initError = err;
    throw err;
  }
}

async function put(file, destination, filename) {
  const key = `${destination}/${filename}`;
  const object = getBucket().file(key);

  await object.save(file.buffer, {
    resumable: false,
    contentType: file.mimetype || 'application/octet-stream',
    metadata: {
      // Patient documents: never cached by an intermediary.
      cacheControl: 'private, max-age=0, no-store',
    },
  });

  return key;
}

async function get(key) {
  const object = getBucket().file(key);
  try {
    const [buffer] = await object.download();
    const [metadata] = await object.getMetadata();
    return { buffer, contentType: metadata.contentType || null };
  } catch (err) {
    if (err && err.code === 404) {
      const notFound = new Error('File not found');
      notFound.code = 'STORAGE_NOT_FOUND';
      throw notFound;
    }
    throw err;
  }
}

async function exists(key) {
  try {
    const [found] = await getBucket().file(key).exists();
    return found;
  } catch (_) {
    return false;
  }
}

async function remove(key) {
  try {
    await getBucket().file(key).delete();
  } catch (err) {
    // Idempotent by contract; a missing object is not a failure.
    if (!err || err.code !== 404) {
      console.warn(`⚠️  Could not delete ${key}: ${err && err.message}`);
    }
  }
}

module.exports = { name: 'firebase storage', put, get, exists, remove };
