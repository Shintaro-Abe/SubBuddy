#!/usr/bin/env node
// md2guide.mjs — 手順書MD → 単一HTML（オフライン・コピーボタン付き）変換器
// 依存ゼロ（Node 標準のみ）。
//
// 使い方:
//   node md2guide.mjs <input.md> [output.html]
//   出力省略時は <input>.html（同じ場所・同名）。
//
// 変換規約（SKILL.md と一致させること）:
//   - ```bash / ```sh / ```shell / ```zsh / ```console フェンス1つ = コピー単位（1ボタン=1シェル実行）。
//   - それ以外の言語のフェンス（```json 等）= 表示のみ（コピー不可）。
//   - 番号付きリスト（1. 2. ...）= GUI手順（コピー不可）。
//   - 引用 `> ⚠ ...` = ミス注意 callout、`> ✅ ...` = 確認 callout。
//   - 見出し / 箇条書き / 表(GFM) / 水平線 / 段落 / インライン（`code` **bold** [link](url)）に対応。

import { readFileSync, writeFileSync } from 'node:fs';

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'console']);

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// インライン記法: `code` **bold** [text](url)
function inline(src) {
  const codes = [];
  // 先にインラインコードを退避（中の記号を無効化）
  let s = src.replace(/`([^`]+)`/g, (_m, p1) => {
    codes.push(p1);
    return `@@CODE${codes.length - 1}@@`;
  });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, t, u) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/@@CODE(\d+)@@/g, (_m, i) => `<code>${escapeHtml(codes[+i])}</code>`);
  return s;
}

function isTableSep(line) {
  return /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('-');
}
function splitRow(line) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

function parse(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let title = '';

  const flushPara = (buf) => {
    if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
    return [];
  };

  let para = [];

  while (i < lines.length) {
    const line = lines[i];

    // コードフェンス
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      para = flushPara(para);
      const lang = (fence[1] || '').toLowerCase();
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // 閉じフェンスを飛ばす
      const code = escapeHtml(body.join('\n'));
      if (SHELL_LANGS.has(lang)) {
        out.push(
          `<div class="cmd"><button class="copy" type="button">コピー</button>` +
          `<pre><code>${code}</code></pre></div>`
        );
      } else {
        out.push(`<pre class="plain"><code>${code}</code></pre>`);
      }
      continue;
    }

    // 見出し
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      para = flushPara(para);
      const level = h[1].length;
      const text = inline(h[2].trim());
      if (level === 1 && !title) title = h[2].trim();
      out.push(`<h${level}>${text}</h${level}>`);
      i++;
      continue;
    }

    // 水平線
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      para = flushPara(para);
      out.push('<hr>');
      i++;
      continue;
    }

    // 引用（callout）
    if (/^>\s?/.test(line)) {
      para = flushPara(para);
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        q.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const text = q.join('\n').trim();
      let cls = 'note';
      let stripped = text;
      if (/^⚠/.test(text)) { cls = 'warn'; stripped = text.replace(/^⚠\s*/, ''); }
      else if (/^✅/.test(text)) { cls = 'ok'; stripped = text.replace(/^✅\s*/, ''); }
      const html = stripped.split(/\n{2,}/).map((p) => `<p>${inline(p.replace(/\n/g, ' '))}</p>`).join('');
      out.push(`<div class="callout ${cls}">${html}</div>`);
      continue;
    }

    // 表（GFM）
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      para = flushPara(para);
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map((r) =>
        `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // 番号付きリスト = GUI手順
    if (/^\s*\d+\.\s+/.test(line)) {
      para = flushPara(para);
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push(`<ol class="gui">${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ol>`);
      continue;
    }

    // 箇条書き
    if (/^\s*[-*]\s+/.test(line)) {
      para = flushPara(para);
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`);
      continue;
    }

    // 空行 = 段落区切り
    if (line.trim() === '') {
      para = flushPara(para);
      i++;
      continue;
    }

    // 段落本文
    para.push(line.trim());
    i++;
  }
  flushPara(para);
  return { body: out.join('\n'), title: title || '手順書' };
}

const CSS = `
:root{
  --bg:#f7f6f1; --surface:#fffdf8; --ink:#2c2e2a; --muted:#6b6f66;
  --line:#e3e0d6; --accent:#4a5d4e; --accent-soft:#eef1ea;
  --warn-bg:#fbf1e8; --warn-line:#c8744f; --ok-bg:#eef3ec; --ok-line:#4a7a55;
  --code-bg:#23261f; --code-ink:#eef0e8;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic UI",Meiryo,sans-serif;
  line-height:1.8;font-size:16px}
.wrap{max-width:760px;margin:0 auto;padding:48px 24px 96px}
h1,h2,h3,h4{font-family:Georgia,"Times New Roman","Hiragino Mincho ProN",serif;
  line-height:1.4;font-weight:600;color:var(--ink)}
h1{font-size:30px;margin:0 0 8px;border-bottom:1px solid var(--line);padding-bottom:16px}
h2{font-size:22px;margin:40px 0 12px}
h3{font-size:18px;margin:28px 0 8px}
p{margin:10px 0}
a{color:var(--accent);text-underline-offset:2px}
hr{border:0;border-top:1px solid var(--line);margin:32px 0}
ul,ol{margin:10px 0;padding-left:24px}
li{margin:6px 0}
ol.gui{counter-reset:gui;list-style:none;padding-left:0}
ol.gui>li{counter-increment:gui;position:relative;padding:8px 8px 8px 44px;margin:6px 0;
  background:var(--surface);border:1px solid var(--line);border-radius:8px}
ol.gui>li::before{content:counter(gui);position:absolute;left:10px;top:8px;
  width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;
  font-size:13px;display:flex;align-items:center;justify-content:center;font-family:sans-serif}
code{background:var(--accent-soft);padding:1px 6px;border-radius:4px;font-size:90%;
  font-family:"SF Mono",Consolas,"DejaVu Sans Mono",monospace}
.cmd{position:relative;margin:12px 0}
.cmd pre{margin:0;background:var(--code-bg);color:var(--code-ink);border-radius:10px;
  padding:16px 18px;overflow-x:auto}
.cmd pre code{background:none;color:inherit;padding:0;font-size:13.5px;line-height:1.7}
pre.plain{background:#eceae2;border:1px solid var(--line);border-radius:10px;
  padding:14px 16px;overflow-x:auto;margin:12px 0}
pre.plain code{background:none;padding:0;font-size:13px}
.copy{position:absolute;top:10px;right:10px;border:0;cursor:pointer;
  background:rgba(255,255,255,.14);color:#fff;font-size:12px;padding:5px 12px;
  border-radius:6px;font-family:sans-serif;transition:background .15s}
.copy:hover{background:rgba(255,255,255,.26)}
.copy.done{background:var(--ok-line);color:#fff}
.callout{margin:14px 0;padding:12px 16px;border-radius:8px;border-left:4px solid}
.callout p{margin:4px 0}
.callout.warn{background:var(--warn-bg);border-color:var(--warn-line)}
.callout.warn::before{content:"⚠ ミスしやすい点";display:block;font-weight:700;
  font-size:13px;color:var(--warn-line);margin-bottom:2px}
.callout.ok{background:var(--ok-bg);border-color:var(--ok-line)}
.callout.ok::before{content:"✅ 確認";display:block;font-weight:700;
  font-size:13px;color:var(--ok-line);margin-bottom:2px}
.callout.note{background:var(--accent-soft);border-color:var(--accent)}
table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
th{background:var(--accent-soft);font-weight:600}
`;

const JS = `
document.querySelectorAll('.cmd .copy').forEach(function(btn){
  btn.addEventListener('click',function(){
    var code=btn.parentElement.querySelector('code').textContent;
    function done(){
      var old=btn.dataset.label||btn.textContent;
      btn.dataset.label=old;btn.textContent='コピーした✓';btn.classList.add('done');
      setTimeout(function(){btn.textContent=old;btn.classList.remove('done');},1500);
    }
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(code).then(done).catch(fallback);
    }else{fallback();}
    function fallback(){
      var ta=document.createElement('textarea');ta.value=code;
      ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);
      ta.select();try{document.execCommand('copy');}catch(e){}ta.remove();done();
    }
  });
});
`;

function render(body, title) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<main class="wrap">
${body}
</main>
<script>${JS}</script>
</body>
</html>
`;
}

// --- entry ---
const input = process.argv[2];
if (!input) {
  console.error('使い方: node md2guide.mjs <input.md> [output.html]');
  process.exit(1);
}
const output = process.argv[3] || input.replace(/\.md$/i, '') + '.html';
const md = readFileSync(input, 'utf8');
const { body, title } = parse(md);
writeFileSync(output, render(body, title));
console.log(`生成: ${output}`);
