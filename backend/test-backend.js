
async function test() {
  try {
    // Test with a valid video ID to ensure spoofing doesn't break normal fetching
    const response = await fetch('http://localhost:3001/api/video-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Data:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
