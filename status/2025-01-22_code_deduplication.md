# Code deduplication refactoring

## Summary
Eliminated code duplication between `index.html` and `prerelease.html` by creating a unified schema browser.

## Problem identified
- `index.html` and `prerelease.html` were nearly identical (224 lines each)
- Only difference was the schema loading call: `load("standard")` vs `load("standard_prerelease")`
- This violated DRY principle and created maintenance overhead

## Solution implemented
1. **Created unified file**: `schema-browser.html`
   - Contains all the original functionality
   - Detects schema type via URL parameter or path
   - Dynamic button text updating
   - Toggle functionality between standard and prerelease modes

2. **Updated existing files** to redirect:
   - `index.html` → redirects to `schema-browser.html`
   - `prerelease.html` → redirects to `schema-browser.html?prerelease=true`

## Benefits
- **Eliminated duplication**: Reduced from 448 lines (2 × 224) to ~260 lines total
- **Single source of truth**: All UI changes only need to be made in one file
- **Backward compatibility**: Existing links continue to work via redirects
- **Enhanced UX**: Toggle button allows switching between modes without navigation

## Files changed
- ✅ Created: `schema-browser.html` (unified browser)
- ✅ Modified: `index.html` (now redirect page)
- ✅ Modified: `prerelease.html` (now redirect page)

## Technical implementation
- URL parameter detection: `?prerelease=true`
- Dynamic schema loading based on detected mode
- JavaScript-based button text updates
- Graceful fallback with redirect links for non-JS environments