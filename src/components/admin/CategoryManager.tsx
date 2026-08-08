import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, Trash2, Edit2, GripVertical, Eye, EyeOff, ZoomIn,
  X, Plus, CheckCircle, AlertCircle, Loader2, RefreshCw,
  Monitor, Smartphone, Save, ChevronUp, ChevronDown
} from 'lucide-react';
import { api } from '../../services/api';

// ── Types ──────────────────────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  mobile_image_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  display_order: number;
}

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  display_order: number;
  desktopFile: File | null;
  mobileFile: File | null;
  desktopPreview: string;
  mobilePreview: string;
}

const EMPTY_FORM: CategoryFormData = {
  name: '', slug: '', description: '',
  is_active: true, display_order: 0,
  desktopFile: null, mobileFile: null,
  desktopPreview: '', mobilePreview: ''
};

// ── Helpers ────────────────────────────────────────────────────────────────
function buildFormData(form: CategoryFormData): FormData {
  const fd = new FormData();
  fd.append('name', form.name);
  fd.append('slug', form.slug);
  fd.append('description', form.description);
  fd.append('is_active', form.is_active ? '1' : '0');
  fd.append('display_order', form.display_order.toString());
  if (form.desktopFile) fd.append('image', form.desktopFile);
  if (form.mobileFile) fd.append('mobile_image', form.mobileFile);
  return fd;
}

function previewUrl(file: File): string {
  return URL.createObjectURL(file);
}

