
/**
 * Minimal yt‑dlp wrapper API (Node 18‑plus)
 *   GET /info?url=<youtubeURL>      → JSON of filtered formats
 *   GET /download?url=<youtubeURL>&itag=<itag>  →  streams media
 *
 * Deploy:
 *   1. Create new repo, add this file + package.json (see below)
 *   2. Push to Render/Fly/Railway.  They detect Node app automatically.
 *   3. Set ALLOW_ORIGIN env var (default '*') if you want stricter CORS.
 */
import express from 'express';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';

const exec = promisify(execFile);
const app  = express();
const CORS = process.env.ALLOW_ORIGIN || '*';

app.use((_,res,next)=>{res.set('Access-Control-Allow-Origin',CORS);next();});

app.get('/info', async (req,res)=>{
  const {url} = req.query;
  if(!url) return res.status(400).send('Missing url');
  try{
    const {stdout} = await exec('yt-dlp', ['-J', url]);
    const j = JSON.parse(stdout);
    const formats = (j.formats||[]).filter(f=>f.url).map(f=>({
      itag:    f.format_id,
      type:    f.vcodec==='none' ? 'Audio' : 'Video',
      quality: f.vcodec==='none' ? `${f.abr||'?'} kbps` : (f.format_note||`${f.height}p`),
      size:    f.filesize||0,
      ext:     f.ext,
      source:  url
    }));
    res.json({title:j.title, formats});
  }catch(e){
    res.status(500).send('yt‑dlp failed: '+e.message);
  }
});

app.get('/download', (req,res)=>{
  const {url, itag} = req.query;
  if(!url||!itag) return res.status(400).send('Missing url or itag');
  res.set('Access-Control-Allow-Origin', CORS);
  res.setHeader('Content-Disposition','attachment');
  const child = execFile('yt-dlp', ['-f', itag, '-o', '-', url]);
  child.stdout.pipe(res);
  child.stderr.on('data', d=>console.error(d.toString()));
});

app.listen(process.env.PORT||3000, ()=>console.log('yt-dlp API up'));

/*
  package.json  (add to repo)
  {
    "name": "yt-dlp-api",
    "type": "module",
    "scripts": { "start": "node server.js" },
    "dependencies": { "express": "^4.19.2" }
  }

  Dockerfile (optional)
  FROM node:18-slim
  RUN apt-get update && apt-get install -y yt-dlp && rm -rf /var/lib/apt/lists/*
  WORKDIR /app
  COPY package*.json ./
  RUN npm i --omit=dev
  COPY . .
  EXPOSE 3000
  CMD ["npm","start"]
*/
