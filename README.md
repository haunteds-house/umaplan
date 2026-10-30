# Umaplan

A static, browser-local Umamusume collection and lineage planner, built for this repository's GitHub Pages site.

## Included

- Import `card_data.json`, `support_card_data.json`, and `trained_chara_data.json` (the spelling `trained_char_data.json` works too). Files are recognized by content.
- Browse trainees, supports, and veterans; search and sort; filter veteran sparks/stars, lineage scope, and aptitudes.
- Inspect veteran stats, learned skills, ancestry, and memos; inspect support skill hints.
- Build a 15-slot lineage with imported veterans or manually planned characters, sparks, and G1 wins. The first seven slots determine the selected target's odds; deeper slots record future breeding plans.
- Search all eligible imported parent pairs in a cancellable worker, pin either parent, with multiple desired sparks in Inspiration or end-of-career Spark % mode. The minimum-chance setting is removed. Rank by lowest desired chance, then sum of desired chances, then compatibility. No arbitrary candidate shortlist is used; only the best 40 results are displayed.
- Compare per-event and two-event inheritance odds, with separate conditional white-spark creation estimates.
- Save/delete plan snapshots, export/import a single plan, and back up/restore the whole local workspace.
- Browse skill cards with icons, effects, activation expressions, Sources and Variants; filter by category, rarity, condition, wit check, and owned sources.
- View character portraits and support art in collections, lineage slots, pickers, and source panels. Candidate pickers preview affinity, including targets for an already-filled tree.
- Set expected normal/upgraded/gold skills or Inspiration only. Scenario normal/plus sparks are interchangeable and counted once per ancestor.

The implementation is independent: it does not embed either uma.guide or uma.moe, and does not include their application source. Public game-data snapshots and community formulas are attributed in [SOURCES.md](SOURCES.md).

## Use

1. Open the deployed GitHub Pages site.
2. Select **Import collection**, and choose the three umadump files at once.
3. Optionally select the target in **Lineage planner**.
4. Add desired sparks, choose Inspiration or Spark %, set learning assumptions, then **Find parent pairs**.
5. Use a pair, inspect its lineage and odds, and save a named snapshot.

No game MDB is needed for these features. Names and game mechanics use a bundled Global snapshot. New or unsupported IDs remain visible, but target-specific search excludes characters without compatibility entries. There is no complete Japanese-server catalog mode.

Your imports stay in IndexedDB on the current browser and site origin. No telemetry, remote roster API, or third-party script is used. Artwork loads from uma.guide with no referrer; its server receives image requests, never JSON files. Missing images fall back to initials. Export a backup before clearing browser data or moving devices. Backups include personal memos; do not commit them to this public repository.

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
- Target-specific search requires both captured ancestors for each parent. Without a target, every source uses zero affinity, all race bonuses are omitted, and incomplete ancestry is ranked from recorded sparks only. This is an affinity-free baseline, not target-specific career odds. Missing race history is flagged and may understate odds. No ancestors are invented from character names.
- White-skill creation is a separate conditional model, `base × 1.1^copies`, with bases 20% / 25% / 40% for learned normal / upgraded / gold skills. Not every skill has all variants. The selector offers known skill-family tiers, but learning from the career remains a user assumption. Inspiration-only multiplies normal creation chance by inheritance probability. Non-skill sparks retain inheritance probabilities in Spark % mode. Normal/plus sources count once per ancestor, preferring the exact form when both are present. The comparison table is conditional and does not predict stars.
- The app is not a race simulator or an implementation of every feature of either reference site. Support ownership is imported and browsable; support-deck optimization and team trials are outside this initial scope.
- Best-pair search is exhaustive and quadratic. Large rosters may take time; search runs off the main UI thread and can be cancelled.

## Validation

`npm test` runs 18 checks covering imports, ancestry, compatibility, independent probabilities, scenario aliases, gold/inspiration assumptions, target-free ranking, source integrity, and the search worker including pins. The production build passes. Browser checks covered synthetic JSON imports, affinity previews, learning controls, skill search, Sources, Variants, and artwork. No personal roster was available during development.

## Veteran search and presets

My Collection → Veterans and the planner's **Candidate filters** share Basic,
Advanced and UQL search. Basic builds spark rules; Advanced adds stats, aptitudes,
rating, characters, races, learned skills and affinity. Candidate filters apply to
both parents before pair scoring and to imported-veteran slot pickers. Pinned
parents excluded by a filter produce an explicit message.

**Save preset** saves a named snapshot of the active mode, query, rules, text,
sort and affinity target. Presets can be loaded or deleted from either panel and
are included in workspace backups. Basic and Advanced share rules; **Edit as UQL**
converts them into a separate editable query. UQL edits do not rewrite visual rules.

