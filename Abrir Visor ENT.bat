@echo off
REM ============================================================================
REM Abrir Visor ENT EpiSIG (modo desarrollo)
REM
REM Doble click sobre este archivo:
REM   1. Cambia al directorio webapp-react/
REM   2. Lanza el navegador apuntando a http://localhost:8080
REM   3. Arranca Vite (npm run dev) en esta ventana
REM
REM Para detener el server: Ctrl+C o cerrar esta ventana.
REM
REM Si no aparece el visor: revisa que Node.js este instalado (node --version)
REM y que en webapp-react/ exista node_modules/ (si no, corre `npm install`).
REM ============================================================================

title Visor ENT EpiSIG (dev server)
echo.
echo ============================================
echo  EpiSIG . Visor ENT . Modo desarrollo
echo  URL: http://localhost:8080
echo ============================================
echo.

cd /d "%~dp0webapp-react"

if not exist "node_modules\" (
    echo [!] node_modules no existe. Corriendo npm install...
    call npm install
    echo.
)

REM Abrir navegador despues de un pequeno delay para que Vite arranque
start "" /b cmd /c "timeout /t 3 /nobreak >nul && start """" http://localhost:8080"

call npm run dev

echo.
echo Servidor detenido. Pulsa cualquier tecla para cerrar...
pause >nul
