@echo off
chcp 65001 >nul
setlocal
set "KAYNAK=%~dp0SebekeHakedis.bundle"
set "HEDEF=%APPDATA%\Autodesk\ApplicationPlugins"

if not exist "%KAYNAK%\PackageContents.xml" (
  echo SebekeHakedis.bundle klasoru bulunamadi. Zip dosyasini once bir klasore cikartin.
  pause
  exit /b 1
)

echo Sebeke-M eklentisi kuruluyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-ChildItem -LiteralPath '%KAYNAK%' -Recurse -File | Unblock-File;" ^
  "New-Item -ItemType Directory -Force -Path '%HEDEF%' | Out-Null;" ^
  "if (Test-Path -LiteralPath '%HEDEF%\SebekeHakedis.bundle') { Remove-Item -LiteralPath '%HEDEF%\SebekeHakedis.bundle' -Recurse -Force };" ^
  "Copy-Item -LiteralPath '%KAYNAK%' -Destination '%HEDEF%' -Recurse -Force"

if errorlevel 1 (
  echo Kurulum basarisiz oldu. AutoCAD aciksa kapatip tekrar deneyin.
  pause
  exit /b 1
)

echo.
echo Kuruldu: %HEDEF%\SebekeHakedis.bundle
echo AutoCAD'i kapatip yeniden acin. Seritte "SEBEKE-M" ve "SEBEKE-M ARACLAR" sekmeleri gorunecek.
echo Guvenlik uyarisi cikarsa "Her zaman yukle" (Always Load) secin.
pause
