# Doctor Ratings & Reviews System

## Overview
The doctor ratings and reviews system allows patients to rate and review their experiences with doctors. This helps other patients make informed decisions when selecting healthcare providers and helps doctors receive feedback on their services.

## Features

### 1. **Submit/Update Review**
- Patients can submit a rating (1-5 stars) and optional review text
- Patients can only have one active review per doctor (updates if already exists)
- Reviews are marked as verified if patient has completed appointments with the doctor

### 2. **View Doctor Ratings & Recent Reviews**
- When viewing available doctors, patients see:
  - Average rating (0-5.00)
  - Total number of reviews
  - Highest and lowest ratings received
  - **Up to 5 most recent reviews** with patient name, rating, and review text
- Detailed rating distribution (percentage of 1★, 2★, 3★, 4★, 5★ reviews)
- Access full review list via dedicated endpoint

### 3. **Review Management**
- Patients can view all their reviews
- Patients can update their reviews (rating and text)
- Patients can delete their reviews
- Reviews cannot be deleted by others (authorization checks)

### 4. **Review Verification**
- Reviews are automatically marked as verified if the patient has a completed appointment with the doctor
- Verified reviews show additional credibility

## Database Schema

### Doctor Reviews Table
```sql
CREATE TABLE doctor_reviews (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(doctor_id, patient_id)  -- One review per patient per doctor
);
```

**Indexes:**
- `idx_doctor_reviews_doctor_id`: Fast lookup of doctor reviews
- `idx_doctor_reviews_patient_id`: Fast lookup of patient reviews
- `idx_doctor_reviews_rating`: Fast filtering by rating
- `idx_doctor_reviews_created_at`: Timeline queries

## API Endpoints

### Submit/Update Review
```http
POST /appointments/doctors/{doctorId}/reviews
```
**Authentication:** Required (Patient only)

**Request Body:**
```json
{
  "rating": 5,
  "reviewText": "Dr. Smith provided excellent care and was very attentive to my concerns."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Review submitted successfully",
  "data": {
    "reviewId": 1,
    "doctorId": 5,
    "rating": 5,
    "reviewText": "Dr. Smith provided excellent care...",
    "isVerified": true,
    "createdAt": "2026-05-13T15:30:00Z"
  }
}
```

**Error Response (Invalid Rating):**
```json
{
  "success": false,
  "message": "Rating must be between 1 and 5"
}
```

---

### Get Doctor Reviews
```http
GET /appointments/doctors/{doctorId}/reviews?limit=10&offset=0
```
**Authentication:** Not required

**Query Parameters:**
- `limit` (optional): Number of reviews to retrieve (default: 10)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "message": "Doctor reviews retrieved successfully",
  "data": {
    "doctorId": 5,
    "ratingStats": {
      "averageRating": 4.75,
      "totalReviews": 20,
      "highestRating": 5,
      "lowestRating": 3,
      "fiveStarPercentage": 75.0,
      "fourStarPercentage": 20.0,
      "threeStarPercentage": 5.0,
      "twoStarPercentage": 0.0,
      "oneStarPercentage": 0.0
    },
    "reviews": [
      {
        "reviewId": 1,
        "rating": 5,
        "reviewText": "Excellent doctor, very professional",
        "patientName": "John Doe",
        "isVerified": true,
        "createdAt": "2026-05-13T15:30:00Z"
      },
      {
        "reviewId": 2,
        "rating": 4,
        "reviewText": "Good service, a bit rushed",
        "patientName": "Jane Smith",
        "isVerified": true,
        "createdAt": "2026-05-12T10:15:00Z"
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 20,
      "hasMore": false
    }
  }
}
```

---

### Get Rating Summary
```http
GET /appointments/doctors/{doctorId}/reviews/summary
```
**Authentication:** Not required

**Response:**
```json
{
  "success": true,
  "message": "Rating summary retrieved successfully",
  "data": {
    "doctorId": 5,
    "averageRating": 4.75,
    "totalReviews": 20,
    "ratingDistribution": [
      {
        "stars": 5,
        "count": 15
      },
      {
        "stars": 4,
        "count": 4
      },
      {
        "stars": 3,
        "count": 1
      }
    ]
  }
}
```

---

### Check Existing Review
```http
GET /appointments/doctors/{doctorId}/reviews/check-review
```
**Authentication:** Required (Patient only)

**Response (Has Review):**
```json
{
  "success": true,
  "data": {
    "hasReview": true,
    "review": {
      "reviewId": 1,
      "rating": 5,
      "reviewText": "Dr. Smith is excellent",
      "createdAt": "2026-05-13T15:30:00Z"
    }
  }
}
```

**Response (No Review):**
```json
{
  "success": true,
  "data": {
    "hasReview": false,
    "review": null
  }
}
```

---

### Get Patient's Reviews
```http
GET /reviews?limit=10&offset=0
```
**Authentication:** Required (Patient only)

**Query Parameters:**
- `limit` (optional): Number of reviews to retrieve (default: 10)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "message": "Patient reviews retrieved successfully",
  "data": {
    "reviews": [
      {
        "reviewId": 1,
        "doctorId": 5,
        "doctorName": "Dr. John Smith",
        "specialization": "Cardiology",
        "clinicName": "Heart Health Clinic",
        "city": "Johannesburg",
        "rating": 5,
        "reviewText": "Excellent doctor, very professional",
        "isVerified": true,
        "createdAt": "2026-05-13T15:30:00Z"
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 1
    }
  }
}
```

