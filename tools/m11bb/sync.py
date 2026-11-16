#!/usr/bin/env python3
"""M11 BB schedule sync. Compares M11BB/data.js SCHED with tools/m11bb/games.csv (and official.json).

  python3 -I tools/m11bb/sync.py check     list differences, change nothing
  python3 -I tools/m11bb/sync.py apply     write date, time, venue and team changes into SCHED (scores are never touched)
  python3 -I tools/m11bb/sync.py todo      games up to today with no score in data.js, with their game sheet URL
  python3 -I tools/m11bb/sync.py standings rebuild OFF and ORDER from SCHED scores and G penalties
  python3 -I tools/m11bb/sync.py verify    consistency checks; prints OK when data.js is ready to publish

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
    if c['start_local']=='00:00': want[2]='TBD'   # league placeholder for a postponed game: shows as "Date TBD"
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
        if c['date']<=today and gid in idx and len(idx[gid][1])==6: print(gid,c['date'],c['away'],'at',c['home'],c['gamesheet_url'])
    sys.exit()
if cmd in ('standings','verify'):
    import subprocess
    J=json.loads(subprocess.check_output(['node','-e',"eval(require('fs').readFileSync(process.argv[1],'utf8'));console.log(JSON.stringify({S:SCHED,G:G,O:OFF,ORDER:ORDER,TIMED:TIMED,PPX:PPX,R:R}))",DATA]))
    # PIM and sportsmanship: league per-game numbers (official.json) when there, else 2 per penalty on the sheet and 1 point
    # ADJ: fixed differences between the league's standings table and its own per-game numbers (keeps OFF as published)
    ADJ={'OIL':{9:2},'ATT':{9:4}}
    G={g['id']:g for g in J['G']}
    calc={t:[0]*10 for t in J['O']}
    for r in J['S']:
        if len(r)!=8: continue
        o=off.get(str(r[0]))
        for side,c,f,a in (('away',4,r[6],r[7]),('home',5,r[7],r[6])):
            t=r[c]; x=calc[t]; x[0]+=1; x[6]+=f; x[7]+=a
            x[1 if f>a else 2 if f==a else 3]+=1
            if o and o.get(side): x[9]+=o[side]['pim']; x[4]+=o[side]['sp']
            else:
                x[9]+=2*sum(1 for q in G[r[0]]['p'] if q[0]==t) if r[0] in G else 0; x[4]+=1
    for t,x in calc.items():
        for i,v in ADJ.get(t,{}).items(): x[i]+=v
        x[4]+=2*x[1]+x[2]; x[8]=x[6]-x[7]
        pc=x[4]/(3*x[0]) if x[0] else 0; x[5]=('%.3f'%pc)[1:] if pc<1 else '%.3f'%pc
    order=sorted(calc,key=lambda t:(-calc[t][4],-(calc[t][4]/(3*calc[t][0]) if calc[t][0] else 0),-calc[t][8],J['ORDER'].index(t)))
    if cmd=='standings':
        for j,l in enumerate(L):
            m=re.match(r'  (\w{3}): \[.*\](,?)$',l)
            if m and m.group(1) in calc and j>L.index('var OFF = {'): L[j]='  %s: [%s]%s'%(m.group(1),', '.join(json.dumps(v) for v in calc[m.group(1)]),m.group(2))
            if l.startswith('var ORDER = '): L[j]='var ORDER = ['+', '.join('"%s"'%t for t in order)+'];'
        open(DATA,'w',encoding='utf-8').write('\n'.join(L)); print('standings rebuilt:',' '.join('%s %d'%(t,calc[t][4]) for t in order)); sys.exit()
    bad=[]
    for t in calc:
        if calc[t]!=J['O'][t]: bad.append('OFF %s is %s, should be %s (run standings)'%(t,J['O'][t],calc[t]))
    if J['ORDER']!=order: bad.append('ORDER not sorted (run standings)')
    for r in J['S']:
        if len(r)!=8: continue
        g=G.get(r[0])
        if not g: bad.append('game %d has a score but no G entry'%r[0]); continue
        if g['s']!=r[6:8] or g['a']!=r[4] or g['h']!=r[5]: bad.append('game %d G teams/score differ from SCHED'%r[0])
        for t,n in ((r[4],r[6]),(r[5],r[7])):
            if sum(1 for q in g['g'] if q[0]==t)!=n: bad.append('game %d %s goals listed != score'%(r[0],t))
        for q in g['g']+g['p']:
            for k in q[1:]:
                if k and k not in J['R'][q[0]]: bad.append('game %d unknown player key %s %s'%(r[0],q[0],k))
        if r[0] not in J['TIMED']: bad.append('game %d not in TIMED'%r[0])
    for x in J['PPX']:
        for k in x[2:3]+x[4:]:
            if k not in J['R'][x[1]]: bad.append('PPX unknown player %s %s'%(x[1],k))
    for b in bad: print('PROBLEM',b)
    if not bad: print('OK')
    sys.exit(1 if bad else 0)
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
