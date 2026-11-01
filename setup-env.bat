@echo off
title Setting the ProPresenter Remote Control project environmental variable
:: ==============================================================================
:: ProPresenter Web Studio Controller - Environment Variables Setup
:: Uses setx to permanently save Cloudflare D1 credentials in Windows User Scope
:: ==============================================================================

echo Setting the ProPresenter Remote Control project environmental variable...
echo.

setx CLOUDFLARE_ACCOUNT_ID "0b1c76e5e6b514a1bd0ef28aa0a348f5"
setx CLOUDFLARE_DATABASE_ID "12c25273-ebbf-4206-b075-fbfbaca83de5"
setx CLOUDFLARE_API_TOKEN "your_cloudflare_api_token_here"

echo.
echo ==============================================================================
echo [SUCCESS] Environment variables set permanently in Windows User scope!
echo.
echo   * CLOUDFLARE_ACCOUNT_ID = 0b1c76e5e6b514a1bd0ef28aa0a348f5
echo   * CLOUDFLARE_DATABASE_ID = 12c25273-ebbf-4206-b075-fbfbaca83de5
echo   * CLOUDFLARE_API_TOKEN  = your_cloudflare_api_token_here
echo.
echo NOTE: Restart your CMD or PowerShell window for the changes to take effect.
echo ==============================================================================
echo.
pause
