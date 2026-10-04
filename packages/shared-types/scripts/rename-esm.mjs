// Đổi tên file ESM từ .js -> .mjs để Node nhận đúng module type,
// rồi ghi package.json exports trỏ đúng vào hai bản build.
import {
  readdirSync,
  renameSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  mkdirSync,
  cpSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const esmDir = join(root, 'dist-esm');
const outDir = join(root, 'dist');

// 1) Đổi .js -> .mjs trong dist-esm
if (existsSync(esmDir)) {
  for (const file of readdirSync(esmDir)) {
    if (file.endsWith('.js')) {
      renameSync(join(esmDir, file), join(esmDir, file.replace(/\.js$/, '.mjs')));
    }
  }

  // 2) Gộp ESM vào dist/esm
  const target = join(outDir, 'esm');
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(esmDir, target, { recursive: true });
  rmSync(esmDir, { recursive: true, force: true });
}

// 3) Cập nhật exports trong package.json
const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.main = './dist/index.js';
pkg.module = './dist/esm/index.mjs';
pkg.types = './dist/index.d.ts';
pkg.exports = {
  '.': {
    types: './dist/index.d.ts',
    import: './dist/esm/index.mjs',
    require: './dist/index.js',
  },
};
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log('[shared-types] build hoàn tất: CJS -> dist/, ESM -> dist/esm/');
