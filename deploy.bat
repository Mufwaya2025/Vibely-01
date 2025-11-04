@echo off
REM Deploy batch script for Vibely app to henzter server

echo Building frontend...
npm run build

REM Set production environment variables
set NODE_ENV=production

echo Starting server...
npm run server:start