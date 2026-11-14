#!/usr/bin/env python3
"""M11 BB schedule sync. Compares M11BB/data.js SCHED with tools/m11bb/games.csv (and official.json).

  python3 -I tools/m11bb/sync.py check     list differences, change nothing
  python3 -I tools/m11bb/sync.py apply     write date, time, venue and team changes into SCHED (scores are never touched)
  python3 -I tools/m11bb/sync.py todo      games already played with no score in data.js, with their game sheet URL

Only the SCHED lines of M11BB/data.js are ever written."""
import sys,os,re,csv,json,unicodedata,datetime
HERE=os.path.dirname(os.path.abspath(__file__))
DATA=os.path.normpath(os.path.join(HERE,'..','..','M11BB','data.js'))
# league venue name -> name used on the site
VENUE={'Aréna Mont-Royal (plateau)':'Aréna Mont-Royal','Aréna Michel-Normandin (MTL)':'Aréna Michel-Normandin'}
def nn(s): return re.sub(r'[^a-z]','',unicodedata.normalize('NFD',s.lower()).encode('ascii','ignore').decode())
src=open(DATA,encoding='utf-8').read(); L=src.split('\n')
TEAMS=dict(re.findall(r'(\w{3}): "([^"]+)"',src[src.index('var TEAMS'):src.index('};',src.index('var TEAMS'))]))
CODE={nn(v):k for k,v in TEAMS.items()}
def code(name):
    k=nn(name)
    if k in CODE: return CODE[k]
    hit=[c for kk,c in CODE.items() if k in kk or kk in k]
    if len(hit)==1: return hit[0]
    raise SystemExit('unknown team '+name)
def t12(hm):
    h,m=map(int,hm.split(':')); return '%d:%02d %s'%((h-1)%12+1,m,'AM' if h<12 else 'PM')
csvrows={int(r['game_number'].split('-')[1]):r for r in csv.DictReader(open(os.path.join(HERE,'games.csv'),encoding='utf-8-sig'))}
i0=L.index('var SCHED = [')
idx={}
j=i0+1
while L[j]!='];':
    if L[j].strip(): r=json.loads(L[j].strip().rstrip(',')); idx[r[0]]=(j,r)
    j+=1
cmd=sys.argv[1] if len(sys.argv)>1 else 'check'
today=datetime.date.today().isoformat()
changes=[]
for gid,c in sorted(csvrows.items()):
    want=[c['date'],t12(c['start_local']),VENUE.get(c['arena'],c['arena']),code(c['away']),code(c['home'])]
    if c['status']!='Active': print('STATUS',gid,c['status'])
    if gid not in idx: changes.append((gid,None,want)); continue
    j,r=idx[gid]
    if r[1:6]!=want: changes.append((gid,r,want))
for gid in idx:
    if gid not in csvrows: print('NOT IN CSV',gid)
off={}
p=os.path.join(HERE,'official.json')
if os.path.exists(p): off=json.load(open(p,encoding='utf-8'))
if cmd=='todo':
    for gid,c in sorted(csvrows.items()):
        if c['date']<today and gid in idx and len(idx[gid][1])==6: print(gid,c['date'],c['away'],'at',c['home'],c['gamesheet_url'])
    sys.exit()
for gid,r,w in changes: print('CHANGE' if r else 'NEW',gid,(r or [None])[1:6],'->',w)
for gid,o in sorted(off.items()):
    gid=int(gid)
    if gid in idx and len(idx[gid][1])==8 and [o['score']['away'],o['score']['home']]!=idx[gid][1][6:8]: print('SCORE DIFF',gid,idx[gid][1][6:8],'official',o['score'])
ppx={}
for g,t in re.findall(r'\[(\d{4}), "([A-Z]{3})", "[^"]*", "PP"',src): ppx[(int(g),t)]=ppx.get((int(g),t),0)+1
for gid,o in sorted(off.items()):
    gid=int(gid)
    if gid not in idx: continue
    for side,col in (('away',4),('home',5)):
        t=idx[gid][1][col]; ofc=(o.get(side) or {}).get('ppg')
        if ofc is not None and ofc!=ppx.get((gid,t),0): print('PPG DIFF',gid,t,'PPX',ppx.get((gid,t),0),'official',ofc)
if cmd=='apply':
    for gid,r,w in changes:
        if r is None: print('skip new game',gid,'(add by hand)'); continue
        j,_=idx[gid]; new=[gid]+w+r[6:]
        line='  ['+', '.join(json.dumps(x,ensure_ascii=False) for x in new)+']'
        L[j]=line+(',' if L[j].rstrip().endswith(',') else '')
    open(DATA,'w',encoding='utf-8').write('\n'.join(L))
    print('applied',len([c for c in changes if c[1]]))
elif not changes: print('OK no schedule changes')
