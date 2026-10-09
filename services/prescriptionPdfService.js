const PDFDocument = require('pdfkit');
const crypto = require('crypto');

/**
 * Renders a prescription as a PDF.
 *
 * A prescription is a legal instrument, so the document has to be honest
 * about its own standing: an unsigned or revoked one carries a banner and a
 * watermark on every page saying it cannot be dispensed. Printing one that
 * merely looks official would be the dangerous outcome.
 *
 * Only the standard PDF fonts are used, so there is nothing to ship
 * alongside this file and nothing to go missing on a deploy.
 */

const MARGIN = 48;
const TEAL = '#309CA3';
const DARK = '#1F2937';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const RED = '#B3261E';
const GREEN = '#1B7F4B';
const WASH = '#F4FBFB';
const BANNER_WASH = '#FDECEA';

/**
 * Dates are rendered in South African time whatever the server is set to.
 * Render runs in UTC, so a signing time formatted in the server's zone would
 * read two hours early to everyone holding the paper -- on a document whose
 * whole purpose is to say when a prescriber signed.
 */
const ZONE = 'Africa/Johannesburg';

const dateFormat = new Intl.DateTimeFormat('en-ZA', {
  timeZone: ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const timeFormat = new Intl.DateTimeFormat('en-ZA', {
  timeZone: ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return dateFormat.format(d).replace(/,/g, '');
}

function formatDateTime(value) {
  const date = formatDate(value);
  if (!date) return null;
  return `${date} at ${timeFormat.format(new Date(value))} SAST`;
}

/** Items arrive as a json_agg array, or as its text form on some drivers. */
function itemsOf(prescription) {
  const raw = prescription.items;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

/**
 * A short, readable stand-in for the signature blob. The full value is far
 * too long to print and nobody would compare it by eye; a fingerprint can be
 * checked against the one the verification endpoint reports.
 */
function fingerprint(signature) {
  if (!signature) return null;
  const hex = crypto.createHash('sha256').update(signature).digest('hex');
  return hex.slice(0, 24).toUpperCase().match(/.{1,4}/g).join(' ');
}

function medicineDetail(item) {
  const quantity = item.quantity
    ? `${item.quantity}${item.quantity_unit ? ' ' + item.quantity_unit : ''}`
    : null;
  return [
    item.dosage,
    item.dosage_form,
    quantity,
    item.frequency,
    item.route_of_administration,
    item.duration,
  ].filter(Boolean).join('   ');
}

function standingOf(prescription) {
  if (prescription.is_revoked) {
    return {
      watermark: 'REVOKED',
      banner: 'THIS PRESCRIPTION HAS BEEN REVOKED',
      detail: prescription.revoke_reason
        ? `Reason: ${prescription.revoke_reason}`
        : 'It must not be dispensed.',
    };
  }
  if (prescription.signature_status !== 'signed') {
    return {
      watermark: 'NOT SIGNED',
      banner: 'NOT SIGNED - NOT VALID FOR DISPENSING',
      detail: 'A pharmacy cannot dispense against this document until the '
        + 'prescriber has signed it.',
    };
  }
  return { watermark: null, banner: null, detail: null };
}

function drawWatermark(doc, label) {
  if (!label) return;
  const { width, height } = doc.page;
  const x = doc.x;
  const y = doc.y;
  doc.save();
  doc.rotate(-38, { origin: [width / 2, height / 2] });
  doc.fillColor(RED).fillOpacity(0.08).font('Helvetica-Bold').fontSize(68);
  doc.text(label, 0, height / 2 - 44, { width, align: 'center' });
  doc.restore();
  doc.fillOpacity(1);
  doc.x = x;
  doc.y = y;
}

/** A label/value stack inside a column. Returns the y it finished at. */
function block(doc, x, y, width, title, rows) {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(TEAL);
  doc.text(title.toUpperCase(), x, y, { width, characterSpacing: 0.7 });
  let cursor = doc.y + 6;

  for (const [label, value] of rows) {
    if (value === null || value === undefined || value === '') continue;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text(label, x, cursor, { width });
    cursor = doc.y + 1;
    doc.font('Helvetica').fontSize(10.5).fillColor(DARK);
    doc.text(String(value), x, cursor, { width });
    cursor = doc.y + 7;
  }
  return cursor;
}

function sectionHeading(doc, text, y) {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(TEAL);
  doc.text(text.toUpperCase(), MARGIN, y, { characterSpacing: 0.7 });
  return doc.y + 6;
}

function rule(doc, y) {
  doc.moveTo(MARGIN, y)
    .lineTo(doc.page.width - MARGIN, y)
    .lineWidth(0.8)
    .strokeColor(LINE)
    .stroke();
  return y + 12;
}

/**
 * One medicine, in a bordered card. The card is measured before it is drawn
 * so the border can be laid down first, and so a card that will not fit moves
 * to the next page whole rather than being split across the break.
 */
function medicineCard(doc, item, index, y) {
  const width = doc.page.width - MARGIN * 2;
  const padding = 11;
  const schedule = item.schedule_classification;
  const inner = width - padding * 2;
  const nameWidth = schedule ? inner - 76 : inner;

  const name = item.generic_name && item.generic_name !== item.medicine_name
    ? `${index}. ${item.medicine_name}  (${item.generic_name})`
    : `${index}. ${item.medicine_name}`;
  const detail = medicineDetail(item);
  const caution = [item.warnings, item.contraindications].filter(Boolean).join('   ');

  // Measure every part with the exact font it will be drawn in.
  let height = padding;
  doc.font('Helvetica-Bold').fontSize(11);
  height += doc.heightOfString(name, { width: nameWidth });
  if (detail) {
    doc.font('Helvetica').fontSize(9.5);
    height += 3 + doc.heightOfString(detail, { width: inner });
  }
  if (item.special_instructions) {
    doc.font('Helvetica-Oblique').fontSize(9.5);
    height += 5 + doc.heightOfString(item.special_instructions, { width: inner });
  }
  if (caution) {
    doc.font('Helvetica').fontSize(8.5);
    height += 5 + doc.heightOfString(caution, { width: inner });
  }
  height += padding;

  const bottomLimit = doc.page.height - MARGIN - 28;
  let top = y;
  if (top + height > bottomLimit) {
    doc.addPage();
    top = MARGIN;
  }

  doc.roundedRect(MARGIN, top, width, height, 7)
    .lineWidth(0.8)
    .strokeColor(LINE)
    .stroke();

  const cursorStart = top + padding;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK);
  doc.text(name, MARGIN + padding, cursorStart, { width: nameWidth });
  let cursor = doc.y;

  if (schedule) {
    doc.font('Helvetica').fontSize(8).fillColor(TEAL);
    doc.text(`Schedule ${schedule}`, MARGIN + padding + nameWidth, cursorStart, {
      width: 76,
      align: 'right',
    });
  }

  if (detail) {
    cursor += 3;
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED);
    doc.text(detail, MARGIN + padding, cursor, { width: inner });
    cursor = doc.y;
  }
  if (item.special_instructions) {
    cursor += 5;
    doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(DARK);
    doc.text(item.special_instructions, MARGIN + padding, cursor, { width: inner });
    cursor = doc.y;
  }
  if (caution) {
    cursor += 5;
    doc.font('Helvetica').fontSize(8.5).fillColor(RED);
    doc.text(caution, MARGIN + padding, cursor, { width: inner });
  }

  return top + height + 8;
}

function compose(doc, prescription) {
  const standing = standingOf(prescription);
  const width = doc.page.width - MARGIN * 2;
  const items = itemsOf(prescription);

  // Every page carries the watermark, including ones pdfkit adds mid-flow.
  doc.on('pageAdded', () => drawWatermark(doc, standing.watermark));
  drawWatermark(doc, standing.watermark);

  // Header
  doc.font('Helvetica-Bold').fontSize(19).fillColor(TEAL);
  doc.text('PHolders', MARGIN, MARGIN);
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
  doc.text('Digital prescription', MARGIN, doc.y + 1);

  doc.font('Helvetica-Bold').fontSize(12).fillColor(DARK);
  doc.text(prescription.prescription_number || 'Prescription', MARGIN, MARGIN + 3, {
    width,
    align: 'right',
  });
  const issued = formatDate(prescription.created_at);
  if (issued) {
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
    doc.text(`Issued ${issued}`, MARGIN, doc.y + 2, { width, align: 'right' });
  }

  let y = rule(doc, MARGIN + 54);

  // Standing: a banner when it cannot be dispensed, a quiet line when it can.
  if (standing.banner) {
    doc.font('Helvetica').fontSize(9);
    const bannerHeight = 32 + doc.heightOfString(standing.detail, { width: width - 24 });
    doc.roundedRect(MARGIN, y, width, bannerHeight, 6).fillColor(BANNER_WASH).fill();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(RED);
    doc.text(standing.banner, MARGIN + 12, y + 9, { width: width - 24 });
    doc.font('Helvetica').fontSize(9).fillColor(DARK);
    doc.text(standing.detail, MARGIN + 12, doc.y + 3, { width: width - 24 });
    y = y + bannerHeight + 14;
  } else {
    const signedAt = formatDateTime(prescription.signature_timestamp);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(GREEN);
    doc.text(
      signedAt
        ? `Digitally signed by the prescriber on ${signedAt}`
        : 'Digitally signed by the prescriber',
      MARGIN,
      y,
      { width }
    );
    y = doc.y + 14;
  }

  // Prescriber and patient, side by side.
  const columnWidth = (width - 24) / 2;
  const prescriberBottom = block(doc, MARGIN, y, columnWidth, 'Prescriber', [
    ['Name', prescription.prescriber_name],
    ['HPCSA registration', prescription.prescriber_hpcsa],
    ['Telephone', prescription.prescriber_phone],
    ['Email', prescription.prescriber_email],
  ]);
  const patientBottom = block(doc, MARGIN + columnWidth + 24, y, columnWidth, 'Patient', [
    ['Name', prescription.patient_name],
    ['Identity number', prescription.patient_id_number],
    ['Date of birth', formatDate(prescription.patient_dob)],
    ['Telephone', prescription.patient_phone],
  ]);

  y = rule(doc, Math.max(prescriberBottom, patientBottom) + 6);

  // Diagnosis
  if (prescription.diagnosis) {
    y = sectionHeading(doc, 'Diagnosis', y);
    doc.font('Helvetica').fontSize(10.5).fillColor(DARK);
    doc.text(prescription.diagnosis, MARGIN, y, { width });
    y = doc.y + 14;
  }

  // Medicines
  y = sectionHeading(doc, `Medicines (${items.length})`, y);
  if (!items.length) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED);
    doc.text('No medicines are listed on this prescription.', MARGIN, y, { width });
    y = doc.y + 14;
  } else {
    items.forEach((item, i) => {
      y = medicineCard(doc, item, i + 1, y);
    });
    y += 6;
  }

  // Clinical notes
  if (prescription.clinical_notes) {
    if (y > doc.page.height - MARGIN - 110) {
      doc.addPage();
      y = MARGIN;
    }
    y = sectionHeading(doc, 'Clinical notes', y);
    doc.font('Helvetica').fontSize(10).fillColor(DARK);
    doc.text(prescription.clinical_notes, MARGIN, y, { width });
    y = doc.y + 16;
  }

  // Signature
  if (y > doc.page.height - MARGIN - 130) {
    doc.addPage();
    y = MARGIN;
  }
  const print = fingerprint(prescription.digital_signature);
  const signedAt = formatDateTime(prescription.signature_timestamp);

  doc.roundedRect(MARGIN, y, width, print ? 88 : 60, 7).fillColor(WASH).fill();
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(TEAL);
  doc.text('DIGITAL SIGNATURE', MARGIN + 12, y + 11, {
    width: width - 24,
    characterSpacing: 0.7,
  });

  doc.font('Helvetica').fontSize(9.5).fillColor(DARK);
  if (print) {
    const who = `Signed by ${prescription.prescriber_name || 'the prescriber'}`
      + (prescription.prescriber_hpcsa ? ` (HPCSA ${prescription.prescriber_hpcsa})` : '')
      + (signedAt ? ` on ${signedAt}.` : '.');
    doc.text(who, MARGIN + 12, doc.y + 4, { width: width - 24 });
    doc.font('Courier').fontSize(9).fillColor(MUTED);
    doc.text(print, MARGIN + 12, doc.y + 5, { width: width - 24 });
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED);
    doc.text(
      'This fingerprint identifies the signature held on record. No handwritten '
        + 'signature is required.',
      MARGIN + 12,
      doc.y + 3,
      { width: width - 24 }
    );
  } else {
    doc.text(
      'This prescription carries no digital signature.',
      MARGIN + 12,
      doc.y + 4,
      { width: width - 24 }
    );
  }
}

