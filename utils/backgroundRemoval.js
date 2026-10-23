const path = require('path');
const { removeBackground } = require('@imgly/background-removal-node');

/**
 * Cuts the subject out of a photo and returns a transparent PNG.
 *
 * The model ships inside the package, so this runs in-process with no
 * external service. The first call loads the model, which takes a few seconds;
 * later calls reuse it.
 *
 * @param {Buffer} buffer  JPEG, PNG or WEBP bytes
 * @param {string} mimeType the detected mime type of those bytes
 * @returns {Promise<Buffer>} PNG bytes with the background transparent
 */
async function stripBackground(buffer, mimeType) {
  const input = new Blob([buffer], { type: mimeType });

  const result = await removeBackground(input, {
    // Resolve from the package location, not the process cwd, so the model
    // is found however the server is started.
    publicPath: `file://${path.dirname(require.resolve('@imgly/background-removal-node'))}/`,
    model: 'small',
    output: { format: 'image/png' },
  });

  return Buffer.from(await result.arrayBuffer());
}

module.exports = { stripBackground };
