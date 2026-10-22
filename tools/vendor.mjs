// 由 GitHub Actions 執行：把 npm 下載的程式庫複製到 vendor/
import fs from 'node:fs';
import path from 'node:path';
const NM = process.argv[2];
const OUT = path.resolve('vendor');
const copy = (from, to) => {
  const src = path.join(NM, from), dst = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log('copied', from, '->', to, fs.statSync(dst).size);
};
fs.rmSync(OUT, { recursive: true, force: true });
copy('tesseract.js/dist/tesseract.min.js', 'tesseract/tesseract.min.js');
copy('tesseract.js/dist/worker.min.js', 'tesseract/worker.min.js');
for (const f of ['tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js', 'tesseract-core-simd.wasm.js', 'tesseract-core.wasm.js'])
  copy(`tesseract.js-core/${f}`, `tesseract-core/${f}`);
copy('opencc-js/dist/umd/full.js', 'opencc/full.js');
copy('pdfjs-dist/build/pdf.min.js', 'pdfjs/pdf.min.js');
copy('pdfjs-dist/build/pdf.worker.min.js', 'pdfjs/pdf.worker.min.js');
copy('jspdf/dist/jspdf.umd.min.js', 'jspdf/jspdf.umd.min.js');

// 字型：霞鶩文楷 TC（只取 woff2）
const fontPkg = path.join(NM, '@fontsource/lxgw-wenkai-tc');
if (fs.existsSync(fontPkg)) {
  const outDir = path.join(OUT, 'fonts/lxgw');
  fs.mkdirSync(outDir, { recursive: true });
  let css = '';
  for (const w of ['400', '700']) {
    const p = path.join(fontPkg, `${w}.css`);
    if (!fs.existsSync(p)) continue;
    let c = fs.readFileSync(p, 'utf8');
    c = c.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '');
    c = c.replace(/url\(\.\/files\/([^)]+\.woff2)\)/g, (m, f) => {
      fs.copyFileSync(path.join(fontPkg, 'files', f), path.join(outDir, f));
      return `url(lxgw/${f})`;
    });
    css += c + '\n';
  }
  fs.writeFileSync(path.join(OUT, 'fonts/lxgw-wenkai-tc.css'), css);
  console.log('font files', fs.readdirSync(outDir).length);
} else {
  fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'fonts/lxgw-wenkai-tc.css'), '/* 未能下載本機字型，會改用 Google Fonts */\n');
  console.log('font package missing');
}
