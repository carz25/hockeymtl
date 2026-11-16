@echo off
rem Fetches the M11 BB game sheets the site is still missing. Run by Windows Task Scheduler.
cd /d "%~dp0"
python get_sheets.py --auto >> nightly_log.txt 2>&1
