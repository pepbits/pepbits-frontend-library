# Library versions

Run `npx changeset` for a library change, then `npm run release:version` to apply
reviewed changesets. The twelve publishable packages form one fixed version group.
Private workspaces are excluded from versioning and publication by
`privatePackages: {version: false, tag: false}` and their `private: true` manifests.
`ignore` is empty: private packages need no temporary ignore list.

The initial minor changeset was applied to move all twelve packages from 0.0.0 to
0.1.0. Applied changesets are consumed; its original text and command result are
retained in the phase 7a release evidence. No version has been published.

See [manual publishing](../docs/development/PUBLISHING.md). Versioning does not
commit, tag, build or publish. Publishing is an explicit owner operation later.
