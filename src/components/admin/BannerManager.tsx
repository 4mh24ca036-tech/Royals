import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, Trash2, Edit2, GripVertical, Eye, EyeOff, ZoomIn,
  X, Plus, CheckCircle, AlertCircle, Loader2, RefreshCw,
  Monitor, Smartphone, Save, ChevronUp, ChevronDown
} from 'lucide-react';
import { api } from '../../services/api';

// ── Types ──────────────────────────────────────────────────────────────────
export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image_url: string;
  mobile_image_url: string;
  button_text: string;
  button_link: string;
  tag: string;
  category_id: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BannerFormData {
  title: string;
  subtitle: string;
  description: string;
  button_text: string;
  button_link: string;
  tag: string;
  category_id: string;
  is_active: boolean;
  desktopFile: File | null;
  mobileFile: File | null;
  desktopPreview: string;
  mobilePreview: string;
}

const EMPTY_FORM: BannerFormData = {
  title: '', subtitle: '', description: '',
  button_text: 'Shop Now', button_link: '',
  tag: '', category_id: '',
  is_active: true,
  desktopFile: null, mobileFile: null,
  desktopPreview: '', mobilePreview: ''
};

// ── Helpers ────────────────────────────────────────────────────────────────
function buildFormData(form: BannerFormData): FormData {
  const fd = new FormData();
  fd.append('title', form.title);
  fd.append('subtitle', form.subtitle);
  fd.append('description', form.description);
  fd.append('button_text', form.button_text);
  fd.append('button_link', form.button_link);
  fd.append('tag', form.tag);
  fd.append('category_id', form.category_id);
  fd.append('is_active', form.is_active ? '1' : '0');
  if (form.desktopFile) fd.append('image', form.desktopFile);
  if (form.mobileFile) fd.append('mobile_image', form.mobileFile);
  return fd;
}

function previewUrl(file: File): string {
  return URL.createObjectURL(file);
}

