/**
 * The audit_logs.event_type allow-list — the single source of truth.
 *
 * Five migrations used to redefine the audit_logs_event_type_check
 * constraint, each with its own copy of the list, and they run in sequence.
 * The earliest held the narrowest list, so as soon as a row existed carrying
 * an event type only a later migration knew about, that early migration could
 * never re-apply: Postgres validates a CHECK against existing rows, and the
 * whole boot died on
 *   "check constraint audit_logs_event_type_check is violated by some row".
 *
 * Every migration now builds the constraint from this one array, so adding an
 * event type is a single edit and the order they run in stops mattering.
 *
 * Adding one: append it here, and make sure the code that writes it uses the
 * same spelling.
 */

const AUDIT_EVENT_TYPES = [
  'signup',
  'signup_verified',
  'login',
  'logout',
  'login_failed',
  'google_login',
  'oauth_profile_completed',
  'password_change',
  'password_changed',
  'password_reset',
  'reset_password',
  'otp_generated',
  'otp_verified',
  'otp_failed',
  'session_created',
  'session_revoked',
  'sessions_revoked_others',
  'profile_updated',
  'account_updated',
  'avatar_updated',
  'email_change_requested',
  'email_changed',
  'biometrics_updated',
  'twofa_enable_started',
  'twofa_enable_verify',
  'twofa_enabled',
  'twofa_disabled',
  'twofa_disable',
  'unauthorized_access',
  'account_locked',
  'account_unlocked',
  'account_frozen',
  'account_unfrozen',
  'suspicious_activity_reported',
  'audit_log_exported',
  'forgot_password',
  'doctor_linked',
  'doctor_unlinked',
  'pharmacy_linked',
  'pharmacy_unlinked',
  'dependent_added',
  'dependent_updated',
  'dependent_removed',
  'medical_aid_updated',
  'medical_aid_card_uploaded',
  'medical_aid_document_uploaded',
  'medical_aid_document_downloaded',
  'support_ticket_submitted',
  'contact_message_submitted',
  'account_deletion_requested',
  'account_deleted',
  'delete_account_request',
  'payment_init',
  'payment_confirm',
  'payment_cash',
  'payment_medical_aid',
  'security_alert_reviewed',
  'security_alerts_bulk_updated',
  'email_verification_sent',
  'email_verification',
  'email_verification_resend',
  'review_submitted',
  'review_update',
  'review_delete',
  'pharmacy_status_changed',
  'nearby_doctors_search',
  'delete_account_cancelled',
  'tier_upgrade'
];

/** The SQL fragment each migration drops in: a quoted, comma-separated list. */
const auditEventTypeList = () =>
  AUDIT_EVENT_TYPES.map((e) => `'${e}'`).join(', ');

module.exports = { AUDIT_EVENT_TYPES, auditEventTypeList };
