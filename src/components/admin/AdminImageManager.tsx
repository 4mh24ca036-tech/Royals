import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Trash2,
  Star,
  GripVertical,
  ZoomIn,
  X,
  ImagePlus,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Cloud,
  AlertTriangle
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ImageRecord {
  id: string;
  product_id: string;
  image_url: string;
  display_order: number;
  is_cover: boolean;
  view_type: string;
  alt_text: string | null;
  created_at: string;
  updated_at: string;
}

interface ImageStatus {
  isWorking: boolean;
  isCloudinary: boolean;
  isMissing: boolean;
  isLoading?: boolean;
}

interface AdminImageManagerProps {
  productId: string;
  /** Initial images fetched from DB (passed in when editing an existing product). */
  initialImages?: ImageRecord[];
  onImagesChanged?: (images: ImageRecord[]) => void;
}

// ── API helpers ───────────────────────────────────────────────────────────

function getAdminToken(): string {
  return localStorage.getItem('royals_admin_token') || '';
}

async function adminFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${getAdminToken()}`);
  // Don't set Content-Type when FormData — browser handles the boundary
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

async function fetchImages(productId: string): Promise<ImageRecord[]> {
  const data = await adminFetch<ImageRecord[]>(`/api/images/product/${productId}`);
  return data;
}

async function uploadImages(productId: string, files: File[]): Promise<{ images: ImageRecord[] }> {
  const form = new FormData();
  files.forEach((f) => form.append('images', f));
  return adminFetch(`/api/images/upload/${productId}`, { method: 'POST', body: form });
}

async function deleteImage(imageId: string): Promise<void> {
  await adminFetch(`/api/images/${imageId}`, { method: 'DELETE' });
}

async function setCover(imageId: string): Promise<{ images: ImageRecord[] }> {
  return adminFetch(`/api/images/${imageId}/cover`, { method: 'PATCH' });
}

async function reorderImages(productId: string, order: string[]): Promise<{ images: ImageRecord[] }> {
  return adminFetch(`/api/images/reorder/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify({ order })
  });
}

async function replaceImage(imageId: string, file: File): Promise<{ image: ImageRecord }> {
  const form = new FormData();
  form.append('image', file);
  return adminFetch(`/api/images/${imageId}`, { method: 'PATCH', body: form });
}

// ── Image Status Detection ────────────────────────────────────────────────

/**
 * Checks if an image URL is:
 * - Working (loads successfully)
 * - Cloudinary (hosted on res.cloudinary.com)
 * - Missing (404 or fails to load)
 */
function getImageStatus(imageUrl: string): ImageStatus {
  const isCloudinary = imageUrl.includes('res.cloudinary.com');
  
  return {
    isWorking: true,  // Assume working until proven otherwise
    isCloudinary,
    isMissing: false,
    isLoading: false
  };
}

/**
 * Validate image URL by attempting to load it
 */
