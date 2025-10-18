# Trials of the Gatekeeper

This project implements a multi-step browser puzzle built with plain HTML, CSS, and JavaScript. Players speak the key phrase to open the gate, inspect a dedicated map page, and then solve the sigil alignment puzzle before claiming the final reward.

## Structure

- **Landing view** – Presents the gate challenge. Submitting the correct passphrase unlocks navigation to subsequent views.
- **Map view** – Displays the atlas map in isolation so explorers can gather clues.
- **Clue view** – Hosts the sigil alignment trial with three horizontally arranged sections.
- **Reward view** – Reveals the treasure once the sigils are aligned in the required order.

## Sigil alignment puzzle

1. **Section 1** shuffles twelve word tiles on every load. Clicking the plus icon on any tile sends it to the staging grid.
2. **Section 2** provides a three-column, two-row staging grid. Tiles here expose plus and minus controls—plus advances the tile to the matching alignment column, while minus returns it to the word cache.
3. **Section 3** features six vertical columns that rotate tiles ninety degrees. When the six target words occupy the correct columns, the page flashes green and automatically advances to the reward view.

The helper logic tracks tile locations, enforces capacity rules, persists completion, and emits success events that trigger the visual celebration.

## Development

No build tooling is required. Open `index.html` in a browser to interact with the experience. The JavaScript module `script.js` orchestrates navigation and puzzle state, and `styles.css` contains all visual styling.
