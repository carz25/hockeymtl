# Automatic run log

## 2026-11-14
Self-test: WebFetch of game 885838 worked (HTTP 200, PDF form fields). Matches game 1056 in sheets_log.py: score 0-4, rosters (15+15), goalies and minutes, 4 goals, 3 penalties, 1 PP goal. Only difference: fetched text read "KILIAM CARON" (ESP/NCO #21) vs "Kilian Caron" in the log, likely a read/typo difference; names are uppercase and accent-stripped on the sheet so accents were not verified. Clone and push: clone existed at start, push tested below. No unscored played games on this run (earliest unscored is 2026-11-14).

## 2026-11-15
No games added. 7 played games dated 2026-11-14 still have no score (1264, 1265, 1266, 1073, 1337, 1169, 1170; gamesheets 895525, 895522, 895518, 885987, 899356, 893387, 893385). Every WebFetch of pdf.play.spordle.com failed with PROVENANCE_REQUIRED ("permission request for this URL was not answered in time"), so nothing was transcribed. All skipped; they will be retried on the next run. data.js unchanged.

2026-11-15 (second run, fetches worked): added 1264 MEL 2-6 ROC, 1265 GRE 2-4 SEN, 1170 LBL 5-CFR 1. No WARNINGs/PP CHECK. Notes: 1264 Élite goalie 42.7 min / 5 GA vs 6 goals and 1265 GRE goalie 43.9 min = empty-net time (goal at 14:49 P3 in 1264); accepted like earlier games.
Skipped (do not add up, retry tomorrow): 1266 (895518) visitor goalie 5 GA vs 6 goals at 45.0 min, suspended #13 not on roster; 1073 (885987) goal 3 has no scorer, one scorer conflict (#16 vs #8); 1337 (899356) score 2-1 but one goal each, shootout result not recorded; 1169 (893387) printed home 2 but one home goal, shootout, result not recorded.
