/**
 * Cloudinary Service
 * Handles all cloud image storage, transformation, and optimization
 */

import https from 'https';
import { URL } from 'url';

interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
}

interface CloudinaryTransformUrl {
  url: string;
  width: number;
  height: number;
}

export class CloudinaryService {
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;
  private uploadPreset: string;

  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
    this.apiKey = process.env.CLOUDINARY_API_KEY || '';
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || '';
    this.uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'royals_unsigned';

    if (!this.cloudName) {
      console.warn('⚠️  CLOUDINARY_CLOUD_NAME not configured. Image uploads will fail.');
    }
  }

  /**
   * Upload an image file to Cloudinary
   * Returns the secure URL and metadata
   */
  async uploadImage(
    fileBuffer: Buffer,
    filename: string,
    folder: string = 'royals/products'
  ): Promise<CloudinaryUploadResponse> {
    if (!this.cloudName) {
      throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME.');
    }

    return new Promise((resolve, reject) => {
      const formData = `--boundary\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
      const formDataEnd = `\r\n--boundary\r\nContent-Disposition: form-data; name="folder"\r\n\r\n${folder}\r\n--boundary\r\nContent-Disposition: form-data; name="upload_preset"\r\n\r\n${this.uploadPreset}\r\n--boundary--\r\n`;

      const buffer = Buffer.concat([
        Buffer.from(formData),
        fileBuffer,
        Buffer.from(formDataEnd)
      ]);

      const url = new URL(`https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`);
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=boundary',
          'Content-Length': buffer.length
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const response = JSON.parse(data) as CloudinaryUploadResponse;
            if (response.secure_url) {
              resolve(response);
            } else {
              reject(new Error('Upload failed: No URL in response'));
            }
          } catch (err) {
            reject(new Error(`Failed to parse Cloudinary response: ${err}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Cloudinary upload error: ${err.message}`));
      });

      req.write(buffer);
      req.end();
    });
  }

  /**
   * Delete an image from Cloudinary using public_id
   */
  async deleteImage(publicId: string): Promise<boolean> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      console.warn('Cloudinary credentials incomplete, cannot delete');
      return false;
    }

    return new Promise((resolve, reject) => {
      const timestamp = Math.floor(Date.now() / 1000);
      const params = new URLSearchParams({
        public_id: publicId,
        timestamp: timestamp.toString()
      });

      // In production, use proper SHA-1 signing. For now, use unsigned.
      const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`;
      const body = params.toString();

      const options = {
        hostname: 'api.cloudinary.com',
        path: `/v1_1/${this.cloudName}/image/destroy`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': body.length
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response.result === 'ok');
          } catch (err) {
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        console.error('Cloudinary delete error:', err);
        resolve(false);
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Generate a transformation URL for an image
   * Presets: gallery (1200px), thumbnail (400px), mobile (600px), hero (1920px)
   */
  generateTransformUrl(cloudinaryUrl: string, preset: 'gallery' | 'thumbnail' | 'mobile' | 'hero' = 'gallery'): string {
    if (!cloudinaryUrl.includes('cloudinary.com')) {
      return cloudinaryUrl;
    }

    const transformations: Record<string, string> = {
      gallery: 'w_1200,h_1200,c_fill,q_auto,f_auto',
      thumbnail: 'w_400,h_400,c_fill,q_auto,f_auto',
      mobile: 'w_600,h_600,c_fill,q_auto,f_auto',
      hero: 'w_1920,h_1080,c_fill,q_auto,f_auto'
    };

    const transformation = transformations[preset];

    // Insert transformation into the URL: https://res.cloudinary.com/cloud/image/upload/
    // becomes: https://res.cloudinary.com/cloud/image/upload/w_1200,h_1200,c_fill,q_auto,f_auto/
    return cloudinaryUrl.replace(
      /\/image\/upload\//,
      `/image/upload/${transformation}/`
    );
  }

  /**
   * Generate srcset string for responsive images
   * Returns: "url-1x 1x, url-2x 2x"
   */
  generateSrcset(cloudinaryUrl: string, width: number = 1200): string {
    const url1x = this.generateTransformUrl(
      cloudinaryUrl.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`),
      'gallery'
    );

    const url2x = this.generateTransformUrl(
      cloudinaryUrl.replace('/upload/', `/upload/w_${width * 2},q_auto,f_auto/`),
      'gallery'
    );

    return `${url1x} 1x, ${url2x} 2x`;
  }

  /**
   * Verify Cloudinary is properly configured
   */
  isConfigured(): boolean {
    return !!this.cloudName && !!this.apiKey && !!this.apiSecret;
  }

  /**
   * Get the Cloudinary cloud name
   */
  getCloudName(): string {
    return this.cloudName;
  }
}

// Singleton instance
let instance: CloudinaryService | null = null;

export function getCloudinaryService(): CloudinaryService {
  if (!instance) {
    instance = new CloudinaryService();
  }
  return instance;
}
