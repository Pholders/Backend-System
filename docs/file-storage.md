# File storage

Every file the platform accepts — patient documents, profile photos, medical
aid cards — goes through one small interface in `services/storage`. Nothing
else in the codebase touches the filesystem for uploads.

```js
const storage = require('./services/storage');

const key = await storage.put(file, 'patient-files/patient_42', filename);
const { buffer } = await storage.get(key);
await storage.remove(key);
```

`put` returns a **key**, not a path. The key is what goes in the database.
It stays valid if the driver changes underneath, which a path does not.

## Choosing a driver

`STORAGE_DRIVER` picks one. It defaults to `local`, so nothing changes until
it is set.

| Value | Where bytes live | Use |
| --- | --- | --- |
| `local` (default) | `uploads/` on the machine | Development |
| `firebase` | Firebase Storage bucket | Render, and any host with an ephemeral disk |

On Render the disk is wiped on every deploy. With the `local` driver, a
document a patient uploaded on Monday is gone after Tuesday's deploy while
its database row survives — pointing at nothing. That is the reason the
firebase driver exists, and why `STORAGE_DRIVER=firebase` belongs on any
deployed environment.

## Setting up the firebase driver

1. Create a Firebase project and enable Storage. Pick **africa-south1** as
   the location — patient data under POPIA should stay in South Africa, and
   the bucket location cannot be changed afterwards.
2. Project settings → Service accounts → generate a private key.
3. Set these on the host:

   | Variable | Value |
   | --- | --- |
   | `STORAGE_DRIVER` | `firebase` |
   | `FIREBASE_STORAGE_BUCKET` | e.g. `pholders.firebasestorage.app` |
   | `FCM_PROJECT_ID` | `project_id` from the key file |
   | `FCM_CLIENT_EMAIL` | `client_email` from the key file |
   | `FCM_PRIVATE_KEY` | `private_key` from the key file, newlines and all |

   The `FCM_*` names are shared with push notifications, which already
   authenticate as the same service account — one credential, one app.
   `GOOGLE_APPLICATION_CREDENTIALS` works instead if the host mounts the key
   file.

The driver only reaches for Firebase on the first upload or download, so a
missing variable surfaces as a failed request and never as a crashed boot.

## Serving files

Objects are written private and `no-store`, and the driver exposes no
provider signed URLs on purpose. Every download goes back through the app,
which re-checks ownership itself:

- `GET /api/users/profile/files/:fileId` — checks the row belongs to the
  caller, and records the access in `access_log`
- `GET /api/profile/medical-aid/files/download` — takes a short-lived token
  the app issued from `/api/profile/medical-aid/card/:side/url` (10 minutes),
  then re-checks ownership of the key before returning bytes
- `GET /api/profile/avatars/:filename` — unauthenticated, which is why the
  filename carries 8 random bytes

The app issuing its own token is not the same as a bucket signed URL: a
provider URL grants access the app can no longer withdraw or log, and it
would bypass both checks above. That is the whole reason for the extra hop.

## Accepted types

| Route | Types | Limit |
| --- | --- | --- |
| Patient documents | PDF, JPEG, PNG, DOC, DOCX, TXT | 10 MB |
| Medical aid card | JPEG, PNG, WEBP | 8 MB |
| Avatar | JPEG, PNG, WEBP | 5 MB |

## Rows from before this change

Older `patient_files` rows hold an absolute path from the machine that took
the upload. Those are read from disk where they are, so a developer's local
files keep working. On Render they are already unreadable — the disk they
named is gone — and they report as not found.