---

### Update Review
```http
PUT /reviews/{reviewId}
```
**Authentication:** Required (Patient only)

**Request Body:**
```json
{
  "rating": 4,
  "reviewText": "Updated review text"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Review updated successfully",
  "data": {
    "reviewId": 1,
    "rating": 4,
    "reviewText": "Updated review text",
    "updatedAt": "2026-05-14T10:00:00Z"
  }
}
```

---

### Delete Review
```http
DELETE /reviews/{reviewId}
```
**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

## Integration with Doctor Selection

### Available Doctors with Ratings and Recent Reviews
When patients view available doctors via `/appointments/doctors`, each doctor now includes:

```json
{
  "id": 5,
  "firstName": "John",
  "lastName": "Smith",
  "specialization": "Cardiology",
  "experience": 10,
  "clinicName": "Heart Health Clinic",
  "city": "Johannesburg",
  "consultationFee": 500,
  "bio": "Dr. Smith is a highly experienced cardiologist...",
  "rating": {
    "averageRating": 4.75,
    "totalReviews": 20,
    "highestRating": 5,
    "lowestRating": 3
  },
  "recentReviews": [
    {
      "reviewId": 1,
      "rating": 5,
      "reviewText": "Excellent care and very professional",
      "patientName": "Jane Doe",
      "isVerified": true,
      "createdAt": "2026-05-12T14:30:00Z"
    },
    {
      "reviewId": 2,
      "rating": 4,
      "reviewText": "Good doctor, very knowledgeable",
      "patientName": "John Smith",
      "isVerified": true,
      "createdAt": "2026-05-10T10:15:00Z"
    },
    {
      "reviewId": 3,
      "rating": 5,
      "reviewText": "Highly recommend for heart issues",
      "patientName": "Sarah Johnson",
      "isVerified": true,
      "createdAt": "2026-05-08T16:45:00Z"
    }
  ]
}
```

**Data Available:**
- **Rating Summary**: Average rating, total reviews, highest/lowest ratings
- **Recent Reviews**: Up to 5 most recent reviews with:
  - Patient name
  - Star rating (1-5)
  - Review text
  - Verified status
  - Review date

## Frontend Implementation Examples

### Display Doctor Ratings with Recent Reviews
```javascript
// Display doctor card with rating and recent reviews
function DoctorCard({ doctor }) {
  const stars = Array(5).fill(0).map((_, i) => (
    <span key={i}>
      {i < Math.round(doctor.rating.averageRating) ? '★' : '☆'}
    </span>
  ));

  return (
    <div className="doctor-card">
      <h3>{doctor.firstName} {doctor.lastName}</h3>
      <p>{doctor.specialization}</p>
      
      <div className="rating">
        {stars} {doctor.rating.averageRating.toFixed(2)} ({doctor.rating.totalReviews} reviews)
      </div>
      
      <p className="bio">{doctor.bio}</p>
      
      {/* Display recent reviews */}
      {doctor.recentReviews && doctor.recentReviews.length > 0 && (
        <div className="recent-reviews">
          <h4>Recent Reviews</h4>
          {doctor.recentReviews.map(review => (
            <div key={review.reviewId} className="review-item">
              <div className="review-header">
                <span className="patient-name">{review.patientName}</span>
                <span className="rating">★{review.rating}</span>
                {review.isVerified && <span className="verified">✓ Verified</span>}
              </div>
              <p className="review-text">{review.reviewText}</p>
              <small className="review-date">{new Date(review.createdAt).toLocaleDateString()}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Submit Review
```javascript
async function submitReview(doctorId, rating, reviewText) {
  const response = await fetch(
    `/appointments/doctors/${doctorId}/reviews`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rating,
        reviewText
      })
    }
  );

  return response.json();
}
```

### Display Reviews
```javascript
async function displayDoctorReviews(doctorId) {
  const response = await fetch(`/appointments/doctors/${doctorId}/reviews`);
  const data = await response.json();

  if (data.success) {
    const stats = data.data.ratingStats;
    console.log(`Average Rating: ${stats.averageRating}/5`);
    console.log(`Total Reviews: ${stats.totalReviews}`);
    
    data.data.reviews.forEach(review => {
      console.log(`${review.patientName}: ★${review.rating} - ${review.reviewText}`);
    });
  }
}
```

## Validation & Business Rules

### Rating Constraints
- Must be an integer between 1 and 5
- Required field when submitting a review
- Cannot be null or undefined

### Review Text
- Optional field
- Can be up to 1000 characters
- Stores detailed patient feedback

### One Review Per Patient Per Doctor
- UNIQUE constraint on (doctor_id, patient_id)
- Updating existing review instead of creating duplicate
- Prevents review spam

### Verification Status
- Automatically set to `true` if patient has completed appointment with doctor
- Helps identify reviews from patients with actual experience
- Can be used to sort/filter reviews

## Error Handling

### Doctor Not Found
```json
{
  "success": false,
  "message": "Doctor not found"
}
```

### Unauthorized Review Update/Delete
```json
{
  "success": false,
  "message": "You can only update your own reviews"
}
```

### Invalid Rating
```json
{
  "success": false,
  "message": "Rating must be between 1 and 5"
}
```

### Review Not Found
```json
{
  "success": false,
  "message": "Review not found"
}
```

## Security Features

- **Authentication Required:** All patient review operations require valid JWT token
- **Authorization Checks:** Patients can only update/delete their own reviews
- **Audit Logging:** All review operations logged to security audit log
- **Input Validation:** Rating and review text validated before database operations
- **UNIQUE Constraint:** Prevents duplicate reviews via database constraint

## Performance Optimization

### Indexes
- Doctor reviews indexed by doctor_id for fast retrieval
- Patient reviews indexed by patient_id
- Rating indexed for filtering operations
- Created date indexed for timeline queries

### Pagination
- Reviews support pagination (limit/offset)
- Prevents loading all reviews at once
- Default limit: 10 reviews per request

### Caching Recommendations
- Cache average ratings (update every 5 minutes)
- Cache rating distribution (update every 5 minutes)
- Clear cache when new review is posted

## Future Enhancements

1. **Review Moderation**
   - Flag inappropriate reviews
   - Admin review approval system
   - Automatic spam detection

2. **Enhanced Analytics**
   - Track rating trends over time
   - Identify improvement areas for doctors
   - Highlight common positive/negative themes

3. **Helpful Voting**
   - Allow patients to mark reviews as "helpful"
   - Sort reviews by helpfulness
   - Identify most valuable patient feedback

4. **Review Responses**
   - Allow doctors to respond to reviews
   - Address patient concerns publicly
   - Build doctor engagement with feedback

5. **Advanced Filtering**
   - Filter reviews by rating (show only 5-star, etc.)
   - Filter by verified status
   - Filter by date range

6. **Review Photos**
   - Allow patients to upload photos with reviews
   - Visual documentation of clinic/doctor
   - Increase review authenticity

## Installation & Setup

### 1. Run Database Migration
The reviews table is automatically created when the application initializes:

```javascript
// In config/initDb.js
const DoctorReview = require('../models/DoctorReview');
await DoctorReview.createTable();
```

Or manually:
```bash
node -e "const { DoctorReview } = require('./models'); DoctorReview.createTable();"
```

### 2. Restart Application
Restart your backend server to ensure all routes are registered:
```bash
npm start
# or
node server.js
```

### 3. Verify Setup
Test the endpoints using your API client:
```bash
# Get available doctors with ratings
curl http://localhost:3000/appointments/doctors

# Get reviews for a specific doctor
curl http://localhost:3000/appointments/doctors/1/reviews
```

## Usage Statistics

### Metrics to Track
- Average review response time
- Review conversion rate (% of patients who leave reviews)
- Distribution of ratings (most common rating)
- Doctor improvement trends
- Most helpful reviews

### Recommended Actions
- Encourage detailed reviews with incentives
- Respond to low ratings with improvements
- Highlight top-rated doctors in marketing
- Use feedback for doctor training programs
