/**
 * useImages Hook Tests
 * Tests for image management hooks
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useProductImages,
  useUploadProductImages,
  useDeleteProductImage,
  useSetCoverImage,
  useReorderProductImages,
  useReplaceProductImage,
  useProductCoverImage,
  useResponsiveImageUrls
} from '../useImages';
import * as apiService from '../../services/api';

// Mock the API service
vi.mock('../../services/api', () => ({
  api: {
    getProductImages: vi.fn(),
    uploadProductImages: vi.fn(),
    deleteProductImage: vi.fn(),
    setProductImageCover: vi.fn(),
    reorderProductImages: vi.fn(),
    replaceProductImage: vi.fn()
  }
}));

describe('useImages Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useProductImages', () => {
    it('should fetch product images on mount', async () => {
      const mockImages = [
        {
          id: 'img_1',
          product_id: 'prod_1',
          image_url: 'https://cloudinary.com/image1.jpg',
          display_order: 0,
          is_cover: true,
          view_type: 'gallery',
          alt_text: 'Product image 1',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z'
        }
      ];

      vi.mocked(apiService.api.getProductImages).mockResolvedValue(mockImages);

      const { result } = renderHook(() => useProductImages('prod_1'));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.images).toEqual(mockImages);
      expect(result.current.error).toBeNull();
    });

    it('should handle fetch errors gracefully', async () => {
      const errorMessage = 'Failed to load images';
      vi.mocked(apiService.api.getProductImages).mockRejectedValue(
        new Error(errorMessage)
      );

      const { result } = renderHook(() => useProductImages('prod_1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toContain(errorMessage);
      expect(result.current.images).toEqual([]);
    });

    it('should refetch images when refetch is called', async () => {
      const mockImages = [];
      vi.mocked(apiService.api.getProductImages).mockResolvedValue(mockImages);

      const { result, rerender } = renderHook(() => useProductImages('prod_1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(apiService.api.getProductImages).toHaveBeenCalledTimes(2);
    });

    it('should handle empty product ID', async () => {
      const { result } = renderHook(() => useProductImages(''));

      expect(result.current.images).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('useDeleteProductImage', () => {
    it('should delete image and return success', async () => {
      vi.mocked(apiService.api.deleteProductImage).mockResolvedValue({
        success: true,
        message: 'Image deleted'
      });

      const { result } = renderHook(() => useDeleteProductImage());

      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        await result.current.deleteImage('img_1');
      });

      expect(apiService.api.deleteProductImage).toHaveBeenCalledWith('img_1');
    });

    it('should handle delete errors', async () => {
      const errorMessage = 'Cannot delete image';
      vi.mocked(apiService.api.deleteProductImage).mockRejectedValue(
        new Error(errorMessage)
      );

      const { result } = renderHook(() => useDeleteProductImage());

      await expect(result.current.deleteImage('img_1')).rejects.toThrow(errorMessage);
      expect(result.current.error).toContain(errorMessage);
    });
  });

  describe('useSetCoverImage', () => {
    it('should set image as cover', async () => {
      const mockResult = {
        success: true,
        message: 'Cover image updated',
        images: []
      };

      vi.mocked(apiService.api.setProductImageCover).mockResolvedValue(mockResult);

      const { result } = renderHook(() => useSetCoverImage());

      await act(async () => {
        await result.current.setCover('img_1');
      });

      expect(apiService.api.setProductImageCover).toHaveBeenCalledWith('img_1');
    });
  });

  describe('useReorderProductImages', () => {
    it('should reorder images', async () => {
      const mockResult = {
        success: true,
        message: 'Images reordered',
        images: []
      };

      vi.mocked(apiService.api.reorderProductImages).mockResolvedValue(mockResult);

      const { result } = renderHook(() => useReorderProductImages());

      await act(async () => {
        await result.current.reorder('prod_1', ['img_2', 'img_1', 'img_3']);
      });

      expect(apiService.api.reorderProductImages).toHaveBeenCalledWith(
        'prod_1',
        ['img_2', 'img_1', 'img_3']
      );
    });
  });

  describe('useProductCoverImage', () => {
    it('should return cover image from product images', async () => {
      const mockImages = [
        {
          id: 'img_1',
          product_id: 'prod_1',
          image_url: 'https://cloudinary.com/image1.jpg',
          display_order: 0,
          is_cover: true,
          view_type: 'gallery',
          alt_text: 'Product image 1',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z'
        },
        {
          id: 'img_2',
          product_id: 'prod_1',
          image_url: 'https://cloudinary.com/image2.jpg',
          display_order: 1,
          is_cover: false,
          view_type: 'gallery',
          alt_text: 'Product image 2',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z'
        }
      ];

      vi.mocked(apiService.api.getProductImages).mockResolvedValue(mockImages);

      const { result } = renderHook(() => useProductCoverImage('prod_1'));

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      expect(result.current?.is_cover).toBe(true);
      expect(result.current?.id).toBe('img_1');
    });

    it('should return null if no cover image', async () => {
      const mockImages = [
        {
          id: 'img_1',
          product_id: 'prod_1',
          image_url: 'https://cloudinary.com/image1.jpg',
          display_order: 0,
          is_cover: false,
          view_type: 'gallery',
          alt_text: 'Product image 1',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z'
        }
      ];

      vi.mocked(apiService.api.getProductImages).mockResolvedValue(mockImages);

      const { result } = renderHook(() => useProductCoverImage('prod_1'));

      await waitFor(() => {
        expect(result.current).toBeNull();
      });
    });
  });

  describe('useResponsiveImageUrls', () => {
    it('should generate responsive image URLs', () => {
      const cloudinaryUrl = 'https://res.cloudinary.com/royals/image/upload/v1234/prod_1/image.jpg';
      const { result } = renderHook(() => useResponsiveImageUrls(cloudinaryUrl));

      expect(result.current.thumbnail).toContain('w_400');
      expect(result.current.mobile).toContain('w_600');
      expect(result.current.gallery).toContain('w_1200');
      expect(result.current.hero).toContain('w_1920');
    });

    it('should generate srcset for responsive images', () => {
      const cloudinaryUrl = 'https://res.cloudinary.com/royals/image/upload/v1234/prod_1/image.jpg';
      const { result } = renderHook(() => useResponsiveImageUrls(cloudinaryUrl));

      expect(result.current.srcset).toContain('1x');
      expect(result.current.srcset).toContain('2x');
    });

    it('should handle null image URL', () => {
      const { result } = renderHook(() => useResponsiveImageUrls(null));

      expect(result.current.thumbnail).toBeNull();
      expect(result.current.srcset).toBeUndefined();
    });

    it('should return original URL for non-Cloudinary images', () => {
      const localUrl = '/uploads/prod_1/image.jpg';
      const { result } = renderHook(() => useResponsiveImageUrls(localUrl));

      expect(result.current.thumbnail).toBe(localUrl);
      expect(result.current.gallery).toBe(localUrl);
    });
  });
});