// ── Main Component ─────────────────────────────────────────────────────────
export const CategoryManager: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit / Create modal state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<CategoryFormData>(EMPTY_FORM);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Drag reorder
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const notify = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') { setSuccess(msg); setError(null); setTimeout(() => setSuccess(null), 4500); }
    else { setError(msg); setSuccess(null); setTimeout(() => setError(null), 6000); }
  };

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getAdminCategories();
      setCategories(data);
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  // ── Form helpers ───────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingCategory(null);
    setIsCreating(true);
  };

  const openEdit = (c: Category) => {
    setForm({
      name: c.name, slug: c.slug, description: c.description,
      is_active: c.is_active, display_order: c.display_order,
      desktopFile: null, mobileFile: null,
      desktopPreview: c.image_url, mobilePreview: c.mobile_image_url || ''
    });
    setEditingCategory(c);
    setIsCreating(true);
  };

  const closeModal = () => {
    setIsCreating(false);
    setEditingCategory(null);
    if (form.desktopFile) URL.revokeObjectURL(form.desktopPreview);
    if (form.mobileFile) URL.revokeObjectURL(form.mobilePreview);
    setForm(EMPTY_FORM);
  };

  const setField = (key: keyof CategoryFormData, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleFileSelect = (type: 'desktop' | 'mobile', file: File) => {
    const url = previewUrl(file);
    if (type === 'desktop') {
      if (form.desktopFile) URL.revokeObjectURL(form.desktopPreview);
      setForm(prev => ({ ...prev, desktopFile: file, desktopPreview: url }));
    } else {
      if (form.mobileFile) URL.revokeObjectURL(form.mobilePreview);
      setForm(prev => ({ ...prev, mobileFile: file, mobilePreview: url }));
    }
  };

  // ── Save (create or update) ────────────────────────────────────────────
  const handleSave = async () => {
    if (!editingCategory && !form.desktopFile) {
      notify('A desktop category image is required to create a new category.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const fd = buildFormData(form);
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, fd);
        notify('Category updated successfully.', 'success');
      } else {
        await api.createCategory(fd);
        notify('Category created and saved permanently.', 'success');
      }
      closeModal();
      await loadCategories();
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Toggle active ──────────────────────────────────────────────────────
  const handleToggle = async (id: string) => {
    try {
      await api.toggleCategory(id);
      await loadCategories();
    } catch (e: any) {
      notify(e.message, 'error');
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = async (c: Category) => {
    if (!window.confirm(`Permanently delete category "${c.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteCategory(c.id);
      notify('Category deleted.', 'success');
      await loadCategories();
    } catch (e: any) {
      notify(e.message, 'error');
    }
  };

  // ── Drag-to-reorder ────────────────────────────────────────────────────
  const handleDragStart = (idx: number) => setDragIndex(idx);
  const handleDragEnter = (idx: number) => {
    if (dragIndex === null || dragIndex === idx) return;
    setDragOverIndex(idx);
  };
  const handleDragEnd = async () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const next = [...categories];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dragOverIndex, 0, moved);
    setCategories(next);
    setDragIndex(null); setDragOverIndex(null);
    try {
      await api.reorderCategories(next.map(c => c.id));
      notify('Category order saved.', 'success');
    } catch (e: any) {
      notify(e.message, 'error');
      await loadCategories();
    }
  };

  // ── Move up/down (accessibility) ─────────────────────────────────────────
  const moveUp = async (idx: number) => {
    if (idx === 0) return;
    const next = [...categories];
    [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
    setCategories(next);
    try {
      await api.reorderCategories(next.map(c => c.id));
    } catch (e: any) {
      notify(e.message, 'error');
      await loadCategories();
    }
  };

  const moveDown = async (idx: number) => {
    if (idx === categories.length - 1) return;
    const next = [...categories];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setCategories(next);
    try {
      await api.reorderCategories(next.map(c => c.id));
    } catch (e: any) {
      notify(e.message, 'error');
      await loadCategories();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#1A1A1A]">Collection Categories</h2>
          <p className="text-sm text-[#6B6658] mt-1">Manage homepage collection showcase images</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadCategories}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E1D8] rounded-lg hover:bg-[#FAF9F6] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white rounded-lg hover:bg-[#333] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Category
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Category List */}
      {isLoading && categories.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#C5A059]" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 bg-white border border-[#E5E1D8] rounded-lg">
          <p className="text-[#6B6658]">No categories yet. Create your first collection category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-4 p-4 bg-white border rounded-lg transition-all ${
                dragIndex === idx ? 'opacity-50' : 'hover:shadow-md'
              } ${dragOverIndex === idx ? 'border-[#C5A059]' : 'border-[#E5E1D8]'}`}
            >
              {/* Drag Handle */}
              <div className="cursor-grab text-[#9CA3AF] hover:text-[#6B6658]">
                <GripVertical className="w-5 h-5" />
              </div>

              {/* Desktop Image */}
              <div className="relative w-16 h-16 flex-shrink-0 bg-[#F5F2ED] rounded overflow-hidden group">
                <img
                  src={cat.image_url}
                  alt={cat.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    el.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect fill=%22%23F5F2ED%22 width=%2264%22 height=%2264%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2210%22 fill=%22%238E8A81%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3ENo Image%3C/text%3E%3C/svg%3E';
                  }}
                />
                <button
                  onClick={() => setLightboxUrl(cat.image_url)}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <ZoomIn className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-[#1A1A1A] truncate">{cat.name}</h3>
                  {!cat.is_active && (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">Hidden</span>
                  )}
                </div>
                <p className="text-sm text-[#6B6658] truncate">{cat.slug}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[#9CA3AF]">Order: {cat.display_order}</span>
                  {cat.mobile_image_url && (
                    <span className="text-xs text-[#C5A059] flex items-center gap-1">
                      <Smartphone className="w-3 h-3" />
                      Mobile
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="p-2 text-[#6B6658] hover:text-[#1A1A1A] disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === categories.length - 1}
                  className="p-2 text-[#6B6658] hover:text-[#1A1A1A] disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggle(cat.id)}
                  className={`p-2 ${cat.is_active ? 'text-green-600' : 'text-gray-400'} hover:text-green-700`}
                  title={cat.is_active ? 'Hide' : 'Show'}
                >
                  {cat.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => openEdit(cat)}
                  className="p-2 text-[#6B6658] hover:text-[#1A1A1A]"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  className="p-2 text-red-500 hover:text-red-700"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#E5E1D8] px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-[#1A1A1A]">
                {editingCategory ? 'Edit Category' : 'New Category'}
              </h3>
              <button onClick={closeModal} className="text-[#6B6658] hover:text-[#1A1A1A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Category Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  className="w-full px-4 py-2 border border-[#E5E1D8] rounded-lg focus:ring-2 focus:ring-[#C5A059] focus:border-transparent"
                  placeholder="e.g., Royal Men's Kurta Sets"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-2">URL Slug *</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setField('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  className="w-full px-4 py-2 border border-[#E5E1D8] rounded-lg focus:ring-2 focus:ring-[#C5A059] focus:border-transparent"
                  placeholder="e.g., mens-kurta-sets"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-[#E5E1D8] rounded-lg focus:ring-2 focus:ring-[#C5A059] focus:border-transparent"
                  placeholder="Brief description of this collection..."
                />
              </div>

              {/* Desktop Image */}
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                  Desktop Image * {editingCategory && '(leave empty to keep current)'}
                </label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      ref={desktopInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect('desktop', e.target.files[0])}
                      className="hidden"
                    />
                    <button
                      onClick={() => desktopInputRef.current?.click()}
                      className="w-full px-4 py-2 border border-[#E5E1D8] rounded-lg hover:bg-[#FAF9F6] flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {form.desktopFile ? form.desktopFile.name : 'Choose Image'}
                    </button>
                  </div>
                  {form.desktopPreview && (
                    <div className="relative w-24 h-24 bg-[#F5F2ED] rounded overflow-hidden">
                      <img src={form.desktopPreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Image */}
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                  Mobile Image (optional) {editingCategory && '(leave empty to keep current)'}
                </label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      ref={mobileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect('mobile', e.target.files[0])}
                      className="hidden"
                    />
                    <button
                      onClick={() => mobileInputRef.current?.click()}
                      className="w-full px-4 py-2 border border-[#E5E1D8] rounded-lg hover:bg-[#FAF9F6] flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {form.mobileFile ? form.mobileFile.name : 'Choose Image'}
                    </button>
                  </div>
                  {form.mobilePreview && (
                    <div className="relative w-24 h-24 bg-[#F5F2ED] rounded overflow-hidden">
                      <img src={form.mobilePreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Active */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setField('is_active', e.target.checked)}
                  className="w-4 h-4 text-[#C5A059] border-[#E5E1D8] rounded focus:ring-[#C5A059]"
                />
                <label htmlFor="is_active" className="text-sm text-[#1A1A1A]">Active (visible on homepage)</label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[#E5E1D8] px-6 py-4 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-[#E5E1D8] rounded-lg hover:bg-[#FAF9F6]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-[#1A1A1A] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingCategory ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="Full size" className="max-w-full max-h-full object-contain" />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
};
