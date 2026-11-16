#!/usr/bin/env python3
"""Download Spordle game sheets (PDF) for a list of gamesheet IDs.

Usage (Windows, Mac or Linux, Python 3.8+, nothing to install):
    python get_sheets.py ids.txt      sheets listed in ids.txt
    python get_sheets.py --auto       sheets the site is still missing (no list to keep)

--auto reads the site's own data from GitHub (M11BB/data.js and
tools/m11bb/games.csv), finds every game dated today or earlier that has no
score on the site yet, and fetches those sheets. A sheet fetched too early
(game not finished) is simply fetched again on the next run.

ids.txt: one gamesheet ID per line, for example
    929122
    929120
    929121   # anything after # is ignored

Each sheet is saved as sheets/<id>.pdf next to this script.
A sheet that already exists is skipped.

If Spordle refuses the direct download (its "are you human" check), the script
does not try to get past it. It opens each sheet in your normal browser
instead, one at a time, and watches your Downloads folder: any new PDF is
moved to sheets/<id>.pdf.

To make that step automatic, tell your browser to download PDFs instead of
showing them (one-time setting):
  Chrome:  Settings > Privacy and security > Site settings >
           Additional content settings > PDF documents > Download PDFs
  Edge:    Settings > Cookies and site permissions > PDF documents >
           Always download PDF files
  Firefox: Settings > General > Applications > PDF > Save File
With that on, you only act when the browser shows the human check.
"""
import os, sys, time, glob, shutil, webbrowser, urllib.request, urllib.error

URL = "https://pdf.play.spordle.com/game/{id}?locale=fr"
RAW = "https://raw.githubusercontent.com/carz25/hockeymtl/main/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "sheets")
DOWNLOADS = os.path.join(os.path.expanduser("~"), "Downloads")
WAIT_SECONDS = 180          # how long to wait for you to save one sheet by hand


def read_ids(path):
    ids = []
    for line in open(path, encoding="utf-8-sig"):
        line = line.split("#")[0].strip()
        if line:
            if not line.isdigit():
                sys.exit("Not a gamesheet ID: %r" % line)
            ids.append(line)
    return ids


def auto_ids():
    """Gamesheet IDs of games dated today or earlier with no score on the site."""
    import csv, io, json, datetime
    get = lambda path: urllib.request.urlopen(RAW + path, timeout=30).read().decode("utf-8-sig")
    sheet = {int(r["game_number"].split("-")[1]): r["gamesheet_id"]
             for r in csv.DictReader(io.StringIO(get("tools/m11bb/games.csv")))}
    src = get("M11BB/data.js")
    block = src[src.index("var SCHED = ["):]
    block = block[:block.index("\n];")]
    today = datetime.date.today().isoformat()
    ids = []
    for line in block.split("\n")[1:]:
        line = line.strip().rstrip(",")
        if not line:
            continue
        row = json.loads(line)
        if len(row) == 6 and row[3] != "TBD" and row[1] <= today and row[0] in sheet:
            print("  game %d (%s, %s at %s) has no score yet" % (row[0], row[1], row[4], row[5]))
            ids.append(sheet[row[0]])
    return ids


def try_download(gid, dest):
    """Plain download. Returns True when a real PDF was saved."""
    req = urllib.request.Request(URL.format(id=gid), headers={"Accept": "application/pdf"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        print("  %s: server answered %d" % (gid, e.code))
        return False
    except Exception as e:
        print("  %s: could not connect (%s)" % (gid, e))
        return False
    if not data.startswith(b"%PDF"):
        print("  %s: got a web page, not a PDF (probably the human check)" % gid)
        return False
    with open(dest, "wb") as f:
        f.write(data)
    return True


def pdfs_in_downloads():
    return {p: os.path.getmtime(p) for p in glob.glob(os.path.join(DOWNLOADS, "*.pdf"))}


def by_hand(gid, dest):
    """Open the sheet in the normal browser and wait for a new PDF in Downloads."""
    before = pdfs_in_downloads()
    print("  %s: opening it in your browser. Pass the check if asked. If the PDF shows" % gid)
    print("      instead of downloading, save it (Ctrl+S) into your Downloads folder.")
    webbrowser.open(URL.format(id=gid))
    end = time.time() + WAIT_SECONDS
    while time.time() < end:
        time.sleep(2)
        now = pdfs_in_downloads()
        new = [p for p, t in now.items() if p not in before or t > before[p]]
        new = [p for p in new if not p.endswith(".crdownload") and os.path.getsize(p) > 0]
        if new:
            time.sleep(1)  # let the browser finish writing
            shutil.move(max(new, key=os.path.getmtime), dest)
            return True
    print("  %s: nothing saved after %d seconds, skipped" % (gid, WAIT_SECONDS))
    return False


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    auto = sys.argv[1] == "--auto"
    ids = auto_ids() if auto else read_ids(sys.argv[1])
    if not ids:
        print("Nothing to fetch.")
        return
    got, missing = [], []
    direct = True   # stop trying direct downloads after the first refusal
    for gid in ids:
        dest = os.path.join(OUT, gid + ".pdf")
        if os.path.exists(dest) and auto:
            os.remove(dest)   # still unscored on the site: the earlier copy was too early
        if os.path.exists(dest):
            print("  %s: already have it" % gid)
            got.append(gid)
            continue
        ok = direct and try_download(gid, dest)
        if direct and not ok:
            direct = False
            print("  direct download refused, using your browser for the rest")
        if ok or by_hand(gid, dest):
            print("  %s: saved %s" % (gid, dest))
            got.append(gid)
        else:
            missing.append(gid)
        time.sleep(2)  # be gentle with the server
    print("\nDone: %d saved, %d missing %s" % (len(got), len(missing), " ".join(missing)))
    print("Sheets folder: " + OUT)


if __name__ == "__main__":
    main()