// ── Main Component ─────────────────────────────────────────────────────────
export const BannerManager: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit / Create modal state
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<BannerFormData>(EMPTY_FORM);

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

  const loadBanners = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getAdminBanners();
      setBanners(data);
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadBanners(); }, [loadBanners]);

  // ── Form helpers ───────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingBanner(null);
    setIsCreating(true);
  };

  const openEdit = (b: Banner) => {
    setForm({
      title: b.title, subtitle: b.subtitle, description: b.description,
      button_text: b.button_text, button_link: b.button_link,
      tag: b.tag, category_id: b.category_id,
      is_active: b.is_active,
      desktopFile: null, mobileFile: null,
      desktopPreview: b.image_url, mobilePreview: b.mobile_image_url || ''
    });
    setEditingBanner(b);
    setIsCreating(true);
  };

  const closeModal = () => {
    setIsCreating(false);
    setEditingBanner(null);
    if (form.desktopFile) URL.revokeObjectURL(form.desktopPreview);
    if (form.mobileFile) URL.revokeObjectURL(form.mobilePreview);
    setForm(EMPTY_FORM);
  };

  const setField = (key: keyof BannerFormData, value: any) =>
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
    if (!editingBanner && !form.desktopFile) {
      notify('A desktop banner image is required to create a new banner.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const fd = buildFormData(form);
      if (editingBanner) {
        await api.updateBanner(editingBanner.id, fd);
        notify('Banner updated successfully.', 'success');
      } else {
        await api.createBanner(fd);
        notify('Banner created and saved permanently.', 'success');
      }
      closeModal();
      await loadBanners();
    } catch (e: any) {
      notify(e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Toggle active ──────────────────────────────────────────────────────
  const handleToggle = async (id: string) => {
    try {
      await api.toggleBanner(id);
      await loadBanners();
    } catch (e: any) {
      notify(e.message, 'error');
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = async (b: Banner) => {
    if (!window.confirm(`Permanently delete banner "${b.title || b.id}"? This cannot be undone.`)) return;
    try {
      await api.deleteBanner(b.id);
      notify('Banner deleted.', 'success');
      await loadBanners();
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
    const next = [...banners];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dragOverIndex, 0, moved);
    setBanners(next);
    setDragIndex(null); setDragOverIndex(null);
    try {
      await api.reorderBanners(next.map(b => b.id));
      notify('Banner order saved.', 'success');
    } catch (e: any) {
      notify(e.message, 'error');
      await loadBanners();
    }
  };

  // ── Move up/down buttons (keyboard-accessible alternative to drag) ──────
  const moveItem = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= banners.length) return;
    const next = [...banners];
    [next[idx], next[target]] = [next[target], next[idx]];
    setBanners(next);
    try {
      await api.reorderBanners(next.map(b => b.id));
      notify('Banner order saved.', 'success');
    } catch (e: any) {
      notify(e.message, 'error');
      await loadBanners();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-[#1A1A1A] font-cinzel">
            Banner Management
          </h2>
          <p className="text-[11px] text-[#8E8A81] mt-0.5">
            Images are permanently stored — survive refresh, restart, and deployment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadBanners} disabled={isLoading}
            className="p-2 text-[#8E8A81] hover:text-[#1A1A1A] transition-colors disabled:opacity-40"
            title="Refresh">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] uppercase tracking-widest font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add Banner
          </button>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />{success}
        </div>
      )}

      {/* Banner List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-[#8E8A81]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-xs">Loading banners…</span>
        </div>
      ) : banners.length === 0 ? (
        <div className="text-center py-12 bg-[#FAF8F5] border border-dashed border-[#D9D5CC]">
          <Upload className="w-8 h-8 text-[#C5A059] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#1A1A1A]">No banners yet</p>
          <p className="text-xs text-[#8E8A81] mt-1">Click "Add Banner" to create your first homepage banner.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[10px] text-[#8E8A81] uppercase tracking-wider">
            Drag rows to reorder · Changes save immediately
          </p>
          {banners.map((b, idx) => (
            <div
              key={b.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              className={`flex items-center gap-3 p-3 border rounded transition-colors ${
                dragOverIndex === idx && dragIndex !== idx
                  ? 'border-[#C5A059] bg-[#FDF9F3]'
                  : 'border-[#E5E1D8] bg-white hover:border-[#C5A059]/40'
              }`}
            >
              {/* Drag handle */}
              <GripVertical className="w-4 h-4 text-[#C0BAB0] shrink-0 cursor-grab active:cursor-grabbing" />

              {/* Thumbnail */}
              <div className="w-20 h-12 shrink-0 overflow-hidden border border-[#E5E1D8] bg-[#F5F2ED]">
                <img
                  src={b.image_url}
                  alt={b.title || 'Banner'}
                  loading="lazy"
                  onError={e => { (e.target as HTMLImageElement).src = '/images/hero_royal_kurtas_1785856586452.jpg'; }}
                  className="w-full h-full object-cover object-center"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-xs font-semibold text-[#1A1A1A] truncate">{b.title || <em className="text-[#8E8A81]">No title</em>}</p>
                <p className="text-[10px] text-[#8E8A81] truncate">{b.subtitle || '—'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-block px-1.5 py-0.5 text-[9px] font-medium rounded-sm uppercase tracking-wider ${
                    b.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-[#F0EDE8] text-[#8E8A81]'
                  }`}>
                    {b.is_active ? 'Active' : 'Hidden'}
                  </span>
                  {b.mobile_image_url && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] text-[#8E8A81]">
                      <Smartphone className="w-2.5 h-2.5" /> Mobile
                    </span>
                  )}
                  <span className="text-[9px] text-[#C0BAB0]">#{idx + 1}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                  className="p-1.5 text-[#8E8A81] hover:text-[#1A1A1A] hover:bg-[#F5F2ED] rounded transition-colors disabled:opacity-25"
                  title="Move up"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveItem(idx, 1)} disabled={idx === banners.length - 1}
                  className="p-1.5 text-[#8E8A81] hover:text-[#1A1A1A] hover:bg-[#F5F2ED] rounded transition-colors disabled:opacity-25"
                  title="Move down"><ChevronDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => setLightboxUrl(b.image_url)}
                  className="p-1.5 text-[#8E8A81] hover:text-[#1A1A1A] hover:bg-[#F5F2ED] rounded transition-colors"
                  title="Preview"><ZoomIn className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleToggle(b.id)}
                  className={`p-1.5 rounded transition-colors ${b.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-[#8E8A81] hover:bg-[#F5F2ED]'}`}
                  title={b.is_active ? 'Disable banner' : 'Enable banner'}>
                  {b.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => openEdit(b)}
                  className="p-1.5 text-[#8E8A81] hover:text-[#4B8CF5] hover:bg-blue-50 rounded transition-colors"
                  title="Edit banner"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(b)}
                  className="p-1.5 text-[#8E8A81] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete banner"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit / Create Modal ─────────────────────────────────────────── */}
      {isCreating && (
        <div className="fixed inset-0 z-[150] bg-black/70 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
          <div className="bg-white w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E1D8]">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] font-cinzel">
                {editingBanner ? 'Edit Banner' : 'New Banner'}
              </h3>
              <button onClick={closeModal} className="p-1.5 text-[#8E8A81] hover:text-[#1A1A1A] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* Desktop image upload */}
              <div className="space-y-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#1A1A1A]">
                  <Monitor className="w-3 h-3 inline mr-1" />
                  Desktop Banner Image {!editingBanner && <span className="text-red-500">*</span>}
                </label>
                <div
                  onClick={() => desktopInputRef.current?.click()}
                  className="relative cursor-pointer border-2 border-dashed border-[#D9D5CC] hover:border-[#C5A059] transition-colors bg-[#FAF8F5] hover:bg-[#FDF9F3]"
                >
                  {form.desktopPreview ? (
                    <div className="relative">
                      <img src={form.desktopPreview} alt="Desktop preview"
                        className="w-full h-44 object-cover object-center"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-medium">Click to replace</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <Upload className="w-6 h-6 text-[#C5A059]" />
                      <p className="text-xs text-[#1A1A1A] font-medium">Upload desktop banner</p>
                      <p className="text-[10px] text-[#8E8A81]">JPEG · PNG · WebP · up to 15 MB · recommended 1920×800px</p>
                    </div>
                  )}
                </div>
                <input ref={desktopInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFileSelect('desktop', e.target.files[0]); e.target.value = ''; }} />
              </div>

              {/* Mobile image upload */}
              <div className="space-y-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#1A1A1A]">
                  <Smartphone className="w-3 h-3 inline mr-1" />
                  Mobile Banner Image <span className="text-[#8E8A81] font-normal">(optional — shown on screens &lt; 768px)</span>
                </label>
                <div
                  onClick={() => mobileInputRef.current?.click()}
                  className="relative cursor-pointer border-2 border-dashed border-[#D9D5CC] hover:border-[#C5A059] transition-colors bg-[#FAF8F5] hover:bg-[#FDF9F3]"
                >
                  {form.mobilePreview ? (
                    <div className="relative">
                      <img src={form.mobilePreview} alt="Mobile preview"
                        className="w-full h-28 object-cover object-center"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-medium">Click to replace</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-5 gap-1.5">
                      <Smartphone className="w-5 h-5 text-[#C5A059]" />
                      <p className="text-[11px] text-[#8E8A81]">Upload mobile banner (optional · 768×600px)</p>
                    </div>
                  )}
                </div>
                <input ref={mobileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFileSelect('mobile', e.target.files[0]); e.target.value = ''; }} />
              </div>

              {/* Text fields — two-column grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#1A1A1A]">Title</label>
                  <input type="text" value={form.title} onChange={e => setField('title', e.target.value)}
                    placeholder="e.g. THE IMPERIAL KURTA ATELIER"
                    className="w-full px-3 py-2 border border-[#D9D5CC] bg-white text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#1A1A1A]">Subtitle / Badge</label>
                  <input type="text" value={form.subtitle} onChange={e => setField('subtitle', e.target.value)}
                    placeholder="e.g. HERITAGE COUTURE 2026"
                    className="w-full px-3 py-2 border border-[#D9D5CC] bg-white text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]" />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#1A1A1A]">Description</label>
                  <textarea value={form.description} onChange={e => setField('description', e.target.value)}
                    rows={2} placeholder="Short description shown below the title…"
                    className="w-full px-3 py-2 border border-[#D9D5CC] bg-white text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059] resize-none" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#1A1A1A]">Button Text</label>
                  <input type="text" value={form.button_text} onChange={e => setField('button_text', e.target.value)}
                    placeholder="e.g. Explore Royal Kurtas"
                    className="w-full px-3 py-2 border border-[#D9D5CC] bg-white text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#1A1A1A]">Button Link <span className="text-[#8E8A81] font-normal">(optional)</span></label>
                  <input type="text" value={form.button_link} onChange={e => setField('button_link', e.target.value)}
                    placeholder="e.g. /shop or leave blank"
                    className="w-full px-3 py-2 border border-[#D9D5CC] bg-white text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#1A1A1A]">Tag Label</label>
                  <input type="text" value={form.tag} onChange={e => setField('tag', e.target.value)}
                    placeholder="e.g. Haute Couture Kurtas"
                    className="w-full px-3 py-2 border border-[#D9D5CC] bg-white text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#1A1A1A]">Category ID <span className="text-[#8E8A81] font-normal">(optional)</span></label>
                  <input type="text" value={form.category_id} onChange={e => setField('category_id', e.target.value)}
                    placeholder="e.g. cat_womens_kurtas"
                    className="w-full px-3 py-2 border border-[#D9D5CC] bg-white text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]" />
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setField('is_active', !form.is_active)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${form.is_active ? 'bg-emerald-500' : 'bg-[#D9D5CC]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs font-medium text-[#1A1A1A]">
                  {form.is_active ? 'Active — visible on website' : 'Hidden — not shown to customers'}
                </span>
              </label>

              {/* Modal actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E5E1D8]">
                <button onClick={closeModal} disabled={isSaving}
                  className="px-5 py-2.5 text-[11px] uppercase tracking-widest font-medium text-[#8E8A81] hover:text-[#1A1A1A] transition-colors disabled:opacity-40">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] uppercase tracking-widest font-medium transition-colors disabled:opacity-60">
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {isSaving ? 'Saving…' : editingBanner ? 'Save Changes' : 'Create Banner'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
            aria-label="Close">
            <X className="w-6 h-6" />
          </button>
          <img src={lightboxUrl} alt="Banner preview"
            className="max-w-[95vw] max-h-[88vh] object-contain shadow-2xl"
            onClick={e => e.stopPropagation()} />
        </div>
      )}

    </div>
  );
};
