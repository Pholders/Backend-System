# Patient Reminders & Adherence — Frontend Integration

What the patient app needs for medication reminders, logging doses, changing dose times, adherence, and appointment reminders.

**Base URL**: `https://backend-system-u8s2.onrender.com/api`
**Auth**: every endpoint needs `Authorization: Bearer <token>` from a patient login. A doctor, pharmacy or admin token gets `403`.

---

## 1. How it fits together

**Medications.** Each time in a medication's `schedule` (for example `["08:00", "20:00"]`) becomes a **dose**, once per day of the course. The server:

1. sends a push reminder before each dose (by default 30 minutes before, set by `reminder_time_window`, see §4);
2. waits for the patient to log the dose as **taken** or **skipped**;
3. marks a dose **missed** if nobody logs it within 2 hours of its time;
4. keeps `adherence_percent` on each medication up to date.

```
adherence_percent = taken / (taken + skipped + missed)
```

Doses that are still `pending` are left out, so a dose that is due right now doesn't lower the figure before the patient has had a chance to take it.

**Appointments.**
- If the patient sets their own reminders for an appointment (for example 1 day and 1 hour before, by email and push), those are sent, each one once.
- If they set none, they get one push reminder the day before, from 08:00.

**Times.** All schedule times, dose times and appointment times are **South African time**. Timestamps in responses are ISO 8601 in UTC (`2026-11-21T06:00:00.000Z` is 08:00 in South Africa). Convert them for display.

**Push needs a device token.** Reminders reach the phone only if the app has registered its token (see §4). Without one they still show up in the notification inbox.

---

## 2. Medication doses

These endpoints use the medications error format, which is different from the `/users` endpoints:

```json
{ "error": { "code": "NOT_FOUND", "message": "Dose not found." } }
```

| Status | `code` | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Bad `date` or `taken_at`. `error.fields` says which field when there is one |
| `401` | `UNAUTHORIZED` | No token, bad or expired token, or the session was revoked |
| `403` | `FORBIDDEN` | Not a patient token, or the dose belongs to another patient |
| `404` | `NOT_FOUND` | The dose doesn't exist |
| `409` | `DOSE_NOT_DUE` | The dose is more than 60 minutes away |
| `409` | `MEDICATION_NOT_ACTIVE` | Changing the times of a medication that is past or whose course has ended |
| `422` | `DOSES_PER_DAY_MISMATCH` | Changing a prescribed medication's times to a different number per day |
| `500` | `INTERNAL_ERROR` | Server error |

### The dose object

```json
{
  "id": "1042",
  "medication_id": "med_6c1f0d0e8a2b4f7c9d3e5a1b2c4d6e8f",
  "medication_name": "Metformin",
  "dosage": "500mg tablet",
  "scheduled_at": "2026-11-21T06:00:00.000Z",
  "status": "pending",
  "taken_at": null,
  "reminded_at": "2026-11-21T05:30:12.481Z"
}
```

| Field | Notes |
|---|---|
| `id` | **A string.** Send it back exactly as you received it |
| `status` | `pending`, `taken`, `skipped` or `missed` |
| `taken_at` | Set only when `status` is `taken` |
| `reminded_at` | When the reminder went out. `null` if it hasn't been sent yet |

---

### GET `/medications/doses`

The patient's doses for one day, in time order. Use it for a "Today" screen.

| Query | Default | Notes |
|---|---|---|
| `date` | today (South African date) | `YYYY-MM-DD` |

Doses exist from the start of the medication's course (and never from before this feature went live) up to tomorrow. A date further ahead returns an empty list.

**Response `200`**
```json
{
  "data": {
    "date": "2026-11-21",
    "time_zone": "Africa/Johannesburg",
    "doses": [
      { "id": "1042", "medication_id": "med_6c1f…", "medication_name": "Metformin", "dosage": "500mg tablet",
        "scheduled_at": "2026-11-21T06:00:00.000Z", "status": "taken", "taken_at": "2026-11-21T06:04:51.000Z",
        "reminded_at": "2026-11-21T05:30:12.481Z" },
      { "id": "1043", "medication_id": "med_6c1f…", "medication_name": "Metformin", "dosage": "500mg tablet",
        "scheduled_at": "2026-11-21T18:00:00.000Z", "status": "pending", "taken_at": null, "reminded_at": null }
    ]
  }
}
```

