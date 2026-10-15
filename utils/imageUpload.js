const IMAGE_TYPES = [
  {
    mimeType: 'image/jpeg',
    extension: '.jpg',
    matches: (buffer) => buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    extension: '.png',
    matches: (buffer) => buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: 'image/webp',
    extension: '.webp',
    matches: (buffer) => buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

function detectSupportedImage(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  return IMAGE_TYPES.find(({ matches }) => matches(buffer)) || null;
}

function normalizeSupportedImage(file) {
  const image = file && detectSupportedImage(file.buffer);
  if (!image) return null;

  file.mimetype = image.mimeType;
  return image;
}

module.exports = { detectSupportedImage, normalizeSupportedImage };
