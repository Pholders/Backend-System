# Enhanced Patient Profile API Documentation

## Overview
This document covers all new enhanced features for the patient profile system:
- Tagging & Organization
- Search & Filtering
- Version History & Audit Trail
- Secure File Management
- Category Management

**Base URL**: `http://localhost:3000/api/users`
**Authentication**: JWT Bearer Token required for all endpoints
**Role**: `patient` (or `admin` where specified)

---

## 🏷️ Tagging System

### Create Tag
```http
POST /profile/tags
Content-Type: application/json
Authorization: Bearer <token>

{
  "tag_name": "Urgent",
  "tag_color": "#FF0000",
  "description": "Requires immediate attention"
}

Response (201 Created):
{
  "success": true,
  "message": "Tag created successfully",
  "data": {
    "id": 1,
    "patient_id": 123,
    "tag_name": "Urgent",
    "tag_color": "#FF0000",
    "description": "Requires immediate attention",
    "usage_count": 0,
    "created_at": "2025-04-23T10:00:00.000Z"
  }
}
```

### Get All Tags
```http
GET /profile/tags
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tag_name": "Urgent",
      "tag_color": "#FF0000",
      "usage_count": 5
    },
    {
      "id": 2,
      "tag_name": "Follow-up",
      "tag_color": "#0099FF",
      "usage_count": 3
    }
  ]
}
```

### Update Tag
```http
PUT /profile/tags/:tagId
Content-Type: application/json
Authorization: Bearer <token>

{
  "tag_name": "High Priority",
  "tag_color": "#FF5500"
}

Response (200 OK):
{
  "success": true,
  "message": "Tag updated successfully",
  "data": { ... }
}
```

### Delete Tag
```http
DELETE /profile/tags/:tagId
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "message": "Tag deleted successfully"
}
```

### Assign Tag to Item
```http
POST /profile/tags/assign
Content-Type: application/json
Authorization: Bearer <token>

{
  "tag_id": 1,
  "item_type": "medication",
  "item_id": 42
}

Response (201 Created):
{
  "success": true,
  "message": "Tag assigned successfully",
  "data": {
    "id": 1,
    "tag_id": 1,
    "item_type": "medication",
    "item_id": 42,
    "assigned_at": "2025-04-23T10:00:00.000Z"
  }
}
```

Supported item_types: `allergy`, `condition`, `medication`, `vaccination`, `test_result`, `provider`, `lifestyle_data`, `directive`, `custom_category`, `file`

### Remove Tag from Item
```http
POST /profile/tags/remove
Content-Type: application/json
Authorization: Bearer <token>

{
  "tag_id": 1,
  "item_type": "medication",
  "item_id": 42
}

Response (200 OK):
{
  "success": true,
  "message": "Tag removed successfully"
}
```

### Get Items by Tag
```http
GET /profile/tags/:tagId/items?itemType=medication
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "data": [
    {
      "id": 42,
      "item_type": "medication",
      "medication_name": "Aspirin",
      "dosage": "100mg",
      "tags": [{ "id": 1, "tag_name": "Urgent" }]
    }
  ]
}
```

---

## 🔍 Search & Filtering

### Full-Text Search
```http
GET /profile/search?query=diabetes&itemTypes=condition,medication&tags=1,2
Authorization: Bearer <token>

Query Parameters:
- query (required): Search term (min 2 chars)
- itemTypes (optional): Comma-separated item types to search in
- tags (optional): Comma-separated tag IDs to filter by

Response (200 OK):
{
  "success": true,
  "message": "Found 5 results",
  "data": [
    {
      "id": 10,
      "item_type": "condition",
      "condition_name": "Diabetes Type 2",
      "severity": "Moderate",
      "tags": [{ "id": 1, "tag_name": "Chronic" }]
    },
    {
      "id": 15,
      "item_type": "medication",
      "medication_name": "Metformin",
      "dosage": "500mg",
      "tags": [{ "id": 1, "tag_name": "Chronic" }]
    }
  ]
}
```

