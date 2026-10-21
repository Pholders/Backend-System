const { query } = require('./db');

/**
 * Migration: Add Pharmacy Partnership Management Tables
 * Creates tables for:
 * - Pharmacy Groups (chains, networks)
 * - Partnership Agreements (contracts, terms, SLAs)
 * - Agreement Compliance (performance tracking)
 * - Claim Routing History (track which pharmacy got which prescription)
 */

async function addPharmacyPartnerships() {
  try {
    console.log('🔄 Starting Pharmacy Partnership migration...');

    // ============================================================
    // 1. PHARMACY GROUPS TABLE
    // ============================================================
    const createPharmacyGroupsQuery = `
      CREATE TABLE IF NOT EXISTS pharmacy_groups (
        id SERIAL PRIMARY KEY,
        group_name VARCHAR(255) NOT NULL,
        parent_company VARCHAR(255),
        tier VARCHAR(20) NOT NULL DEFAULT 'standard',
        CHECK (tier IN ('premium', 'standard', 'basic')),
        
        description TEXT,
        total_pharmacies INT DEFAULT 0,
        
        -- Commission & Revenue
        commission_rate DECIMAL(5, 2),
        total_claims_handled INT DEFAULT 0,
        total_revenue DECIMAL(15, 2) DEFAULT 0,
        
        -- Status
        is_active BOOLEAN DEFAULT true,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_pharmacy_groups_tier ON pharmacy_groups(tier);
      CREATE INDEX IF NOT EXISTS idx_pharmacy_groups_status ON pharmacy_groups(is_active);
    `;

    await query(createPharmacyGroupsQuery);
    console.log('✅ pharmacy_groups table created');

    // ============================================================
    // 2. PHARMACY GROUP MEMBERS TABLE
    // ============================================================
    const createGroupMembersQuery = `
      CREATE TABLE IF NOT EXISTS pharmacy_group_members (
        id SERIAL PRIMARY KEY,
        pharmacy_id INT NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
        group_id INT NOT NULL REFERENCES pharmacy_groups(id) ON DELETE CASCADE,
        
        is_primary BOOLEAN DEFAULT true,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        left_at TIMESTAMP,
        
        UNIQUE(pharmacy_id, group_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_group_members_group ON pharmacy_group_members(group_id);
      CREATE INDEX IF NOT EXISTS idx_group_members_pharmacy ON pharmacy_group_members(pharmacy_id);
    `;

    await query(createGroupMembersQuery);
    console.log('✅ pharmacy_group_members table created');

    // ============================================================
    // 3. PHARMACY AGREEMENTS TABLE
    // ============================================================
    const createAgreementsQuery = `
      CREATE TABLE IF NOT EXISTS pharmacy_agreements (
        id SERIAL PRIMARY KEY,
        pharmacy_or_group_id INT NOT NULL,
        entity_type VARCHAR(20) NOT NULL,
        CHECK (entity_type IN ('pharmacy', 'group')),
        
        agreement_type VARCHAR(50),
        
        -- Agreement Terms
        start_date DATE NOT NULL,
        end_date DATE,
        auto_renew BOOLEAN DEFAULT false,
        
        -- Financial Terms
        commission_rate DECIMAL(5, 2) NOT NULL,
        service_fee DECIMAL(10, 2),
        minimum_monthly_transactions INT,
        
        -- SLA Requirements
        claim_response_time_hours INT DEFAULT 24,
        dispensing_time_hours INT DEFAULT 48,
        
        -- Payment Terms
        payment_terms VARCHAR(50),
        
        -- Status
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        CHECK (status IN ('pending', 'active', 'suspended', 'expired', 'terminated')),
        
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_agreements_status ON pharmacy_agreements(status);
      CREATE INDEX IF NOT EXISTS idx_agreements_entity ON pharmacy_agreements(pharmacy_or_group_id, entity_type);
      CREATE INDEX IF NOT EXISTS idx_agreements_dates ON pharmacy_agreements(start_date, end_date);
    `;

    await query(createAgreementsQuery);
    console.log('✅ pharmacy_agreements table created');

    // ============================================================
    // 4. AGREEMENT COMPLIANCE TABLE
    // ============================================================
    const createComplianceQuery = `
      CREATE TABLE IF NOT EXISTS agreement_compliance (
        id SERIAL PRIMARY KEY,
        agreement_id INT NOT NULL REFERENCES pharmacy_agreements(id) ON DELETE CASCADE,
        
        month_date DATE NOT NULL,
        
        -- Transaction Metrics
        total_claims INT DEFAULT 0,
        claims_accepted INT DEFAULT 0,
        claims_rejected INT DEFAULT 0,
        claims_expired INT DEFAULT 0,
        
        -- Performance Metrics
        on_time_responses INT DEFAULT 0,
        on_time_dispensed INT DEFAULT 0,
        
        response_time_compliance DECIMAL(5, 2),
        dispensing_time_compliance DECIMAL(5, 2),
        
        -- Revenue
        monthly_revenue DECIMAL(15, 2) DEFAULT 0,
        commission_paid DECIMAL(15, 2) DEFAULT 0,
        
        -- Overall Score (0-100)
        compliance_score DECIMAL(5, 2),
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(agreement_id, month_date)
      );
      
      CREATE INDEX IF NOT EXISTS idx_compliance_agreement ON agreement_compliance(agreement_id);
      CREATE INDEX IF NOT EXISTS idx_compliance_month ON agreement_compliance(month_date);
    `;

    await query(createComplianceQuery);
    console.log('✅ agreement_compliance table created');

    // ============================================================
    // 5. CLAIM ROUTING HISTORY TABLE
    // ============================================================
    const createRoutingHistoryQuery = `
      CREATE TABLE IF NOT EXISTS claim_routing_history (
        id SERIAL PRIMARY KEY,
        prescription_id INT NOT NULL,
        
        -- Routing Details
        routed_to_pharmacy_id INT REFERENCES pharmacies(id),
        routed_to_group_id INT REFERENCES pharmacy_groups(id),
        
        routing_reason VARCHAR(100),
        routing_order INT,
        
        -- Response Tracking
        claim_sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        claim_response_at TIMESTAMP,
        response_time_seconds INT,
        
        -- Acceptance Status
        accepted BOOLEAN,
        acceptance_reason VARCHAR(255),
        
        -- Dispensing Tracking
        dispensed_at TIMESTAMP,
        dispensing_time_seconds INT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_routing_prescription ON claim_routing_history(prescription_id);
      CREATE INDEX IF NOT EXISTS idx_routing_pharmacy ON claim_routing_history(routed_to_pharmacy_id);
      CREATE INDEX IF NOT EXISTS idx_routing_group ON claim_routing_history(routed_to_group_id);
      CREATE INDEX IF NOT EXISTS idx_routing_dates ON claim_routing_history(claim_sent_at, claim_response_at);
    `;

    await query(createRoutingHistoryQuery);
    console.log('✅ claim_routing_history table created');

    // ============================================================
    // 6. PHARMACY PERFORMANCE METRICS TABLE
    // ============================================================
    const createPerformanceQuery = `
      CREATE TABLE IF NOT EXISTS pharmacy_performance_metrics (
        id SERIAL PRIMARY KEY,
        pharmacy_id INT NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
        
        -- Claim Metrics
        total_claims_routed INT DEFAULT 0,
        total_claims_accepted INT DEFAULT 0,
        acceptance_rate DECIMAL(5, 2),
        
        -- Timing Metrics
        avg_response_time_seconds INT,
        avg_dispensing_time_seconds INT,
        
        -- Quality Metrics
        on_time_response_rate DECIMAL(5, 2),
        on_time_dispensing_rate DECIMAL(5, 2),
        
        -- Revenue Metrics
        total_revenue DECIMAL(15, 2) DEFAULT 0,
        total_commission_paid DECIMAL(15, 2) DEFAULT 0,
        
        -- Overall Rating (0-100)
        overall_score DECIMAL(5, 2),
        
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(pharmacy_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_performance_pharmacy ON pharmacy_performance_metrics(pharmacy_id);
      CREATE INDEX IF NOT EXISTS idx_performance_score ON pharmacy_performance_metrics(overall_score);
    `;

    await query(createPerformanceQuery);
    console.log('✅ pharmacy_performance_metrics table created');

    console.log('✅ All pharmacy partnership tables created successfully');
  } catch (error) {
    console.error('❌ Error creating pharmacy partnership tables:', error);
    throw error;
  }
}

module.exports = addPharmacyPartnerships;
