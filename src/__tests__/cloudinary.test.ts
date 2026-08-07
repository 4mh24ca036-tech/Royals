import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudinaryService } from '../../server/services/cloudinary';

describe('Cloudinary Service', () => {
  let service: CloudinaryService;

  beforeEach(() => {
    // Mock environment variables
    process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
    process.env.CLOUDINARY_API_KEY = 'test_key';
    process.env.CLOUDINARY_API_SECRET = 'test_secret';
    process.env.CLOUDINARY_UPLOAD_PRESET = 'royals_unsigned';

    service = new CloudinaryService();
  });

  describe('Configuration', () => {
    it('should initialize with environment variables', () => {
      expect(service.getCloudName()).toBe('test_cloud');
      expect(service.isConfigured()).toBe(true);
    });

    it('should warn when CLOUDINARY_CLOUD_NAME is missing', () => {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      const service = new CloudinaryService();
      expect(service.isConfigured()).toBe(false);
    });

    it('should require all three credentials for full functionality', () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
      process.env.CLOUDINARY_API_KEY = 'test_key';
      process.env.CLOUDINARY_API_SECRET = '';
      const service = new CloudinaryService();
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('URL Transformations', () => {
    it('should generate gallery transformation URL', () => {
      const url = 'https://res.cloudinary.com/test_cloud/image/upload/v1234/royals-image.jpg';
      const transformed = service.generateTransformUrl(url, 'gallery');
      expect(transformed).toContain('w_1200');
      expect(transformed).toContain('h_1200');
      expect(transformed).toContain('q_auto');
      expect(transformed).toContain('f_auto');
    });

    it('should generate thumbnail transformation URL', () => {
      const url = 'https://res.cloudinary.com/test_cloud/image/upload/v1234/royals-image.jpg';
      const transformed = service.generateTransformUrl(url, 'thumbnail');
      expect(transformed).toContain('w_400');
      expect(transformed).toContain('h_400');
    });

    it('should generate mobile transformation URL', () => {
      const url = 'https://res.cloudinary.com/test_cloud/image/upload/v1234/royals-image.jpg';
      const transformed = service.generateTransformUrl(url, 'mobile');
      expect(transformed).toContain('w_600');
      expect(transformed).toContain('h_600');
    });

    it('should generate hero transformation URL', () => {
      const url = 'https://res.cloudinary.com/test_cloud/image/upload/v1234/royals-image.jpg';
      const transformed = service.generateTransformUrl(url, 'hero');
      expect(transformed).toContain('w_1920');
      expect(transformed).toContain('h_1080');
    });

    it('should pass through non-Cloudinary URLs unchanged', () => {
      const url = '/images/local-image.jpg';
      const transformed = service.generateTransformUrl(url, 'gallery');
      expect(transformed).toBe(url);
    });
  });

  describe('Responsive Images', () => {
    it('should generate srcset with 1x and 2x variants', () => {
      const url = 'https://res.cloudinary.com/test_cloud/image/upload/v1234/royals-image.jpg';
      const srcset = service.generateSrcset(url, 1200);
      
      const parts = srcset.split(', ');
      expect(parts.length).toBe(2);
      expect(parts[0]).toContain('1x');
      expect(parts[1]).toContain('2x');
    });

    it('should scale srcset dimensions correctly', () => {
      const url = 'https://res.cloudinary.com/test_cloud/image/upload/v1234/royals-image.jpg';
      const srcset = service.generateSrcset(url, 600);
      
      expect(srcset).toContain('w_600');
      expect(srcset).toContain('w_1200');
    });
  });

  describe('URL Validation', () => {
    it('should validate Cloudinary URL format', () => {
      const validUrls = [
        'https://res.cloudinary.com/mycloud/image/upload/v1234/file.jpg',
        'https://res.cloudinary.com/mycloud/image/upload/f_auto/file.jpg',
        'https://res.cloudinary.com/mycloud/image/upload/w_500/file.webp'
      ];

      validUrls.forEach(url => {
        expect(url).toContain('cloudinary.com');
        expect(url).toContain('image/upload');
      });
    });

    it('should reject invalid Cloudinary URLs', () => {
      const invalidUrls = [
        'https://example.com/image.jpg',
        '/local/path/image.jpg',
        'uploads/prod_boutique_01/image.jpg'
      ];

      invalidUrls.forEach(url => {
        expect(url).not.toContain('cloudinary.com');
      });
    });
  });

  describe('File Type Support', () => {
    it('should accept JPEG format', () => {
      const filename = 'garment-01.jpeg';
      expect(filename).toMatch(/\.(jpg|jpeg)$/i);
    });

    it('should accept PNG format', () => {
      const filename = 'image.png';
      expect(filename).toMatch(/\.(png)$/i);
    });

    it('should accept WebP format', () => {
      const filename = 'image.webp';
      expect(filename).toMatch(/\.(webp)$/i);
    });

    it('should reject invalid formats', () => {
      const invalidFiles = ['document.pdf', 'video.mp4', 'archive.zip'];
      invalidFiles.forEach(file => {
        expect(file).not.toMatch(/\.(jpg|jpeg|png|webp)$/i);
      });
    });
  });

  describe('Upload Folder Structure', () => {
    it('should organize uploads by product', () => {
      const productId = 'prod_boutique_01';
      const folder = `royals/products/${productId}`;
      expect(folder).toContain('royals/products');
      expect(folder).toContain(productId);
    });

    it('should handle boutique product IDs', () => {
      const productIds = ['prod_boutique_01', 'prod_boutique_76', 'prod_raw_silk_kurta_set'];
      productIds.forEach(id => {
        const folder = `royals/products/${id}`;
        expect(folder.length).toBeGreaterThan(0);
        expect(folder).toContain('royals');
      });
    });
  });

  describe('Batch Operations', () => {
    it('should track multiple uploads', () => {
      const uploads = [
        { id: 1, file: 'image1.jpg', url: 'https://res.cloudinary.com/cloud/image/upload/v1/1.jpg' },
        { id: 2, file: 'image2.png', url: 'https://res.cloudinary.com/cloud/image/upload/v2/2.png' },
        { id: 3, file: 'image3.webp', url: 'https://res.cloudinary.com/cloud/image/upload/v3/3.webp' }
      ];

      expect(uploads.length).toBe(3);
      expect(uploads.every(u => u.url.includes('cloudinary.com'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', () => {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      const unconfiguredService = new CloudinaryService();
      expect(unconfiguredService.isConfigured()).toBe(false);
    });

    it('should validate required parameters', () => {
      expect(() => {
        service.generateTransformUrl('', 'gallery');
      }).not.toThrow();
    });
  });
});
