# M13 AAA daily data update

Keeps `M13AAA/data.js` current. Only that one file is ever changed. Never touch `shared/` or the design.

Files here:
- `update.py` applies changes to `M13AAA/data.js` in the exact existing format (`python3 -I tools/m13aaa/update.py check` must print `OK` before and after).
- `games.csv` is the league's game list (Spordle gamesheet id + URL per game, status, venue). `game_number` M13AAA-1264 is game id 1264 in `SCHED`.
- `sheets_log.py` is the record of every game sheet already entered (the format example). Append new ones to it.
- `run_log.md` is the log of automatic runs.

## Daily routine

1. Today (America/Toronto). Games to enter = rows of `SCHED` with 6 columns (no score) whose date is before today, and that `games.csv` does not mark Postponed. Look up each one's Spordle URL in `games.csv`. If there are none, stop (write nothing, change nothing).
2. Fetch each sheet (WebFetch, `https://pdf.play.spordle.com/game/<gamesheet_id>?locale=fr`). A game that is not finished or has no score yet: skip it, try again tomorrow.
3. Write `/tmp/new_sheets.py` with `SHEETS = [dict(...), ...]` (format below). Check each against the sheet: score = number of goals, penalties, goalie minutes add to the game length.
4. `python3 -I tools/m13aaa/update.py sheets /tmp/new_sheets.py`. Read every WARNING. `NEW PLAYER x (close to an existing player: y)` is almost always a spelling difference between the sheet and the league's stats: add `(team, normalized sheet name): normalized stats name` to `ALIAS` in `update.py` and redo it from a clean `data.js` (`git checkout M13AAA/data.js`). `PP CHECK` means the power-play goals derived from penalty times differ from what the sheet says: recheck the transcription.
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
- `fp` = sportsmanship point per team (SP column, 0 or 1, included in PTS). Use what the sheet shows. If it does not show it, 1 unless the team took a misconduct or match penalty (like game 1347, PLA, code C61 → 0). Mention the guess in the log.
- Team codes: EDH division CAN ASQ COR NCO EST ESP BLI ALB; HEX division HAR NOM DYN CAS GRE FAD CFR LBL; SRO division MEL ROC SEN LSI SDN SMI CBL PLA.
- Player names exactly as on the sheet (accents and all).
