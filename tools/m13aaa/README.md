# M13 AAA daily data update

Keeps `M13AAA/data.js` current. Only that one file is ever changed. Never touch `shared/` or the design.

Files here:
- `get_sheets.py`, `run_nightly.bat`, `setup_task.ps1`: the download scripts that run on the owner's PC (copy of the M11 BB ones, reading `M13AAA/data.js` and `games.csv` from GitHub). Setup: `Desktop\M13AAA\Gamesheet Downloader`, then `powershell -ExecutionPolicy Bypass -File setup_task.ps1` once.
- `update.py` applies changes to `M13AAA/data.js` in the exact existing format (`python3 -I tools/m13aaa/update.py check` must print `OK` before and after).
- `games.csv` is the league's game list (Spordle gamesheet id + URL per game, status, venue). `game_number` M13AAA-1264 is game id 1264 in `SCHED`.
- `sheets_log.py` is the record of every game sheet already entered (the format example). Append new ones to it.
- `run_log.md` is the log of automatic runs.

## Daily routine

1. Today (America/Toronto). Games to enter = rows of `SCHED` with 6 columns (no score) whose date is before today, and that `games.csv` does not mark Postponed. Look up each one's gamesheet id in `games.csv`. If there are none, stop (change nothing, write nothing, no notification).
2. Get the sheets as PDFs. Spordle now puts its sheets behind a Cloudflare human check, so WebFetch and scripts get 403: never try to get past it. The owner's PC fetches them instead: `get_sheets.py --auto` (run every night at 9:30 PM and after sign-in by the Windows task made by `setup_task.ps1`, via `run_nightly.bat`) opens each missing sheet in his own browser and saves it as `<gamesheet_id>.pdf` in `Desktop\M13AAA\Gamesheet Downloader\sheets` on his computer. Read them from there with the remote-devices file tools (`device_list_dir`, `device_stage_files`). If the computer cannot be reached (it is off or asleep), stop quietly: no commit, no log line, no notification. A game with no PDF there is skipped until the next run. Read a staged PDF two ways and compare: form fields (`pypdf.PdfReader(f).get_fields()`, the same text WebFetch used to return, see the lessons in `run_log.md`) and the picture (`pdftoppm -jpeg -r 110`, then Read the image: left block = visitors' goals and penalties, right block = home). A sheet with no final score and no officials is not played yet; one dated far in the future at 00:00 was postponed: set its `SCHED` row to `[id, "<that date>", "12:00 AM", "TBD", away, home]` and the same date with `00:00` in `games.csv`.
3. `python3 -I tools/m13aaa/pdf2sheet.py <folder of staged PDFs> > /tmp/draft.py` turns the PDF form fields into a draft `SHEETS` list (NOTE lines on stderr point at anything odd: tie or shootout, printed score differing from the goals, affiliated players). Check every game against the picture, fix, then write `/tmp/new_sheets.py` with `SHEETS = [dict(...), ...]` (format below). Check each against the sheet: score = number of goals, penalties, goalie minutes add to the game length.
4. `python3 -I tools/m13aaa/update.py sheets /tmp/new_sheets.py`. Read every WARNING. `NEW PLAYER x (close to an existing player: y)` is almost always a spelling difference between the sheet and the league's stats: add `(team, normalized sheet name): normalized stats name` to `ALIAS` in `update.py` and redo it from a clean `data.js` (`git checkout M13AAA/data.js`). `PP CHECK` means the power-play goals derived from penalty times differ from what the sheet says: recheck the transcription.
   `update.py sheets` also stores each goal's and penalty's period, time, situation and code in the game's `G` entry (`gt`, `pt`), which the game summary on the site uses. `update.py times tools/m13aaa/sheets_log.py` re-adds them to games already entered.
5. Append the new dicts to `sheets_log.py` (keep it valid Python: `SHEETS = [` … `]`).
6. If the league's schedule CSV is newer, replace `games.csv` and run `update.py schedule tools/m13aaa/games.csv`.
7. `update.py check` → `OK`; `git diff --stat` must show `M13AAA/data.js`, `tools/m13aaa/sheets_log.py` (and `games.csv`, `run_log.md`) only. Commit to `main` and push (`git pull --rebase` first).
8. If the user sends an official standings file, it wins over the sheet-derived standings: `update.py standings OFFICIAL.json` where the json is `{"CAN":[GP,W,L,OTL,PTS,"PTS%",GF,GA,DIFF,PIM,RW,OTSOW,SP,false],...}` for all 24 teams. Do not apply it unless the user supplied it.

## SHEETS format (see `sheets_log.py` for real examples)

```
dict(id=1056, date="2026-11-08", a="ESP", h="NCO", s=(0,4), so=False, fp={"ESP":1,"NCO":1}, url="...",
  ros={"ESP":{9:"Sam Harvey", ...}, "NCO":{...}},          # dressed skaters: jersey number -> full name
  gl={"ESP":{1:"Lohan Verville",30:"Jayden Girard"}, ...},  # goalies: number -> name
  goals=[("NCO",1,"2:18",44,[21,11]), ...],                # (team, period, "m:ss", scorer#, [assist#]); scorer None if unknown
  pens=[("ESP",1,"2:01",9,"A50"), ...],                    # (team, period, "m:ss", player# or None, code); each = 2 PIM
  goalies=[("ESP",1,0,0,False),("ESP",30,45,4,True), ...], # (team, #, minutes played, goals against, started)
  pp={"NCO":1})                                            # power-play goals per team as printed on the sheet (check only)
```
- `a` = away team code, `h` = home team code, `s=(away goals, home goals)`. `so=True` when decided by overtime or shootout (the team that wins gets 2 pts, the loser 1). Period 4 = overtime.
- A tie (equal goals, no shootout, `so=False`, `s` equal) is entered as printed: 1 point each (plus the sportsmanship point), no W, L or OTL, no goalie decision. The league accepted game 1224 (Nov 15, 3-3) as an exceptional tie. Standings from an official file replace these numbers.
- `fp` = sportsmanship point per team (SP column, 0 or 1, included in PTS). Use what the sheet shows. If it does not show it, 1 unless the team took a misconduct or match penalty (like game 1347, PLA, code C61 → 0). Mention the guess in the log.
- Team codes: EDH division CAN ASQ COR NCO EST ESP BLI ALB; HEX division HAR NOM DYN CAS GRE FAD CFR LBL; SRO division MEL ROC SEN LSI SDN SMI CBL PLA.
- Names: the sheets print them in capitals without accents. Write them as printed; `update.py` swaps in the spelling already in the stats (accents, capitals) and prints `WARNING NAME ...` for any name it has not seen before: fix those by hand (proper accents and capitals) in the SHEETS entry and rerun from a clean `data.js`.
