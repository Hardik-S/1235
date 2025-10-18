# Agent Guidelines

- Preserve the single-page application structure: `index.html`, `styles.css`, and `script.js` form the interactive experience. Avoid introducing additional build tooling.
- Maintain accessibility affordances (ARIA attributes, focus management) when adding or updating interactive elements.
- Keep styling in `styles.css` and behavior in `script.js`. Do not inline new styles or scripts inside `index.html`.
- The `make_pr` tool must be called after committing changes.
