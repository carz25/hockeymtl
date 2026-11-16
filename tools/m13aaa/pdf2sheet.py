#!/usr/bin/env python3
"""Turn Spordle game sheet PDFs into SHEETS entries for update.py (a first draft: always check it against the picture of the sheet).

  python3 -I tools/m13aaa/pdf2sheet.py <dir with PDFs> > /tmp/new_sheets.py

Reads the PDF form fields. Game id, date and teams come from games.csv + data.js (SCHED). Names are uppercase on the sheet;
update.py swaps in the spelling already in the stats. Prints NOTE lines (stderr) for anything to look at."""
import sys,os,re,csv,glob,json,pypdf
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.normpath(os.path.join(HERE,'..','..'))
sys.path.insert(0,HERE)
def sched():
    L=open(os.path.join(ROOT,'M13AAA','data.js'),encoding='utf-8').read().split('\n'); i=L.index(next(l for l in L if l.startswith('var SCHED ')))+1; out={}
    while L[i]!='];':
        if L[i].strip(): r=json.loads(L[i].strip().rstrip(',')); out[r[0]]=r
        i+=1
    return out
def tc(name):  # team code from the codes used in data.js
    return name
def main(d):
    S=sched(); notes=[]
    for f in sorted(glob.glob(os.path.join(d,'*.pdf'))):
        gid=os.path.basename(f)[:-4]
        F={k:(v.get('/V') or '') for k,v in (pypdf.PdfReader(f).get_fields() or {}).items()}
        F={k:str(v).strip() for k,v in F.items() if str(v).strip() not in ('','/Off')}
        gn=int(re.sub(r'\D','',F.get('gameNum','0').split('-')[-1]) or 0)
        if gn not in S: print('# %s: game %s not in SCHED'%(gid,gn),file=sys.stderr); continue
        r=S[gn]; a,h=r[4],r[5]; tm={'Vis':a,'Loc':h}
        def num(x):
            try: return int(x)
            except: return None
        ros={a:{},h:{}}; gl={a:{},h:{}}; aff=[]
        for side,t in tm.items():
            for k in range(1,40):
                n=num(F.get('playerNum%s%d'%(side,k))); nm=F.get('playerName%s%d'%(side,k))
                if n is not None and nm: 
                    ros[t][n]=nm
                    if F.get('playerAffiliate%s%d'%(side,k)): aff.append((t,nm))
        goalies=[]
        for side,t in tm.items():
            for k in range(1,5):
                n=num(F.get('goalerNum%s%d'%(side,k))); nm=F.get('goalerName%s%d'%(side,k))
                if n is None or not nm: continue
                gl[t][n]=nm.replace('*','').strip()
                mn=float(F.get('totalMin%s%d'%(side,k),'0') or 0); ga=num(F.get('totalGoal%s%d'%(side,k))) or 0
                goalies.append((t,n,mn,ga,'*' in nm))
        goals=[]
        for side,t in tm.items():
            sk='scoreLoc' if side=='Loc' else 'scorerVis'
            for k in range(1,30):
                tmv=F.get('goalTime%s%d'%(side,k)); 
                if not tmv: continue
                per=num(F.get('goalPeriod%s%d'%(side,k))); sc=num(F.get('%s%d'%(sk,k)))
                ast=[num(F.get('assist%s%s%d'%(w,side,k))) for w in ('One','Two')]
                mm=tmv.lstrip('0') if False else tmv
                m,s_=tmv.split(':'); goals.append((t,per,'%d:%s'%(int(m),s_),sc,[x for x in ast if x is not None]))
        pens=[]
        for side,t in tm.items():
            for kind in ('minor','other'):
                for k in range(1,15):
                    tmv=F.get('%sPen%sTime%d'%(kind,side,k)); code=F.get('%sPen%sCode%d'%(kind,side,k)); n=num(F.get('%sPen%sNum%d'%(kind,side,k)))
                    if not (tmv or code or n): continue
                    per=num(F.get('%sPen%sPeriod%d'%(kind,side,k)))
                    if not tmv: notes.append('%s: penalty %s %s #%s has no time'%(gid,kind,t,n)); tmv='0:00'
                    m,s_=tmv.split(':'); pens.append((t,per,'%d:%s'%(int(m),s_),n,code or ''))
        def pp(x):
            m=re.search(r'(\d+) en',F.get(x,'')); return int(m.group(1)) if m else 0
        sv,sl=num(F.get('scoreVis')),num(F.get('scoreLoc'))
        ng={t:sum(1 for g in goals if g[0]==t) for t in (a,h)}
        so=(ng[a]==ng[h]) or (sv!=ng[a] or sl!=ng[h]) and sv+sl!=ng[a]+ng[h] and False
        print('# %s game %s %s at %s  printed %s-%s  goals listed %s-%s  date %s'%(gid,gn,a,h,sv,sl,ng[a],ng[h],F.get('gameDate')))
        if ng[a]==ng[h]: notes.append('%s: game %s equal goals %s-%s, printed %s-%s: shootout or tie, check the picture'%(gid,gn,ng[a],ng[h],sv,sl))
        elif (sv,sl)!=(ng[a],ng[h]): notes.append('%s: game %s printed %s-%s but goals listed %s-%s (empty net? check)'%(gid,gn,sv,sl,ng[a],ng[h]))
        if aff: notes.append('%s: affiliated players %s'%(gid,aff))
        d=F.get('gameDate','')[:10]
        print(' dict(id=%d, date=%r, a=%r, h=%r, s=(%s,%s), so=%s, fp={%r:%s,%r:%s}, url="https://pdf.play.spordle.com/game/%s",'%(gn,d,a,h,sv,sl,'False',a,F.get('fairPlayVis','1'),h,F.get('fairPlayLoc','1'),gid))
        print('  ros=%r,'%ros); print('  gl=%r,'%gl); print('  goals=%r,'%goals); print('  pens=%r,'%pens); print('  goalies=%r, pp={%r:%d,%r:%d}),'%(goalies,a,pp('PPVis'),h,pp('PPLoc')))
    for n in notes: print('NOTE',n,file=sys.stderr)
if __name__=='__main__': main(sys.argv[1])