---

### POST `/medications/doses/:doseId/taken`

Log a dose as taken.

**Request body** (optional)
```json
{ "taken_at": "2026-11-21T06:10:00.000Z" }
```

Leave out `taken_at` to mean "just now". Send it when the patient says they took the dose earlier. It can't be in the future, and it can't be more than 60 minutes before the dose's time.

**Rules**
- A dose can be logged from 60 minutes before its time. Earlier than that gets `409 DOSE_NOT_DUE`.
- A `missed` dose can still be logged as taken, for a patient who took it but forgot to tap.
- A dose can be switched between `taken` and `skipped`.

**Response `200`.** The updated dose, plus the medication's new adherence:
```json
{
  "data": {
    "id": "1042", "medication_id": "med_6c1f…", "medication_name": "Metformin", "dosage": "500mg tablet",
    "scheduled_at": "2026-11-21T06:00:00.000Z", "status": "taken", "taken_at": "2026-11-21T06:10:00.000Z",
    "reminded_at": "2026-11-21T05:30:12.481Z", "adherence_percent": 92
  }
}
```

---

### POST `/medications/doses/:doseId/skipped`

Log that the patient deliberately didn't take the dose. There is no body. It follows the same rules as `/taken`, and the response has the same shape, with `"status": "skipped"` and `"taken_at": null`. **A skipped dose counts against adherence.**

---

### New fields on GET `/medications`

Each medication in the existing list now carries:

| Field | Notes |
|---|---|
| `adherence_percent` | 0–100 |
| `adherence_doses_counted` | How many doses the percentage is based on (taken + skipped + missed) |
| `schedule_editable` | `true` while the times can be changed: the medication is active and its course hasn't ended. Hide the Edit button when `false` |
| `doses_per_day` | For a medication from a prescription, the prescribed number of times a day: show that many time pickers. `null` for a medication the patient added, which can have any number |

When `adherence_doses_counted` is `0`, show "No data yet" instead of "0%". It's a new medication, or none of its doses have come round yet.

---

### PATCH `/medications/:medicationId/schedule`

Change the times the patient takes a medication. The upcoming doses and their reminders follow the new times.

**Request body**
```json
{ "schedule": ["07:30", "19:30"] }
```

**Rules**
- Times are `HH:mm`, 24-hour, South African time: the same format as `schedule` in `GET /medications`. At least one, at most 12, with no time twice. They're stored sorted.
- A medication from a prescription keeps its prescribed number of times a day: send exactly `doses_per_day` times, or get `422 DOSES_PER_DAY_MISMATCH`. A medication the patient added themselves (`doses_per_day` is `null`) can have any number.
- Only while `schedule_editable` is `true`. Otherwise `409 MEDICATION_NOT_ACTIVE`.

**What changes**
- Doses already taken, skipped or missed stay as they are, so `adherence_percent` and `adherence_doses_counted` don't change.
- Upcoming doses at times that are no longer in the schedule are removed, along with their reminders.
- Upcoming doses at times that stay are kept, so a reminder already sent for one isn't sent again.
- A new time later today gets a dose today. A new time that has already passed today starts tomorrow; it never shows up as missed.

After saving, reload `GET /medications/doses` for the Today screen.

**Response `200`.** The medication, in the same shape as one item of `GET /medications`:
```json
{
  "data": {
    "id": "med_6c1f0d0e8a2b4f7c9d3e5a1b2c4d6e8f",
    "name": "Amoxicillin",
    "schedule": ["07:30", "19:30"],
    "status": "active",
    "adherence_percent": 85,
    "adherence_doses_counted": 12,
    "schedule_editable": true,
    "doses_per_day": 2,
    "...": "the other existing fields"
  }
}
```

**Errors** use the medications format above. Show `error.message` to the patient.

