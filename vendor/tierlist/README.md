# Euophrys training-value calculator

Source: https://github.com/Euophrys/umamusume-tierlist
Pinned commit: a405c452f2b086c5d2e5f25626714756a79291a9
License: MIT, Copyright (c) 2021 Amber Flina. See LICENSE (shipped with the app).

Vendored `src/components/tierlist-calc.js`, `src/card-events.js`, and
`src/scenarios.js`. The calculator's event import has an explicit local `.js`
extension. `cards.js` is the Global card dataset from `src/cards/gl.js`, compacted
without changing values. No React code or upstream site assets are included.

Umaplan's adapter is `../../training.js`. It uses actual target growth rates,
common stat valuations across scenario presets, current owned LB levels with
max-level-at-that-LB assumptions, and MLB borrowed cards. It sums six marginal
card scores (each evaluated with the other five fixed) as a relative deck index.
That sum is not a simulated final-stat total. Scenario availability is selected
by the user; a model preset does not establish that a scenario has launched.
