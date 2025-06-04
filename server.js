/**
 * yt-dlp wrapper API with cookie + UA support
 * ------------------------------------------
 *   GET /info?url=...        → JSON formats
 *   GET /download?url=...&itag=...  → media stream
 */

import express      from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs           from 'node:fs';

const exec  = promisify(execFile);
const app   = express();

const CORS         = process.env.ALLOW_ORIGIN || '*';
const COOKIE_PATH  = process.env.COOKIE_PATH  || './cookies.txt';
const USER_AGENT   = process.env.USER_AGENT   ||
                     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const YTDLP_BASE   = [
  'yt-dlp',
  '--cookies', COOKIE_PATH,        // attach cookies
  '--user-agent', USER_AGENT,      // look like a real browser
  '--no-check-certificate'         // avoid cert errors on some hosts
];

// make sure cookies file exists (optional hard-fail)
if (!fs.existsSync(COOKIE_PATH)) {
  console.warn(`⚠️  COOKIE file not found at ${COOKIE_PATH}. Continuing without cookies may hit 429.`);
}

app.use((_, res, next) => {
  res.set('Access-Control-Allow-Origin', CORS);
  next();
});

// ---------------------------  /info  ---------------------------------
app.get('/info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');

  try {
    const { stdout } = await exec(
      YTDLP_BASE[0],
      [...YTDLP_BASE.slice(1), '-J', url]           // spread base args + -J
    );

    const j = JSON.parse(stdout);
    const formats = (j.formats || [])
      .filter(f => f.url)
      .map(f => ({
        itag:    f.format_id,
        type:    f.vcodec === 'none' ? 'Audio' : 'Video',
        quality: f.vcodec === 'none'
                  ? `${f.abr || '?'} kbps`
                  : (f.format_note || `${f.height}p`),
        size:    f.filesize || 0,
        ext:     f.ext,
        source:  url
      }));

    res.json({ title: j.title, formats });
  } catch (e) {
    console.error(e.stderr ?? e.message);
    res.status(500).send('yt-dlp failed: ' + e.message);
  }
});

// -------------------------  /download  -------------------------------
app.get('/download', (req, res) => {
  const { url, itag } = req.query;
  if (!url || !itag) return res.status(400).send('Missing url or itag');

  res.setHeader('Access-Control-Allow-Origin', CORS);
  res.setHeader('Content-Disposition', 'attachment');

  const child = execFile(
    YTDLP_BASE[0],
    [...YTDLP_BASE.slice(1), '-f', itag, '-o', '-', url]
  );

  child.stdout.pipe(res);
  child.stderr.on('data', d => console.error(d.toString()));
});

app.listen(process.env.PORT || 3000,
  () => console.log('yt-dlp API up on port', process.env.PORT || 3000));
