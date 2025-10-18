# Ananya’s Half Birthday Adventure!

This project delivers a moonlit half-birthday quest crafted with plain HTML, CSS, and JavaScript. Players whisper the moonlit password to open the gate, explore the Star Chart Expedition, assemble the celebration sequence, and finally unlock Ananya’s half-birthday cache of keepsakes.

## Structure

- **Landing view – Moonlit Password**: Share the celebration password to illuminate the adventure and unlock navigation to the other scenes.
- **Map view – Star Chart Expedition**: View the dedicated map experience to trace celestial hints and gather clues for the celebration sequence.
- **Clue view – Celebration Sequence**: Arrange glowing clues across paired panels to choreograph the half-birthday celebration.
- **Reward view – Half-Birthday Cache**: Review the star chart ledger, enter the celebration values, and unveil the cache of themed treasures.

## Celebration sequence puzzle

1. **Clue Cache** presents twelve words, shuffled on every load. Selecting a clue sends it into the celebration sequence staging area.
2. **Sequence Alignment** provides a three-column, two-row grid of celebration slots. Tapping a filled slot releases the clue so you can adjust the choreography.
3. When all six target clues occupy the correct slots, the interface highlights the success, announces the completion, and escorts players to the Half-Birthday Cache.

Behind the scenes, the helper logic keeps track of clue locations, enforces slot capacity, persists completion, and triggers celebratory overlays once the sequence is correct.

## Development

No build tooling is required. Open `index.html` in a browser to interact with the experience. The JavaScript module `script.js` orchestrates navigation and puzzle state, while `styles.css` provides the star-lit presentation.
