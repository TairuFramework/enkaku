# Archive Plan

1. Check if the feature referenced in the plan is fully implemented (all tests passing)
2. If complete: summarise document (no need for code samples, specific tasks list and checks, etc. just high-level changes) and move to `docs/plans/archive/` with filename format `YYYY-MM-DD-feature-name.complete.md`
3. If not complete: ask the user before proceeding
4. Update status field to "complete" in frontmatter
5. Remove any references to this plan from active plan indexes
6. Commit with message: "docs: archive completed plan for <feature>"
