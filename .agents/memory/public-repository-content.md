---
name: Public repository content
description: Keep hosting-platform references out of public project files while preserving local workspace setup.
---

GitHub-tracked documentation and metadata should remain platform-neutral. Keep workspace-specific run configuration and collaborator notes local rather than committing them to the public repository.

**Why:** the user explicitly asked to remove hosting-platform references from the README and GitHub repository.

**How to apply:** Before committing documentation, lockfiles, test environment names, workflows, or editor configuration, check whether they expose platform-specific branding or internal URLs. Preserve local-only configuration required by the current workspace.