| Status | `code` | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Not a list, empty, a time not in `HH:mm`, or the same time twice. `error.fields` says which |
| `403` | `FORBIDDEN` | The medication belongs to another patient |
| `404` | `NOT_FOUND` | No such medication |
| `409` | `MEDICATION_NOT_ACTIVE` | The medication is past, or its course has ended |
| `422` | `DOSES_PER_DAY_MISMATCH` | A prescribed medication with a different number of times than prescribed |

```json
{ "error": { "code": "DOSES_PER_DAY_MISMATCH", "message": "This medication is prescribed 2 times a day, so choose exactly 2 times." } }
```

---

## 3. Appointment reminders

These endpoints use the standard envelope: `{ "success": true, "message": "...", "data": { ... } }`. On failure `success` is `false` and `message` explains why. `404` means the appointment or reminder doesn't exist. `403` means the appointment belongs to someone else.

**Reminder settings**

| Field | Notes |
|---|---|
| `reminderTimes` | Minutes before the appointment, as positive whole numbers. `1440` = 1 day, `60` = 1 hour, `15` = 15 minutes |
| `reminderMethods` | Any of `push`, `email`, `in-app`, `sms` |

What each method does:

| Method | Behaviour |
|---|---|
| `push` | A push notification. It also goes in the notification inbox |
| `email` | An email to the patient's address |
| `in-app` | The notification inbox only, with no push. If `push` is also chosen, it adds nothing extra |
| `sms` | **Not available yet.** No SMS provider is connected; these show as `skipped` in the history. Hide this option in the UI for now |

Each time and method is sent once. If the appointment is rescheduled, the reminders are sent again for the new time. A reminder whose moment passed more than 30 minutes before it was set is not sent, for example "1 day before" on an appointment 3 hours away.

---

### POST `/users/appointments/:appointmentId/reminders`

Set the reminders for an appointment. If it already has reminders, they're replaced.

**Request body**
```json
{ "reminderTimes": [1440, 60], "reminderMethods": ["push", "email"] }
```

**Response `200`**
```json
{
  "success": true,
  "message": "Reminder set successfully",
  "data": {
    "reminderId": 12, "appointmentId": 101,
    "reminderTimes": [1440, 60], "reminderMethods": ["push", "email"],
    "isEnabled": true, "createdAt": "2026-11-21T07:00:00.000Z"
  }
}
```

### GET `/users/appointments/:appointmentId/reminders`

The appointment's reminders. Returns `404` with `"No reminder set for this appointment"` when there are none.

**Response `200`.** The same `data` as above, plus `updatedAt`.

### PUT `/users/appointments/:appointmentId/reminders`

Change the times, the methods, or both.

**Request body.** Send either field, or both:
```json
{ "reminderTimes": [60] }
```

**Response `200`**: `data` has `reminderId`, `appointmentId`, `reminderTimes`, `reminderMethods` and `updatedAt`.

### PATCH `/users/appointments/:appointmentId/reminders/toggle`

Turn the reminders off or back on without losing the settings.

**Request body**
```json
{ "isEnabled": false }
```

**Response `200`**
```json
{ "success": true, "message": "Reminder disabled successfully", "data": { "reminderId": 12, "appointmentId": 101, "isEnabled": false } }
```

While the reminders are turned off, the patient gets the default day-before reminder instead.

### DELETE `/users/appointments/:appointmentId/reminders`

Remove the reminders. The patient gets the default day-before reminder instead.

**Response `200`**: `data` has `reminderId` and `appointmentId`.

### GET `/users/reminders`

Every appointment the patient has set reminders for.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "total": 1,
    "reminders": [
      { "reminderId": 12, "appointmentId": 101, "doctorName": "Thandi Nkosi",
        "appointmentDate": "2026-11-26T00:00:00.000Z", "appointmentTime": "13:00",
        "reminderTimes": [1440, 60], "reminderMethods": ["push", "email"], "isEnabled": true }
    ]
  }
}
```

`appointmentDate` is the calendar date sent as midnight UTC. Use its first 10 characters (`2026-11-26`). `appointmentTime` is South African time.

### GET `/users/reminders/upcoming`

The patient's turned-on reminders for appointments today or tomorrow. Each item also has `specialization`, `clinicName`, `consultationFee` and `status`.

### GET `/users/appointments/:appointmentId/notification-history`

What was sent for an appointment, newest first.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "appointmentId": "101",
    "total": 2,
    "notifications": [
      { "notificationId": 7, "reminderMethod": "push", "minutesBefore": 60, "status": "sent",
        "sentAt": "2026-11-26T10:00:04.000Z", "errorMessage": null },
      { "notificationId": 6, "reminderMethod": "sms", "minutesBefore": 60, "status": "skipped",
        "sentAt": "2026-11-26T10:00:03.000Z", "errorMessage": "SMS reminders are not configured" }
    ]
  }
}
```

`status` is one of:
- `sent`
- `skipped`: deliberately not sent (no SMS provider, no email address, or the patient turned appointment notifications off)
- `failed`: tried again automatically while the reminder is still due
- `pending`: being sent right now

---

## 4. Notifications: receiving reminders

Reminders arrive as push notifications and in the notification inbox. These endpoints already existed; this section covers what the reminders put in them.

### Register the device: POST `/notifications/device-token`

Call this after the patient grants notification permission, and again whenever the token changes.

```json
{ "token": "<FCM registration token>", "platform": "android" }
```

On logout, call `DELETE /notifications/device-token` with `{ "token": "..." }`.

### Push payloads

Every push carries a `data` map. **All values are strings** (an FCM rule).

**Medication dose reminder**

| Key | Example |
|---|---|
| `type` | `"medication"` |
| `action` | `"medication_dose"` |
| `doseId` | `"1043"` |
| `medicationId` | `"med_6c1f…"` |
| `scheduledAt` | `"2026-11-21T18:00:00.000Z"` |
| `notificationId` | `"88"` (the inbox item) |

Title `Medication Reminder`, body `Your 20:00 dose of Metformin (500mg tablet) is due.`

Suggested handling: offer **Taken** and **Skip** actions on the notification that call §2 with `doseId`. Tapping the notification itself should open the dose. A dose can be logged from 60 minutes before its time, so a patient whose `reminder_time_window` is more than 60 can get `409 DOSE_NOT_DUE` from an early tap. Show the error message.

**Appointment reminder** (patient-set or day-before)

| Key | Example |
|---|---|
| `type` | `"appointment"` |
| `action` | `"view_appointment"` |
| `appointmentId` | `"101"` |
| `notificationId` | `"89"` |

Example bodies:
- Patient-set: `Your appointment with Dr. Thandi Nkosi is in 1 hour: Thursday, 26 November 2026 at 13:00.`
- Day-before: `You have a consultation tomorrow at 13:00 with Dr. Thandi Nkosi.`

### Inbox: GET `/notifications`

Reminders appear here with `type` `medication` or `appointment`. Their `data` is the same as the push, but as JSON (`doseId` and `appointmentId` come as they are stored: `doseId` a string, `appointmentId` a number). Filter with `?type=medication` or `?type=appointment`.

### Settings: GET / PUT `/notifications/settings`

| Field | Effect on reminders |
|---|---|
| `medication_reminders` | `false` stops medication dose reminders. Doses are still tracked and adherence still counts |
| `appointment_notifications` | `false` stops appointment reminders by push and in-app (they are recorded as `skipped`). Email reminders still go out |
| `reminder_time_window` | Minutes before a **medication dose** that its reminder is sent. Default `30`; `0` means at the dose time. It doesn't affect appointment reminders, which use `reminderTimes` |

```json
{ "medication_reminders": true, "reminder_time_window": 15 }
```

---

## 5. Timing, at a glance

| Thing | When |
|---|---|
| Medication reminder | `reminder_time_window` minutes before the dose; checked every 5 minutes, so it can be up to 5 minutes later than that |
| Medication reminder after the server was down | Still sent up to 30 minutes after the dose time, then dropped |
| Dose becomes `missed` | 2 hours after its time if not logged |
| Earliest a dose can be logged | 60 minutes before its time |
| Patient-set appointment reminder | At each `reminderTimes` offset, within 5 minutes; up to 30 minutes late after downtime; never after the appointment starts |
| Default day-before appointment reminder | From 08:00 the day before, for appointments with no reminders of their own; checked every 15 minutes |
