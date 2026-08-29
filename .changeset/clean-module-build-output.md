---
"86d": patch
---

Clean a Module's distribution directory before compiling. The release pipeline now also validates and cleans every publishable distribution before a forced build that cannot restore cached stale files, so deleted source cannot survive in published output.
