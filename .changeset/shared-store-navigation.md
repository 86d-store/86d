---
"@86d-store/ui": patch
---

Expose shared sidebar, navigation, empty-state, and layout primitives through resolvable source exports. Keep their internal imports package-relative so Store Runtime consumers can compose them without application alias conflicts.
