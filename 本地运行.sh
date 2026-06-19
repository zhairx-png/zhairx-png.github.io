#!/bin/bash
clear
echo "==================================================="
echo "  白鹤梁水下数字时空博物馆 - 本地极速服务器启动中..."
echo "==================================================="
echo ""
echo "[提示] 现代浏览器限制了直接双击 HTML 文件加载现代 ES 模块。"
echo "       本脚本将自动为您开辟一个安全的本地轻量级 Web 服务器，确保体验无暇。"
echo ""

if command -v node >/dev/null 2>&1; then
    echo "[OK] 检测到已安装 Node.js，正在加载依赖并编译构建生产环境..."
    echo ""
    npm install --no-audit --no-fund
    npm run build
    echo ""
    echo "---------------------------------------------------"
    echo "[成功] 极速服务器已就绪！即将为您在浏览器中打开页面。"
    echo "       如果浏览器没有自动弹出，请手动打开浏览器访问："
    echo "       http://localhost:4173"
    echo "---------------------------------------------------"
    if command -v open >/dev/null 2>&1; then
        open http://localhost:4173
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open http://localhost:4173
    fi
    npm run preview
else
    if command -v python3 >/dev/null 2>&1; then
        echo "[OK] 正在使用 Python3 静态服务器拉起打包后的 dist 目录..."
        if command -v open >/dev/null 2>&1; then
            open http://localhost:8000/dist/
        elif command -v xdg-open >/dev/null 2>&1; then
            xdg-open http://localhost:8000/dist/
        fi
        python3 -m http.server 8000
    elif command -v python >/dev/null 2>&1; then
        echo "[OK] 正在使用 Python 静态服务器拉起打包后的 dist 目录..."
        if command -v open >/dev/null 2>&1; then
            open http://localhost:8000/dist/
        elif command -v xdg-open >/dev/null 2>&1; then
            xdg-open http://localhost:8000/dist/
        fi
        python -m http.server 8000
    else
        echo "[错误] 您的电脑需要安装 Node.js (推荐) 或 Python 才能顺利在本机运行渲染。"
        echo "请前往 https://nodejs.org/ 下载安装最新成熟版本，再重试启动。"
        echo ""
        read -p "按回车键退出..."
    fi
fi
