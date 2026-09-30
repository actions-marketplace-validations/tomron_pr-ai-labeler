# Releases

Stable versions use semantic versioning: `v1.0.0`, `v1.0.1`, `v1.1.0`, etc.
Exact version tags are immutable. Floating major tags such as `v1` move to the
latest stable release in that major. Use a full commit SHA for a supply-chain
pin; use `v1` when you intentionally want compatible updates.

## Maintainer process

1. Change `package.json` version and update the lockfile with
   `npm install --package-lock-only --ignore-scripts`.
2. Review changes and run `npm run check`. Commit the rebuilt `dist/` files and
   all changes to main. Wait for CI green.
3. Run the **Release** workflow manually from main, entering the matching stable
   tag (for example `v1.0.1`). It validates version/config, runs checks and audit,
   ensures the bundle is committed, creates an immutable annotated version tag
   and release, then updates the floating major tag with a lease-checked push.
4. Inspect the GitHub release and both tags. If release creation fails after the
   exact tag push, repair the release manually instead of retagging that version.
5. Marketplace publication is separate. The workflow does not accept legal terms
   or publish a Marketplace listing.

Do not move exact published tags to a new commit. A breaking API/config/behavior
change requires a new major. Do not use release labels or AI classification to
trigger this workflow automatically.

## GitHub Marketplace

The repository must be public and have a root `action.yml` with a unique name.
Branding is already provided: tag icon, purple color. The account needs two-factor
authentication. The repository owner must accept the GitHub Marketplace Developer
Agreement. For a release, choose **Publish this Action to GitHub Marketplace**,
choose a category (suggestion: Utilities; secondary: Code review), verify metadata
validation, and publish/update the release. Agreement acceptance is the owner's
step and is not automated here. Listing/name availability is verified in that UI,
not inferred from a web search.

Publishing a GitHub release alone does not publish the Marketplace listing.
If the release is already published, edit it to add Marketplace publication.

GitHub references:

- https://docs.github.com/en/actions/how-tos/create-and-publish-actions/release-and-maintain-actions
- https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace
