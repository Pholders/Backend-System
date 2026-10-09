const { query } = require('../config/db');

/**
 * Shared results for the phase 1 testing checklist.
 *
 * Deliberately open: the checklist page is opened by whoever holds its link,
 * including people with no account on this platform, so there is no session
 * to authenticate against. What guards it instead:
 *
 *   - a key the page sends, which is a bot deterrent and NOT a secret -- it
 *     is readable in the page source by anyone who can open the page, which
 *     is exactly the intended audience
 *   - every field length-capped and the status constrained
 *   - a per-address write rate limit
 *
 * The data is test ticks and notes. Nothing else in the platform reads these
 * tables, and the worst outcome of abuse is junk in a checklist the team can
 * clear. Nothing here touches patient data.
 */

// Not a secret. Rotate with CHECKLIST_KEY if it ever gets scraped.
const CHECKLIST_KEY = process.env.CHECKLIST_KEY || 'pholders-phase1-checklist';

const STATUSES = ['pass', 'fail', 'blocked'];
const MAX_TESTER = 60;
const MAX_NOTE = 2000;
const MAX_STORY_ID = 16;

// Rolling window, in memory. It resets when the dyno restarts, which is fine
// for what this protects.
const WINDOW_MS = 60 * 1000;
const MAX_WRITES_PER_WINDOW = 120;
const hits = new Map();

function rateLimited(req) {
  const who = req.ip || 'unknown';
  const now = Date.now();
  const recent = (hits.get(who) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(who, recent);

  // Keep the map from growing without bound on a long-lived process.
  if (hits.size > 500) {
    for (const [key, times] of hits) {
      if (!times.length || now - times[times.length - 1] > WINDOW_MS) hits.delete(key);
    }
  }
  return recent.length > MAX_WRITES_PER_WINDOW;
}

function keyOk(req) {
  return req.get('X-Checklist-Key') === CHECKLIST_KEY;
}

/** A story id as the page issues them: letters then digits, e.g. L10, DX12. */
function cleanStoryId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  if (!/^[A-Z]{1,3}\d{1,3}$/.test(trimmed)) return null;
  return trimmed.slice(0, MAX_STORY_ID);
}

function cleanTester(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_TESTER);
}

function guard(req, res) {
  if (!keyOk(req)) {
    res.status(403).json({ success: false, message: 'Not the checklist' });
    return false;
  }
  if (rateLimited(req)) {
    res.status(429).json({ success: false, message: 'Too many updates, slow down' });
    return false;
  }
  return true;
}

/** GET /api/checklist — everything the page needs to draw itself. */
async function getAll(req, res) {
  try {
    if (!keyOk(req)) {
      return res.status(403).json({ success: false, message: 'Not the checklist' });
    }

    const results = await query(
      `SELECT story_id, tester, status, updated_at
         FROM checklist_results
        ORDER BY updated_at DESC
        LIMIT 5000`
    );
    const notes = await query(
      `SELECT id, story_id, tester, body, created_at
         FROM checklist_notes
        ORDER BY created_at ASC
        LIMIT 5000`
    );

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      results: results.rows.map((r) => ({
        storyId: r.story_id,
        tester: r.tester,
        status: r.status,
        at: r.updated_at
      })),
      notes: notes.rows.map((n) => ({
        id: n.id,
        storyId: n.story_id,
        tester: n.tester,
        text: n.body,
        at: n.created_at
      }))
    });
  } catch (error) {
    console.error('checklist getAll error:', error);
    res.status(500).json({ success: false, message: 'Could not load results' });
  }
}

/**
 * PUT /api/checklist/result — one tester's verdict on one story.
 *
 * `notrun` is how a tester takes their tick back, so it deletes their row
 * rather than storing a third state.
 */
async function putResult(req, res) {
  try {
    if (!guard(req, res)) return;

    const storyId = cleanStoryId(req.body && req.body.storyId);
    const tester = cleanTester(req.body && req.body.tester);
    const status = req.body && typeof req.body.status === 'string'
      ? req.body.status.toLowerCase()
      : null;

    if (!storyId) {
      return res.status(400).json({ success: false, message: 'storyId is not a story id' });
    }
    if (!tester) {
      return res.status(400).json({ success: false, message: 'tester is required' });
    }
    if (status === 'notrun') {
      await query(
        `DELETE FROM checklist_results WHERE story_id = $1 AND tester = $2`,
        [storyId, tester]
      );
      return res.json({ success: true, cleared: true });
    }
    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of ${STATUSES.join(', ')} or notrun`
      });
    }

    await query(
      `INSERT INTO checklist_results (story_id, tester, status, updated_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (story_id, tester)
       DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP`,
      [storyId, tester, status]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('checklist putResult error:', error);
    res.status(500).json({ success: false, message: 'Could not save that result' });
  }
}

/** POST /api/checklist/note — a note against a story. */
async function postNote(req, res) {
  try {
    if (!guard(req, res)) return;

    const storyId = cleanStoryId(req.body && req.body.storyId);
    const tester = cleanTester(req.body && req.body.tester);
    const text = req.body && typeof req.body.text === 'string' ? req.body.text.trim() : '';

    if (!storyId) {
      return res.status(400).json({ success: false, message: 'storyId is not a story id' });
    }
    if (!tester) {
      return res.status(400).json({ success: false, message: 'tester is required' });
    }
    if (!text) {
      return res.status(400).json({ success: false, message: 'text is required' });
    }

    const inserted = await query(
      `INSERT INTO checklist_notes (story_id, tester, body)
            VALUES ($1, $2, $3)
         RETURNING id, created_at`,
      [storyId, tester, text.slice(0, MAX_NOTE)]
    );

    res.json({
      success: true,
      note: {
        id: inserted.rows[0].id,
        storyId,
        tester,
        text: text.slice(0, MAX_NOTE),
        at: inserted.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('checklist postNote error:', error);
    res.status(500).json({ success: false, message: 'Could not post that note' });
  }
}

/** DELETE /api/checklist/note/:id — remove a note the poster regrets. */
async function deleteNote(req, res) {
  try {
    if (!guard(req, res)) return;

    const id = parseInt(req.params.id, 10);
    const tester = cleanTester(req.query && req.query.tester);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    if (!tester) {
      return res.status(400).json({ success: false, message: 'tester is required' });
    }

    // Only the person who wrote it, by the name they wrote it under. There is
    // no real identity here, so this is tidiness rather than authorisation.
    const result = await query(
      `DELETE FROM checklist_notes WHERE id = $1 AND tester = $2`,
      [id, tester]
    );
    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('checklist deleteNote error:', error);
    res.status(500).json({ success: false, message: 'Could not remove that note' });
  }
}

module.exports = { getAll, putResult, postNote, deleteNote };
