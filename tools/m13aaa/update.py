#!/usr/bin/env python3
"""M13 AAA data updater. Reads ../../M13AAA/data.js, applies changes, writes data.js back in the same format.

  python3 -I update.py check                      round-trip test (must print OK and change nothing)
  python3 -I update.py schedule games.csv         apply schedule changes from the league CSV
  python3 -I update.py sheets new_sheets.py       add played game sheets (python file defining SHEETS = [dict(...)])
  python3 -I update.py standings OFFICIAL.json    replace OFF with official standings ({"CAN":[14,10,4,...],...})

Only M13AAA/data.js is ever written. See README.md for the SHEETS format."""
import sys,re,json,csv,os,copy,unicodedata,difflib
HERE=os.path.dirname(os.path.abspath(__file__))
DATA=os.path.normpath(os.path.join(HERE,'..','..','M13AAA','data.js'))
jb=lambda o: json.dumps(o,ensure_ascii=False)
nn_key=lambda n: re.sub(r'\W+','_',n)
def nn(s): return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFD',s.lower()).encode('ascii','ignore').decode())
def sec(per,t): m,s=t.split(':'); return (per-1)*900+int(m)*60+int(s)
# spellings that differ between a game sheet and the official stat tables: (team, normalized sheet name) -> normalized official name
ALIAS={('NCO','kiliancaron'):'kiliamcaron',('FAD','loganhitikas'):'loganhiticas'}

# ---------- load / save (line based, so unchanged parts stay byte-identical) ----------
def load():
    L=open(DATA,encoding='utf-8').read().split('\n'); D={'L':L}
    def one(name):
        for i,l in enumerate(L):
            if l.startswith('var %s = '%name): return i,l
        raise SystemExit('missing var '+name)
    i,l=one('AS_OF'); D['AS_OF']=re.search(r'"(.*?)"',l).group(1)
    i,l=one('DATA_THROUGH'); D['DATA_THROUGH']=re.search(r'"(.*?)"',l).group(1)
    for n in ('DIVS','PSTATS','GSTATS','R'):
        i,l=one(n); D[n]=json.loads(l[len('var %s = '%n):].rstrip(';'))
    i,_=one('OFF'); D['OFF']={}
    j=i+1
    while L[j]!='};':
        m=re.match(r'  (\w+): (\[.*\]),?$',L[j]); D['OFF'][m.group(1)]=json.loads(m.group(2)); j+=1
    i,_=one('SCHED'); D['SCHED']=[]; j=i+1
    while L[j]!='];':
        if L[j].strip(): D['SCHED'].append(json.loads(L[j].strip().rstrip(',')))
        j+=1
    i,_=one('G'); D['G']=[]; j=i+1
    while L[j]!='];':
        if L[j].strip(): D['G'].append(json.loads(L[j].strip().rstrip(',')))
        j+=1
    return D
def render(D):
    L=D['L']; out=[]; i=0
    def block_end(start,end): 
        j=start+1
        while L[j]!=end: j+=1
        return j
    while i<len(L):
        l=L[i]
        if l.startswith('var DATA_THROUGH = '): out.append('var DATA_THROUGH = "%s"; // latest game sheet added on top'%D['DATA_THROUGH'])
        elif l.startswith('var DIVS = '): out.append('var DIVS = '+jb(D['DIVS'])+';')
        elif l.startswith('var PSTATS = '): out.append('var PSTATS = '+jb(D['PSTATS'])+';')
        elif l.startswith('var GSTATS = '): out.append('var GSTATS = '+jb(D['GSTATS'])+';')
        elif l.startswith('var R = '): out.append('var R = '+jb(D['R'])+';')
        elif l.startswith('var OFF = '):
            j=block_end(i,'};'); out.append(l); out+=[(',\n'.join('  %s: %s'%(c,jb(v)) for c,v in D['OFF'].items()))]; out.append('};'); i=j
        elif l.startswith('var SCHED = '):
            j=block_end(i,'];'); out.append(l); out+=[',\n'.join('  '+jb(r) for r in D['SCHED'])]; out.append('];'); i=j
        elif l.startswith('var G = '):
            j=block_end(i,'];'); out.append(l); out+=[',\n'.join('  '+jb(r) for r in D['G'])]; out.append('];'); i=j
        else: out.append(l)
        i+=1
    return '\n'.join(out)
def save(D): open(DATA,'w',encoding='utf-8').write(render(D))
def tkey(r):  # file order: date, time of day, game id
    t=r[2]; h,m=t[:-3].split(':'); h=int(h)%12+(12 if t.endswith('PM') else 0); return (r[1],h*60+int(m),r[0])
