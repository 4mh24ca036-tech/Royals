/**
 * useImages Hook
 * Custom React hook for managing product, category, and section images
 * Handles loading, caching, error states, and real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  display_order: number;
  is_cover: boolean;
  view_type?: string;
  alt_text?: string | null;
  width?: number;
  height?: number;
  created_at: string;
  updated_at: string;
}

export interface UseImagesState {
  images: ProductImage[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage images for a product
 * @param productId - The product ID to fetch images for
 * @returns Object with images, loading state, error, and refetch function
 */
export function useProductImages(productId: string): UseImagesState {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchImages = useCallback(async () => {
    if (!productId) {
      setImages([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getProductImages(productId);
      setImages(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error(`Error fetching images for product ${productId}:`, err);
      setError(err.message || 'Failed to load images');
      setImages([]);
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  return {
    images,
    isLoading,
    error,
    refetch: fetchImages
  };
}

/**
 * Hook to upload images for a product
 * @param productId - The product ID to upload images for
 * @returns Object with upload function, loading state, and error
 */
export function useUploadProductImages(productId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (files: File[]) => {
      try {
        setIsLoading(true);
        setError(null);

        if (!files || files.length === 0) {
          throw new Error('No files provided');
        }

        const result = await api.uploadProductImages(productId, files);
        return result;
      } catch (err: any) {
        const message = err.message || 'Failed to upload images';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [productId]
  );

  return {
    upload,
    isLoading,
    error
  };
}

/**
 * Hook to delete a product image
 * @returns Object with delete function, loading state, and error
 */
export function useDeleteProductImage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteImage = useCallback(async (imageId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await api.deleteProductImage(imageId);
      return true;
    } catch (err: any) {
      const message = err.message || 'Failed to delete image';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    deleteImage,
    isLoading,
    error
  };
}

/**
 * Hook to set the cover image for a product
 * @returns Object with function, loading state, and error
 */
export function useSetCoverImage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setCover = useCallback(async (imageId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.setProductImageCover(imageId);
      return result;
    } catch (err: any) {
      const message = err.message || 'Failed to set cover image';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    setCover,
    isLoading,
    error
  };
}

/**
 * Hook to reorder images for a product
 * @returns Object with function, loading state, and error
 */
export function useReorderProductImages() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reorder = useCallback(async (productId: string, order: string[]) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.reorderProductImages(productId, order);
      return result;
    } catch (err: any) {
      const message = err.message || 'Failed to reorder images';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    reorder,
    isLoading,
    error
  };
}

/**
 * Hook to replace a single image
 * @returns Object with function, loading state, and error
 */
export function useReplaceProductImage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replace = useCallback(async (imageId: string, file: File) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.replaceProductImage(imageId, file);
      return result;
    } catch (err: any) {
      const message = err.message || 'Failed to replace image';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    replace,
    isLoading,
    error
  };
}

/**
 * Hook to get the cover image for a product
 * @param productId - The product ID to get the cover image for
 * @returns The cover image object or null if not found
 */
export function useProductCoverImage(productId: string): ProductImage | null {
  const { images } = useProductImages(productId);
  return images.find((img) => img.is_cover) || null;
}

/**
 * Hook to generate responsive image URLs
 * @param imageUrl - The original Cloudinary URL
 * @returns Object with URLs for different resolutions and srcset
 */
export function useResponsiveImageUrls(imageUrl: string | null | undefined) {
  const generateUrl = (width: number, height: number) => {
    if (!imageUrl || !imageUrl.includes('cloudinary')) {
      return imageUrl;
    }

    // Transform: https://res.cloudinary.com/cloud/image/upload/
    // to: https://res.cloudinary.com/cloud/image/upload/w_800,h_800,c_fill,q_auto,f_auto/
    return imageUrl.replace(
      /\/image\/upload\//,
      `/image/upload/w_${width},h_${height},c_fill,q_auto,f_auto/`
    );
  };

  return {
    thumbnail: generateUrl(400, 400),
    mobile: generateUrl(600, 600),
    gallery: generateUrl(1200, 1200),
    hero: generateUrl(1920, 1080),
    srcset: imageUrl
      ? `${generateUrl(1200, 1200)} 1x, ${generateUrl(2400, 2400)} 2x`
      : undefined
  };
}
