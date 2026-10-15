const https = require('https');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);

let client;

function cloudinary() {
  if (client) return client;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  const missing = [
    ['CLOUDINARY_CLOUD_NAME', CLOUDINARY_CLOUD_NAME],
    ['CLOUDINARY_API_KEY', CLOUDINARY_API_KEY],
    ['CLOUDINARY_API_SECRET', CLOUDINARY_API_SECRET],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(`Cloudinary storage requires ${missing.join(', ')}`);
  }

  const { v2 } = require('cloudinary');
  v2.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  client = v2;
  return client;
}

function isSafeKey(key) {
  return typeof key === 'string'
    && key.length > 0
    && key.length <= 400
    && !key.startsWith('/')
    && !key.includes('\\')
    && !/^[A-Za-z]:/.test(key)
    && !key.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');
}

function ensureSafeKey(key) {
  if (!isSafeKey(key)) {
    throw new Error('Refusing an unsafe Cloudinary storage key');
  }
}

function resourceTypeFor(key) {
  return IMAGE_EXTENSIONS.has(path.posix.extname(key).toLowerCase()) ? 'image' : 'raw';
}

function publicIdFor(key, resourceType) {
  const prefix = (process.env.CLOUDINARY_FOLDER || 'pholders').replace(/^\/+|\/+$/g, '');
  const objectKey = resourceType === 'image'
    ? key.slice(0, -path.posix.extname(key).length)
    : key;
  return prefix ? `${prefix}/${objectKey}` : objectKey;
}

function isNotFound(error) {
  return error.code === 'STORAGE_NOT_FOUND'
    || error.http_code === 404
    || (error.error && error.error.http_code === 404);
}

function download(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if (response.statusCode === 404) {
          const error = new Error('File not found');
          error.code = 'STORAGE_NOT_FOUND';
          reject(error);
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Cloudinary download failed with status ${response.statusCode}`));
          return;
        }
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: response.headers['content-type'] || null,
        });
      });
    });
    request.on('error', reject);
    request.setTimeout(15_000, () => request.destroy(new Error('Cloudinary download timed out')));
  });
}

async function put(file, destination, filename) {
  const key = `${destination}/${filename}`;
  ensureSafeKey(key);

  const resourceType = file.mimetype && file.mimetype.startsWith('image/')
    ? 'image'
    : 'raw';
  const publicId = publicIdFor(key, resourceType);

  await new Promise((resolve, reject) => {
    const stream = cloudinary().uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: resourceType,
        type: 'authenticated',
        overwrite: false,
        unique_filename: false,
        use_filename: false,
      },
      (error) => (error ? reject(error) : resolve())
    );
    stream.end(file.buffer);
  });

  return key;
}

async function get(key) {
  ensureSafeKey(key);

  const resourceType = resourceTypeFor(key);
  const extension = path.posix.extname(key).slice(1);
  const url = cloudinary().utils.private_download_url(
    publicIdFor(key, resourceType),
    resourceType === 'image' ? extension : undefined,
    { resource_type: resourceType, type: 'authenticated', attachment: false }
  );
  return download(url);
}

async function exists(key) {
  try {
    ensureSafeKey(key);
    const resourceType = resourceTypeFor(key);
    await cloudinary().api.resource(publicIdFor(key, resourceType), {
      resource_type: resourceType,
      type: 'authenticated',
    });
    return true;
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }
    throw error;
  }
}

async function remove(key) {
  ensureSafeKey(key);
  const resourceType = resourceTypeFor(key);
  await cloudinary().uploader.destroy(publicIdFor(key, resourceType), {
    resource_type: resourceType,
    type: 'authenticated',
    invalidate: true,
  });
}

module.exports = { name: 'Cloudinary', put, get, exists, remove };
