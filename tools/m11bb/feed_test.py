#!/usr/bin/env python3
"""One-off test: can Spordle's public schedule feed be read from GitHub's servers?
Asks for the M11 BB games of Nov 14-15, 2026 and prints the scores. Changes nothing."""
import json, sys, urllib.parse, urllib.request, urllib.error
flt = {"order": ["startTime ASC", "number ASC"],
       "where": {"and": [{"date": {"between": ["2026-11-14", "2026-11-15"]}}, {"scheduleId": 199330}, {"officeId": 6082}]},
       "include": ["teamStats", "awayTeam", "homeTeam"]}
url = "https://pub-api.play.spordle.com/api/sp/games?filter=" + urllib.parse.quote(json.dumps(flt, separators=(",", ":")))
req = urllib.request.Request(url, headers={"Accept": "application/json", "X-Page-Type": "LEAGUE", "User-Agent": "hockeymtl.ca fan site updater (nightly, one request)"})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read(); status = r.status; ctype = r.headers.get("content-type", "")
except urllib.error.HTTPError as e:
    body = e.read(); status = e.code; ctype = e.headers.get("content-type", "")
print("HTTP", status, ctype, len(body), "bytes")
if status != 200 or "json" not in ctype:
    print("FEED TEST: REFUSED"); print(body[:300].decode("utf-8", "replace")); sys.exit(0)
games = json.loads(body)
for g in games:
    sc = g.get("score") or {}
    print(g["number"], g["date"], g["awayTeam"]["name"], sc.get(str(g["awayTeamId"])), "-", sc.get(str(g["homeTeamId"])), g["homeTeam"]["name"],
          "| certified:", g.get("isCertified"), "| teamStats:", len(g.get("teamStats") or []))
print("keys:", sorted(games[0].keys()) if games else None)
print("FEED TEST: OK,", len(games), "games")
