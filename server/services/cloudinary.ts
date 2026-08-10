/**
 * server/services/cloudinary.ts
 *
 * Cloudinary upload / delete service.
 *
 * Uses the Cloudinary REST API directly via Node's built-in fetch + FormData
 * (available in Node 18+; the project targets Node 22).
 *
 * Upload strategy: SIGNED upload with api_key + api_secret.
 * This does NOT depend on an unsigned upload preset, so it works regardless
 * of how the Cloudinary account is configured.
 *
 * Environment variables read from process.env (loaded by dotenv in dev,
 * injected by Vercel in production):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

import { createHash } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────
export interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

// ── Signing helper ────────────────────────────────────────────────────────
/**
 * Generates a Cloudinary request signature.
 * Spec: SHA-1( sorted_param_string + api_secret )
 * Docs: https://cloudinary.com/documentation/upload_images#generating_authentication_signatures
 */
function sign(params: Record<string, string | number>, apiSecret: string): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== '' && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  return createHash('sha1')
    .update(sorted + apiSecret)
    .digest('hex');
}

// ── CloudinaryService ─────────────────────────────────────────────────────
export class CloudinaryService {
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    // Read from process.env — populated by dotenv in dev, by Vercel in prod.
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? '';
    this.apiKey = process.env.CLOUDINARY_API_KEY ?? '';
    this.apiSecret = process.env.CLOUDINARY_API_SECRET ?? '';

    if (!this.cloudName) {
      console.warn('[Cloudinary] CLOUDINARY_CLOUD_NAME is not set.');
    } else if (
      this.cloudName.includes('.') ||
      this.cloudName.includes('/') ||
      this.cloudName.startsWith('http') ||
      this.cloudName.length > 30
    ) {
      // A Cloudinary cloud name is a short slug like "royals-couture", never a URL or UUID.
      console.warn(
        '[Cloudinary] CLOUDINARY_CLOUD_NAME looks invalid — value is ' +
        this.cloudName.length + ' chars and may be a URL or UUID instead of a cloud name slug. ' +
        'Find your cloud name at cloudinary.com/console (top-left of dashboard).'
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret);
  }

  getCloudName(): string {
    return this.cloudName;
  }

  /**
   * Upload a file buffer to Cloudinary using the signed Upload API.
   * Returns the upload response including secure_url and public_id.
   */
  async uploadImage(
    fileBuffer: Buffer,
    filename: string,
    folder: string = 'royals/products'
  ): Promise<CloudinaryUploadResponse> {
    if (!this.isConfigured()) {
      throw new Error(
        'Cloudinary is not configured. ' +
        'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
      );
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Parameters that are included in the signature (must match what we send)
    const sigParams: Record<string, string> = {
      folder,
      timestamp,
    };

    const signature = sign(sigParams, this.apiSecret);

    // Build multipart form using native FormData (Node 22)
    const form = new FormData();
    // Attach the file as a Blob
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    form.append('file', blob, filename);
    form.append('folder', folder);
    form.append('timestamp', timestamp);
    form.append('api_key', this.apiKey);
    form.append('signature', signature);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;

    let rawText = '';
    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: form,
        // Do NOT set Content-Type — fetch sets it automatically with the correct boundary
      });

      rawText = await response.text();

      const data = JSON.parse(rawText);

      // Cloudinary returns { error: { message } } on failure
      if (data.error) {
        const hint = data.error.message?.includes('cloud_name')
          ? ` (CLOUDINARY_CLOUD_NAME is ${this.cloudName.length} chars — it should be a short slug from your Cloudinary dashboard, not a URL or UUID)`
          : '';
        throw new Error(`Cloudinary API error: ${data.error.message}${hint}`);
      }

      if (!data.secure_url) {
        throw new Error(
          `Cloudinary upload returned no secure_url. ` +
          `HTTP ${response.status}. Response: ${rawText.slice(0, 300)}`
        );
      }

      return {
        public_id: data.public_id,
        secure_url: data.secure_url,
        url: data.url ?? data.secure_url,
        width: data.width ?? 0,
        height: data.height ?? 0,
        format: data.format ?? '',
        bytes: data.bytes ?? 0,
      };
    } catch (err: any) {
      // Re-throw with useful context (but never log the secret)
      if (err.message?.startsWith('Cloudinary')) throw err;
      throw new Error(
        `Cloudinary upload failed: ${err.message}. ` +
        (rawText ? `Response: ${rawText.slice(0, 300)}` : '')
      );
    }
  }

  /**
   * Delete an asset from Cloudinary by public_id using the signed Destroy API.
   */
  async deleteImage(publicId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('[Cloudinary] Cannot delete — credentials not configured.');
      return false;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sigParams = { public_id: publicId, timestamp };
    const signature = sign(sigParams, this.apiSecret);

    const params = new URLSearchParams({
      public_id: publicId,
      timestamp,
      api_key: this.apiKey,
      signature,
    });

    const destroyUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`;

    try {
      const response = await fetch(destroyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const data = await response.json() as { result?: string; error?: { message: string } };

      if (data.error) {
        console.warn(`[Cloudinary] Delete warning for "${publicId}": ${data.error.message}`);
        return false;
      }

      return data.result === 'ok';
    } catch (err: any) {
      console.error(`[Cloudinary] Delete error for "${publicId}":`, err.message);
      return false;
    }
  }

  /**
   * Insert a Cloudinary transformation into an existing URL.
   * Works only with URLs that are already on res.cloudinary.com.
   */
  generateTransformUrl(
    cloudinaryUrl: string,
    preset: 'gallery' | 'thumbnail' | 'mobile' | 'hero' = 'gallery'
  ): string {
    if (!cloudinaryUrl?.includes('cloudinary.com')) return cloudinaryUrl;

    const transforms: Record<string, string> = {
      gallery: 'w_1200,h_1200,c_fill,q_auto,f_auto',
      thumbnail: 'w_400,h_400,c_fill,q_auto,f_auto',
      mobile: 'w_600,h_600,c_fill,q_auto,f_auto',
      hero: 'w_1920,h_1080,c_fill,q_auto,f_auto',
    };

    return cloudinaryUrl.replace(
      /\/image\/upload\//,
      `/image/upload/${transforms[preset]}/`
    );
  }

  generateSrcset(cloudinaryUrl: string, width = 1200): string {
    const make = (w: number) =>
      cloudinaryUrl.replace('/upload/', `/upload/w_${w},q_auto,f_auto/`);
    return `${make(width)} 1x, ${make(width * 2)} 2x`;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────
let _instance: CloudinaryService | null = null;

export function getCloudinaryService(): CloudinaryService {
  if (!_instance) _instance = new CloudinaryService();
  return _instance;
}
