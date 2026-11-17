# M11 BB data update

Keeps `M11BB/data.js` current. Only that file (plus the files in this folder) is ever changed. Never touch `shared/`, any `index.html`, `league.js`, `logos.css` or the design.

Files here:
- `games.csv`: the league's full game list, same columns as `tools/m13aaa/games.csv`: Spordle gamesheet id and URL, game number (M11BB-2851 = game 2851 in `SCHED`), date, start time, home, away, arena, surface, status.
- `official.json`: per played game, the league's own score, PIM, power-play goals (`ppg`), chances (`ppo`) and sportsmanship point (`sp`) per side. A check and the source of PIM/SP for standings.
- `har2csv.py`: rebuilds both files from a browser `.har` of the Spordle M11 BB schedule page.
- `sync.py`: schedule sync, standings rebuild and checks.
- `run_log.md`: log of automatic runs.

## Commands (always `python3 -I`, from the repo root)

```
python3 -I tools/m11bb/har2csv.py M11BB_Full_Schedule.har   # refresh games.csv + official.json
python3 -I tools/m11bb/sync.py check      # schedule changes, score / PPG differences vs official.json (changes nothing)
python3 -I tools/m11bb/sync.py apply      # write date / time / venue changes into SCHED (never scores)
python3 -I tools/m11bb/sync.py todo       # games dated today or earlier with no score yet, with their sheet URL
python3 -I tools/m11bb/sync.py standings  # rebuild OFF and ORDER from SCHED + G (+ official.json)
python3 -I tools/m11bb/sync.py verify     # must print OK before publishing
```

## Daily routine (also what the scheduled task does)

1. `sync.py verify` must print OK first. `sync.py todo` lists games to enter. None: stop, change nothing.
2. Get each sheet as a PDF. Since Nov 2026 Spordle puts the sheets behind a Cloudflare human check, so WebFetch and scripts get 403: never try to get past it. The owner's PC fetches them instead: `get_sheets.py --auto` (run nightly by `run_nightly.bat`) opens each missing sheet in his own browser and saves it as `<gamesheet_id>.pdf` in `Desktop\M11BB\Gamesheet Downloader\sheets` on his computer. Read them from there with the remote-devices file tools (device_list_dir, device_stage_files), then `pdftotext -layout` and `pdftoppm -jpeg -r 110` + Read the image: the picture is the reliable view (left block = visitors' goals and penalties, right block = home). A game with no PDF there is skipped until the next run. A sheet with no final score and no officials is not played yet; one dated far in the future at 00:00 means the game was postponed: set its `SCHED` row to `[id, "<that date>", "12:00 AM", "TBD", away, home]` and the same date with `00:00` in `games.csv`.
3. For each finished game, edit `M11BB/data.js` by hand, keeping the exact format:
   - `SCHED`: add the two scores to its row: `[2899, "2026-11-14", "12:00 PM", "Aréna ...", "ROC", "BRA", 3, 2],` (away goals, then home goals).
   - `G`: append an entry at the end of the array (before `];`), same shape as the last ones:
     ```
     { id: 2899, a: "ROC", h: "BRA", s: [3, 2], d: { ROC: ROCD, BRA: BRAD },
       g: [["ROC", "Henry", "Caspar", "Robert"], ...],     // goals in sheet order: team, scorer key, assist keys
       p: [["BRA", "Poirier"], ...],                        // one per penalty: team, player key ("" if no number)
       k: [["ROC", "Cannistraro", 33.8, 2], ["BRA", "Pathmasiri", 33.8, 3]],  // goalie: team, key, minutes (33:48 -> 33.8), goals against
       gt: [[1, "4:12", "ev"], [2, "0:45", "pp"], ...],   // one per goal, same order as g: period, game-clock time m:ss as printed, ev / pp / sh
       pt: [["BRA", "Poirier", 1, "3:10", "A53"], ...] },  // every penalty in time order: team, player key ("" if no number), period, m:ss, sheet code
     ```
     `gt` and `pt` feed the game summary (period-by-period scoring, penalty summary with infractions, line score). The code is the Hockey Québec one printed on the sheet (letter = type: A minor 2 min, B major 5, C misconduct 10, D game misconduct, E match; number = infraction, e.g. 53 tripping, 22 slashing). `gt` situations must agree with `PPX` (pp/sh goals). Every game has `gt`/`pt`; a game without them still shows a summary, without times.
     `d` is the dressed list: use the team's standard list (`ROCD`, `BRAD`, ...) when the sheet's skaters match it, otherwise a string of keys in the sheet's order. A second goalie who played gets his own `k` row with his minutes.
   - Player keys are the keys of `R[team]` (usually the last name; see `R` for doubles like `LDupuis`, `JecA`). A skater not in `R` yet: add `Key: "First Last"` to that team in `R`, with proper accents and capitals. An affiliated (call-up) player gets ` †` after the name.
   - `TIMED`: add the game id.
   - `NUM`: jersey numbers, `NUM[team]["First Last"] = number` with the name exactly as in `R` (`†` included). Add any player on the sheet's roster who has no number yet, goalies too, and update a number that changed. The player profile page shows it.
   - `PPX`: add power-play and short-handed goals, worked out from the goal and penalty times: a minor is 2:00, ends early when the other team scores, carries into the next period. `[2899, "ROC", "Henry", "PP", "Caspar"]`. Compare with the sheet's PP counters (`PPVis/PPLoc: A.N: x en y`, x = power-play goals); if they disagree, go with the sheet's count.
4. `sync.py standings`, then `sync.py verify` must print OK. Any PROBLEM: fix it, or undo that game (`git checkout M11BB/data.js` and redo the others).
5. Commit to `main` and push (`git pull --rebase origin main` first). Message: `M11BB: game results through YYYY-MM-DD`.

Standings rules: PTS = 2 per win, 1 per tie, plus the sportsmanship point (1 per game unless the league removes it). PTS% = PTS / (3 × GP). Order: PTS, PTS%, goal difference. PIM and sportsmanship come from `official.json` when the game is in it, otherwise 2 per penalty and 1 point. `ADJ` in `sync.py` keeps two small known differences in the league's own table (OIL +2 PIM, ATT +4 PIM).

Schedule changes are only visible in a new `.har` from the user: run `har2csv.py`, `sync.py check`, `sync.py apply`. Venue names the league writes differently are mapped in `VENUE` in `sync.py`.
