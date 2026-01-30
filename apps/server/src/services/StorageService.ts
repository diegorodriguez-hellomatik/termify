import * as Minio from 'minio';
import sharp from 'sharp';

/**
 * StorageService - Singleton service for MinIO storage operations
 * Handles avatar uploads with automatic compression to WebP format
 *
 * Files in the `public/` folder are publicly accessible.
 */
class StorageService {
  private static instance: StorageService | null = null;
  private client: Minio.Client;
  private bucket: string;
  private isInitialized: boolean = false;

  private constructor() {
    this.bucket = process.env.MINIO_BUCKET || 'termify-avatars';

    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '443'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || '',
      secretKey: process.env.MINIO_SECRET_KEY || '',
    });
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Initialize the bucket and ensure proper policies
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        console.log(`[Storage] Created bucket: ${this.bucket}`);
      }

      // Ensure the public folder has read access
      await this.ensurePublicPolicy();

      this.isInitialized = true;
      console.log(`[Storage] Initialized with bucket: ${this.bucket}`);
    } catch (error) {
      console.error('[Storage] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Ensure the bucket has public read access for the public/ folder
   */
  private async ensurePublicPolicy(): Promise<void> {
    try {
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/public/*`],
          },
        ],
      };
      await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
      console.log(`[Storage] Public policy set for public/ folder in bucket: ${this.bucket}`);
    } catch (error) {
      console.warn('[Storage] Could not set bucket policy (may require admin permissions):', error);
    }
  }

  /**
   * Upload and compress an avatar image
   * @param buffer - Raw image buffer
   * @param userId - User ID for naming the file
   * @returns Public URL of the uploaded avatar
   */
  async uploadAvatar(buffer: Buffer, userId: string): Promise<string> {
    await this.initialize();

    // Compress image to WebP format
    // Target: 200x200 pixels, 80% quality
    // Result: ~5-15KB from typical 500KB-2MB uploads
    const compressed = await sharp(buffer)
      .resize(200, 200, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80 })
      .toBuffer();

    // Store in public/ folder for public access
    const filename = `public/avatars/${userId}.webp`;
    const metadata = {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000', // 1 year cache
    };

    await this.client.putObject(this.bucket, filename, compressed, compressed.length, metadata);

    console.log(`[Storage] Uploaded avatar for user ${userId} (${compressed.length} bytes)`);

    // Return the public URL with cache-busting timestamp
    return `${this.getPublicUrl(filename)}?v=${Date.now()}`;
  }

  /**
   * Upload and compress a team image
   * @param buffer - Raw image buffer
   * @param teamId - Team ID for naming the file
   * @returns Public URL of the uploaded team image
   */
  async uploadTeamImage(buffer: Buffer, teamId: string): Promise<string> {
    await this.initialize();

    // Compress image to WebP format
    // Target: 256x256 pixels, 80% quality
    const compressed = await sharp(buffer)
      .resize(256, 256, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80 })
      .toBuffer();

    // Store in public/ folder for public access
    const filename = `public/teams/${teamId}.webp`;
    const metadata = {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000', // 1 year cache
    };

    await this.client.putObject(this.bucket, filename, compressed, compressed.length, metadata);

    console.log(`[Storage] Uploaded image for team ${teamId} (${compressed.length} bytes)`);

    // Return the public URL with cache-busting timestamp
    return `${this.getPublicUrl(filename)}?v=${Date.now()}`;
  }

  /**
   * Delete a team's image
   * @param teamId - Team ID
   */
  async deleteTeamImage(teamId: string): Promise<void> {
    await this.initialize();

    const filename = `public/teams/${teamId}.webp`;

    try {
      await this.client.removeObject(this.bucket, filename);
      console.log(`[Storage] Deleted image for team ${teamId}`);
    } catch (error) {
      // Ignore if file doesn't exist
      console.log(`[Storage] Image not found for team ${teamId}, skipping delete`);
    }
  }

  /**
   * Delete a user's avatar
   * @param userId - User ID
   */
  async deleteAvatar(userId: string): Promise<void> {
    await this.initialize();

    const filename = `public/avatars/${userId}.webp`;

    try {
      await this.client.removeObject(this.bucket, filename);
      console.log(`[Storage] Deleted avatar for user ${userId}`);
    } catch (error) {
      // Ignore if file doesn't exist
      console.log(`[Storage] Avatar not found for user ${userId}, skipping delete`);
    }
  }

  /**
   * Get the public URL for a file
   * @param filename - Path to the file in the bucket
   * @returns Public URL
   */
  getPublicUrl(filename: string): string {
    const ssl = process.env.MINIO_USE_SSL === 'true';
    const protocol = ssl ? 'https' : 'http';
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '443';

    // If using standard HTTPS port, don't include it in URL
    const portSuffix = (ssl && port === '443') || (!ssl && port === '80') ? '' : `:${port}`;

    return `${protocol}://${endpoint}${portSuffix}/${this.bucket}/${filename}`;
  }

  /**
   * Check if storage is properly configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.MINIO_ENDPOINT &&
      process.env.MINIO_ACCESS_KEY &&
      process.env.MINIO_SECRET_KEY
    );
  }
}

export const storageService = StorageService.getInstance();
