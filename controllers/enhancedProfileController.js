const TaggingSystem = require('../models/TaggingSystem');
const VersionHistory = require('../models/VersionHistory');
const FileUploadService = require('../services/fileUploadService');
const PatientProfile = require('../models/PatientProfile');
const cache = require('../services/cacheService');
const { query } = require('../config/db');

/**
 * Enhanced Patient Profile Controller
 * Handles tagging, searching, version history, and file management
 */

class EnhancedProfileController {
  /**
   * Create a tag
   */
  static async createTag(req, res) {
    try {
      const patientId = req.user.id;
      const { tag_name, tag_color, description } = req.body;

      if (!tag_name) {
        return res.status(400).json({
          success: false,
          message: 'Tag name is required'
        });
      }

      const tag = await TaggingSystem.createTag(patientId, tag_name, tag_color || '#2196F3', description);

      res.status(201).json({
        success: true,
        message: 'Tag created successfully',
        data: tag
      });

    } catch (error) {
      console.error('Error creating tag:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating tag',
        error: error.message
      });
    }
  }

  /**
   * Get all tags
   */
  static async getTags(req, res) {
    try {
      const patientId = req.user.id;

      const tags = await TaggingSystem.getPatientTags(patientId);

      res.json({
        success: true,
        data: tags
      });

    } catch (error) {
      console.error('Error fetching tags:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching tags',
        error: error.message
      });
    }
  }

  /**
   * Assign tag to item
   */
  static async assignTag(req, res) {
    try {
      const patientId = req.user.id;
      const { tag_id, item_type, item_id } = req.body;

      if (!tag_id || !item_type || !item_id) {
        return res.status(400).json({
          success: false,
          message: 'Tag ID, item type, and item ID are required'
        });
      }

      const assignment = await TaggingSystem.assignTag(patientId, tag_id, item_type, item_id);

      // Invalidate cache
      await cache.delete(`patient_profile_complete_${patientId}`);

      res.status(201).json({
        success: true,
        message: 'Tag assigned successfully',
        data: assignment
      });

    } catch (error) {
      console.error('Error assigning tag:', error);
      res.status(500).json({
        success: false,
        message: 'Error assigning tag',
        error: error.message
      });
    }
  }

  /**
   * Remove tag from item
   */
  static async removeTag(req, res) {
    try {
      const { tag_id, item_type, item_id } = req.body;

      if (!tag_id || !item_type || !item_id) {
        return res.status(400).json({
          success: false,
          message: 'Tag ID, item type, and item ID are required'
        });
      }

      await TaggingSystem.removeTag(tag_id, item_type, item_id);

      // Invalidate cache
      await cache.delete(`patient_profile_complete_${req.user.id}`);

      res.json({
        success: true,
        message: 'Tag removed successfully'
      });

    } catch (error) {
      console.error('Error removing tag:', error);
      res.status(500).json({
        success: false,
        message: 'Error removing tag',
        error: error.message
      });
    }
  }

  /**
   * Update tag
   */
  static async updateTag(req, res) {
    try {
      const { tagId } = req.params;
      const updates = req.body;

      const tag = await TaggingSystem.updateTag(tagId, updates);

      res.json({
        success: true,
        message: 'Tag updated successfully',
        data: tag
      });

    } catch (error) {
      console.error('Error updating tag:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating tag',
        error: error.message
      });
    }
  }

  /**
   * Delete tag
   */
  static async deleteTag(req, res) {
    try {
      const { tagId } = req.params;

      await TaggingSystem.deleteTag(tagId);

      res.json({
        success: true,
        message: 'Tag deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting tag:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting tag',
        error: error.message
      });
    }
  }

  /**
   * Search across profile
   */
  static async search(req, res) {
    try {
      const patientId = req.user.id;
      const { query: searchTerm, itemTypes, tags } = req.query;

      if (!searchTerm || searchTerm.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search term must be at least 2 characters'
        });
      }

      const itemTypeArray = itemTypes ? itemTypes.split(',') : null;
      const tagArray = tags ? tags.split(',').map(Number) : null;

      const results = await TaggingSystem.search(patientId, searchTerm, itemTypeArray, tagArray);

      res.json({
        success: true,
        message: `Found ${results.length} results`,
        data: results
      });

    } catch (error) {
      console.error('Error searching:', error);
      res.status(500).json({
        success: false,
        message: 'Error searching profile',
        error: error.message
      });
    }
  }

  /**
   * Filter by tags
   */
  static async filterByTags(req, res) {
    try {
      const patientId = req.user.id;
      const { tag_ids } = req.body;

      if (!tag_ids || tag_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one tag ID is required'
        });
      }

      const results = await TaggingSystem.filterByTags(patientId, tag_ids);

      res.json({
        success: true,
        message: `Found ${results.length} items`,
        data: results
      });

    } catch (error) {
      console.error('Error filtering by tags:', error);
      res.status(500).json({
        success: false,
        message: 'Error filtering by tags',
        error: error.message
      });
    }
  }

  /**
   * Get items by tag
   */
  static async getItemsByTag(req, res) {
    try {
      const patientId = req.user.id;
      const { tagId } = req.params;
      const { itemType } = req.query;

      const items = await TaggingSystem.getItemsByTag(patientId, tagId, itemType);

      res.json({
        success: true,
        data: items
      });

    } catch (error) {
      console.error('Error fetching items by tag:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching items by tag',
        error: error.message
      });
    }
  }

  /**
   * Get item version history
   */
  static async getItemHistory(req, res) {
    try {
      const patientId = req.user.id;
      const { itemType, itemId } = req.query;

      if (!itemType || !itemId) {
        return res.status(400).json({
          success: false,
          message: 'Item type and ID are required'
        });
      }

      const history = await VersionHistory.getItemHistory(itemType, itemId, patientId);

      res.json({
        success: true,
        data: history
      });

    } catch (error) {
      console.error('Error fetching item history:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching item history',
        error: error.message
      });
    }
  }

  /**
   * Get recent changes
   */
  static async getRecentChanges(req, res) {
    try {
      const patientId = req.user.id;
      const { limit = 50, days = 30 } = req.query;

      const changes = await VersionHistory.getRecentChanges(patientId, parseInt(limit), parseInt(days));

      res.json({
        success: true,
        data: changes
      });

    } catch (error) {
      console.error('Error fetching recent changes:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching recent changes',
        error: error.message
      });
    }
  }

  /**
   * Get full audit trail
   */
  static async getAuditTrail(req, res) {
    try {
      const patientId = req.user.id;
      const { itemType, action, startDate, endDate } = req.query;

      const filters = {};
      if (itemType) filters.itemType = itemType;
      if (action) filters.action = action;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const trail = await VersionHistory.getFullAuditTrail(patientId, filters);

      res.json({
        success: true,
        data: trail
      });

    } catch (error) {
      console.error('Error fetching audit trail:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching audit trail',
        error: error.message
      });
    }
  }

  /**
   * Generate audit report
   */
  static async generateAuditReport(req, res) {
    try {
      const patientId = req.user.id;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const report = await VersionHistory.generateAuditReport(patientId, new Date(startDate), new Date(endDate));

      res.json({
        success: true,
        message: 'Audit report generated',
        data: report
      });

    } catch (error) {
      console.error('Error generating audit report:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating audit report',
        error: error.message
      });
    }
  }

  /**
   * Upload file
   */
  static async uploadFile(req, res) {
    try {
      const patientId = req.user.id;
      const { category, description } = req.body;
      const tags = req.body.tags ? JSON.parse(req.body.tags) : [];

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file provided'
        });
      }

      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Category is required'
        });
      }

      const result = await FileUploadService.uploadFile(patientId, req.file, category, description, tags);

      res.status(201).json(result);

    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({
        success: false,
        message: 'Error uploading file',
        error: error.message
      });
    }
  }

  /**
   * Get file
   */
  static async getFile(req, res) {
    try {
      const patientId = req.user.id;
      const { fileId } = req.params;

      const file = await FileUploadService.getFile(fileId, patientId);

      res.contentType(file.mimetype);
      res.attachment(file.filename);
      res.send(file.buffer);

    } catch (error) {
      console.error('Error retrieving file:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving file',
        error: error.message
      });
    }
  }

  /**
   * List files
   */
  static async listFiles(req, res) {
    try {
      const patientId = req.user.id;
      const { category } = req.query;

      const files = await FileUploadService.listPatientFiles(patientId, category);

      res.json({
        success: true,
        data: files
      });

    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({
        success: false,
        message: 'Error listing files',
        error: error.message
      });
    }
  }

  /**
   * Delete file
   */
  static async deleteFile(req, res) {
    try {
      const patientId = req.user.id;
      const { fileId } = req.params;

      const result = await FileUploadService.deleteFile(fileId, patientId);

      res.json(result);

    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting file',
        error: error.message
      });
    }
  }

  /**
   * Verify file integrity
   */
  static async verifyFileIntegrity(req, res) {
    try {
      const patientId = req.user.id;
      const { fileId } = req.params;

      const result = await FileUploadService.verifyFileIntegrity(fileId, patientId);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error verifying file:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying file',
        error: error.message
      });
    }
  }

  /**
   * Rename category
   */
  static async renameCategory(req, res) {
    try {
      const patientId = req.user.id;
      const { categoryId } = req.params;
      const { new_name } = req.body;

      if (!new_name) {
        return res.status(400).json({
          success: false,
          message: 'New category name is required'
        });
      }

      const category = await PatientProfile.renameCustomCategory(categoryId, patientId, new_name);

      // Invalidate cache
      await cache.delete(`patient_profile_complete_${patientId}`);

      res.json({
        success: true,
        message: 'Category renamed successfully',
        data: category
      });

    } catch (error) {
      console.error('Error renaming category:', error);
      res.status(500).json({
        success: false,
        message: 'Error renaming category',
        error: error.message
      });
    }
  }

  /**
   * Reorder categories
   */
  static async reorderCategories(req, res) {
    try {
      const patientId = req.user.id;
      const { category_orders } = req.body;

      if (!category_orders || category_orders.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Category orders are required'
        });
      }

      const result = await PatientProfile.reorderCategories(patientId, category_orders);

      // Invalidate cache
      await cache.delete(`patient_profile_complete_${patientId}`);

      res.json({
        success: true,
        message: 'Categories reordered successfully'
      });

    } catch (error) {
      console.error('Error reordering categories:', error);
      res.status(500).json({
        success: false,
        message: 'Error reordering categories',
        error: error.message
      });
    }
  }
}

module.exports = EnhancedProfileController;
