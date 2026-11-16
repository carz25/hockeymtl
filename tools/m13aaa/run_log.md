# Automatic run log

## 2026-11-14
Self-test: WebFetch of game 885838 worked (HTTP 200, PDF form fields). Matches game 1056 in sheets_log.py: score 0-4, rosters (15+15), goalies and minutes, 4 goals, 3 penalties, 1 PP goal. Only difference: fetched text read "KILIAM CARON" (ESP/NCO #21) vs "Kilian Caron" in the log, likely a read/typo difference; names are uppercase and accent-stripped on the sheet so accents were not verified. Clone and push: clone existed at start, push tested below. No unscored played games on this run (earliest unscored is 2026-11-14).

## 2026-11-15
No games added. 7 played games dated 2026-11-14 still have no score (1264, 1265, 1266, 1073, 1337, 1169, 1170; gamesheets 895525, 895522, 895518, 885987, 899356, 893387, 893385). Every WebFetch of pdf.play.spordle.com failed with PROVENANCE_REQUIRED ("permission request for this URL was not answered in time"), so nothing was transcribed. All skipped; they will be retried on the next run. data.js unchanged.

2026-11-15 (second run, fetches worked): added 1264 MEL 2-6 ROC, 1265 GRE 2-4 SEN, 1170 LBL 5-CFR 1. No WARNINGs/PP CHECK. Notes: 1264 Élite goalie 42.7 min / 5 GA vs 6 goals and 1265 GRE goalie 43.9 min = empty-net time (goal at 14:49 P3 in 1264); accepted like earlier games.
Skipped (do not add up, retry tomorrow): 1266 (895518) visitor goalie 5 GA vs 6 goals at 45.0 min, suspended #13 not on roster; 1073 (885987) goal 3 has no scorer, one scorer conflict (#16 vs #8); 1337 (899356) score 2-1 but one goal each, shootout result not recorded; 1169 (893387) printed home 2 but one home goal, shootout, result not recorded.

2026-11-15 (owner follow-up): added 1266 CBL 3-6 SMI (visitor goalie 5 GA vs 6 goals = empty-net goal, owner confirmed goalie was pulled) and 1073 CAN 1-2 ASQ (two goals entered with scorer unknown: CAN P1 4:44 sheet has scorer #16 vs name #8 conflict; ASQ P2 2:28 no scorer on sheet). Still skipped: 1337 and 1169 (shootout decided, result not recorded on sheet).

2026-11-15 (correction): 1073 goals fixed from the top of the sheet: CAN P1 4:44 scorer #16 (Michaud); ASQ P2 2:04 #2 (assist #3) and P2 2:28 #2 (scoreLoc fields are scorer numbers). Goalie per-period GA at the bottom of the sheet ignored.

2026-11-15 (owner confirmed): added 1337 SDN 2-1 PLA (shootout win, printed score = winner+1; owner confirmed via checkmarks) and 1169 CAS 1-2 NOM (same pattern, shootout, home winner by printed score). 1337 notes: duplicate SDN #88 A48 at P3 9:50 entered once; PLA #20 has A25+A22 at 9:50 (the "other" entry skipped); new player SDN Elliot Laplante (spelling unverified).

## Lessons for future sheets (owner-confirmed 2026-11-15)
- WebFetch returns PDF form fields, not the printed layout. Roster rows (playerNameVis1/playerNumVis1...) are NOT goals; do not read a roster row as a goal scorer.
- Goals: use goalTime/goalPeriod/scorer fields at the top. Home scorer numbers are in scoreLoc1..N (not a running score); visitor scorers in scorerVis1..N; assists in assistOne/TwoLoc/Vis. Ignore the per-period goalie GA block at the bottom if it disagrees with the goals.
- Goalie GA lower than goals scored, or minutes under 45, is normal when the trailing team pulled its goalie (empty-net goal): accept, do not skip.
- Shootout/OT games: the printed final score is winner = loser+1 with equal goals listed; enter with so=True and s = printed score. Do not skip for goals != score in that case.
- PP/PK fields read "x en y": PP = goals on y chances, PK = kills on y chances. Penalty counts can be off by one from coincident penalties; do not skip for that. Exact duplicate penalty rows: enter once unless the PP/PK counts need both.
- Skip only when a score cannot be determined or goals clearly contradict the score without an empty-net or shootout explanation.

## 2026-11-16
No games added. 7 played games dated 2026-11-15 still have no score (1224, 1323, 1267, 1171, 1329, 1172, 1268; gamesheets 893331, 897153, 895516, 893382, 898100, 893383, 895515). Every WebFetch of pdf.play.spordle.com failed with PROVENANCE_REQUIRED ("permission request for this URL was not answered in time"), so nothing was transcribed. All skipped; they will be retried on the next run. data.js unchanged.

## 2026-11-16 (owner)
Spordle sheets are behind a Cloudflare human check: WebFetch no longer works. Switched to PDFs downloaded by the owner's PC (`get_sheets.py`, same as M11 BB). The scheduled task now requires the computer and reads `Desktop\M13AAA\Gamesheet Downloader\sheets`.
