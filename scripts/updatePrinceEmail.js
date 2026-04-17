const { query } = require('../config/db');

/**
 * Update user email
 * Updates Prince Mashumu's email to princengwakomashumu@gmail.com
 */

const updateEmail = async () => {
  console.log('🔄 Updating user email...');
  
  try {
    const result = await query(
      `UPDATE users 
       SET email = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, first_name, last_name, email`,
      ['princengwakomashumu@gmail.com', 1]
    );

    if (result.rows.length > 0) {
      console.log('✅ Email updated successfully:');
      console.log(result.rows[0]);
    } else {
      console.log('❌ User not found');
    }

    return true;
  } catch (error) {
    console.error('❌ Update failed:', error);
    throw error;
  }
};

// Run update if this script is executed directly
if (require.main === module) {
  updateEmail()
    .then(() => {
      console.log('👍 Update successful');
      process.exit(0);
    })
    .catch((error) => {
      console.error('👎 Update failed:', error);
      process.exit(1);
    });
}

module.exports = { updateEmail };
