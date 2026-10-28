// Where a doctor stands with one patient's health record, worked out from
// the doctor's current grant (phr_access) and their most recent request
// (phr_access_requests). Pure, so the rules can be tested without a database.
//
//   granted  - the doctor can see the record now
//   pending  - asked, the patient has not answered
//   denied   - the patient said no to the latest request
//   revoked  - access was given once, then withdrawn or expired
//   none     - never asked
function describeAccess(grant, latestRequest) {
  if (grant) {
    return {
      status: 'granted',
      grantedAt: grant.granted_at || null,
      expiresAt: grant.expires_at || null,
    };
  }
  if (!latestRequest) return { status: 'none' };

  const requestId = latestRequest.id;
  const requestedAt = latestRequest.requested_at || null;
  switch (latestRequest.status) {
    case 'pending':
      return { status: 'pending', requestId, requestedAt };
    case 'denied':
      return { status: 'denied', requestId, requestedAt };
    case 'approved':
      return { status: 'revoked', requestId, requestedAt };
    default:
      return { status: 'none' };
  }
}

module.exports = { describeAccess };
