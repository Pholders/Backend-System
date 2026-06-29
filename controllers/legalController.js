const fs = require('fs');
const path = require('path');

const LEGAL_DIR = path.join(__dirname, '..', 'content', 'legal');

function loadDoc(filename) {
  const p = path.join(LEGAL_DIR, filename);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

/**
 * Build the response. If client sends Accept: text/markdown (or ?format=md)
 * we return raw markdown; otherwise we wrap it in JSON.
 */
function sendDoc(req, res, content, title) {
  if (!content) {
    return res.status(404).json({ success: false, message: `${title} not available` });
  }
  const wantsMarkdown =
    String(req.query.format).toLowerCase() === 'md' ||
    (req.headers.accept || '').includes('text/markdown');

  if (wantsMarkdown) {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    return res.send(content);
  }
  res.json({
    success: true,
    document: {
      title,
      format: 'markdown',
      content
    }
  });
}

/** GET /api/legal/terms  */
async function getTerms(req, res) {
  sendDoc(req, res, loadDoc('terms.md'), 'Terms of Service');
}

/** GET /api/legal/privacy */
async function getPrivacy(req, res) {
  sendDoc(req, res, loadDoc('privacy.md'), 'Privacy Policy');
}

module.exports = { getTerms, getPrivacy };
