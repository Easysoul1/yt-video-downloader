# 🎥 YouTube Video Downloader

A modern, fast, and secure YouTube video downloader built with React, Node.js, and yt-dlp. Features a beautiful AI-inspired dark theme with smooth animations.

## ✨ Features

- **High Quality Downloads**: Support for 4K, 1080p, 720p, and best available quality
- **Modern UI**: Dark theme with neon accents and smooth Framer Motion animations
- **Fast & Secure**: No data stored on servers, automatic file cleanup
- **Rate Limited**: Built-in protection against abuse
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Real-time Info**: Fetch video details before downloading

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- yt-dlp installed globally
- ffmpeg installed (for video processing)

### Installation

1. **Install yt-dlp and ffmpeg**:
   ```bash
   # On macOS (using Homebrew)
   brew install yt-dlp ffmpeg
   
   # On Ubuntu/Debian
   sudo apt update
   sudo apt install yt-dlp ffmpeg
   
   # On Windows (using Chocolatey)
   choco install yt-dlp ffmpeg
   
   # Alternative: Install yt-dlp via pip
   pip install yt-dlp
   ```

2. **Clone and setup the project**:
   ```bash
   git clone <repository-url>
   cd youtube-downloader
   
   # Install frontend dependencies
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   cd ..
   ```

3. **Start the application**:
   ```bash
   # Terminal 1: Start the backend server
   cd backend
   npm start
   
   # Terminal 2: Start the frontend development server
   npm run dev
   ```

4. **Open your browser** and navigate to `http://localhost:5173`

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern React with hooks
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Smooth animations and transitions
- **Lucide React** - Beautiful icon library
- **TypeScript** - Type-safe development

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **yt-dlp** - YouTube video downloader
- **ffmpeg** - Video processing
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - API protection

## 📁 Project Structure

```
youtube-downloader/
├── backend/
│   ├── server.js          # Express server with yt-dlp integration
│   ├── package.json       # Backend dependencies
│   └── temp/              # Temporary download directory (auto-created)
├── src/
│   ├── App.tsx            # Main React component
│   ├── main.tsx           # React entry point
│   └── index.css          # Global styles
├── package.json           # Frontend dependencies
├── tailwind.config.js     # Tailwind configuration
├── vite.config.ts         # Vite configuration
└── README.md              # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com
```

### Quality Options

The downloader supports multiple quality options:
- `best` - Best available quality (default)
- `4k` - 4K resolution (2160p)
- `1080p` - Full HD
- `720p` - HD

### Rate Limiting

Default rate limits (configurable in `server.js`):
- 10 requests per 15 minutes per IP address
- Automatic cleanup of files older than 1 hour

## 🚀 Deployment

### Frontend Deployment

1. **Build the frontend**:
   ```bash
   npm run build
   ```

2. **Deploy to your preferred hosting service**:
   - Vercel: `vercel --prod`
   - Netlify: Upload `dist` folder
   - GitHub Pages: Use GitHub Actions

### Backend Deployment

1. **Prepare for production**:
   ```bash
   cd backend
   npm install --production
   ```

2. **Deploy to your server**:
   - Ensure yt-dlp and ffmpeg are installed on the server
   - Set up process manager (PM2 recommended)
   - Configure reverse proxy (Nginx recommended)
   - Set up SSL certificate

### Docker Deployment (Recommended)

Create a `Dockerfile` in the backend directory:

```dockerfile
FROM node:18-alpine

# Install yt-dlp and ffmpeg
RUN apk add --no-cache python3 py3-pip ffmpeg
RUN pip3 install yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3001

CMD ["node", "server.js"]
```

## 🔒 Security Considerations

### Production Security Checklist

- [ ] Set up HTTPS with SSL certificate
- [ ] Configure CORS for your domain only
- [ ] Set up rate limiting and DDoS protection
- [ ] Monitor server resources and disk usage
- [ ] Implement request logging and monitoring
- [ ] Set up automated security updates
- [ ] Configure firewall rules
- [ ] Use environment variables for sensitive data

### URL Validation

The application validates YouTube URLs using regex patterns and only accepts:
- `youtube.com/watch?v=`
- `youtu.be/`
- `youtube.com/embed/`
- `youtube.com/v/`

### File Security

- Temporary files are automatically deleted after download
- Unique filenames prevent conflicts
- Files older than 1 hour are automatically cleaned up
- No user data is stored on the server

## 🐛 Troubleshooting

### Common Issues

1. **yt-dlp not found**:
   ```bash
   # Install yt-dlp globally
   pip install yt-dlp
   # Or using package manager
   brew install yt-dlp  # macOS
   ```

2. **ffmpeg not found**:
   ```bash
   # Install ffmpeg
   brew install ffmpeg  # macOS
   sudo apt install ffmpeg  # Ubuntu
   ```

3. **CORS errors**:
   - Update the CORS configuration in `server.js`
   - Ensure frontend URL is in allowed origins

4. **Download failures**:
   - Check if the YouTube URL is valid and accessible
   - Verify yt-dlp is up to date: `pip install --upgrade yt-dlp`
   - Check server logs for detailed error messages

### Performance Optimization

- Monitor disk space in the temp directory
- Implement CDN for static assets
- Use compression middleware for API responses
- Consider implementing download queuing for high traffic

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## ⚠️ Legal Notice

This tool is for educational purposes only. Users are responsible for complying with YouTube's Terms of Service and applicable copyright laws. Only download videos you have permission to download.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Search existing GitHub issues
3. Create a new issue with detailed information
4. Include error logs and system information

---

**Made with ❤️ using React, Node.js, and yt-dlp**
