# Comparing private manuscript drafts

Conflicting imports open a comparison showing each complete reading layer or
geometry record, its author and date, and the full record. Choose the saved or
incoming record for every conflict, then save all decisions together. Other
nonconflicting incoming changes are included in that same operation. These are
private decisions, not scholarly review or publication.

The incoming file and choices are stored separately from the working draft and
survive navigation and reload. Export pending file retrieves the original file.
Close comparison discards only that pending comparison; the saved draft stays
unchanged and the original file on disk is not modified.

Each decision retains both complete records, provenance, source filename, editor,
date and package version in `importResolutions`, included in private JSON export.
History displays these decisions. Importing an archive preserves earlier import
and source-version resolution histories. TEI remains the reading interchange
format; JSON preserves this complete local audit trail. Local names are supplied
by the editor and do not establish authenticated reviewer identity.

The complete result must pass manuscript validation before anything is saved.
Incompatible reading orders, invalid geometry, unknown anchors, ID collisions and
missing choices are rejected atomically. Storage errors preserve the prior draft
and pending file. If another tab saves a different draft, reload/reopen the import
before choosing against the new state. Changes from a different source-package
version still require explicit source-version reconciliation; this interface
does not silently rebase them. Interdependent changes that cannot form a valid
combined package require editing a complete coherent draft before importing.

No image, corpus token, published review, GitHub commit or source reading is
modified by opening this comparison. The 5 MB incoming-file limit remains.

Validation: `scripts/validate_manuscripts.cjs`, `scripts/smoke_manuscripts.cjs`
and the existing Worker contract tests. Browser fixtures are isolated synthetic
drafts; they are not manuscript evidence or actual user submissions.
