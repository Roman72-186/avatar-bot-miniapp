/**
 * S3 Upload Microservice
 * Handles photo uploads to S3-compatible storage
 * All credentials via environment variables.
 */

const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3001;

// Validate required env vars
const required = ['S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET', 'S3_ENDPOINT'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`ERROR: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// S3 Configuration from environment
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'ru-1',
  endpoint: `https://${process.env.S3_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  },
  forcePathStyle: true
});

const S3_BUCKET = process.env.S3_BUCKET;
const S3_ENDPOINT = process.env.S3_ENDPOINT;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 's3-upload-service' });
});

// Upload photo endpoint
app.post('/upload-photo', async (req, res) => {
  try {
    const { photo_base64, mime_type = 'image/jpeg', file_name = 'photo.jpg' } = req.body;

    if (!photo_base64) {
      return res.status(400).json({ error: 'photo_base64 is required' });
    }

    // Remove data URL prefix if present
    const base64Clean = photo_base64.includes(',')
      ? photo_base64.split(',')[1]
      : photo_base64;

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Clean, 'base64');

    // Generate unique filename
    const timestamp = Date.now();
    const ext = file_name.split('.').pop() || 'jpg';
    const s3FileName = `photo_${timestamp}.${ext}`;

    // Upload to S3
    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: s3FileName,
      Body: buffer,
      ContentType: mime_type,
      ACL: 'public-read'
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    const s3_url = `https://${S3_BUCKET}.${S3_ENDPOINT}/${s3FileName}`;

    console.log(`[${new Date().toISOString()}] Uploaded: ${s3FileName}`);

    // Return in format expected by frontend
    res.json([{ file_url: s3_url }]);

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`S3 Upload Service running on port ${PORT}`);
  console.log(`Endpoint: http://localhost:${PORT}/upload-photo`);
});
