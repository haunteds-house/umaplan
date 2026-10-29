# Umaplan

A static, browser-local Umamusume collection and lineage planner, built for this repository's GitHub Pages site.

## Included

- Import `card_data.json`, `support_card_data.json`, and `trained_chara_data.json` (the spelling `trained_char_data.json` works too). Files are recognized by content.
- Browse trainees, supports, and veterans; search and sort; filter veteran sparks/stars, lineage scope, and aptitudes.
- Inspect veteran stats, learned skills, ancestry, and memos; inspect support skill hints.
- Build a 15-slot lineage with imported veterans or manually planned characters, sparks, and G1 wins. The first seven slots determine the selected target's odds; deeper slots record future breeding plans.
- Search all eligible imported parent pairs in a cancellable worker, pin either parent, and require minimum inheritance percentages for multiple sparks. Rank by lowest desired chance, then sum of desired chances, then compatibility. No arbitrary candidate shortlist is used; only the best 40 results are displayed.
- Compare per-event and two-event inheritance odds, with separate conditional white-spark creation estimates.
- Save/delete plan snapshots, export/import a single plan, and back up/restore the whole local workspace.
- Search a bundled skill reference including activation expressions, effects, duration, and cooldown.

The implementation is independent: it does not embed either uma.guide or uma.moe, and does not include their application source. Public game-data snapshots and community formulas are attributed in [SOURCES.md](SOURCES.md).

## Use

1. Open the deployed GitHub Pages site.
2. Select **Import collection**, and choose the three umadump files at once.
3. Select the target in **Lineage planner**.
4. Add desired sparks and a minimum probability, then **Find parent pairs**.
5. Use a pair, inspect its lineage and odds, and save a named snapshot.

No game MDB is needed for these features. Names and game mechanics use a bundled Global snapshot. New or unsupported IDs remain visible, but characters without compatibility entries cannot be automatically ranked. There is no complete Japanese-server catalog mode.

Your imports stay in IndexedDB on the current browser and site origin. No telemetry, remote roster API, or third-party script is used. Export a backup before clearing browser data or moving devices. Backups include personal memos; do not commit them to this public repository.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` tests, builds, and deploys pushes to `main`. In repository **Settings → Pages**, the source must be **GitHub Actions**. An owner must select this source once before deployment. The workflow intentionally does not use `enablement: true`: its token has deployment permissions, but cannot create the Pages site. After enabling Pages, open Actions → Test and deploy GitHub Pages → Run workflow, selecting `main`.

All paths are relative, including the worker and JSON resources, so deployment under `/umaplan/` works. Hash navigation avoids server-side routing requirements.

## Local development

Requires Node 22+; no npm dependencies are needed.

```sh
npm test
npm run build
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. Opening `index.html` through `file://` is unsupported because browsers restrict module and data fetches.

## Calculation assumptions and limitations

- Community model: individual spark base rate × `(1 + slot affinity / 100)`, capped at 100%. Independent copies are combined as `1 − product(1 − p)`; both inheritance events repeat the set of rolls. Starting inheritance is excluded.
- Stat, aptitude, race, skill/scenario and unique base rates are respectively 70/80/90%, 1/3/5%, 1/2/3%, 3/6/9%, and 5/10/15% for 1/2/3 stars.
- Each shared G1 group contributes +3 once per relationship. Parent-to-parent shared G1 bonuses default **off**, reflecting uma.guide's Global timeline note; the toggle enables the alternate rule. Both live planners' implementations may evolve independently of their explanatory text. See SOURCES.md.
- The compatibility matrix covers 74 base characters. Outfit names cover 112 Global cards. Unknown compatibility is not silently scored as zero.
- Automatic search requires both captured ancestors for each parent. Missing race history is flagged and may understate odds. No ancestors are invented from character names.
- White-skill creation is a separate conditional model, `base × 1.1^copies`, with bases 20% / 25% / 40% for learned normal / upgraded / gold skills. Not every skill has all variants. The table does not establish that a variant exists or that the target can learn it, and does not predict stars.
- The app is not a race simulator or an implementation of every feature of either reference site. Support ownership is imported and browsable; support-deck optimization and team trials are outside this initial scope.
- Best-pair search is exhaustive and quadratic. Large rosters may take time; search runs off the main UI thread and can be cancelled.

## Validation

`npm test` covers export normalization, encoded stars, invalid/duplicate records, captured ancestry, same-character restrictions, independent probability rolls, shared-G1 grouping, missing compatibility, probability thresholds, and the alternate race rule. The browser preview was inspected; the automated file-picker harness stalled, so a real-user import remains an explicit verification limit. No personal roster was available during development.