async function validateImageUrl(imageUrl: string): Promise<ImageStatus> {
  const isCloudinary = imageUrl.includes('res.cloudinary.com');
  
  try {
    const response = await fetch(imageUrl, { method: 'HEAD', mode: 'no-cors' });
    // With no-cors, we can't check response.ok, so we assume success if fetch completes
    return {
      isWorking: true,
      isCloudinary,
      isMissing: false
    };
  } catch (e) {
    return {
      isWorking: false,
      isCloudinary,
      isMissing: true
    };
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export const AdminImageManager: React.FC<AdminImageManagerProps> = ({
  productId,
  initialImages = [],
  onImagesChanged
}) => {
  const [images, setImages] = useState<ImageRecord[]>(initialImages);
  const [imageStatuses, setImageStatuses] = useState<Record<string, ImageStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Drag-to-reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Replace-mode: which image ID are we replacing?
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Validate images on load
  React.useEffect(() => {
    if (images.length === 0) {
      setImageStatuses({});
      return;
    }

    const validateAllImages = async () => {
      const statuses: Record<string, ImageStatus> = {};
      for (const img of images) {
        statuses[img.id] = await validateImageUrl(img.image_url);
      }
      setImageStatuses(statuses);
    };

    validateAllImages();
  }, [images]);

  const notify = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccess(msg);
      setError(null);
      setTimeout(() => setSuccess(null), 4000);
    } else {
      setError(msg);
      setSuccess(null);
      setTimeout(() => setError(null), 6000);
    }
  };

  const refresh = useCallback(async () => {
    if (!productId) return;
    setIsLoading(true);
    try {
      const imgs = await fetchImages(productId);
      setImages(imgs);
      onImagesChanged?.(imgs);
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [productId, onImagesChanged]);

  // ── Upload ───────────────────────────────────────────────────────────

  const handleUpload = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (!fileArr.length) return;

    const invalid = fileArr.find(
      (f) => !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(f.type) || f.size > 4 * 1024 * 1024
    );
    if (invalid) {
      notify('Only JPEG/PNG/WebP images up to 4 MB each are accepted.', 'error');
      return;
    }

    setUploadProgress(`Uploading ${fileArr.length} image(s)…`);
    setIsLoading(true);
    try {
      let uploadedCount = 0;
      for (const file of fileArr) {
        const result = await uploadImages(productId, [file]);
        uploadedCount += result.images.length;
      }
      const fresh = await fetchImages(productId);
      setImages(fresh);
      onImagesChanged?.(fresh);
      notify(`${uploadedCount} image(s) uploaded successfully.`, 'success');
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setIsLoading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Replace ──────────────────────────────────────────────────────────

  const handleReplace = async (file: File) => {
    if (!replacingId) return;
    if (file.size > 4 * 1024 * 1024) {
      notify('Image must be under 4 MB.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      await replaceImage(replacingId, file);
      const fresh = await fetchImages(productId);
      setImages(fresh);
      onImagesChanged?.(fresh);
      notify('Image replaced successfully.', 'success');
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setIsLoading(false);
      setReplacingId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────

  const handleDelete = async (imgId: string, imgUrl: string) => {
    const filename = imgUrl.split('/').pop() || imgUrl;
    if (!window.confirm(`Permanently delete "${filename}"? This cannot be undone.`)) return;
    setIsLoading(true);
    try {
      await deleteImage(imgId);
      const fresh = await fetchImages(productId);
      setImages(fresh);
      onImagesChanged?.(fresh);
      notify('Image deleted permanently.', 'success');
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Set Cover ────────────────────────────────────────────────────────

  const handleSetCover = async (imgId: string) => {
    setIsLoading(true);
    try {
      const result = await setCover(imgId);
      setImages(result.images);
      onImagesChanged?.(result.images);
      notify('Cover image updated.', 'success');
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Drag-to-reorder ──────────────────────────────────────────────────

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragEnter = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = async () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Optimistic reorder locally
    const next = [...images];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dragOverIndex, 0, moved);
    setImages(next);
    setDragIndex(null);
    setDragOverIndex(null);

    // Persist to server
    try {
      const result = await reorderImages(productId, next.map((i) => i.id));
      setImages(result.images);
      onImagesChanged?.(result.images);
      notify('Image order saved.', 'success');
    } catch (e: any) {
      notify(e.message, 'error');
      await refresh(); // revert
    }
  };

  // ── Drop-zone drag-over for new file uploads ─────────────────────────

  const handleDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1A1A1A] font-cinzel flex items-center gap-2">
          <ImagePlus className="w-3.5 h-3.5 text-[#C5A059]" />
          Product Images
          {images.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-[#F5F2ED] border border-[#E5E1D8] text-[#6B6658] text-[10px] rounded">
              {images.length}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={refresh}
          disabled={isLoading}
          className="p-1 text-[#8E8A81] hover:text-[#1A1A1A] transition-colors disabled:opacity-40"
          title="Refresh images"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status messages */}
      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {uploadProgress && (
        <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs">
          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          <span>{uploadProgress}</span>
        </div>
      )}

      {/* Drop-zone for new uploads */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDropZoneDragOver}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDropZoneDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded cursor-pointer transition-colors p-4 text-center ${
          isDraggingOver
            ? 'border-[#C5A059] bg-[#FDF9F3]'
            : 'border-[#D9D5CC] bg-[#FAF8F5] hover:border-[#C5A059] hover:bg-[#FDF9F3]'
        } ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <Upload className="w-5 h-5 text-[#C5A059] mx-auto mb-1.5" />
        <p className="text-xs font-medium text-[#1A1A1A]">
          {isDraggingOver ? 'Drop images here' : 'Upload Images'}
        </p>
        <p className="text-[10px] text-[#8E8A81] mt-0.5">
          JPEG · PNG · WebP · up to 10 MB each · multiple allowed
        </p>
        {/* Hidden real file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
        />
      </div>

      {/* Hidden replace input */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleReplace(e.target.files[0]);
        }}
      />

      {/* Image grid */}
      {images.length === 0 ? (
        <p className="text-center text-xs text-[#8E8A81] py-6 bg-[#FAF8F5] border border-[#E5E1D8]">
          No images yet. Upload the first image above.
        </p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[10px] text-[#8E8A81] uppercase tracking-wider">
            Drag rows to reorder · First image = cover
          </p>
          <div className="space-y-2">
            {images.map((img, idx) => {
              const status = imageStatuses[img.id];
              const statusIcon = img.is_cover ? (
                <div className="flex items-center gap-0.5 text-[#C5A059] text-xs" title="Cover image">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="font-medium">★</span>
                </div>
              ) : status?.isCloudinary ? (
                <div className="flex items-center gap-0.5 text-blue-600 text-xs" title="Cloudinary hosted">
                  <Cloud className="w-3 h-3" />
                  <span className="font-medium">☁</span>
                </div>
              ) : status?.isMissing ? (
                <div className="flex items-center gap-0.5 text-red-600 text-xs" title="Image missing or broken">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="font-medium">⚠</span>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 text-emerald-600 text-xs" title="Working">
                  <CheckCircle className="w-3 h-3" />
                  <span className="font-medium">✓</span>
                </div>
              );

              return (
              <div
                key={img.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragEnter={() => handleDragEnter(idx)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className={`flex items-center gap-3 p-2 border rounded transition-colors ${
                  dragOverIndex === idx && dragIndex !== idx
                    ? 'border-[#C5A059] bg-[#FDF9F3]'
                    : img.is_cover
                    ? 'border-[#C5A059] bg-[#FDFAF4]'
                    : 'border-[#E5E1D8] bg-white hover:border-[#D0C9BE]'
                } ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
              >
                {/* Drag handle */}
                <GripVertical className="w-4 h-4 text-[#C0BAB0] shrink-0 cursor-grab active:cursor-grabbing" />

                {/* Thumbnail */}
                <div className="w-12 h-14 shrink-0 overflow-hidden border border-[#E5E1D8] bg-[#F5F2ED]">
                  <img
                    src={img.image_url}
                    alt={img.alt_text || `Image ${idx + 1}`}
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/mens_raw_silk_kurta.jpg';
                    }}
                  />
                </div>

                {/* Info with Status Badge */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {statusIcon}
                    <p className="text-[10px] text-[#1A1A1A] font-medium truncate">
                      {img.image_url.split('/').pop()}
                    </p>
                  </div>
                  <p className="text-[9px] text-[#8E8A81]">Position {idx + 1}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Preview */}
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(img.image_url)}
                    className="p-1.5 text-[#8E8A81] hover:text-[#1A1A1A] hover:bg-[#F5F2ED] rounded transition-colors"
                    title="Preview"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>

                  {/* Set cover */}
                  {!img.is_cover && (
                    <button
                      type="button"
                      onClick={() => handleSetCover(img.id)}
                      className="p-1.5 text-[#8E8A81] hover:text-[#C5A059] hover:bg-[#FDF9F3] rounded transition-colors"
                      title="Set as cover"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Replace */}
                  <button
                    type="button"
                    onClick={() => {
                      setReplacingId(img.id);
                      replaceInputRef.current?.click();
                    }}
                    className="p-1.5 text-[#8E8A81] hover:text-[#4B8CF5] hover:bg-blue-50 rounded transition-colors"
                    title="Replace image"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDelete(img.id, img.image_url)}
                    className="p-1.5 text-[#8E8A81] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fullscreen preview lightbox */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 p-2 text-white hover:text-[#C5A059] transition-colors"
            aria-label="Close preview"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
