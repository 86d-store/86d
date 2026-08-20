# Forms Module

Custom forms for contact, surveys, inquiries, and feedback. Merchants create form definitions with configurable fields; customers submit responses via store endpoints.

## File structure

```
src/
  index.ts              Module factory, FormsOptions, admin pages
  schema.ts             ModuleSchema (form, formSubmission)
  service.ts            Type definitions + FormsController interface
  service-impl.ts       Controller implementation + field validation
  store/endpoints/
    index.ts            Store endpoint map
    list-forms.ts       GET /forms — active forms list
    get-form.ts         GET /forms/:slug — single form by slug
    submit-form.ts      POST /forms/:slug/submit — customer submission
  admin/endpoints/
    index.ts            Admin endpoint map
    list-forms.ts       GET /admin/forms
    create-form.ts      POST /admin/forms/create
    get-form.ts         GET /admin/forms/:id
    update-form.ts      POST /admin/forms/:id/update
    delete-form.ts      POST /admin/forms/:id/delete
    list-submissions.ts GET /admin/forms/:formId/submissions
    get-submission.ts   GET /admin/forms/submissions/:id (auto-marks read)
    update-submission-status.ts  POST /admin/forms/submissions/:id/status
    delete-submission.ts         POST /admin/forms/submissions/:id/delete
    bulk-delete-submissions.ts   POST /admin/forms/submissions/bulk-delete
    stats.ts            GET /admin/forms/stats
  admin/components/
    index.tsx           FormsList, FormCreate, FormDetail, FormSubmissions
  __tests__/
    service-impl.test.ts  58 tests covering CRUD, validation, all field types, submissions, stats
```

## Data models

### form
| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| name | string | Display name |
| slug | string | Unique, used in store URLs |
| description | string? | Optional |
| fields | json (FormField[]) | Field definitions array |
| submitLabel | string | Button text, default "Submit" |
| successMessage | string | Shown after submit |
| isActive | boolean | Whether accepting submissions |
| notifyEmail | string? | Email to notify on submission |
| honeypotEnabled | boolean | Spam protection, default true |
| maxSubmissions | number | 0 = unlimited |

### formSubmission
| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| formId | string | References form.id, cascade delete |
| values | json | Field name → value map |
| ipAddress | string? | Submitter IP |
| status | string | unread / read / spam / archived |

## Field types

`text`, `email`, `textarea`, `number`, `phone`, `select`, `radio`, `checkbox`, `date`, `url`, `hidden`

## Admin components

| Component | Path | Description |
|-----------|------|-------------|
| `FormsList` | `/admin/forms` | Stats dashboard + form table with status, field count, creation date |
| `FormCreate` | `/admin/forms/create` | Create form with field builder, settings, slug auto-generation |
| `FormDetail` | `/admin/forms/:id` | View/edit form with inline field builder, toggle active, delete |
| `FormSubmissions` | `/admin/forms/:id/submissions` | Submission list with status filter, bulk select/delete, mark read/spam/archive |

All components use `useModuleClient()` from `@86d-app/core/client`. The `FieldBuilder` internal component is shared between create and edit views.

## Key patterns

- **Validation** happens in `service-impl.ts` `validateSubmission()` — checks required, email/url format, number range, text length, regex pattern, select/radio options
- **Honeypot** spam protection: store submit endpoint accepts `_hp` field; if non-empty, silently discards the submission
- **Auto-read**: admin `get-submission` endpoint marks unread submissions as read
- **Cascade delete**: deleting a form removes all its submissions
- **Label a11y**: all form inputs are nested inside `<label>` elements for accessibility

## Options

```ts
interface FormsOptions extends ModuleConfig {
  maxSubmissionsPerHour?: number; // rate limit per IP (default 10)
}
```
