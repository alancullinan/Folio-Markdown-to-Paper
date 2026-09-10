# Folio — Markdown to paper

A browser-based Markdown editor with a live, paginated A4 preview. Documents are processed locally in your browser, with no application backend or document uploads.

## Features

- Open, edit, and save Markdown; recover a local browser draft.
- **Dark mode:** follows your system appearance initially, with a toggle that remembers your choice. The paper preview and printed output stay light.
- **Click to edit:** click a paragraph, heading, table, or code block in the preview to select its matching Markdown in the editor. Preview-only mode reveals the editor automatically. You can also focus a block and press Enter. Links and drag-to-copy selections retain their usual behaviour.
- **Link scrolling:** scroll either pane to follow the corresponding source or rendered block. Handles wrapped source lines and page boundaries. Uncheck to scroll independently.
- **Resize the panes:** drag the centre divider. Double-click to reset; focus it and use arrow keys for keyboard control.
- Undo/redo for typing, formatting, and insertions.
- Heading buttons format complete lines and replace existing heading levels.
- Tables, tasks, footnotes, highlighted code, KaTeX math, and Mermaid diagrams.
- A4 by default; adjustable paper, margins, fonts, zoom, and page numbers.
- Bundled Source Serif 4, Source Sans 3, Lora, and IBM Plex Mono fonts, with separate body and heading choices. Fonts are available offline and embedded by the browser in PDF output.
- Document style panel with Minimal, Grid, Striped, and Compact tables, five accent colours, and optional repeated table headers across pages. Style settings are stored with browser drafts; Markdown downloads remain plain content.
- Print or export through your browser's **Save as PDF** dialog.

Linked scrolling operates in the side-by-side desktop view. Long blocks are aligned approximately within the block; source-only syntax and blank space do not always have an exact rendered counterpart. Split width and link preference are saved in this browser.

## Development

Requires Node.js 22 or later.

```sh
npm ci
npm run build
npx playwright install chromium
npm test
```

Open `dist/index.html` or serve `dist/` with a static server. Build output uses relative URLs for GitHub Pages project hosting. The build also creates `release/Folio.html`, a self-contained offline copy. Source lives in `src/`; generated assets are not committed.

## Publishing

The GitHub Pages workflow builds, tests, and deploys the site on pushes to `main`. Set the repository's **Settings → Pages → Source** to **GitHub Actions**. Pull requests run the build and tests without publishing.

## Files, privacy, and printing

Save .md downloads a copy; it does not overwrite your original. Drafts and preferences belong to the current browser and website address. **Save your document before switching from the old website to GitHub Pages**, then reopen it on the new site.

Use Images to embed local images in Markdown. Remote image links make network requests. Browser storage has limits; use Save .md for durable copies.

For PDF, select **Save as PDF**, match the app's paper size, choose **100% scale**, and disable browser headers and footers. The app supplies margins and page numbers. Inspect unusually wide tables or large diagrams before printing.

Safe HTML is supported; scripts, frames, forms, and custom CSS are removed. Markdown dialects vary; MDX and executable extensions are not supported. Third-party notices are included in the generated website.
