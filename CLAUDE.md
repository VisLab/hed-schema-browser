# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static single-page browser for HED (Hierarchical Event Descriptor) vocabularies. No build step. No package manager. All schema XML is fetched at runtime from the `hed-standard/hed-schemas` GitHub repo (both the REST API and `raw.githubusercontent.com`).

Live site: https://www.hedtags.org/hed-schema-browser/

Deployment: pushing to `main` triggers `.github/workflows/deploy.yml`, which uploads the entire repo root as a static-site artifact to GitHub Pages.

## Running locally

Must be served over HTTP — opening the HTML directly as `file://` breaks CORS (blocks GitHub API) and XSLT loading.

```bash
python -m http.server 8000
# then open http://localhost:8000/schema-browser.html
```

Or `npx serve .`, or the VS Code Live Server extension.

**GitHub API rate limit**: unauthenticated GitHub API is 60 req/hr per IP. During active dev you *will* hit it. Symptom: blank schema list or empty content. Wait ~an hour.

There is no test suite, no linter, and no build.

## Architecture

Three HTML entry points, all converging on `schema-browser.html`:

| File | Behavior |
|------|----------|
| `index.html` | Redirects to `schema-browser.html` |
| `prerelease.html` | Redirects to `schema-browser.html?prerelease=true` |
| `schema-browser.html` | Main page. Reads `?prerelease=true` and `?schema=<name>` from URL and calls `load()` |

All logic lives in **`source/schema-browser.js`** — plain ES5-ish JS with jQuery 3.3.1 and Bootstrap 4.4.1, loaded from CDNs. No module system.

### Schema loading pipeline

`load(schemaName)` is the entry point invoked from `schema-browser.html`. It:
1. Reads URL params (`?schema=`, `?version=`, `?prerelease=true`) — these override the argument.
2. Populates the **Schema** dropdown by hitting the GitHub API (`getLibarySchemas()`) — this uses **synchronous jQuery AJAX** (`async: false`), which is why it works from a non-async caller. Don't "modernize" this without also making `load()` and its callers async.
3. Kicks off the initial schema load via `loadDefaultSchema(name)` (release, falling back to prerelease if the schema has no released version) or `loadPrereleaseSchema(name)` (always loads the prerelease XML).

`loadSchema(schemaName, url)` is the single choke point that actually fetches an XML file, transforms it, and updates the UI. Both `loadDefaultSchema` and `loadPrereleaseSchema` end up calling it. It also sets `currentSchemaName` (the module-global that tracks *what the user is currently viewing*, including a `_prerelease` suffix when applicable) and updates both dropdown-button labels + the prerelease toggle button state.

### Prerelease naming convention

Prerelease schemas are tracked by suffixing the base name: **`mouse`** = release view of the mouse library schema; **`mouse_prerelease`** = prerelease view. This suffix appears in:
- `currentSchemaName`
- URL param `?schema=mouse_prerelease`
- The internal string passed to `loadSchema()`

`setDropdownBtnText()` strips the suffix and formats it as `"mouse (prerelease)"` for display. Any new code that reasons about the "base" schema name should call `.replace('_prerelease', '')`.

### XML → HTML rendering

Schema XML files come in two formats. `useNewFormat` (global) selects between them, based on the first digit of the version number in the URL:
- **New format** (>= 8.x): `transformNewFormat()` → `renderSchemaTree()` etc. Attributes are child `<attribute>` elements.
- **Old format** (< 8.x): `transformOldFormat()` → `renderSchemaNodeOld()`. Attributes are XML attributes on the node.

Both branches produce structurally identical HTML that the rest of the code (search, hover info, library-tag coloring) consumes without caring which format was used. This replaced the original `hed-schema.xsl` / `hed-schema-old.xsl` XSLT pipeline; the `.xsl` files are still in the repo but are dead code.

`xslTranslate()` reproduces a specific `translate()` chain from the old XSLT to build CSS-safe IDs. **Do not** run the leaf-tag `tag=` attribute through it — that attribute is used as a jQuery selector key and must match the raw `name` used by `renderAttrDivs()`. This bit the codebase before (GitHub issue #11) with digit-containing tag names in the test library. See the comment in `renderSchemaNode()`.

### Library-tag detection (`inLibrary`)

`parseMergedSchema()` runs after each `loadSchema()`. It scans hidden `.attribute` divs for the `inLibrary` marker, adds the `inLibrary` class to those `<a>` nodes, propagates a `hasInLibrary` class up the ancestors, and colors them brown. The "Show library only" button uses `hasInLibrary` to filter which nodes stay visible.

### Version dropdown ordering

`buildSchemaVersionDropdown()` sorts by semantic version *descending* using `compareSemanticVersions()`. There's a token-based guard (`buildSchemaVersionDropdownToken`) that discards stale async results if the user switches schemas mid-fetch — preserve this if you touch the dropdown code.

## Common gotchas

- **Async/sync mixing**: `getLibarySchemas()` is intentionally synchronous jQuery AJAX. Most other network calls (`getGithubSchema`, `getPrereleaseXml`, `checkSchemaVersionExists`) are `async fetch`. `load()` and `loadDefaultSchema()` are `async`. If you add a new caller of these, `await` them — passing an unawaited Promise into `loadSchema()` fails silently at `url.match(re)`.
- **Prerelease-only schemas** (like `mouse`) have no `hedxml/` folder in the repo — only a `prerelease/` folder. `loadDefaultSchema` handles this: if no release version is found, it checks for prerelease and loads that. Don't add a `HED_<name>_Latest.xml` fallback — that file doesn't exist for prerelease-only schemas and will 404.
- **Deprecated folder 404s**: library schemas typically lack a `hedxml/deprecated/` folder. `getGithubSchema` silently ignores this — don't add an error message for it.
- **`currentSchemaName` drives the toggle button**: the "View prerelease/released schema" button's label and enabled/disabled state depend on `currentSchemaName`, not on URL params. Whenever a new schema is loaded, `updatePrereleaseToggleUI()` must be called (it already is, from `loadSchema()`).

## References

- `.status/prerelease_display_issues.md` — long-form notes on a prerelease loading bug (fixed). Useful background on why the async plumbing looks the way it does.
- `.status/2025-01-22_code_deduplication.md` — earlier refactor notes.
- `source/README.md` — user-facing "how does this work" doc; kept in sync with reality but written for humans.
