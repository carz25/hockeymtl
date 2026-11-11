# Hockey MTL league hub

Every league site runs on the same design and code, which live in this folder.
Change something here once and every league updates.

```
shared/
  hub.css      design for every league (colours, fonts, layout, mobile view)
  hub.js       code for every league (home, standings, players, schedule, teams, previews)
M11BB/  M13AAA/  (one folder per league)
  index.html   short page that loads the files below. Copy it for a new league.
  league.js    settings for this league (title, format). Rarely changes.
  logos.css    team logo images (optional)
  data.js      schedule, standings, rosters and game sheets. Updated every week.
```

## Who edits what

| Change | File |
|---|---|
| New game sheets, standings, schedule changes | that league's `data.js` only |
| League name, format | that league's `league.js` |
| Hockey MTL header logo (same on every league) | `shared/hub.js` (`LOGO`) |
| Team logos | that league's `logos.css` |
| Anything about how the site looks or works | `shared/hub.css` or `shared/hub.js` |

Paste this into the instructions of each league's Claude chat or project:

> This league's site uses the shared Hockey MTL template. When I send game sheets or standings, update and return only this league's `data.js`. Never change `shared/hub.css`, `shared/hub.js` or the design. Keep the data format exactly as it is.

## League settings (`league.js`)

| Setting | Meaning |
|---|---|
| `id` | Short code used to save each visitor's choices (view, team), e.g. `"u11bb"`. Must be different for each league. |
| `title`, `subtitle` | Header text, e.g. `"M11 BB"` and `"L.H.G.M. Conference MTL"`. |
| `name` | Page title and copyright name. |
| `record` | `"WTL"`: wins, ties, losses (ties allowed). `"OTL"`: wins, regulation losses, overtime/shootout losses. |
| `stats` | `"sheets"`: player stats are counted from the game sheets in `data.js`. `"official"`: player stats come from the league's own stat tables (`PSTATS`, `GSTATS`). |
| `logos` | `true` when `logos.css` has team logos. `false` shows coloured badges with the team code. |
| `group` | Word used in "1st in the ...": `"conference"` or `"division"`. |
| `footerNote` | Footer text about where the numbers come from. |

A league has divisions when its `data.js` defines `DIVS`. That adds the division picker and division sections. Without `DIVS`, the league is one table in the order of `ORDER`.

## Data format (`data.js`)

The data files hold the same variables as before the split, so the format hasn't changed:

- `SCHED`: one row per game: `[id, "YYYY-MM-DD", "h:mm AM", venue, awayCode, homeCode, awayGoals, homeGoals]`. Leave the two scores off for games not played yet.
- `TEAMS`, `SHORT`, `BADGE`: full names, short names and badge colours by team code.
- `ORDER` (one table) or `DIVS` (divisions, each with its teams in standings order).
- `OFF`: official standings row per team. With `record: "WTL"` the row is GP W T L PTS PTS% GF GA DIFF PIM. With `"OTL"` it's GP W L OTL PTS PTS% GF GA DIFF PIM RW OT/SO-wins SP incomplete.
- `R`: player names by team and key. `G`: game sheets (dressed players, goals, penalties, goalies).
- Sheet-stat leagues only: `PPX` and `TIMED` (power-play and short-handed goals).
- Official-stat leagues only: `AS_OF`, `DATA_THROUGH`, `PSTATS`, `GSTATS`, `GLEN` (minutes per game).

## Adding a league (e.g. M11AA)

1. Copy `M11BB/index.html` into the new folder and change the two names in it (`<title>` and `copyright`). Remove the `logos.css` line if there are no logos yet.
2. Copy `M11BB/league.js` (if the league is like M11 BB) or `M13AAA/league.js` (if it's like M13 AAA) and change the settings.
3. Create `data.js` from the league's schedule, standings and game sheets.

## Notes

- After a change, GitHub Pages can take a few minutes to update, and browsers may keep the old `hub.css`/`hub.js` for a short while. A hard refresh shows the new version right away.
- A few page sections still have two versions in `hub.js`, because the two leagues currently show different things. Those are standings and the home-page standings snapshot (one table vs divisions), and the players and team pages (sheet stats vs official stats). They're the functions ending in `C` (the M11 BB style) next to the ones without it (the M13 AAA style). If you want both leagues to look the same there, that's a change in one place.
