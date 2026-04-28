const TaggingSystem = require('../models/TaggingSystem');
const VersionHistory = require('../models/VersionHistory');
const FileUploadService = require('../services/fileUploadService');

/**
 * Migration: Add Tagging, Search/Filter, Version History, and File Upload Support
 */

async function setupEnhancedFeatures() {
  try {
    console.log('🔄 Starting migration: Add enhanced patient profile features...\n');
    
    console.log('📍 Creating tagging system tables...');
    await TaggingSystem.createTables();
    
    console.log('📍 Creating version history tables...');
    await VersionHistory.createTables();
    
    console.log('📍 Creating file upload system...');
    await FileUploadService.constructor.createFilesTable();
    
    console.log('\n✅ Migration completed successfully!\n');
    console.log('🎯 New features enabled:');
    console.log('   ✓ Tagging system (across all sections)');
    console.log('   ✓ Full-text search functionality');
    console.log('   ✓ Tag-based filtering');
    console.log('   ✓ Complete version history & audit trail');
    console.log('   ✓ Category rename with history');
    console.log('   ✓ Secure file uploads (PDFs, images, documents)');
    console.log('   ✓ File integrity verification');
    console.log('   ✓ Access logging for files');
    console.log('   ✓ Audit reports & compliance');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
}

setupEnhancedFeatures();
