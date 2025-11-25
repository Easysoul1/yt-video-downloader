import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - FIXED
const corsOptions = {
  origin: [
    'https://yt-video-downloader-lilac.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false,
  maxAge: 86400 // 24 hours
};

// Apply CORS before other middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  }
}));

// Rate limiting - 10 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many download requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting only to specific routes
app.use('/api/download', limiter);
app.use('/api/video-info', limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Temporary directory for downloads
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure temp directory exists
async function ensureTempDir() {
  try {
    await fs.access(TEMP_DIR);
  } catch {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  }
}

// YouTube URL validation - IMPROVED
function isValidYouTubeUrl(url) {
  if (typeof url !== 'string') return false;
  
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[\w-]+/;
  return youtubeRegex.test(url.trim());
}

// Clean up old files (older than 1 hour)
async function cleanupOldFiles() {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        const fileAge = now - stats.mtime.getTime();
        
        // Delete files older than 1 hour
        if (fileAge > 60 * 60 * 1000) {
          await fs.unlink(filePath);
          console.log(`Cleaned up old file: ${file}`);
        }
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Get video info endpoint - IMPROVED
app.post('/api/video-info', async (req, res) => {
  // Set CORS headers explicitly for this route
  res.header('Access-Control-Allow-Origin', 'https://yt-video-downloader-lilac.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { url } = req.body;

    if (!url || !isValidYouTubeUrl(url)) {
      return res.status(400).json({ 
        error: 'Invalid YouTube URL provided',
        details: 'Please provide a valid YouTube URL in the format: https://www.youtube.com/watch?v=VIDEO_ID'
      });
    }

    console.log(`Fetching info for URL: ${url}`);

    // Get video information using yt-dlp
    const ytDlp = spawn('yt-dlp', [
      '--dump-json',
      '--no-warnings',
      '--no-download',
      url
    ], {
      timeout: 30000 // 30 second timeout
    });

    let videoInfo = '';
    let errorOutput = '';

    ytDlp.stdout.on('data', (data) => {
      videoInfo += data.toString();
    });

    ytDlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytDlp.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp error:', errorOutput);
        return res.status(400).json({ 
          error: 'Failed to fetch video information',
          details: 'Please check if the URL is correct and the video is accessible'
        });
      }

      try {
        const info = JSON.parse(videoInfo);
        res.json({
          title: info.title || 'Unknown Title',
          duration: info.duration_string || Math.round(info.duration) + 's',
          thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
          uploader: info.uploader || 'Unknown Uploader',
          view_count: info.view_count || 0,
          description: info.description ? info.description.substring(0, 200) + '...' : '',
          formats: info.formats ? info.formats.map(f => ({
            format_id: f.format_id,
            ext: f.ext,
            resolution: f.format_note || 'unknown',
            filesize: f.filesize
          })).filter(f => f.ext === 'mp4').slice(0, 5) : []
        });
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        res.status(500).json({ 
          error: 'Failed to parse video information',
          details: 'The video information could not be processed'
        });
      }
    });

    ytDlp.on('error', (error) => {
      console.error('yt-dlp spawn error:', error);
      res.status(500).json({ 
        error: 'Failed to process video information',
        details: 'YouTube downloader service unavailable'
      });
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'An unexpected error occurred'
    });
  }
});

// Download video endpoint - IMPROVED
app.get('/api/download', async (req, res) => {
  // Set CORS headers explicitly for this route
  res.header('Access-Control-Allow-Origin', 'https://yt-video-downloader-lilac.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { url, quality = 'best' } = req.query;

    if (!url || !isValidYouTubeUrl(url)) {
      return res.status(400).json({ 
        error: 'Invalid YouTube URL provided' 
      });
    }

    console.log(`Download request for URL: ${url}, quality: ${quality}`);

    // Quality format selection
    let formatSelector;
    switch (quality) {
      case '4k':
        formatSelector = 'bestvideo[height<=2160][vcodec^=avc1]+bestaudio/best[height<=2160]';
        break;
      case '1080p':
        formatSelector = 'bestvideo[height<=1080][vcodec^=avc1]+bestaudio/best[height<=1080]';
        break;
      case '720p':
        formatSelector = 'bestvideo[height<=720][vcodec^=avc1]+bestaudio/best[height<=720]';
        break;
      case 'audio':
        formatSelector = 'bestaudio[ext=m4a]/bestaudio';
        break;
      default:
        formatSelector = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
    }

    // Get video title first for filename
    const getTitle = () => {
      return new Promise((resolve, reject) => {
        const infoProcess = spawn('yt-dlp', [
          '--get-title',
          '--no-warnings',
          url
        ], {
          timeout: 15000
        });

        let title = 'youtube_video';
        let error = '';

        infoProcess.stdout.on('data', (data) => {
          title = data.toString().trim().replace(/[^a-zA-Z0-9\s]/g, '_').substring(0, 100);
        });

        infoProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        infoProcess.on('close', (code) => {
          if (code !== 0) {
            console.error('Failed to get video title:', error);
            resolve('youtube_video'); // Default title
          } else {
            resolve(title || 'youtube_video');
          }
        });

        infoProcess.on('error', (err) => {
          console.error('Title process error:', err);
          resolve('youtube_video');
        });
      });
    };

    const title = await getTitle();
    const filename = `${title}.mp4`;

    // Set headers for file download
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    // Stream video using yt-dlp
    const ytDlp = spawn('yt-dlp', [
      '-f', formatSelector,
      '--no-warnings',
      '--merge-output-format', 'mp4',
      '-o', '-', // Output to stdout
      url
    ], {
      timeout: 300000 // 5 minute timeout for download
    });

    // Pipe yt-dlp stdout directly to response
    ytDlp.stdout.pipe(res);

    ytDlp.stderr.on('data', (data) => {
      console.log('yt-dlp progress:', data.toString().trim());
    });

    ytDlp.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp download failed with code:', code);
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Download failed',
            details: 'The video could not be downloaded'
          });
        }
      } else {
        console.log('Download completed successfully');
      }
      res.end();
    });

    ytDlp.on('error', (error) => {
      console.error('yt-dlp spawn error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Download service unavailable',
          details: 'YouTube downloader failed to start'
        });
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      console.log('Client disconnected, killing download process');
      ytDlp.kill();
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      ytDlp.kill();
    });

  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        details: 'An unexpected error occurred during download'
      });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'YouTube Downloader API'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'CORS is working!',
    frontend: 'https://yt-video-downloader-lilac.vercel.app',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: 'An unexpected error occurred'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, async () => {
  await ensureTempDir();
  console.log(`🚀 YouTube Downloader API running on port ${PORT}`);
  console.log(`🌐 CORS enabled for: https://yt-video-downloader-lilac.vercel.app`);
  
  // Run cleanup every hour
  setInterval(cleanupOldFiles, 60 * 60 * 1000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});