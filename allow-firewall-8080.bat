@echo off
:: Batch script to unblock Node.js and open port 8080 in Windows Firewall
echo ====================================================================
echo  Configuring Windows Firewall for ProPresenter Web Controller (8080)
echo ====================================================================
echo.

:: Check for Administrative privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script requires Administrator privileges!
    echo Please right-click "allow-firewall-8080.bat" and select "Run as administrator".
    echo.
    pause
    exit /b 1
)

echo [1/3] Setting Network Profile to Private...
powershell -Command "Set-NetConnectionProfile -InterfaceAlias 'Ethernet' -NetworkCategory Private -ErrorAction SilentlyContinue"

echo [2/3] Removing existing blocking rules for Node.js...
powershell -Command "Get-NetFirewallRule -DisplayName '*Node.js*' | Where-Object { $_.Action -eq 'Block' } | Remove-NetFirewallRule -ErrorAction SilentlyContinue"

echo [3/3] Adding Inbound Allow Rule for Port 8080 (TCP)...
powershell -Command "Remove-NetFirewallRule -DisplayName 'ProPresenter Controller (Port 8080)' -ErrorAction SilentlyContinue"
powershell -Command "New-NetFirewallRule -DisplayName 'ProPresenter Controller (Port 8080)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -Profile Any"

echo.
echo ====================================================================
echo [SUCCESS] Port 8080 is now open and accessible from your Wi-Fi!
echo.
echo Access URLs from your mobile phone:
echo   * Web UI:         http://192.168.0.200:8080/pages/index.html?bypass=true
echo   * Stage Monitor:  http://192.168.0.200:8080/stage
echo   * Bible Feeds:    http://192.168.0.200:8080/api/bible/rss?type=verse
echo ====================================================================
echo.
pause
