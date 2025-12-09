import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Configuration - Updated
const allowedOrigins = [
  'https://yt-video-downloader-lilac.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://your-frontend-domain.com' // Add your actual frontend domain
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Handle preflight requests
app.options('*', cors());

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
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[\w-]+/;
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

// Get video info endpoint - UPDATED WITH COOKIES
app.post('/api/video-info', async (req, res) => {
  try {
    const { url } = req.body;
    console.log('Received video info request for:', url);

    if (!url || !isValidYouTubeUrl(url)) {
      return res.status(400).json({ 
        error: 'Invalid YouTube URL provided' 
      });
    }

    // Enhanced yt-dlp command with cookies and headers
    const ytDlpArgs = [
      '--dump-json',
      '--no-download',
      '--no-check-certificates',
      '--geo-bypass',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--referer', 'https://www.youtube.com/',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--add-header', 'Accept:application/json, text/plain, */*',
      '--extractor-args', 'youtube:player_client=web',
      url
    ];

    // Try to use cookies if available (you'll need to provide these)
    const cookiesPath = process.env.COOKIES_PATH;
    if (cookiesPath) {
      ytDlpArgs.unshift('--cookies', cookiesPath);
    }

    const ytDlp = spawn('yt-dlp', ytDlpArgs);

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
        
        // Try alternative method without cookies
        if (errorOutput.includes('Sign in to confirm')) {
          console.log('Trying alternative extraction method...');
          
          const fallbackArgs = [
            '--dump-json',
            '--no-download',
            '--extractor-args', 'youtube:player_client=android,web',
            '--user-agent', 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            url
          ];
          
          const fallbackProcess = spawn('yt-dlp', fallbackArgs);
          let fallbackInfo = '';
          let fallbackError = '';
          
          fallbackProcess.stdout.on('data', (data) => {
            fallbackInfo += data.toString();
          });
          
          fallbackProcess.stderr.on('data', (data) => {
            fallbackError += data.toString();
          });
          
          fallbackProcess.on('close', (fallbackCode) => {
            if (fallbackCode === 0) {
              try {
                const info = JSON.parse(fallbackInfo);
                return res.json({
                  title: info.title,
                  duration: info.duration,
                  thumbnail: info.thumbnail,
                  uploader: info.uploader,
                  view_count: info.view_count,
                  formats: info.formats
                });
              } catch (parseError) {
                return res.status(500).json({ 
                  error: 'Failed to parse video information',
                  details: parseError.message
                });
              }
            } else {
              return res.status(400).json({ 
                error: 'YouTube requires authentication',
                details: 'Please try a different video or use cookies for authentication'
              });
            }
          });
          
          return;
        }
        
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
            view_count: info.view_count,
            formats: info.formats
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

// Download video endpoint - UPDATED
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
      case '480p': formatSelector = 'bestvideo[height<=480]+bestaudio/best[height<=480]'; break;
      case '360p': formatSelector = 'bestvideo[height<=360]+bestaudio/best[height<=360]'; break;
      default: formatSelector = 'best';
    }

    // Get video title for filename
    const titleProcess = spawn('yt-dlp', [
      '--get-title',
      '--no-check-certificates',
      url
    ]);
    
    let title = 'youtube_video';
    
    titleProcess.stdout.on('data', (data) => {
      const rawTitle = data.toString().trim();
      // Clean title for filename
      title = rawTitle
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 100);
    });

    titleProcess.on('close', () => {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
      res.setHeader('Cache-Control', 'no-cache');

      // Enhanced download arguments
      const downloadArgs = [
        '-f', formatSelector,
        '-o', '-',
        '--no-check-certificates',
        '--geo-bypass',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--referer', 'https://www.youtube.com/',
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--extractor-args', 'youtube:player_client=web'
      ];

      // Add cookies if available
      if (process.env.COOKIES_PATH) {
        downloadArgs.unshift('--cookies', process.env.COOKIES_PATH);
      }

      downloadArgs.push(url);

      const ytDlp = spawn('yt-dlp', downloadArgs);

      ytDlp.stdout.pipe(res);
      
      ytDlp.stderr.on('data', (data) => {
        console.error('Download error:', data.toString());
      });

      ytDlp.on('close', (code) => {
        if (code !== 0 && !res.headersSent) {
          console.error('yt-dlp download failed with code:', code);
          res.status(500).json({ error: 'Download failed' });
        }
        res.end();
      });

      req.on('close', () => {
        ytDlp.kill();
      });
    });

    titleProcess.on('error', (err) => {
      console.error('Title fetch error:', err);
      if (!res.headersSent) {
        // Continue with default title
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename="youtube_video.mp4"');
        
        const ytDlp = spawn('yt-dlp', [
          '-f', formatSelector,
          '-o', '-',
          '--no-check-certificates',
          url
        ]);
        
        ytDlp.stdout.pipe(res);
        
        ytDlp.on('close', () => {
          res.end();
        });
        
        req.on('close', () => {
          ytDlp.kill();
        });
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }
});

// New endpoint to list available formats
app.post('/api/formats', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !isValidYouTubeUrl(url)) {
      return res.status(400).json({ 
        error: 'Invalid YouTube URL provided' 
      });
    }

    const ytDlp = spawn('yt-dlp', [
      '--list-formats',
      '--no-check-certificates',
      url
    ]);

    let output = '';
    let errorOutput = '';

    ytDlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytDlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytDlp.on('close', (code) => {
      if (code !== 0) {
        return res.status(400).json({ 
          error: 'Failed to list formats',
          details: errorOutput
        });
      }
      
      res.json({ formats: output });
    });

  } catch (error) {
    console.error('Error listing formats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'YouTube Downloader API'
  });
});

app.listen(PORT, async () => {
  await ensureTempDir();
  console.log(`YouTube Downloader API running on port ${PORT}`);
  setInterval(cleanupOldFiles, 60 * 60 * 1000);
});

process.on('SIGTERM', () => { process.exit(0); });
process.on('SIGINT', () => { process.exit(0); });