import express from 'express';
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const blender = process.env.BLENDER_PATH || (process.platform === 'darwin' ? '/Applications/Blender.app/Contents/MacOS/Blender' : 'blender');
const available = () => new Promise(resolve => { const p = spawn(blender, ['--version']); p.once('error', () => resolve(false)); p.once('close', code => resolve(code === 0)); });
app.get('/api/health', async (_, res) => res.json({ blender: await available() }));
let busy = false;
app.post('/api/export', express.raw({ type: 'application/octet-stream', limit: '40mb' }), async (req, res) => {
  if (!['blend', 'fbx'].includes(req.query.format)) return res.status(400).json({ error: '지원하지 않는 형식입니다.' });
  if (!Buffer.isBuffer(req.body) || req.body.length < 12 || req.body.toString('utf8', 0, 4) !== 'glTF') return res.status(400).json({ error: '올바른 GLB 파일이 필요합니다.' });
  if (busy) return res.status(409).json({ error: '다른 파일을 변환 중입니다. 잠시 후 다시 시도해 주세요.' });
  busy = true;
  let dir;
  try {
    dir = await mkdtemp(path.join(tmpdir(), 'avatar-atelier-'));
    const input = path.join(dir, 'avatar.glb'); const output = path.join(dir, `avatar.${req.query.format}`);
    await writeFile(input, req.body);
    await new Promise((resolve, reject) => {
      const proc = spawn(blender, ['--background', '--factory-startup', '--python', path.join(root, 'scripts/convert.py'), '--', input, output]);
      let log = '';
      const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('변환 시간이 초과되었습니다.')); }, 120000);
      proc.stdout.on('data', d => { log = (log + d).slice(-6000); }); proc.stderr.on('data', d => { log = (log + d).slice(-6000); });
      proc.once('error', e => { clearTimeout(timer); reject(new Error(`Blender 실행 실패: ${e.message}`)); });
      proc.once('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(log)); });
    });
    const file = await readFile(output);
    res.set({ 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="avatar.${req.query.format}"` }).send(file);
  } catch (error) { console.error(error.message); res.status(500).json({ error: 'Blender 변환에 실패했습니다. 터미널 로그와 Blender 설치 경로를 확인해 주세요.' }); }
  finally { if (dir) await rm(dir, { recursive: true, force: true }); busy = false; }
});
if (process.env.NODE_ENV === 'production') app.use(express.static(path.join(root, 'dist')));
else { const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' }); app.use(vite.middlewares); }
app.listen(Number(process.env.PORT || 5173), '127.0.0.1', () => console.log('Avatar Atelier → http://127.0.0.1:' + (process.env.PORT || 5173)));
