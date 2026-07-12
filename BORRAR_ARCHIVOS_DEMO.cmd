@echo off
setlocal
cd /d "%~dp0"
if exist classes rmdir /s /q classes
if exist assets\quiz-demo-statistics.svg del /q assets\quiz-demo-statistics.svg
if exist ACTUALIZACION_v0.24.305.md del /q ACTUALIZACION_v0.24.305.md
if exist SUPABASE_MIGRATION_v0.24.305.sql del /q SUPABASE_MIGRATION_v0.24.305.sql
echo Contenido demo anterior eliminado.
pause
