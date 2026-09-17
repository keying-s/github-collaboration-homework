// 生成单文件版：把所有 JS 模块内联进一个 HTML，双击即可玩（无需本地服务器）
// 用法：node build_single.js
const fs = require('fs');

const FILES = ['js/world.js', 'js/entities.js', 'js/weapons.js', 'js/audio.js', 'js/net.js', 'js/main.js'];

let js = "import * as THREE from 'three';\n\n";
for (const f of FILES) {
  let src = fs.readFileSync(f, 'utf8');
  src = src.replace(/^import[^\n]*\n/gm, '');                       // 去掉 import 行
  src = src.replace(/^export\s+(function|class|const|let)/gm, '$1'); // 去掉 export 关键字
  js += src.trim() + '\n\n';
}

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('<script type="module" src="./js/main.js"></script>',
  '<script type="module">\n' + js + '</script>');
html = html.replace('<title>CLASS STRIKE — 浏览器 CS 风格射击游戏</title>',
  '<title>CLASS STRIKE（单文件版，双击即玩）</title>');

const OUT = '双击即玩-CLASS-STRIKE.html';
fs.writeFileSync(OUT, html);
console.log('已生成 ' + OUT + '（' + (html.length / 1024).toFixed(0) + ' KB）');
