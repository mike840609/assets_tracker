---
name: implement the feature skill
description: Implements features. Use this when I ask you to implement a feature.
---

# Feature Implementation Skill

When implementing features, follow these steps:

## How to use it

1. Check the items in the docs folder. If you find items to implement.

2. Implement the items and update the related doc to mark them as done. The code format should follow .prettierrc.json.

3. Add a line in the LOG.md in the same doc folder. Follow the change log format when adding a line to LOG.md.

4. Ensure the code passes all checks defined in .github/workflows/ci.yml (e.g., format check, lint, typecheck, build).

5. Leverage `gh` command to make a PR to the master branch.

## Change log Format

The change log should be in the following format:

```
- YYYY-MM-DD: [ADD/MOD/REM]: Change log description
```
