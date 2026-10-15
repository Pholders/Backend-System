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
| `local` (default) | `uploads/` on the machine | A developer machine |
| `postgres` | `stored_files` in the app's own database | Render, today |
| `cloudinary` | Private authenticated assets in Cloudinary | Production object storage |

On Render the disk is wiped on every deploy. With the `local` driver, a
document a patient uploaded on Monday is gone after Tuesday's deploy while
its database row survives — pointing at nothing. That is why every deployed
environment needs a durable driver, which today means `STORAGE_DRIVER=postgres`.

## The postgres driver

`STORAGE_DRIVER=postgres` keeps the bytes in a `stored_files` table, keyed by
the same storage key every other driver uses. It needs no account, no card and
no configuration beyond that one variable, because it uses the database the
app already connects to.

It is not where files belong long term. It grows the database and its backups,
and it puts file reads on the same connection pool as everything else. It is
here because it is the only durable store available without a billing
account, and it suits what is actually stored: every upload route caps at
10MB or less, files are read one at a time behind an ownership check, and
nothing streams.

Moving off it later is a copy and an env var, not a data migration — the keys
in `medical_aid_schemes`, `patient_files` and the rest mean the same thing to
every driver.

## Adding a driver

A driver is a module in `services/storage` that exports `name` and four
async functions — `put(file, destination, filename)` returning the key,
`get(key)` returning `{ buffer, contentType }`, `exists(key)` and
`remove(key)` — and one line in the `DRIVERS` map in
`services/storage/index.js`. `postgresDriver.js` is the shortest example.

## The Cloudinary driver

Set `STORAGE_DRIVER=cloudinary` and configure these server-side environment
variables:

```dotenv
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
# Optional namespace for all uploaded assets (defaults to "pholders")
CLOUDINARY_FOLDER=pholders
```

The driver uploads images as Cloudinary `image` resources and other accepted
document types as `raw` resources. All assets are uploaded as authenticated,
not public. The app still downloads the bytes from Cloudinary and returns them
only after its normal authorization checks; it never stores or returns a
Cloudinary delivery URL.

Keep two things from the existing drivers:

- Store files privately and serve them through the app's own routes below,
  never through a public provider URL — these are patient medical documents.
- Read credentials lazily, on the first upload or download, so a missing
  variable fails a request rather than the server's boot.

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
| Doctor profile image | JPEG, PNG, WEBP | 5 MB |
| Claim / invoice document | PDF, JPEG, PNG, WEBP | 10 MB |
| Medical aid card | JPEG, PNG, WEBP | 8 MB |
| Avatar | JPEG, PNG, WEBP | 5 MB |

A claim or an invoice holds one document, replaced by uploading another:

- `POST /api/profile/medical-aid/claims/:id/document`
- `POST /api/profile/medical-aid/invoices/:id/document`

Both take the file as `document`, check the row belongs to the caller before
storing anything, and delete the object they superseded only after the row
points at the new one.

Doctor profile images are uploaded through
`PUT /api/users/doctor/profile/image` using the multipart field `image`.
Only the signed-in doctor can upload their own image. The stored image is
returned through `GET /api/users/doctor/profile-images/:filename` for
patient-facing provider listings.

Patient avatars are uploaded through `PUT /api/profile/avatar`. For clients
using the patient API base, `PUT /api/users/profile/avatar` is an equivalent
compatibility endpoint. Both use the multipart field `avatar`. The backend
checks the uploaded bytes rather than trusting the multipart MIME label, so
mobile clients that report a valid JPEG, PNG, or WEBP image as
`application/octet-stream` remain supported.

## Prescription PDFs

A prescription PDF is generated per request by `services/prescriptionPdfService`
and never stored, so there is nothing to keep in sync and nothing to leak. It
is served by `GET /api/prescriptions/:id/download` (as an attachment) and
`GET /api/prescriptions/:id/print` (inline, for a viewer to print from).

An unsigned or revoked prescription still renders, but carries a banner and a
per-page watermark saying it cannot be dispensed -- a document that looked
official while being invalid would be the dangerous outcome. Times are
rendered in `Africa/Johannesburg` whatever the server's clock is set to.

## Rows from before this change

Older `patient_files` rows hold an absolute path from the machine that took
the upload. Those are read from disk where they are, so a developer's local
files keep working. On Render they are already unreadable — the disk they
named is gone — and they report as not found.
