
async function testProduction() {
  try {
    console.log('Testing production endpoint...');
    const response = await fetch('https://youtube-downloader-backend-ikjh.onrender.com/api/video-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testProduction();
