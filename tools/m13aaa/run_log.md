# Automatic run log

## 2026-11-14
Self-test: WebFetch of game 885838 worked (HTTP 200, PDF form fields). Matches game 1056 in sheets_log.py: score 0-4, rosters (15+15), goalies and minutes, 4 goals, 3 penalties, 1 PP goal. Only difference: fetched text read "KILIAM CARON" (ESP/NCO #21) vs "Kilian Caron" in the log, likely a read/typo difference; names are uppercase and accent-stripped on the sheet so accents were not verified. Clone and push: clone existed at start, push tested below. No unscored played games on this run (earliest unscored is 2026-11-14).

## 2026-11-15
No games added. 7 played games dated 2026-11-14 still have no score (1264, 1265, 1266, 1073, 1337, 1169, 1170; gamesheets 895525, 895522, 895518, 885987, 899356, 893387, 893385). Every WebFetch of pdf.play.spordle.com failed with PROVENANCE_REQUIRED ("permission request for this URL was not answered in time"), so nothing was transcribed. All skipped; they will be retried on the next run. data.js unchanged.
