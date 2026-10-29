# Sources and data provenance

Retrieved 2026-10-29. Umamusume names and game data belong to Cygames. This independent fan tool is not affiliated with Cygames, uma.guide, or uma.moe.

## Import schema

- https://github.com/Werseter/umadump
- Inspected commit: `fd8d606be6a5436df83a942e5669178ce41b801c`
- `json_encoders/cards.py`, `json_encoders/trained_chara.py`, and the sample export structures establish the import field names. No extractor code is bundled or executed.
- Modern exports can use `level: 0` with a star-bearing `factor_id`. For example, 103 is Speed with three stars; the normalized factor catalog identifies Speed as 10. Ancestors use `position_id` 10 and 20. Exported succession veteran IDs may be zero placeholders, so the app uses captured ancestor snapshots.

## uma.guide

- https://uma.guide/
- https://uma.guide/roster-viewer/
- Public Global data bundle: https://uma.guide/assets/chunks/uma-data.bcmgdWNZ.js
- `data/characters.json`, `data/supports.json`, and `data/skills.json` contain factual game records extracted from that public bundle. No Vue/site application code, guides, ads, or tracking code is included.
- Skill records include activationCondition, precondition, effects, duration, cooldownTime, and alternate conditions where published.
- The private site repository was not accessible. Feature behavior was inspected from public pages and delivered client code, and implemented independently.
- The bundle's Global timeline notes say the July 2026 change uses shared G1 wins but did not include parent-to-parent G1 affinity. The runtime planner code also contains parent-pair G1 calculations. Because explanatory material and runtime implementation are not fully consistent, this app exposes the rule as an explicit toggle and defaults it off for Global. Treat resulting odds as community-model estimates.

## uma.moe

- https://github.com/uma-moe/umamoe-frontend
- Inspected commit: `85c114e205195f5120d9a336dafcaedb9f4719ba`
- https://github.com/uma-moe/umamoe-resources
- Public manifest: https://uma.moe/resources/manifest.json
- `data/affinity.json`, `data/factors.json`, and the G1 saddle/group facts in `data/races.json` are from the manifest's public resources. The exact manifest version is retained in `data/metadata.json`.
- The public `src/lib/inheritance/spark-probability.ts`, `src/lib/lineage/planner.ts`, and `src/lib/veterans/affinity-engine.ts` were inspected to cross-check mathematical rules, indexing, restrictions, and group deduplication. App logic in this repository was written independently.
- Parent affinity includes direct target-parent compatibility, both target-parent-grandparent terms, parent-pair compatibility, and enabled race bonuses. Grandparent affinity uses its three-way compatibility plus that parent-grandparent race bonus.

## Updating the bundled snapshot

The data is deliberately versioned with the source, rather than remotely fetched every time a user opens the app. Use `python3 scripts/refresh_data.py` from the repository root to fetch the currently published Global data and validate its structure. Review the data diff, run `npm test`, and commit the updated snapshot. The updater refuses incomplete resources. If a site's public bundle format changes, the updater fails rather than guessing new mappings.

No private game files, account exports, credentials, or external site application code are included in the published files.
