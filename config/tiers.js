/**
 * Provider tiers — the single list. Pharmacies get theirs from the
 * pharmacy_groups row they belong to; doctors from doctors.tier.
 *
 * 'standard' used to be accepted in some places and not others, and no
 * Standard group ever existed, so it was dropped. Enterprise was accepted by
 * the database but unknown to claim routing, which ranked it with Basic.
 *
 * Ordered lowest first.
 */
const TIERS = ['basic', 'premium', 'enterprise'];

/** Higher is better. */
const TIER_RANK = { basic: 1, premium: 2, enterprise: 3 };

/** SQL fragment: the quoted list for a CHECK constraint. */
const tierCheckList = () => TIERS.map((t) => `'${t}'`).join(', ');

/** SQL fragment ranking `col` best first (1 = enterprise). */
const tierOrderSql = (col) =>
  `CASE ${col} ${[...TIERS].reverse().map((t, i) => `WHEN '${t}' THEN ${i + 1}`).join(' ')} ELSE ${TIERS.length + 1} END`;

module.exports = { TIERS, TIER_RANK, tierCheckList, tierOrderSql };
