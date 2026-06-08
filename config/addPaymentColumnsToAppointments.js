const { query } = require('./db');

/**
 * Add payment_status and payment_method columns to appointments table
 */
async function addPaymentColumnsToAppointments() {
  try {
    console.log('🔄 Adding payment columns to appointments table...');

    // Check if columns already exist
    const checkPaymentStatusColumn = `
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='appointments' AND column_name='payment_status'
      );
    `;
    
    const paymentStatusResult = await query(checkPaymentStatusColumn);
    
    if (!paymentStatusResult.rows[0].exists) {
      // Add payment_status column
      await query(`
        ALTER TABLE appointments 
        ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending' 
        CHECK (payment_status IN ('pending', 'completed', 'failed', 'cancelled'));
      `);
      console.log('✅ Added payment_status column');
    }

    // Check if payment_method column exists
    const checkPaymentMethodColumn = `
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='appointments' AND column_name='payment_method'
      );
    `;
    
    const paymentMethodResult = await query(checkPaymentMethodColumn);
    
    if (!paymentMethodResult.rows[0].exists) {
      // Add payment_method column
      await query(`
        ALTER TABLE appointments 
        ADD COLUMN payment_method VARCHAR(50) 
        CHECK (payment_method IN ('cash_on_arrival', 'stripe', 'medical_aid'));
      `);
      console.log('✅ Added payment_method column');
    }

    console.log('✅ Payment columns added to appointments table successfully');
  } catch (error) {
    console.error('❌ Error adding payment columns:', error.message);
    throw error;
  }
}

module.exports = { addPaymentColumnsToAppointments };
