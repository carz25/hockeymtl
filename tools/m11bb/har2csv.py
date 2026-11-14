#!/usr/bin/env python3
"""Turn a browser .har of the Spordle M11 BB schedule page into games.csv (same columns as tools/m13aaa/games.csv)
and official.json (per-game score, PIM and power-play goals from the league, used by sync.py as a check).

  python3 -I tools/m11bb/har2csv.py M11BB_Full_Schedule.har"""
import sys,os,json,csv,datetime,zoneinfo
HERE=os.path.dirname(os.path.abspath(__file__))
tz=zoneinfo.ZoneInfo('America/Toronto')
h=json.load(open(sys.argv[1],encoding='utf-8'))
games={}
for e in h['log']['entries']:
    if e['request']['method']!='GET' or not e['request']['url'].split('?')[0].endswith('/api/sp/games'): continue
    t=e['response']['content'].get('text') or ''
    try: d=json.loads(t)
    except Exception: continue
    for g in d if isinstance(d,list) else []:
        if (g.get('category') or {}).get('name')=='U11 BB': games[g['id']]=g
if not games: raise SystemExit('no U11 BB games found in the .har')
rows=[];off={}
for g in sorted(games.values(),key=lambda g:(g['startTime'],int(g['number']))):
    st=datetime.datetime.fromisoformat(g['startTime'].replace('Z','+00:00')).astimezone(tz)
    rows.append([g['id'],'https://pdf.play.spordle.com/game/%d'%g['id'],'M11BB-'+g['number'],st.strftime('%Y-%m-%d'),st.strftime('%H:%M'),
                 g['homeTeam']['name'],g['awayTeam']['name'],g['surface']['venue']['name'],g['surface']['name'],g['status']])
    if g.get('score'):
        side={g['homeTeamId']:'home',g['awayTeamId']:'away'}
        o={'score':{'away':g['score'].get(str(g['awayTeamId'])),'home':g['score'].get(str(g['homeTeamId']))}}
        for s in g.get('teamStats') or []:
            o[side[s['teamId']]]={'pim':s.get('pim'),'ppg':s.get('ppg'),'ppo':s.get('ppo'),'sp':s.get('sportsmanship')}
        off[g['number']]=o
with open(os.path.join(HERE,'games.csv'),'w',newline='',encoding='utf-8-sig') as f:
    w=csv.writer(f,lineterminator='\n')
    w.writerow(['gamesheet_id','gamesheet_url','game_number','date','start_local','home','away','arena','surface','status']); w.writerows(rows)
json.dump(off,open(os.path.join(HERE,'official.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=0,sort_keys=True)
print('games.csv: %d games, official.json: %d with scores'%(len(rows),len(off)))
