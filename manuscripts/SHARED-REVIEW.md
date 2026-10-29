# Manuscript shared review — 0.33.0

This release extends the existing collaboration Worker and the existing
`editorial-overrides.json`. It does not create a second authentication service,
change corpus text, or place scans in editorial records. All tests use isolated
mock services; the live service has not been deployed or written to.

## User workflow

1. Save a private manuscript draft. Unsaved form text is not submitted.
2. Open **Shared review**, check the service and sign in with contributor access.
3. Enter an evidence note and choose **Submit for review**. The service stores an
   immutable proposal; the original private draft remains in browser storage.
4. An editor opens the proposal, compares all affected records, follows **View
   target scan**, and records a decision and note. Current/proposed geometry is
   shown as a temporary overlay, without altering the saved manuscript.
5. **Accept and publish** applies the whole proposal atomically to a versioned
   override. **Return** and **Reject** retain it in history without applying its
   readings. An author's own review is explicitly identified as self-review.
   Every decision publishes the complete proposal and review note in repository
   history, including returned or rejected proposals; the submission/review
   controls explain this before either action.
6. A newly published version may conflict with an older private draft. The
   existing local conflict screen retains both readings and requires an explicit
   decision; it never silently deletes a contributor's draft after submission.

## Contract and provenance

`manuscripts-review-core.js` is shared unchanged between browser and Worker.
The Worker checks against authoritative registry, package, passage index and
editorial files read from the same Git commit. Only line-level passage anchors
are accepted in this first shared-review release. Corpus tokens are untouched.

Private drafts retain schema `1.0.0-manuscript-draft` and their existing storage
keys. A server-created proposal uses `1.0.0-manuscript-proposal`, an immutable
`proposal-UUID`, manuscript ID, draft, evidence note, submission time, repository
head and authenticated GitHub author identity. Existing free-text author names,
local histories, source notes and textual uncertainty are retained as supplied
evidence; they are not authenticated by copying them into a proposal.

Proposals are stored under `manuscript-proposal:` in the existing AUTH namespace.
They have no automatic expiration. Contributors can retrieve only their own;
editors and administrators can review all. Listing is paginated. Ordinary
readers cannot access the queue. KV is used for immutable proposal storage,
never as a concurrency lock or authoritative decision store. A newly submitted
record may take a moment to become visible in another location.

`editorial-overrides.json.manuscriptReviews[manuscriptId]` contains a ledger:

```
schemaVersion: 1.0.0-manuscript-reviews
manuscriptId, baseVersion
events: [{id, proposal, reviewer, decision, note, decidedAt, previousVersion}]
```

Each proposal receives one final decision. An accepted event advances the working
version to `BASE+review.EVENT-ID` and adds authenticated publication provenance
to affected records. Authenticated identities are supplied by the service's
session, not the submitted JSON. The repository remains the publication trust
boundary: a person who edits the ledger manually is responsible for its accuracy.

The browser applies the full ledger before private drafts. Invalid, incomplete,
out-of-sequence or incompatible history is not partly applied. It shows the base
package, retains the private draft and blocks further saves until the history is
resolved. A base-package version update needs an explicit ledger migration;
there is no automatic rebasing of published scholarly assertions.

Review decisions require the exact repository head the reviewer inspected. The
new Git commit is parented to that snapshot and the branch is advanced without
forcing. A concurrent advancement rejects publication; it cannot silently
replace newer manuscript or Reader work. A failed transaction may leave an
unreferenced Git object, but never a partially applied decision. The original
proposal remains available. All other editorial fields are preserved.

Ordinary Reader publication preserves the manuscript ledger and cannot change
it through the legacy payload. Published review decisions are visible in History
and recorded in TEI revision descriptions. JSON proposal export preserves the
full submission, comparison and decision; TEI is not a lossless ledger export.
Complete TEI profile validation remains a separate acceptance item.

Proposals are limited to 512 KiB. Repository reads support GitHub's larger-file
raw-content response, still pinned to the inspected commit. The current service
limits the complete editorial file to 8 MB; before that limit is exceeded, its
review history needs an explicit archive/migration. Nothing is silently pruned.

## Service capabilities and activation

`GET /api/capabilities` returns `manuscriptReview: "1.0.0"` only if the existing
Worker has `MANUSCRIPT_REVIEW_ENABLED = "true"`. Otherwise the Reader offers
private editing/export and explains that shared review is unavailable. The
frontend does not send drafts merely by opening a manuscript or checking status.

Authenticated endpoints:

- `GET /api/manuscripts/proposals?manuscript=ID[&cursor=...]`
- `POST /api/manuscripts/proposals` with `{draft, note}`
- `GET /api/manuscripts/proposals/PROPOSAL-ID`
- `POST /api/manuscripts/proposals/PROPOSAL-ID/decision` with
  `{repositoryHead, decision, note}`; editor/administrator only

The old Reader publication and authentication routes continue to work.
Rejection/return decisions also write an audit entry to GitHub. Review commits
use the signed-in reviewer's GitHub identity and noreply email; the proposal
author is retained separately in the record. No assistant identity is added.

For activation instructions, see the prepared release's
`ACTIVATE_SHARED_REVIEW_0.33.0.md`. No deployment is performed by the assistant.