def divsort(D):
    off=D['OFF']
    for d in D['DIVS']:
        d['teams']=sorted(d['teams'],key=lambda c:(off[c][13],-off[c][4],-off[c][10],-off[c][8],d['teams'].index(c)))

# ---------- schedule from the league CSV ----------
def t12(t): h,m=map(int,t.split(':')); return "%d:%02d %s"%((h%12) or 12,m,'AM' if h<12 else 'PM')
def schedule(D,path):
    rows=list(csv.DictReader(open(path,encoding='utf-8'))); sid={r[0]:r for r in D['SCHED']}; ch=[]
    VP=re.compile(r'^(.*) \(([^()]*)\)(?: - (.*))?$'); city={}
    for r in D['SCHED']:
        m=VP.match(r[3])
        if m and m.group(3): city[m.group(1)]=m.group(3)
    for c in rows:
        i=int(re.sub(r'\D','',c['game_number'].split('-')[-1])); s=sid.get(i)
        if not s: print('SCHEDULE: game %s is not in data.js, skipped (add it by hand)'%i); continue
        if len(s)==8: continue  # already played, keep
        tba=c['arena'].strip().upper()=='TBA'
        d,t=c['date'],t12(c['start_local'])
        if tba: v='TBD'
        else:
            m=VP.match(s[3]); cy=city.get(c['arena']) or (m.group(3) if m else None)  # the city is not in the CSV: reuse the known one
            v='%s (%s)'%(c['arena'],c['surface'])+(' - '+cy if cy else '')
        if tba: d,t='%s'%d,'12:00 AM'
        if nn(v)==nn(s[3]): v=s[3]  # same place, only spelling or accents differ
        new=[i,d,t,v,s[4],s[5]]
        if new!=s: ch.append((s[:4],new[:4])); s[:]=new
    D['SCHED'].sort(key=tkey); return ch

