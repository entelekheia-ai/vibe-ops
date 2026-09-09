Lives in **two artifacts that own different content**: the GitHub issue owns status, assignment and the
executive summary; the dossier (`project/tasks/NNN-slug.md`) owns the detailed working log. The dossier is
ephemeral — at `Done` it is deleted, and git history is its archive.

At closure, use `/vibe-ops:close-task` — it writes back to the source doc, propagates docs, spawns an ADR if
a hard-to-reverse decision emerged, **routes each `Surprises & Discoveries` entry** to a durable surface
(and deletes any instruction line a new guard has made redundant), then distills the summary into the issue
with the breadcrumb `git show <sha>:project/tasks/NNN-slug.md` before deleting the dossier. Never skip the
write-back or the routing step — those are the two that keep docs from drifting and keep a learning from
being deleted along with the dossier.
