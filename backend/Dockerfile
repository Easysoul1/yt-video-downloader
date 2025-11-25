FROM node:18-slim

# Install Python and yt-dlp dependencies
RUN apt-get update && apt-get install -y python3 python3-pip curl ffmpeg

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy everything first (this busts cache when code changes)
COPY . .

# Then install dependencies
RUN npm install --production

EXPOSE 3001

CMD ["node", "server.js"]