# ---------- game sheets ----------
def sheets(D,path):
    ns={}; exec(open(path,encoding='utf-8').read(),ns); SH=ns['SHEETS']
    off=D['OFF']; pst=D['PSTATS']; gst=D['GSTATS']; R=D['R']; sched={r[0]:r for r in D['SCHED']}
    done={g['id'] for g in D['G']}; pidx={(p[0],nn(p[1])):p for p in pst}; gidx={(g[0],nn(g[1])):g for g in gst}
    warn=[]; added=[]
    def player(t,name):
        k=(t,ALIAS.get((t,nn(name)),nn(name))); p=pidx.get(k)
        if p is None:
            near=difflib.get_close_matches(nn(name),[x[1] for x in pidx if x[0]==t],1,0.85)
            warn.append('NEW PLAYER %s %s%s'%(t,name,' (close to an existing player: %s)'%near[0] if near else '')); p=[t,name,0,0,0,0,0,0,0,0,0,0]; pst.append(p); pidx[(t,nn(name))]=p
        return p
    def goalie_row(t,name):
        g=gidx.get((t,nn(name)))
        if g is None:
            warn.append('NEW GOALIE %s %s'%(t,name)); g=[t,name,0,0,0,0,0,0,0,0]; gst.append(g); gidx[(t,nn(name))]=g
        return g
    for sh in SH:
        if sh['id'] in done: print('skip, already in data.js:',sh['id']); continue
        if sh['id'] not in sched: raise SystemExit('game %s is not in SCHED'%sh['id'])
        a,h=sh['a'],sh['h']; sa,ss=sh['s']; win=h if ss>sa else a; lose=a if win==h else h
        for t,gf,ga in ((a,sa,ss),(h,ss,sa)):
            o=off[t]; o[0]+=1; o[6]+=gf; o[7]+=ga; o[8]+=gf-ga; o[12]+=sh['fp'][t]
            o[9]+=2*sum(1 for p in sh['pens'] if p[0]==t)
            if t==win:
                o[1]+=1
                if sh['so']: o[11]+=1; add=2
                else: o[10]+=1; add=3
            else:
                if sh['so']: o[3]+=1; add=1
                else: o[2]+=1; add=0
            if not o[13]: o[4]+=add+sh['fp'][t]
            o[5]="–" if o[13] else ("%.3f"%(o[4]/(4*o[0]))).lstrip('0')
        pens=[[p[0],sec(p[1],p[2]),sec(p[1],p[2])+120] for p in sh['pens']]
        def active(t,x): return sum(1 for pt,s0,e0 in pens if pt==t and s0<=x<e0)
        ppc={a:0,h:0}; goals_out=[]; nth={a:0,h:0}
        for (t,per,tm,sc,ast) in sorted(sh['goals'],key=lambda g:sec(g[1],g[2])):
            o_=h if t==a else a; x=sec(per,tm); ia,io=active(t,x),active(o_,x)
            kind='pp' if io>ia else ('sh' if ia>io else 'ev')
            if kind=='pp':
                ppc[t]+=1; live=[q for q in pens if q[0]==o_ and q[1]<=x<q[2]]
                if live: min(live,key=lambda q:q[1])[2]=x
            nth[t]+=1
            isgw=(t==win and not sh['so'] and nth[t]==(sa if win==h else ss)+1)
            goals_out.append((t,per,tm,sc,ast,kind,isgw))
        for t,v in sh['pp'].items():
            if ppc[t]!=v: warn.append('PP CHECK game %s %s derived %s, sheet %s'%(sh['id'],t,ppc[t],v))
        for t in (a,h):
            for num,name in sh['ros'][t].items(): player(t,name)[2]+=1
        def pname(t,num): return sh['ros'][t][num] if num in sh['ros'][t] else sh['gl'][t].get(num)
        for (t,per,tm,sc,ast,kind,isgw) in goals_out:
            if sc is not None:
                p=player(t,pname(t,sc)); p[3]+=1
                if kind=='sh': p[8]+=1
                if kind=='pp': p[6]+=1
                if isgw: p[10]+=1
            for n in ast:
                p=player(t,pname(t,n)); p[4]+=1
                if kind=='pp': p[7]+=1
                if kind=='sh': p[9]+=1
        for (t,per,tm,pl,code) in sh['pens']:
            if pl is not None and pname(t,pl):
                nmx=pname(t,pl)
                if (t,nn(nmx)) in pidx or nmx in sh['ros'][t].values(): player(t,nmx)[5]+=2
        for t in (a,h):
            order=sorted([g for g in sh['goalies'] if g[0]==t and g[2]>0],key=lambda g:not g[4]); win_t=(t==win)
            def in_net(x):
                cum=0
                for g in order:
                    cum+=g[2]*60
                    if x<cum-1e-6: return g
                return order[-1]
            if sh['so']: dec=order[-1]
            else:
                wgoals=[g for g in goals_out if g[0]==win]; k=(sa if win==h else ss)+1; dg=wgoals[k-1]; dec=in_net(sec(dg[1],dg[2]))
            for g in order:
                r=goalie_row(t,sh['gl'][t][g[1]])
                r[2]+=1; r[9]+=1 if g[4] else 0; r[8]=round(r[8]+g[2],2); r[7]+=g[3]
                if g is dec:
                    if win_t: r[3]+=1
                    elif sh['so']: r[5]+=1
                    else: r[4]+=1
                if len(order)==1 and g[3]==0 and g[2]>=45: r[6]+=1
        # schedule score, page records
        s=sched[sh['id']]
        if len(s)==6: s+=[sa,ss]
        else: s[6],s[7]=sa,ss
        for t in (a,h):
            for n in list(sh['ros'][t].values())+list(sh['gl'][t].values()): R.setdefault(t,{})[nn_key(n)]=n
        pn=lambda t,n: sh['ros'][t].get(n) or sh['gl'][t].get(n)
        gp={"id":sh['id'],"a":a,"h":h,"s":list(sh['s']),"d":{t:" ".join(nn_key(n) for n in sh['ros'][t].values()) for t in (a,h)},
            "g":[[t]+([nn_key(pn(t,sc))] if sc is not None else [])+([nn_key(pn(t,x)) for x in ast] if sc is not None else []) for (t,per,tm,sc,ast,kind,isgw) in sorted(goals_out,key=lambda g:(g[1],int(g[2].split(':')[0])*60+int(g[2].split(':')[1])))],
            "p":[[t,nn_key(pn(t,pl))] for (t,per,tm,pl,code) in sh['pens'] if pl is not None and pn(t,pl)],
            "k":[[t,nn_key(sh['gl'][t][n]),mn,ga] for (t,n,mn,ga,st) in sh['goalies']]}
        if sh['so']: gp["so"]=1
        D['G'].append(gp); done.add(sh['id']); added.append(sh['id'])
        D['DATA_THROUGH']=max(D['DATA_THROUGH'],sh['date'])
    divsort(D); return added,warn

def main():
    cmd=sys.argv[1]; D=load()
    if cmd=='check':
        print('OK' if render(D)==open(DATA,encoding='utf-8').read() else 'MISMATCH'); return
    if cmd=='schedule':
        for a,b in [] or schedule(D,sys.argv[2]): print('changed',a,'->',b)
    elif cmd=='sheets':
        added,warn=sheets(D,sys.argv[2]); print('added games:',added)
        for w in warn: print('WARNING',w)
    elif cmd=='standings':
        D['OFF']=json.load(open(sys.argv[2])); divsort(D)
    else: raise SystemExit(__doc__)
    save(D)
main()
