import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Trash2, Star, GripVertical, X, Search, Loader } from 'lucide-react';

interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  display_order: number;
  is_cover: number;
  view_type: string;
  alt_text?: string;
  created_at: string;
  updated_at: string;
}

interface Product {
  id: string;
  title: string;
  category_name: string;
  price: number;
  stock: number;
}

interface UploadProgress {
  current: number;
  total: number;
  percentage: number;
}

interface ImageManagerState {
  products: Product[];
  selectedProduct: Product | null;
  images: ProductImage[];
  loading: boolean;
  uploading: boolean;
  uploadProgress: UploadProgress | null;
  searchQuery: string;
  draggedImageId: string | null;
  selectedImageIds: Set<string>;
  error: string | null;
  success: string | null;
}

export const ProductImageManager: React.FC = () => {
  const [state, setState] = useState<ImageManagerState>({
    products: [],
    selectedProduct: null,
    images: [],
    loading: false,
    uploading: false,
    uploadProgress: null,
    searchQuery: '',
    draggedImageId: null,
    selectedImageIds: new Set(),
    error: null,
    success: null
  });

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch('/api/products?limit=1000');
      if (!response.ok) throw new Error('Failed to load products');
      const data = await response.json();
      setState(prev => ({ ...prev, products: data, loading: false }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load products'
      }));
    }
  };

  const loadProductImages = useCallback(async (productId: string) => {
    try {
      const response = await fetch(`/api/images/product/${productId}`);
      if (!response.ok) throw new Error('Failed to load images');
      const data = await response.json();
      setState(prev => ({
        ...prev,
        images: data,
        selectedImageIds: new Set()
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load images'
      }));
    }
  }, []);

  const handleProductSelect = (product: Product) => {
    setState(prev => ({ ...prev, selectedProduct: product }));
    loadProductImages(product.id);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!state.selectedProduct || !event.target.files) return;

    const files = Array.from(event.target.files) as File[];
    const validFiles = files.filter((file: File) => {
      const valid = /\.(jpg|jpeg|png|webp)$/i.test(file.name) && file.size < 10 * 1024 * 1024;
      if (!valid) {
        setState(prev => ({
          ...prev,
          error: `Invalid file: ${file.name}. Max 10MB, jpg/jpeg/png/webp only.`
        }));
      }
      return valid;
    });

    if (validFiles.length === 0) return;

    setState(prev => ({
      ...prev,
      uploading: true,
      uploadProgress: { current: 0, total: validFiles.length, percentage: 0 }
    }));

    for (let i = 0; i < validFiles.length; i++) {
      const file: File = validFiles[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`/api/images/upload-cloudinary/${state.selectedProduct.id}`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        setState(prev => ({
          ...prev,
          uploadProgress: {
            current: i + 1,
            total: validFiles.length,
            percentage: Math.round(((i + 1) / validFiles.length) * 100)
          }
        }));

        await loadProductImages(state.selectedProduct.id);
      } catch (err) {
        setState(prev => ({
          ...prev,
          error: `Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`
        }));
      }
    }

    setState(prev => ({
      ...prev,
      uploading: false,
      uploadProgress: null,
      success: `Successfully uploaded ${validFiles.length} image(s)!`
    }));

    event.target.value = '';
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!window.confirm('Delete this image?')) return;

    try {
      const response = await fetch(`/api/images/${imageId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');

      setState(prev => ({
        ...prev,
        images: prev.images.filter(img => img.id !== imageId),
        success: 'Image deleted successfully'
      }));

      if (state.selectedProduct) {
        await loadProductImages(state.selectedProduct.id);
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to delete image'
      }));
    }
  };

  const handleSetCover = async (imageId: string) => {
    try {
      const response = await fetch(`/api/images/${imageId}/cover`, { method: 'PATCH' });
      if (!response.ok) throw new Error('Failed to set cover');

      setState(prev => ({
        ...prev,
        images: prev.images.map(img => ({
          ...img,
          is_cover: img.id === imageId ? 1 : 0
        })),
        success: 'Cover image updated'
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to set cover'
      }));
    }
  };

  const handleDragStart = (imageId: string) => {
    setState(prev => ({ ...prev, draggedImageId: imageId }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetImageId: string) => {
    if (!state.draggedImageId || !state.selectedProduct) return;

    const newOrder = state.images.map(img => img.id);
    const draggedIndex = newOrder.indexOf(state.draggedImageId);
    const targetIndex = newOrder.indexOf(targetImageId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, state.draggedImageId);

    try {
      const response = await fetch(`/api/images/reorder/${state.selectedProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds: newOrder })
      });

      if (!response.ok) throw new Error('Reorder failed');

      await loadProductImages(state.selectedProduct.id);
      setState(prev => ({ ...prev, draggedImageId: null, success: 'Images reordered' }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to reorder',
        draggedImageId: null
      }));
    }
  };

  const filteredProducts = state.products.filter(p =>
    p.id.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
    p.title.toLowerCase().includes(state.searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-serif text-amber-900 mb-2">Image Manager</h1>
          <p className="text-amber-700">Manage product images on Cloudinary</p>
        </div>

        {/* Alerts */}
        {state.error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex justify-between items-center">
            <span>{state.error}</span>
            <button onClick={() => setState(prev => ({ ...prev, error: null }))} className="text-red-700">
              <X size={20} />
            </button>
          </div>
        )}

        {state.success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded flex justify-between items-center">
            <span>{state.success}</span>
            <button onClick={() => setState(prev => ({ ...prev, success: null }))} className="text-green-700">
              <X size={20} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Search and List */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-lg p-6 border-2 border-amber-100">
            <h2 className="text-xl font-serif text-amber-900 mb-4">Products</h2>

            <div className="mb-4 relative">
              <Search className="absolute left-3 top-3 text-amber-400" size={18} />
              <input
                type="text"
                placeholder="Search products..."
                value={state.searchQuery}
                onChange={e => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-amber-200 rounded text-sm"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => handleProductSelect(product)}
                  className={`w-full text-left p-3 rounded transition-all border-l-4 ${
                    state.selectedProduct?.id === product.id
                      ? 'bg-amber-50 border-l-amber-600 border border-amber-300'
                      : 'bg-gray-50 border-l-transparent hover:bg-amber-50'
                  }`}
                >
                  <div className="font-medium text-sm text-amber-900">{product.title}</div>
                  <div className="text-xs text-amber-700">₹{product.price}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Image Management */}
          <div className="lg:col-span-2">
            {state.selectedProduct ? (
              <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-amber-100">
                <div className="mb-6">
                  <h2 className="text-xl font-serif text-amber-900 mb-2">{state.selectedProduct.title}</h2>
                  <p className="text-sm text-amber-700 mb-4">
                    {state.images.length} image{state.images.length !== 1 ? 's' : ''}
                  </p>

                  {/* Upload Area */}
                  <label className="block border-2 border-dashed border-amber-300 rounded-lg p-8 text-center cursor-pointer hover:bg-amber-50 transition-colors">
                    <Upload className="mx-auto mb-2 text-amber-600" size={32} />
                    <p className="text-sm font-medium text-amber-900">Drag images here or click to select</p>
                    <p className="text-xs text-amber-700">JPG, PNG, WebP up to 10MB</p>
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={handleFileUpload}
                      disabled={state.uploading}
                      className="hidden"
                    />
                  </label>

                  {state.uploadProgress && (
                    <div className="mt-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Uploading...</span>
                        <span className="text-sm">{state.uploadProgress.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-amber-600 h-2 rounded-full transition-all"
                          style={{ width: `${state.uploadProgress.percentage}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Images Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {state.images.map(image => (
                    <div
                      key={image.id}
                      draggable
                      onDragStart={() => handleDragStart(image.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(image.id)}
                      className="relative group cursor-move border-2 border-amber-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      <img
                        src={image.image_url}
                        alt={image.alt_text || 'Product image'}
                        className="w-full h-40 object-cover"
                      />

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleSetCover(image.id)}
                          className={`p-2 rounded-full transition-all ${
                            image.is_cover
                              ? 'bg-yellow-400 text-amber-900'
                              : 'bg-gray-600 text-white opacity-0 group-hover:opacity-100'
                          }`}
                          title={image.is_cover ? 'Cover image' : 'Set as cover'}
                        >
                          <Star size={18} fill="currentColor" />
                        </button>

                        <button
                          onClick={() => handleDeleteImage(image.id)}
                          className="p-2 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-700"
                          title="Delete image"
                        >
                          <Trash2 size={18} />
                        </button>

                        <GripVertical size={18} className="text-white opacity-0 group-hover:opacity-100" />
                      </div>

                      {/* Cover Badge */}
                      {image.is_cover === 1 && (
                        <div className="absolute top-2 left-2 bg-yellow-400 text-amber-900 px-2 py-1 rounded text-xs font-medium">
                          Cover
                        </div>
                      )}

                      {/* Order Badge */}
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs font-medium">
                        #{image.display_order + 1}
                      </div>
                    </div>
                  ))}
                </div>

                {state.images.length === 0 && !state.loading && (
                  <div className="text-center py-12">
                    <Upload className="mx-auto mb-4 text-amber-300" size={48} />
                    <p className="text-amber-700 font-medium">No images yet</p>
                    <p className="text-sm text-amber-600">Upload images to get started</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-12 border-2 border-amber-100 text-center">
                <p className="text-amber-700">Select a product to manage its images</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductImageManager;
