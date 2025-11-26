import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Configuration
const allowedOrigins = [
  'https://yt-video-downloader-lilac.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log('Blocked origin:', origin);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.send('YouTube Downloader Backend is running!');
});

// API Root route
app.get('/api/', (req, res) => {
  res.json({ 
    message: 'YouTube Downloader API', 
    endpoints: ['/api/video-info', '/api/download', '/api/health'] 
  });
});

const TEMP_DIR = path.join(__dirname, 'temp');

async function ensureTempDir() {
  try {
    await fs.access(TEMP_DIR);
  } catch {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  }
}

function isValidYouTubeUrl(url) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/;
  return youtubeRegex.test(url);
}

async function cleanupOldFiles() {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = await fs.stat(filePath);
      if (now - stats.mtime.getTime() > 60 * 60 * 1000) {
        await fs.unlink(filePath);
      }
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Get video info endpoint
app.post('/api/video-info', async (req, res) => {
  try {
    const { url } = req.body;
    console.log('Received video info request for:', url);

    if (!url || !isValidYouTubeUrl(url)) {
      return res.status(400).json({ 
        error: 'Invalid YouTube URL provided' 
      });
    }

    // Get video information using yt-dlp
    // Using Android client to bypass "Sign in to confirm you're not a bot"
    const ytDlp = spawn('yt-dlp', [
      '--dump-json',
      '--no-download',
      '--no-check-certificates',
      '--geo-bypass',
      '--extractor-args', 'youtube:player_client=android',
      '--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
      url
    ]);

    let videoInfo = '';
    let errorOutput = '';

    ytDlp.stdout.on('data', (data) => {
      videoInfo += data.toString();
    });

    ytDlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytDlp.on('error', (err) => {
      console.error('Failed to start yt-dlp process:', err);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Failed to execute video processor',
          details: err.message
        });
      }
    });

    ytDlp.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp error output:', errorOutput);
        if (!res.headersSent) {
          return res.status(400).json({ 
            error: 'Failed to fetch video information',
            details: errorOutput || 'Unknown yt-dlp error'
          });
        }
        return;
      }

      try {
        const info = JSON.parse(videoInfo);
        if (!res.headersSent) {
          res.json({
            title: info.title,
            duration: info.duration,
            thumbnail: info.thumbnail,
            uploader: info.uploader,
            view_count: info.view_count
          });
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Failed to parse video information',
            details: parseError.message
          });
        }
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// Download video endpoint
app.get('/api/download', async (req, res) => {
  try {
    const { url, quality = 'best' } = req.query;

    if (!url || !isValidYouTubeUrl(url)) {
      return res.status(400).json({ 
        error: 'Invalid YouTube URL provided' 
      });
    }

    let formatSelector;
    switch (quality) {
      case '4k': formatSelector = 'bestvideo[height<=2160]+bestaudio/best[height<=2160]'; break;
      case '1080p': formatSelector = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]'; break;
      case '720p': formatSelector = 'bestvideo[height<=720]+bestaudio/best[height<=720]'; break;
      default: formatSelector = 'bestvideo+bestaudio/best';
    }

    const infoProcess = spawn('yt-dlp', [
      '--get-title',
      '--extractor-args', 'youtube:player_client=android',
      '--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
      url
    ]);
    
    let title = 'video';
    
    infoProcess.stdout.on('data', (data) => {
      title = data.toString().trim().replace(/[^a-zA-Z0-9]/g, '_');
    });

    infoProcess.on('close', (code) => {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);

      const ytDlp = spawn('yt-dlp', [
        '-f', formatSelector,
        '-o', '-',
        '--no-check-certificates',
        '--geo-bypass',
        '--extractor-args', 'youtube:player_client=android',
        '--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
        url
      ]);

      ytDlp.stdout.pipe(res);
      
      ytDlp.on('close', (code) => {
        if (code !== 0) {
          console.error('yt-dlp download error');
          res.end();
        }
      });

      req.on('close', () => {
        ytDlp.kill();
      });
    });

  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
  await ensureTempDir();
  console.log(` YouTube Downloader API running on port ${PORT}`);
  setInterval(cleanupOldFiles, 60 * 60 * 1000);
});

process.on('SIGTERM', () => { process.exit(0); });
process.on('SIGINT', () => { process.exit(0); });
