@echo off
chcp 65001 >nul
set "HEDEF=%APPDATA%\Autodesk\ApplicationPlugins\SebekeHakedis.bundle"
if exist "%HEDEF%" (
  rmdir /s /q "%HEDEF%"
  echo Sebeke-M eklentisi kaldirildi. AutoCAD'i yeniden baslatin.
) else (
  echo Eklenti zaten kurulu degil.
)
pause
