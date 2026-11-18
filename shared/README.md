# Hockey MTL league hub

Every league site runs on the same design and code, which live in this folder.
Change something here once and every league updates.

```
index.html     hockeymtl.ca home page: one panel per division (built by shared/home.js)
shared/
  hub.css      design for every league (colours, fonts, layout, mobile view)
  hub.js       code for every league (home, standings, players, schedule, teams, previews)
  logo.js      Hockey MTL shield and wordmark, used on every page
  leagues.js   divisions shown on the home page, with their panel colour
  home.css     home page design
  home.js      home page code (Google ad slots are switched off with SHOW_ADS)
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
| Hockey MTL logo and wordmark (every page) | `shared/logo.js` |
| Divisions on the home page, panel colours | `shared/leagues.js` |
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
- `TEAMS`: full names by team code. `SHORT` (optional, defaults to `TEAMS`): short names. `BADGE` (optional): badge colours; without it each team gets a steady colour from a built-in palette.
- `ORDER` (one table) or `DIVS` (divisions, each with its teams in standings order).
- `OFF` (optional): official standings row per team. When `OFF` is left out, or a team is missing from it, that team's row is counted from the scores in `SCHED` (2 points a win, 1 a tie; PIM from the game sheets) and the table is ordered by points, points %, then goal difference. Use `OFF` when the league's own table has rules the scores can't show (fair-play points, overtime losses). With `record: "WTL"` the row is GP W T L PTS PTS% GF GA DIFF PIM. With `"OTL"` it's GP W L OTL PTS PTS% GF GA DIFF PIM RW OT/SO-wins SP incomplete.
- `R`: player names by team and key. `G`: game sheets (dressed players, goals, penalties, goalies).
- Sheet-stat leagues only: `PPX` and `TIMED` (power-play and short-handed goals).
- Official-stat leagues only: `PSTATS`, `GSTATS` (may be empty early in the season), and optionally `AS_OF` (date of the official stats; defaults to the last played game), `DATA_THROUGH` (latest game sheet added on top) and `GLEN` (minutes per game, default 60).
- Nothing played yet is fine: leave the scores off every `SCHED` row and the site shows "Season starts …", zero records and the upcoming games.

## Adding a league (e.g. M11AA)

No code changes are needed: the template was tested with every combination of `record` (WTL/OTL), `stats` (sheets/official), with and without divisions, logos, `OFF`, `BADGE`, game sheets and played games, on desktop and phones, and with 3 and 5 divisions on the home page.

1. Copy `M11BB/index.html` into the new folder and replace the league name and folder in its head (`<title>`, the `og:` title, description and URL, and `copyright`). Point `og:image` at `og-<FOLDER>.png` if you add one to `shared/icons/`, otherwise at `og-home.png`. Remove the `logos.css` line if there are no logos yet.
2. Copy `M11BB/league.js` (if the league is like M11 BB) or `M13AAA/league.js` (if it's like M13 AAA) and change the settings.
3. Create `data.js` from the league's schedule, standings and game sheets.
4. Add one line for it to `shared/leagues.js` so it gets a panel on the home page and a link in the footer. The home page lays out any number of panels (side by side on computers, stacked bands on phones).

## Notes

- After a publish, Cloudflare rebuilds the site from `main` in about a minute. Pages are checked on every visit, so a reload shows the change; `hub.js`/`hub.css` change only when `C` is bumped (see Changing the shared code), and `data.js` can be up to 15 minutes old.
- A few page sections still have two versions in `hub.js`, because the two leagues currently show different things. Those are standings and the home-page standings snapshot (one table vs divisions), and the players and team pages (sheet stats vs official stats). They're the functions ending in `C` (the M11 BB style) next to the ones without it (the M13 AAA style). If you want both leagues to look the same there, that's a change in one place.

## Changing the shared code

Each league page loads `hub.js` and `hub.css` as `?v=C`, where `C` is set near the top of every league's `index.html` (`var C = "20261117b"`). Browsers keep their copy until `C` changes, so after any change to `shared/hub.js` or `shared/hub.css`, give `C` a new value in **every** league's `index.html` (the same value everywhere). `data.js` needs nothing: its `?v=` changes every 15 minutes on its own.

## Hosting

The site is served by Cloudflare (Workers static assets), rebuilt from `main` on every push. `wrangler.jsonc` holds the settings, `.assetsignore` lists repo files that are not published (tools, notes), and `_headers` sets how long browsers keep each file. Nothing else is needed for a new league: its folder is published like the others.

