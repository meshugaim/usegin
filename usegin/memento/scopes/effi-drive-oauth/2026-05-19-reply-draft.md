# Reply draft — Google OAuth verification, 2026-05-19

**Thread:** `[Action Needed] OAuth Verification Request Acknowledgement` (Gmail thread `19dffd0badeef9f5`)
**Replying to:** Google's 2026-05-16 message (their second push toward `drive.file + Picker`)
**Reply-to address:** `api-oauth-dev-verification-reply+2nxaiu0qnsadw1d@google.com`
**Cc:** `nitsan@askeffi.ai`, `oria@askeffi.ai` (matching prior thread pattern)

---

## Draft body

Hello,

Thank you for the follow-up. We'd like to address the points in your reply directly, because the technical limitation we raised does not appear to have been refuted — only restated.

**On `drive.file` + Google Picker (including multiselect)**

Your message states that `drive.file` "allows the user to create Drive files, and select and modify any file from their Drive that they want to share with your application." We agree this is accurate for files the user explicitly picks via the Google Picker. The Picker's multiselect feature (`PickerBuilder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED)`) lets a user select many files in one action — but each one is still an individual, user-initiated grant at the moment of picking.

The functional limitation we raised is not about UI ergonomics or the number of clicks required. It is about a class of files that `drive.file` cannot reach regardless of how the Picker is configured:

> Files added to a previously-authorized folder — via any Drive client (web UI, mobile app, desktop sync, third-party integrations, or a collaborator's "Move to folder") — after the Picker session ended.

These files do not become accessible to a `drive.file` token at any later point. They are not returned by `files.list`, are not enumerated by `changes.list`, and `files.get` with their `fileId` fails with a not-found / no-access response. This is consistent with our testing and with the documented per-file model of `drive.file`, where access is keyed to file IDs the user explicitly grants through the Picker (or that the app creates). Modifications to files the user did pick are reflected correctly — that part of `drive.file` works for our use case; the gap is strictly about files added to the folder after the Picker session.

**This is not a UI preference, and the Picker enhancements you cited do not close the gap**

- `setFileIds()` (January 2025) pre-navigates the Picker to known file IDs. It is useful when the app already knows the file IDs it wants to surface to the user. It does not enumerate or grant access to files the app cannot see in the first place.
- The multiselect feature lets a user pick many files at one moment, but does not create a continuing watch on a folder or its descendants.
- A `DocsView` configured with `setSelectFolderEnabled(true)` and `setIncludeFolders(true)` allows the user to select a folder object, but Google's published documentation at `developers.google.com/workspace/drive/api/guides/api-specific-auth` does not assert that this grants `drive.file` access to the folder's descendants — and our testing confirms it does not. If this behavior is in fact supported and our reading of the documentation is incomplete, please point us to the specific reference; we will retest immediately and revise our request accordingly.

**Why this is a functional limitation, not a UX preference**

Our product is a knowledge workspace for client-engagement teams — IT consultants, ERP integrators, construction project managers, and similar professional-service firms — whose project documentation accumulates organically in shared Drive folders. New documents are added by colleagues, shared by clients, dropped in via mobile uploads from job sites, and moved in by collaborators. The core value to our users is that documents added to an authorized project folder are automatically reflected in their workspace's knowledge base, so the workspace has up-to-date project context without manual re-curation.

A scope that requires every newly-added document to be manually re-selected through a chooser is not a degraded version of our product; it is a different product. A user who must remember to re-open a file picker every time a colleague drops a PDF into the shared project folder cannot rely on the workspace as a current knowledge surface.

**Path forward**

Our request therefore remains `https://www.googleapis.com/auth/drive.readonly`. As noted in our previous reply, we understand that a CASA assessment is required for restricted-scope approval, and we are ready to begin that process once your team confirms the restricted-scope path is approved to advance.

Please let us know what additional information would help complete the eligibility review.

Best regards,

Lihu Berman
Co-Founder & CTO, AskEffi
lihu@askeffi.ai

---

## Notes for review (not part of the email)

**What changed vs. the previous reply (2026-05-15):**

- Opens by naming the gap directly: Google's reply restated their position without engaging the "files added later" point. Sets the frame for the rest of the message.
- Names the specific APIs (`files.list`, `changes.list`, `files.get`) that fail under `drive.file`, but keeps the empirical claim brief — does not walk through the spike step-by-step and does not proactively offer to send results.
- Walks through each Picker workaround Google suggested (`setFileIds`, multiselect, folder selection via `setSelectFolderEnabled`) and addresses why each does not solve the limitation.
- Notes the documentation silence and explicitly invites Google to correct us if we've misread the docs — turns the burden of finding a contrary reference onto them.
- Adds a customer-segment paragraph (IT consultants, ERP integrators, construction PMs) tying the limitation to a concrete product story rather than abstract framing. Matches the verification form's "Productivity" category and the customer description in `effi-drive-oauth/latest.md`.
- Reframes the CASA paragraph from "we are proceeding" (active) to "we are ready to begin once your team confirms" (waiting on Google). Matches the reality that CASA can only formally advance once Google gives the go-ahead on the restricted-scope path.

**Correctness — verified this pass:**

- `PickerBuilder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED)` is the canonical API name (re-checked against Google's Picker reference docs).
- `setFileIds()` rolled out January 20, 2025 per Google's Workspace Updates blog (Nov 2024 announcement).
- `DocsView.setSelectFolderEnabled(true)` and `DocsView.setIncludeFolders(true)` are real methods that enable folder selection in the Picker.
- `files.get` on an inaccessible `fileId` under `drive.file` returns a not-found / no-access response (Drive deliberately obfuscates 403 vs 404 to avoid leaking file existence) — phrasing is intentionally vague to avoid getting dismissed on a wrong status code.
- "Modifications to picked files are reflected" — `drive.file` does grant ongoing access including modifications to file IDs it has access to.
- The docs URL `developers.google.com/workspace/drive/api/guides/api-specific-auth` is the page I fetched; it does not assert folder-children access under `drive.file`.
- Scope URL `https://www.googleapis.com/auth/drive.readonly` matches the verification request.

**Things to consider before sending:**

- Cc list mirrors prior thread (`nitsan@askeffi.ai`, `oria@askeffi.ai`). Confirm that's still right.
- Tone aims to match the prior reply: formal, structured, no defensive padding, no apology. Adjust if you'd like it warmer or sharper.
