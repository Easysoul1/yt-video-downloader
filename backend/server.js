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

// Security middleware
app.use(helmet());
app.use(cors({
  origin: '*'
}));

// Rate limiting - 10 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many download requests, please try again later.'
  }
});

app.use('/api/', limiter);
app.use(express.json());

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

// YouTube URL validation
function isValidYouTubeUrl(url) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/;
  return youtubeRegex.test(url);
}

// Clean up old files (older than 1 hour)
async function cleanupOldFiles() {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = await fs.stat(filePath);
      const fileAge = now - stats.mtime.getTime();
      
      // Delete files older than 1 hour
      if (fileAge > 60 * 60 * 1000) {
        await fs.unlink(filePath);
        console.log(`Cleaned up old file: ${file}`);
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

    if (!url || !isValidYouTubeUrl(url)) {
      return res.status(400).json({ 
        error: 'Invalid YouTube URL provided' 
      });
    }

    // Get video information using yt-dlp
    const ytDlp = spawn('yt-dlp', [
      '--dump-json',
      '--no-download',
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

    ytDlp.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp error:', errorOutput);
        return res.status(400).json({ 
          error: 'Failed to fetch video information. Please check the URL.' 
        });
      }

      try {
        const info = JSON.parse(videoInfo);
        res.json({
          title: info.title,
          duration: info.duration,
          thumbnail: info.thumbnail,
          uploader: info.uploader,
          view_count: info.view_count
        });
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        res.status(500).json({ 
          error: 'Failed to parse video information' 
        });
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Download video endpoint
// Download video endpoint
app.get('/api/download', async (req, res) => {
  try {
    const { url, quality = 'best' } = req.query;

    if (!url || !isValidYouTubeUrl(url)) {
      return res.status(400).json({ 
        error: 'Invalid YouTube URL provided' 
      });
    }

    // Quality format selection
    let formatSelector;
    switch (quality) {
      case '4k':
        formatSelector = 'bestvideo[height<=2160]+bestaudio/best[height<=2160]';
        break;
      case '1080p':
        formatSelector = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]';
        break;
      case '720p':
        formatSelector = 'bestvideo[height<=720]+bestaudio/best[height<=720]';
        break;
      default:
        formatSelector = 'bestvideo+bestaudio/best';
    }

    // Get video title first for filename
    const infoProcess = spawn('yt-dlp', ['--get-title', url]);
    let title = 'video';
    
    infoProcess.stdout.on('data', (data) => {
      title = data.toString().trim().replace(/[^a-zA-Z0-9]/g, '_');
    });

    infoProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Failed to get video title');
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);

      // Stream video using yt-dlp
      const ytDlp = spawn('yt-dlp', [
        '-f', formatSelector,
        '-o', '-', // Output to stdout
        url
      ]);

      // Pipe yt-dlp stdout directly to response
      ytDlp.stdout.pipe(res);

      ytDlp.stderr.on('data', (data) => {
        // console.log('yt-dlp progress:', data.toString());
      });

      ytDlp.on('close', (code) => {
        if (code !== 0) {
          console.error('yt-dlp download error');
          // Can't send error response here as headers are likely already sent
          res.end();
        }
      });

      // Handle client disconnect
      req.on('close', () => {
        ytDlp.kill();
      });
    });

  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error' 
      });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, async () => {
  await ensureTempDir();
  console.log(` YouTube Downloader API running on port ${PORT}`);
  
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
