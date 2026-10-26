@echo off
chcp 65001 >nul
setlocal EnableExtensions
rem Sebeke-M AutoCAD eklentisi kurulumu.
rem Eklenti AutoCAD'in guvenilir saydigi klasore kurulur: Program Files\Autodesk\ApplicationPlugins.
rem AutoCAD bu klasordeki eklentilerde imza aramaz; "imzalanmamis dosya" guvenlik uyarisi cikmaz.
rem Bunun icin Windows bir kez yonetici izni ister. Izin verilmezse eklenti kullanici klasorune
rem kurulur; o zaman AutoCAD ilk acilista uyari gosterir ("Her zaman yukle" denir).
rem   KUR.bat            normal kurulum
rem   KUR.bat /sessiz    soru sormadan, beklemeden (otomatik deneme icin)

set "KAYNAK=%~dp0SebekeHakedis.bundle"
set "PF=%ProgramW6432%"
if not defined PF set "PF=%ProgramFiles%"
set "GUVENILIR=%PF%\Autodesk\ApplicationPlugins"
set "ORTAK=%ProgramData%\Autodesk\ApplicationPlugins"
set "KULLANICI=%APPDATA%\Autodesk\ApplicationPlugins"
set "BEKLE=1"
if /i "%~1"=="/sessiz" set "BEKLE="
if /i "%~2"=="/sessiz" set "BEKLE="

if not exist "%KAYNAK%\PackageContents.xml" goto :paketYok

rem Yonetici izniyle acilan kopya: guvenilir klasore kurar ve cikar
if /i "%~1"=="/yonetici" goto :yonetici

echo Sebeke-M eklentisi kuruluyor...

rem Zaten yonetici olarak calisiyorsa dogrudan guvenilir klasore kur
fltmc >nul 2>&1
if errorlevel 1 goto :izinIste
call :guvenilireKur
if errorlevel 1 goto :hata
goto :tamam

:izinIste
echo.
echo Windows yonetici izni isteyecek: "Evet" deyin.
echo Boylece eklenti AutoCAD'in guvenilir klasorune kurulur ve guvenlik uyarisi cikmaz.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $p = Start-Process -FilePath '%~f0' -ArgumentList '/yonetici' -Verb RunAs -Wait -PassThru; exit $p.ExitCode } catch { exit 1223 }"
set "SONUC=%errorlevel%"
if "%SONUC%"=="0" if exist "%GUVENILIR%\SebekeHakedis.bundle\PackageContents.xml" goto :tamam
if not "%SONUC%"=="1223" goto :hata

echo.
echo Yonetici izni verilmedi; eklenti kullanici klasorune kuruluyor.
call :kopyala "%KULLANICI%"
if errorlevel 1 goto :hata
echo.
echo Kuruldu: %KULLANICI%\SebekeHakedis.bundle
echo AutoCAD ilk acilista guvenlik uyarisi gosterir; "Her zaman yukle" secin.
echo Uyarinin hic cikmamasi icin KUR.bat'i yeniden calistirip yonetici iznine "Evet" deyin.
goto :son

:yonetici
call :guvenilireKur
exit /b %errorlevel%

:guvenilireKur
call :kopyala "%GUVENILIR%"
if errorlevel 1 exit /b 1
rem Baska klasorlerde kalan eski kopyalar silinir; eklenti iki kez yuklenmesin
call :sil "%ORTAK%"
call :sil "%KULLANICI%"
exit /b 0

:kopyala
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { $ub = [bool](Get-Command Unblock-File -ErrorAction SilentlyContinue); if ($ub) { Get-ChildItem -LiteralPath '%KAYNAK%' -Recurse | Where-Object { -not $_.PSIsContainer } | Unblock-File }; New-Item -ItemType Directory -Force -Path '%~1' | Out-Null; $h = Join-Path '%~1' 'SebekeHakedis.bundle'; if (Test-Path -LiteralPath $h) { Remove-Item -LiteralPath $h -Recurse -Force }; Copy-Item -LiteralPath '%KAYNAK%' -Destination '%~1' -Recurse -Force; if ($ub) { Get-ChildItem -LiteralPath $h -Recurse | Where-Object { -not $_.PSIsContainer } | Unblock-File }; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
exit /b %errorlevel%

:sil
if exist "%~1\SebekeHakedis.bundle" rmdir /s /q "%~1\SebekeHakedis.bundle"
exit /b 0

:tamam
call :sil "%KULLANICI%"
echo.
echo Kuruldu: %GUVENILIR%\SebekeHakedis.bundle
echo AutoCAD bu klasoru guvenilir sayar; guvenlik uyarisi cikmaz.
echo AutoCAD'i kapatip yeniden acin. Seritte "SEBEKE-M" ve "SEBEKE-M ARACLAR" sekmeleri gorunecek.
goto :son

:paketYok
echo SebekeHakedis.bundle klasoru bulunamadi. Zip dosyasini once bir klasore cikartin.
goto :hata

:hata
echo.
echo Kurulum basarisiz oldu. AutoCAD aciksa kapatip tekrar deneyin.
if defined BEKLE pause
exit /b 1

:son
if defined BEKLE pause
exit /b 0
