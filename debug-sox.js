const recorder = require('node-record-lpcm16');

// Enable debug logging
process.env.DEBUG = 'record';

console.log('Starting voice recording test...');

try {
  const recording = recorder.record({
    sampleRate: 16000,
    channels: 1,
    threshold: 0.5,
    recorder: 'sox',
    audioType: 'wav'
  });
  
  console.log('Recording started successfully');
  
  recording.stream().on('data', (chunk) => {
    console.log(`Received ${chunk.length} bytes of audio data`);
  });
  
  recording.stream().on('error', (err) => {
    console.error('Recording error:', err);
  });
  
  setTimeout(() => {
    console.log('Stopping recording...');
    recording.stop();
    console.log('Recording stopped');
  }, 3000);
  
} catch (error) {
  console.error('Error starting recording:', error.message);
  console.error('Stack trace:', error.stack);
}