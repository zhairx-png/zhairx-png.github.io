@echo off
title 白鹤梁水下数字时空博物馆 - 本地运行
chcp 65001 >nul
echo ===================================================
echo   白鹤梁水下数字时空博物馆 - 本地极速服务器启动中...
echo ===================================================
echo.
echo [提示] 现代浏览器(Chrome/Edge/Safari/Firefox) 出于安全考虑，
echo        禁止直接通过 "file://" 协议 (双击 html 文件) 加载模块。
echo        本脚本将自动为您启动一个极速、安全的本地轻量级 Web 服务器。
echo.

node -v >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] 检测到已安装 Node.js，正在安装依赖并编译打包应用...
    echo.
    call npm install --no-audit --no-fund
    echo.
    echo 正在进行最终优化构建...
    call npm run build
    echo.
    echo ---------------------------------------------------
    echo [成功] 服务器已就绪！即将自动在您的默认浏览器中打开页面。
    echo 如未自动打开，请手动访问: http://localhost:4173
    echo ---------------------------------------------------
    start http://localhost:4173
    call npm run preview
    goto end
)

python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] 检测到 Python，正在使用 Python 启动极速静态服务器...
    start http://localhost:8000/dist/
    python -m http.server 8000
    goto end
)

python3 --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] 检测到 Python3，正在使用 Python3 启动极速静态服务器...
    start http://localhost:8000/dist/
    python3 -m http.server 8000
    goto end
)

echo [错误] 您的电脑尚未安装 Node.js 运行环境 (React 开发的必需环境)。
echo.
echo 建议解决方案：
echo 1. 前往官方网址：https://nodejs.org/ 并下载安装推荐的 LTSC 版本（无脑点击“下一步”即可）。
echo 2. 安装完成后重新双击运行此脚本。
echo.
pause

:end