The local UQL evaluator supports Boolean groups, comparisons, arithmetic (integer
division), BETWEEN, IN/NOT IN, HAS/CONTAINS, HAS ALL/ANY, LIKE/ILIKE, scoped spark
stars and `2x` copy thresholds. `Main`, `GP1`, `GP2` and `GP` refer to the veteran
and its recorded parents; GP numeric predicates match either recorded parent.
Unscoped spark thresholds sum all three. Functions include `contains`, `has`,
`overlaps`, `has_all`, `spark_sum` and `any_spark`. `target = Maruzensky` and
`sort by = Rating` directives can be separated by semicolons or top-level AND.
Examples and available fields are shown inside each panel.

This implements local roster searching, not uma.moe's remote database. Trainer,
follower, borrowed support, owned-legacy comparison, database ranking functions,
and skill-threshold expressions inside membership lists are not supported.
Unknown/unsupported queries show errors and return no matches. Race-name search
uses the bundled G1 catalog; other races require their saddle IDs. Affinity is a
single candidate's target branch, not the complete final tree. Missing race
histories do not pass predicates requiring their values. Old imports without a
scenario must be reimported to use scenario filtering.

## Parent-match probability summary

Parent matches show the arithmetic mean of all requested outcome probabilities,
an estimated probability of all requested outcomes in one run, and the expected
number of identical attempts to obtain that complete result (`1 / joint chance`).
The joint estimate multiplies distinct outcomes **assuming independence**. Known
normal/plus aliases count once. Cross-skill dependence and career availability
are not inferred, so this is an estimate, not a guarantee. No desired sparks gives
“—”; any impossible outcome gives zero joint chance and infinite expected runs.
In one-event mode, the estimate covers that event rather than both career events.
These summaries do not change the existing weakest-spark-first ranking.

## Parent matches & deck

Enable **Include support cards** to search parent pairs together with legal decks
of exactly five owned cards and one borrowed card. By default the borrowed card
is an MLB SSR; uncheck SSR-only to allow other rarities. Duplicate support
characters and supports of the target trainee are excluded. Without a target,
recheck deck legality after choosing one. At least five legal owned support
characters are required.

For desired skill sparks, deck mode calculates end-of-career creation chances:
known hints/events or target-character skill sources allow learning a listed
white/◎/gold version; otherwise learning requires inspiration from the selected
lineage. Inspiration-only flags override those sources. A veteran's learned skill
list alone cannot pass skills on. Non-skill spark columns remain inheritance
probabilities. Skill-source access is conditional: hint RNG, event completion,
skill points and awakening unlocks are not modeled as guaranteed.

**Training scenario** defaults to Automatic, choosing the highest modeled index
among scenarios you enabled. URA, Aoharu, Make a New Track and Grand Live are enabled
initially; Grand Masters is opt-in. A manual scenario overrides that list. Enable
only scenarios available in your game. Training focus changes common stat values;
target growth rates affect the underlying gains. No target uses neutral growth.

The training index uses the MIT-licensed Euophrys calculator, evaluated six times
per deck with the other five cards fixed. It assumes owned cards are leveled to
the cap at their current LB and borrowed cards are MLB/max level. The result is a
relative expectation index, not final stats or a guaranteed best career. Source
provenance and license are in `vendor/tierlist/README.md`.

The default ranking is 75% skill outcome quality and 25% training value. Change
**Training-value weight** to emphasize either. Skill quality is the mean of the
weakest desired chance and the average desired chance. Training is normalized
as `index / (index + 3000)`. This weighting is an explicit planning heuristic;
it does not alter the displayed spark probabilities. Setting training weight to
zero restores skill-first comparison. With no desired outcomes, training alone
breaks the choice (chance summaries remain unavailable).

Deck search is bounded: a beam of 128 partial owned decks, then up to 64 distinct
skill/type profiles with a borrowed card, evaluated against each parent pair.
It is not exhaustive and may miss better decks. Card levels, skill coverage,
scenario comparisons and individual marginal contributions are shown in results.
**Use pair** also saves the suggested support deck and model result in the plan.

## Advanced search groups

Basic keeps its simple flat rules. Advanced now has its own nested AND/OR groups,
NOT exclusions, comma-separated membership values, and shortcuts for stats,
aptitudes, characters, races and learned skills. First use copies Basic rules;
afterwards each mode retains its own draft. **Copy Basic rules** explicitly
replaces the Advanced draft. **Edit as UQL** serializes the active builder,
including grouping and negation. Presets preserve the whole grouped expression.
