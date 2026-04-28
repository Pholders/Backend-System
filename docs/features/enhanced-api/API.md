# Enhanced Patient Profile API

## Overview

Complete API documentation for advanced patient profile features:
- Tagging & Organization
- Search & Filtering
- Version History
- File Management
- Category Management

---

## 🏷️ Tagging System

### Create Tag
```http
POST /api/users/profile/tags
Authorization: Bearer <token>

{
  "tag_name": "Urgent",
  "tag_color": "#FF0000",
  "description": "Requires immediate attention"
}
```

### Get All Tags
```http
GET /api/users/profile/tags
Authorization: Bearer <token>
```

### Assign Tag to Item
```http
POST /api/users/profile/tags/assign
Authorization: Bearer <token>

{
  "tag_id": 1,
  "item_type": "medication",
  "item_id": 42
}
```

Supported item_types:
- `allergy`
- `condition`
- `medication`
- `vaccination`
- `test_result`
- `provider`
- `lifestyle_data`
- `directive`
- `custom_category`
- `file`

---

## 🔍 Search & Filtering

### Full-Text Search
```http
GET /api/users/profile/search?query=diabetes&itemTypes=condition,medication&tags=1,2
Authorization: Bearer <token>

Query Parameters:
- query: Search term (min 2 chars)
- itemTypes: Comma-separated item types
- tags: Comma-separated tag IDs
```

### Filter by Tags
```http
POST /api/users/profile/filter-by-tags
Authorization: Bearer <token>

{
  "tag_ids": [1, 2, 3]
}
```

---

## 📋 Version History & Audit Trail

### Get Item History
```http
GET /api/users/profile/history/item?itemType=medication&itemId=42
Authorization: Bearer <token>
```

### Get Recent Changes
```http
GET /api/users/profile/history/recent?limit=50&days=30
Authorization: Bearer <token>
```

### Get Audit Trail
```http
GET /api/users/profile/history/audit-trail?itemType=medication&action=UPDATE
Authorization: Bearer <token>
```

### Generate Audit Report
```http
GET /api/users/profile/history/audit-report?startDate=2025-04-01&endDate=2025-04-30
Authorization: Bearer <token>
```

---

## 📁 File Management

### Upload File
```http
POST /api/users/profile/files/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- file: <binary>
- category: Medical Report|Lab Result|Prescription|...
- description: Optional description
- tags: Optional JSON array
```

### List Files
```http
GET /api/users/profile/files?category=Medical%20Report
Authorization: Bearer <token>
```

### Download File
```http
GET /api/users/profile/files/:fileId
Authorization: Bearer <token>
```

### Delete File
```http
DELETE /api/users/profile/files/:fileId
Authorization: Bearer <token>
```

### Verify File Integrity
```http
POST /api/users/profile/files/:fileId/verify-integrity
Authorization: Bearer <token>
```

**Supported File Types**: PDF, JPEG, PNG, Word, Text  
**Max Size**: 10 MB

---

## 📌 Category Management

### Rename Category
```http
PUT /api/users/profile/categories/:categoryId/rename
Authorization: Bearer <token>

{
  "new_name": "My Special Conditions"
}
```

### Reorder Categories
```http
POST /api/users/profile/categories/reorder
Authorization: Bearer <token>

{
  "category_orders": [
    { "id": 1, "display_order": 1 },
    { "id": 2, "display_order": 2 }
  ]
}
```

---

## Error Responses

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

**Status Codes**:
- 200: OK
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

---

## Rate Limiting & Performance

- File uploads: Max 10 MB
- Search queries: Min 2 characters
- Audit reports: Recommended ≤ 90 days
- List endpoints: Default limit 50, max 500

---

**Status**: ✅ Production Ready
