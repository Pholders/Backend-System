const express = require('express');
const cors = require('cors');
const router = express.Router();
const ChecklistController = require('../controllers/checklistController');

/**
 * The phase 1 testing checklist's shared results.
 *
 * These carry their own CORS policy because the page that calls them is a
 * Claude artifact, and every artifact is served from its own origin -- there
 * is no fixed hostname to put on the app's allow-list. Opening the app's
 * global policy to match would widen it for every route, so instead this
 * router allows any origin for itself alone, without credentials: no cookie
 * or session is involved, so a permissive origin grants nothing a reader
 * could not already request directly.
 */
const checklistCors = cors({
  origin: true,
  credentials: false,
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Checklist-Key']
});

// Used as middleware, cors() answers the preflight OPTIONS itself, so there
// is no wildcard route to register -- and Express 5 would reject '*' anyway.
router.use(checklistCors);

// This router is mounted ahead of the app's global CORS policy, which would
// otherwise reject an artifact origin before the request ever arrived here.
// That puts it ahead of the global body parser too, so it brings its own --
// with a small cap, since the largest thing posted is a note.
router.use(express.json({ limit: '64kb' }));

router.get('/', ChecklistController.getAll);
router.put('/result', ChecklistController.putResult);
router.post('/note', ChecklistController.postNote);
router.delete('/note/:id', ChecklistController.deleteNote);

module.exports = router;