### Filter by Tags
```http
POST /profile/filter-by-tags
Content-Type: application/json
Authorization: Bearer <token>

{
  "tag_ids": [1, 2, 3]
}

Response (200 OK):
{
  "success": true,
  "message": "Found 12 items",
  "data": [
    {
      "id": 42,
      "item_type": "medication",
      "medication_name": "Aspirin",
      "tags": [
        { "id": 1, "tag_name": "Urgent" },
        { "id": 2, "tag_name": "Follow-up" }
      ]
    }
  ]
}
```

---

## 📋 Version History & Audit Trail

### Get Item History
```http
GET /profile/history/item?itemType=medication&itemId=42
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "data": [
    {
      "id": 1,
      "item_type": "medication",
      "item_id": 42,
      "action": "CREATE",
      "previous_values": null,
      "new_values": {
        "medication_name": "Aspirin",
        "dosage": "100mg",
        "frequency": "Once daily"
      },
      "modified_by": 123,
      "first_name": "John",
      "last_name": "Doe",
      "created_at": "2025-04-20T10:00:00.000Z"
    },
    {
      "id": 2,
      "item_type": "medication",
      "item_id": 42,
      "action": "UPDATE",
      "previous_values": {
        "dosage": "100mg"
      },
      "new_values": {
        "dosage": "150mg"
      },
      "modified_by": 123,
      "created_at": "2025-04-22T14:30:00.000Z"
    }
  ]
}
```

### Get Recent Changes
```http
GET /profile/history/recent?limit=50&days=30
Authorization: Bearer <token>

Query Parameters:
- limit (optional, default: 50): Max number of results
- days (optional, default: 30): Look back how many days

Response (200 OK):
{
  "success": true,
  "data": [
    { ... history records ... }
  ]
}
```

### Get Full Audit Trail
```http
GET /profile/history/audit-trail?itemType=medication&action=UPDATE&startDate=2025-04-01&endDate=2025-04-30
Authorization: Bearer <token>

Query Parameters:
- itemType (optional): Filter by item type
- action (optional): CREATE, UPDATE, DELETE, or RESTORE
- startDate (optional): ISO 8601 format
- endDate (optional): ISO 8601 format

Response (200 OK):
{
  "success": true,
  "data": [ ... filtered history records ... ]
}
```

### Generate Audit Report
```http
GET /profile/history/audit-report?startDate=2025-04-01&endDate=2025-04-30
Authorization: Bearer <token>

Query Parameters:
- startDate (required): ISO 8601 format
- endDate (required): ISO 8601 format

Response (200 OK):
{
  "success": true,
  "message": "Audit report generated",
  "data": [
    {
      "date": "2025-04-22",
      "action": "CREATE",
      "item_type": "medication",
      "change_count": 3,
      "modified_by_users": "john@example.com, admin@example.com"
    },
    {
      "date": "2025-04-22",
      "action": "UPDATE",
      "item_type": "medication",
      "change_count": 2,
      "modified_by_users": "john@example.com"
    }
  ]
}
```

---

## 📁 File Management

### Upload File
```http
POST /profile/files/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- file: <binary file content> (required)
- category: "Medical Report" (required)
- description: "Annual checkup results" (optional)
- tags: '[1, 2, 3]' (optional, JSON array as string)

Supported Categories:
- Medical Report
- Lab Result
- Prescription
- Insurance Document
- Hospital Record
- Test Image
- Policy Document
- Other

Supported File Types:
- PDF (.pdf)
- JPEG (.jpg, .jpeg)
- PNG (.png)
- Word (.doc, .docx)
- Plain Text (.txt)

Max File Size: 10 MB

Response (201 Created):
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "id": 5,
    "file_name": "med_report_2025_xyz123.pdf",
    "file_type": "application/pdf",
    "file_size": 245000,
    "category": "Medical Report",
    "file_hash": "sha256_hash_here",
    "upload_timestamp": "2025-04-23T10:00:00.000Z",
    "is_encrypted": true
  }
}
```

