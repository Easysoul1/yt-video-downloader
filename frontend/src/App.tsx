import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaYoutube, FaDownload, FaInfoCircle, FaCheckCircle, FaExclamationCircle, FaVideo, FaBolt, FaInfinity } from 'react-icons/fa';
import { BiLoaderAlt } from 'react-icons/bi';

interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  view_count: number;
}

interface DownloadState {
  isLoading: boolean;
  isDownloading: boolean;
  error: string | null;
  success: boolean;
}

const API_BASE_URL = 'http://localhost:3001/api';

function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [quality, setQuality] = useState('best');
  const [downloadState, setDownloadState] = useState<DownloadState>({
    isLoading: false,
    isDownloading: false,
    error: null,
    success: false
  });

  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format view count
  const formatViewCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M views`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K views`;
    }
    return `${count} views`;
  };

  // Fetch video information
  const fetchVideoInfo = async () => {
    if (!url.trim()) return;

    setDownloadState({ isLoading: true, isDownloading: false, error: null, success: false });
    setVideoInfo(null);

    try {
      const response = await fetch(`${API_BASE_URL}/video-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch video information');
      }

      setVideoInfo(data);
      setDownloadState({ isLoading: false, isDownloading: false, error: null, success: false });
    } catch (error) {
      setDownloadState({
        isLoading: false,
        isDownloading: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        success: false
      });
    }
  };

  // Download video
  const downloadVideo = async () => {
    if (!url.trim()) return;

    setDownloadState({ isLoading: false, isDownloading: true, error: null, success: false });

    try {
      const response = await fetch(`${API_BASE_URL}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim(), quality }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }

      // Create blob and download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${videoInfo?.title || 'video'}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setDownloadState({ isLoading: false, isDownloading: false, error: null, success: true });

      // Reset success state after 3 seconds
      setTimeout(() => {
        setDownloadState(prev => ({ ...prev, success: false }));
      }, 3000);

    } catch (error) {
      setDownloadState({
        isLoading: false,
        isDownloading: false,
        error: error instanceof Error ? error.message : 'Download failed',
        success: false
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center justify-center mb-6"
          >
            <FaYoutube className="w-12 h-12 text-red-500 mr-4" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              YouTube Downloader
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xl text-gray-300 max-w-2xl mx-auto"
          >
            Download YouTube videos in high quality with our fast and secure downloader
          </motion.p>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="max-w-4xl mx-auto"
        >
          {/* URL Input Section */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 mb-8 border border-gray-700/50">
            <div className="space-y-6">
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-300 mb-2">
                  YouTube URL
                </label>
                <div className="relative">
                  <input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    onKeyPress={(e) => e.key === 'Enter' && fetchVideoInfo()}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={fetchVideoInfo}
                  disabled={!url.trim() || downloadState.isLoading}
                  className="flex-1 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {downloadState.isLoading ? (
                    <BiLoaderAlt className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <FaInfoCircle className="w-5 h-5 mr-2" />
                  )}
                  Get Video Info
                </motion.button>

                {videoInfo && (
                  <div className="flex-1">
                    <select
                      value={quality}
                      onChange={(e) => setQuality(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="best">Best Quality</option>
                      <option value="4k">4K (2160p)</option>
                      <option value="1080p">1080p HD</option>
                      <option value="720p">720p HD</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {downloadState.error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-900/50 border border-red-500/50 rounded-lg flex items-center"
              >
                <FaExclamationCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0" />
                <p className="text-red-300">{downloadState.error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Message */}
          <AnimatePresence>
            {downloadState.success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-green-900/50 border border-green-500/50 rounded-lg flex items-center"
              >
                <FaCheckCircle className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
                <p className="text-green-300">Video downloaded successfully!</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Video Info Card */}
          <AnimatePresence>
            {videoInfo && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-gray-700/50"
              >
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="md:w-1/3">
                    <img
                      src={videoInfo.thumbnail}
                      alt={videoInfo.title}
                      className="w-full rounded-lg shadow-lg"
                    />
                  </div>
                  <div className="md:w-2/3 space-y-4">
                    <h3 className="text-xl font-semibold text-white line-clamp-2">
                      {videoInfo.title}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                      <span>By {videoInfo.uploader}</span>
                      <span>Duration: {formatDuration(videoInfo.duration)}</span>
                      <span>{formatViewCount(videoInfo.view_count)}</span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={downloadVideo}
                      disabled={downloadState.isDownloading}
                      className="w-full sm:w-auto flex items-center justify-center px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold rounded-lg hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {downloadState.isDownloading ? (
                        <BiLoaderAlt className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <FaDownload className="w-5 h-5 mr-2" />
                      )}
                      {downloadState.isDownloading ? 'Downloading...' : 'Download Video'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Features Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="grid md:grid-cols-3 gap-6 mt-12"
          >
            {[
              {
                title: 'High Quality',
                description: 'Download videos in up to 4K resolution with crystal clear audio',
                icon: <FaVideo className="w-10 h-10 text-purple-400 mx-auto" />
              },
              {
                title: 'Fast & Secure',
                description: 'Lightning-fast downloads with no data stored on our servers',
                icon: <FaBolt className="w-10 h-10 text-yellow-400 mx-auto" />
              },
              {
                title: 'Free Forever',
                description: 'No registration required, completely free to use',
                icon: <FaInfinity className="w-10 h-10 text-cyan-400 mx-auto" />
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.9 + index * 0.1 }}
                className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/30 text-center hover:bg-gray-800/50 transition-colors duration-300"
              >
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export default App;