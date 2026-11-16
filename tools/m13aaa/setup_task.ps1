# One-time setup: Windows Task Scheduler runs run_nightly.bat
#  - every day at 9:30 PM (the M11 BB task runs at 8:45 PM, so the two never open the browser together)
#  - and 10 minutes after you sign in (catches up when the PC was off at 9:30 PM)
# A run missed because the PC was asleep or off starts as soon as it is back on.
# Run once:  powershell -ExecutionPolicy Bypass -File setup_task.ps1
$dir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$action = New-ScheduledTaskAction -Execute (Join-Path $dir 'run_nightly.bat') -WorkingDirectory $dir
$daily  = New-ScheduledTaskTrigger -Daily -At '21:30'
$logon  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$logon.Delay = 'PT10M'
$set    = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun:$false -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'M13AAA game sheets' -Action $action -Trigger $daily,$logon -Settings $set -Force | Out-Null
Write-Host "Done. Task 'M13AAA game sheets' runs daily at 9:30 PM and 10 minutes after sign-in."
Write-Host "Log: $dir\nightly_log.txt"
