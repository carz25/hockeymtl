# M11 BB data update

Keeps `M11BB/data.js` current. Only that one file is ever changed. Never touch `shared/` or the design.

Files here:
- `games.csv`: the league's full game list, same columns as `tools/m13aaa/games.csv`: Spordle gamesheet id and URL per game, date, start time, home, away, arena, surface, status. `game_number` M11BB-2851 is game 2851 in `SCHED`.
- `official.json`: per played game, the league's own score, PIM, power-play goals (`ppg`), power-play chances (`ppo`) and sportsmanship point per side. Used as a check only.
- `har2csv.py`: rebuilds both files from a browser `.har` of the Spordle schedule page (open the M11 BB schedule on page.spordle.com, scroll through every month, save as HAR).
- `sync.py`: compares `data.js` with the two files.

## Commands

```
python3 -I tools/m11bb/har2csv.py M11BB_Full_Schedule.har   # refresh games.csv + official.json
python3 -I tools/m11bb/sync.py check    # schedule changes, score and PPG differences (changes nothing)
python3 -I tools/m11bb/sync.py apply    # write date / time / venue / team changes into SCHED
python3 -I tools/m11bb/sync.py todo     # games before today with no score yet, with their sheet URL
```

## Weekly routine

1. If the user sends a new `.har`, run `har2csv.py`, then `sync.py check` and `sync.py apply`.
2. `sync.py todo` lists the games to enter. Fetch each sheet: `https://pdf.play.spordle.com/game/<gamesheet_id>?locale=fr`.
3. For each sheet, in `data.js`: add the score to its `SCHED` row, add a `G` entry (dressed players, goals, penalties, goalie minutes), new names in `R`, and its id in `TIMED`.
4. Power-play / short-handed goals go in `PPX`, worked out from goal and penalty times (a minor is 2:00 and ends when the other team scores). The league's `ppg` in `official.json` wins when they disagree.
5. Update `OFF` (GP W T L PTS PTS% GF GA DIFF PIM; PTS = 2 per win, 1 per tie, plus the sportsmanship point) and re-sort `ORDER` by PTS, then PTS%, then goal difference.
6. `sync.py check` must show no SCORE DIFF or PPG DIFF. Commit `M11BB/data.js` (and these files) to `main` and push.

Venue names: the league writes some arenas differently from the site. `VENUE` in `sync.py` maps them (for example "Aréna Mont-Royal (plateau)" is "Aréna Mont-Royal").
