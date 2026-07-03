This documentation explains the HED schema browser and is intended as a reference for maintenance and development.

# Overview

The HED schema browser is a standalone static web application — no build step or server-side framework is required. The entry points are:

| File | Purpose |
|------|---------|
| `index.html` | Redirects to `schema-browser.html` |
| `schema-browser.html` | Main browser page |
| `prerelease.html` | Redirects to `schema-browser.html?prerelease=true` |

All interactive logic lives in `source/schema-browser.js`. Schema XML files are fetched at runtime from the [hed-schemas](https://github.com/hed-standard/hed-schemas) GitHub repository via the GitHub API.

# Local deployment

**Important:** The browser must be served over HTTP, not opened directly from the filesystem as a `file://` URL. Opening `file://` blocks the GitHub API calls (CORS) and prevents the XSLT transformation from loading the stylesheet correctly.

## Option 1: Python (no additional install needed)

```bash
# From the root of the repository
python -m http.server 8000
```

Then open `http://localhost:8000/schema-browser.html` in your browser.

## Option 2: VS Code Live Server extension

1. Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension in VS Code.
2. Right-click `schema-browser.html` in the Explorer and choose **Open with Live Server**.

The page will open automatically at `http://127.0.0.1:5500/schema-browser.html` (port may vary).

## Option 3: Node.js

```bash
npx serve .
```

Then open the URL printed in the terminal, e.g. `http://localhost:3000/schema-browser.html`.

## GitHub API rate limits

The browser fetches schema listings and XML files from `https://api.github.com`. Unauthenticated requests are limited to **60 per hour per IP address**. During active development this limit can be reached quickly. If the schema list fails to load or the schema content is blank, wait a few minutes and reload.

# Key components and files

| File | Purpose |
|------|---------|
| `schema-browser.html` | Main HTML page — layout, styles, and markup |
| `source/schema-browser.js` | All interactive functionality |
| `source/hed-schema.xsl` | XSLT that converts a HED XML schema into HTML |
| `source/hed-collapsible.css` | CSS styling for the collapsible tree |

# Structure of the HTML page

`schema-browser.html` has four main sections: header, buttons, collapsible schema tree, and the floating info board.

## Header

Static content shown at the top of the page.

## Buttons

Two toolbar dropdowns and an expand/collapse control.

* **Schema** dropdown: populated on load by calling `getLibarySchemas()` against the GitHub API, then rebuilt whenever the user picks a different schema.
* **Schema version** dropdown: populated by `buildSchemaVersionDropdown()`, which calls `getGithubSchema()` to list `.xml` files in the `hedxml` folder of the [hed-schemas](https://github.com/hed-standard/hed-schemas/tree/main/standard_schema/hedxml) repository, including deprecated versions.
* **Expand/Collapse all**: calls `showHideAll()`. The `div#schema` element carries a `status` attribute (`"show"` or `"hide"`). Clicking the button toggles all `.collapse` child elements by adding or removing the `show` class.

## Collapsible schema

The schema tree lives in `div#schema`. The function `loadSchema()` is the single entry point for all schema loading and rendering steps:

1. Fetch the XML schema file from `raw.githubusercontent.com`.
2. Apply `source/hed-schema.xsl` via the browser's built-in XSLT processor.
3. Set the transformed HTML as the inner content of `div#schema`.

### XML schema

Retrieved from the [hedxml](https://github.com/hed-standard/hed-schemas/tree/main/standard_schema/hedxml) folder via the [GitHub API](https://developer.github.com/v3/repos/contents/#get-repository-content). The latest version is loaded by default.

### hed-schema.xsl

The [Extensible Style Language (XSL)](https://www.w3schools.com/xml/xsl_intro.asp) stylesheet transforms HED XML elements to HTML. Each [template](https://www.w3schools.com/xml/xsl_templates.asp) matches an element type and converts it to an `<a>` element (the clickable tag label) alongside a hidden `<div>` holding the tag's attributes. Nodes with children carry `data-toggle="collapse"` and recurse via [`<xsl:apply-templates>`](https://www.w3schools.com/xml/xsl_apply_templates.asp).

### hed-collapsible.css

Tree styling adapted from [entropicthoughts.com/draw-a-tree-structure-with-only-css](https://entropicthoughts.com/draw-a-tree-structure-with-only-css) and the [Bootstrap Collapse component](https://getbootstrap.com/docs/4.0/components/collapse/).

## Info board

A floating panel whose content updates as the user hovers over HED tags. `displayResult()` in the page's `<script>` block handles the dynamic loading. Pressing Enter freezes or unfreezes the panel.

# Key features and functionality

## Schema loading and version management
- Supports both standard and library schemas
- Handles prerelease versions
- Maintains a version history with deprecated versions
- Uses GitHub API to fetch schema versions and content

## Interactive features
- Expandable/collapsible tree structure
- Search with autocomplete
- Synonym lookup
- Info board with dynamic content loading
- Keyboard shortcut: Enter to freeze/unfreeze the info board

## Schema navigation
- Jump to a specific node by name
- Back to top button
- Path display for the currently focused node

# Deployment

The repository is deployed to GitHub Pages automatically by the [Deploy workflow](../.github/workflows/deploy.yml) whenever a commit is pushed to the `main` branch. GitHub Actions uploads the entire repository root as a static-site artifact; no build step is required.

After merging changes to `main`, visit `https://www.hedtags.org/hed-schema-browser/` to verify the deployment. GitHub Pages propagation typically takes up to a few minutes.