/** Page numbers, written once the page count is known. */
function paginate(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);

    // The footer sits below the bottom margin, and pdfkit answers text that
    // crosses that line by starting a fresh page -- which would add a blank
    // page per page, forever. Dropping the margin for the one write avoids it.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED);
    doc.text(
      `Page ${i - range.start + 1} of ${range.count}`
        + '     Generated by PHolders - verify with the issuing practice',
      MARGIN,
      doc.page.height - MARGIN + 10,
      {
        width: doc.page.width - MARGIN * 2,
        align: 'center',
        lineBreak: false,
      }
    );

    doc.page.margins.bottom = bottomMargin;
  }
}

/**
 * @param {object} prescription a prescriptions row with its `items`
 * @returns {Promise<Buffer>}
 */
function render(prescription) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      bufferPages: true,
      info: {
        Title: `Prescription ${prescription.prescription_number || ''}`.trim(),
        Author: prescription.prescriber_name || 'PHolders',
        Subject: 'Digital prescription',
        Creator: 'PHolders',
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      compose(doc, prescription);
      paginate(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/** The filename a browser should save it as. */
function filenameFor(prescription) {
  const number = (prescription.prescription_number || 'prescription')
    .replace(/[^A-Za-z0-9._-]/g, '_');
  return `${number}.pdf`;
}

module.exports = { render, filenameFor, fingerprint };