### List Files
```http
GET /profile/files?category=Medical%20Report
Authorization: Bearer <token>

Query Parameters:
- category (optional): Filter by category

Response (200 OK):
{
  "success": true,
  "data": [
    {
      "id": 5,
      "file_name": "med_report_2025_xyz123.pdf",
      "category": "Medical Report",
      "file_size": 245000,
      "upload_timestamp": "2025-04-23T10:00:00.000Z",
      "description": "Annual checkup results"
    }
  ]
}
```

### Download File
```http
GET /profile/files/:fileId
Authorization: Bearer <token>

Response (200 OK):
<binary file content>
```

### Delete File
```http
DELETE /profile/files/:fileId
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "message": "File deleted successfully"
}
```

### Verify File Integrity
```http
POST /profile/files/:fileId/verify-integrity
Authorization: Bearer <token>

Response (200 OK):
{
  "success": true,
  "data": {
    "file_id": 5,
    "is_valid": true,
    "stored_hash": "sha256_hash_here",
    "calculated_hash": "sha256_hash_here",
    "verification_timestamp": "2025-04-23T10:05:00.000Z"
  }
}
```

---

## 📌 Category Management

### Rename Category
```http
PUT /profile/categories/:categoryId/rename
Content-Type: application/json
Authorization: Bearer <token>

{
  "new_name": "My Special Conditions"
}

Response (200 OK):
{
  "success": true,
  "message": "Category renamed successfully",
  "data": {
    "id": 1,
    "category_name": "My Special Conditions",
    "updated_at": "2025-04-23T10:00:00.000Z"
  }
}
```

### Reorder Categories
```http
POST /profile/categories/reorder
Content-Type: application/json
Authorization: Bearer <token>

{
  "category_orders": [
    { "id": 1, "display_order": 1 },
    { "id": 2, "display_order": 2 },
    { "id": 3, "display_order": 3 }
  ]
}

Response (200 OK):
{
  "success": true,
  "message": "Categories reordered successfully"
}
```

---

## Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

Common HTTP Status Codes:
- **200**: OK - Request successful
- **201**: Created - Resource created successfully
- **400**: Bad Request - Invalid parameters
- **401**: Unauthorized - Missing or invalid token
- **403**: Forbidden - User lacks permission
- **404**: Not Found - Resource not found
- **500**: Server Error - Internal server error

---

## Rate Limiting & Performance Notes

- File uploads: Max 10 MB per file
- Search queries: Min 2 characters
- Audit reports: Recommended date range ≤ 90 days
- List endpoints: Default limit 50, max 500
- Full-text search: Optimized with GIN index for performance

---

## Testing Examples

### 1. Create Tag and Assign to Medication
```bash
# Create tag
curl -X POST http://localhost:3000/api/users/profile/tags \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tag_name":"Chronic","tag_color":"#FF0000"}'

# Assign to medication
curl -X POST http://localhost:3000/api/users/profile/tags/assign \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tag_id":1,"item_type":"medication","item_id":42}'
```

### 2. Search with Filters
```bash
curl "http://localhost:3000/api/users/profile/search?query=diabetes&itemTypes=condition,medication&tags=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Upload File
```bash
curl -X POST http://localhost:3000/api/users/profile/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@medical_report.pdf" \
  -F "category=Medical Report" \
  -F "description=Quarterly checkup"
```

### 4. Get Audit Report
```bash
curl "http://localhost:3000/api/users/profile/history/audit-report?startDate=2025-04-01&endDate=2025-04-30" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Implementation Status

✅ All endpoints implemented and tested
✅ Database tables created and indexed
✅ Authentication and authorization applied
✅ Error handling and validation in place
✅ Cache invalidation on changes
✅ Ready for production deployment

---

Generated: 2025-04-23
Version: 1.0
Status: Complete
