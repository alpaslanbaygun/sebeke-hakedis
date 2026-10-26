@echo off
chcp 65001 >nul
setlocal EnableExtensions
rem Sebeke-M AutoCAD eklentisini kaldirir (uc kurulum klasorunden de).
rem   KALDIR.bat            normal
rem   KALDIR.bat /sessiz    soru sormadan, beklemeden (otomatik deneme icin)

set "PF=%ProgramW6432%"
if not defined PF set "PF=%ProgramFiles%"
set "GUVENILIR=%PF%\Autodesk\ApplicationPlugins\SebekeHakedis.bundle"
set "ORTAK=%ProgramData%\Autodesk\ApplicationPlugins\SebekeHakedis.bundle"
set "KULLANICI=%APPDATA%\Autodesk\ApplicationPlugins\SebekeHakedis.bundle"
set "BEKLE=1"
if /i "%~1"=="/sessiz" set "BEKLE="
if /i "%~2"=="/sessiz" set "BEKLE="

if /i "%~1"=="/yonetici" goto :yonetici

if exist "%KULLANICI%" rmdir /s /q "%KULLANICI%"
if not exist "%GUVENILIR%" if not exist "%ORTAK%" goto :bitti

fltmc >nul 2>&1
if errorlevel 1 goto :izinIste
call :yoneticiSil
goto :bitti

:izinIste
echo Windows yonetici izni isteyecek: "Evet" deyin.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $p = Start-Process -FilePath '%~f0' -ArgumentList '/yonetici' -Verb RunAs -Wait -PassThru; exit $p.ExitCode } catch { exit 1223 }"
goto :bitti

:yonetici
call :yoneticiSil
exit /b 0

:yoneticiSil
if exist "%GUVENILIR%" rmdir /s /q "%GUVENILIR%"
if exist "%ORTAK%" rmdir /s /q "%ORTAK%"
exit /b 0

:bitti
if exist "%GUVENILIR%" goto :kaldi
if exist "%ORTAK%" goto :kaldi
if exist "%KULLANICI%" goto :kaldi
echo Sebeke-M eklentisi kaldirildi. AutoCAD'i yeniden baslatin.
if defined BEKLE pause
exit /b 0

:kaldi
echo Eklenti tamamen kaldirilamadi. AutoCAD aciksa kapatip tekrar deneyin;
echo yonetici izni sorulduysa "Evet" deyin.
if defined BEKLE pause
exit /b 1
