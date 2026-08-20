

# @86d-app/forms

📚 **Documentation:** [86d.app/docs/modules/forms](https://86d.app/docs/modules/forms)

Custom forms module for the 86d commerce platform. Create contact forms, surveys, inquiry forms, feedback forms, and more with configurable fields and submission management.

## Installation

```ts
import forms from "@86d-app/forms";

export default defineStore({
  modules: [
    forms({
      maxSubmissionsPerHour: 10,
    }),
  ],
});
```

## Features

- **Form builder** — define forms with 11 field types (text, email, textarea, number, phone, select, radio, checkbox, date, url, hidden)
- **Field validation** — required fields, email/URL format, number range, text length, regex patterns, select/radio options
- **Spam protection** — built-in honeypot field support
- **Submission management** — status tracking (unread/read/spam/archived), bulk delete
- **Submission limits** — optional cap on total submissions per form
- **Auto-read** — viewing a submission in admin auto-marks it as read
- **Admin UI** — full admin interface with form list, create/edit with drag-and-drop field builder, submission inbox with filtering and bulk actions

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxSubmissionsPerHour` | `number` | `10` | Rate limit per IP address per hour |

## Store endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/forms` | List active forms |
| GET | `/forms/:slug` | Get a form by slug (active only) |
| POST | `/forms/:slug/submit` | Submit a form response |

### Submit body

```json
{
  "values": { "name": "Jane", "email": "jane@example.com", "message": "Hello" },
  "_hp": ""
}
```

The `_hp` field is a honeypot — if non-empty and honeypot is enabled on the form, the submission is silently discarded.

## Admin endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/forms` | List all forms |
| POST | `/admin/forms/create` | Create a new form |
| GET | `/admin/forms/:id` | Get form details |
| POST | `/admin/forms/:id/update` | Update a form |
| POST | `/admin/forms/:id/delete` | Delete a form and its submissions |
| GET | `/admin/forms/:formId/submissions` | List submissions (filterable by status) |
| GET | `/admin/forms/submissions/:id` | Get submission (auto-marks as read) |
| POST | `/admin/forms/submissions/:id/status` | Update submission status |
| POST | `/admin/forms/submissions/:id/delete` | Delete a submission |
| POST | `/admin/forms/submissions/bulk-delete` | Bulk delete submissions |
| GET | `/admin/forms/stats` | Form statistics |

## Controller API

```ts
interface FormsController {
  // Forms
  createForm(params): Promise<Form>
  getForm(id): Promise<Form | null>
  getFormBySlug(slug): Promise<Form | null>
  listForms(opts?): Promise<Form[]>
  updateForm(id, data): Promise<Form>
  deleteForm(id): Promise<void>

  // Submissions
  submitForm(params): Promise<FormSubmission>
  getSubmission(id): Promise<FormSubmission | null>
  listSubmissions(opts?): Promise<FormSubmission[]>
  updateSubmissionStatus(id, status): Promise<FormSubmission>
  deleteSubmission(id): Promise<void>
  bulkDeleteSubmissions(ids): Promise<number>
  getStats(formId?): Promise<Stats>
}
```

## Types

```ts
type FormFieldType = "text" | "email" | "textarea" | "number" | "phone"
  | "select" | "radio" | "checkbox" | "date" | "url" | "hidden";

interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: string[];     // for select/radio
  pattern?: string;       // regex validation
  min?: number;           // min length/value
  max?: number;           // max length/value
  position: number;
}

type SubmissionStatus = "unread" | "read" | "spam" | "archived";
```

## Events

| Event | Description |
|-------|-------------|
| `forms.form.created` | Form definition created |
| `forms.form.updated` | Form definition updated |
| `forms.form.deleted` | Form definition deleted |
| `forms.submission.created` | New submission received |
| `forms.submission.statusChanged` | Submission status changed |
| `forms.submission.deleted` | Submission deleted |

## Admin pages

| Page | Path | Description |
|------|------|-------------|
| Forms List | `/admin/forms` | Dashboard with stats cards (total forms, submissions, unread, spam) and sortable form table |
| Create Form | `/admin/forms/create` | Multi-section form with field builder, settings, and auto-slug generation |
| Form Detail | `/admin/forms/:id` | View form config, inline edit mode with field builder, toggle active/inactive, delete |
| Submissions | `/admin/forms/:id/submissions` | Submission inbox with status filter, bulk select, mark read/spam/archive, bulk delete |

## Notes

- Forms with `isActive: false` are hidden from store endpoints but visible in admin
- Deleting a form cascades to delete all its submissions
- The `maxSubmissions` field (0 = unlimited) caps total submissions per form
- The honeypot field `_hp` is checked in the store submit endpoint, not in the controller — this keeps controller logic reusable
- All form inputs use nested `<label>` elements for accessibility compliance
