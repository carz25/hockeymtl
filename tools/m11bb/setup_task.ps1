# One-time setup: Windows Task Scheduler runs run_nightly.bat
#  - every day at 8:45 PM
#  - and 5 minutes after you sign in (catches up when the PC was off at 8:45 PM)
# A run missed because the PC was asleep or off starts as soon as it is back on.
# Run once:  powershell -ExecutionPolicy Bypass -File setup_task.ps1
$dir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$action = New-ScheduledTaskAction -Execute (Join-Path $dir 'run_nightly.bat') -WorkingDirectory $dir
$daily  = New-ScheduledTaskTrigger -Daily -At '20:45'
$logon  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$logon.Delay = 'PT5M'
$set    = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun:$false -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'M11BB game sheets' -Action $action -Trigger $daily,$logon -Settings $set -Force | Out-Null
Write-Host "Done. Task 'M11BB game sheets' runs daily at 8:45 PM and 5 minutes after sign-in."
Write-Host "Log: $dir\nightly_log.txt"
