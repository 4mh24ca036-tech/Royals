import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, X } from 'lucide-react';

interface ProductImageGalleryProps {
  images: string[];
  title: string;
  /** Aspect ratio class for the main stage. Default: aspect-[3/4] */
  aspectClass?: string;
  /** If true, preloads the first image eagerly (above-the-fold cover). */
  preloadCover?: boolean;
}

export const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({
  images,
  title,
  aspectClass = 'aspect-[3/4]',
  preloadCover = false
}) => {
  const validImages = images.filter(Boolean);
  const fallback = '/images/mens_raw_silk_kurta.jpg';
  const displayImages = validImages.length > 0 ? validImages : [fallback];

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  // Touch/swipe state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isDragging = useRef(false);

  const safeIndex = (i: number) =>
    ((i % displayImages.length) + displayImages.length) % displayImages.length;

  const goTo = useCallback(
    (index: number) => setActiveIndex(safeIndex(index)),
    [displayImages.length]
  );

  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => safeIndex(i - 1));
      if (e.key === 'ArrowRight') setLightboxIndex((i) => safeIndex(i + 1));
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen, displayImages.length]);

  // Touch handlers for main gallery swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Only intercept horizontal swipes (|dx| > |dy| * 1.5)
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 8) {
      isDragging.current = true;
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current || touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      dx < 0 ? next() : prev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
    isDragging.current = false;
  };

  const handleImgError = (index: number) => {
    setImgErrors((prev) => ({ ...prev, [index]: true }));
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const imgSrc = (index: number) =>
    imgErrors[index] ? fallback : displayImages[index];

  return (
    <>
      {/* ── Main Stage ───────────────────────────────────────────────── */}
      <div className="space-y-3 select-none">
        <div
          className={`relative ${aspectClass} bg-[#F5F2ED] overflow-hidden border border-[#E5E1D8] cursor-pointer group`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Images — CSS transitions between them */}
          {displayImages.map((src, idx) => (
            <img
              key={idx}
              src={imgErrors[idx] ? fallback : src}
              alt={idx === 0 ? title : `${title} view ${idx + 1}`}
              loading={idx === 0 && preloadCover ? 'eager' : 'lazy'}
              fetchPriority={idx === 0 && preloadCover ? 'high' : 'low'}
              decoding="async"
              onError={() => handleImgError(idx)}
              className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-300 ${
                idx === activeIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            />
          ))}

          {/* Prev / Next arrows — only show when multiple images */}
          {displayImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center bg-white/85 hover:bg-white border border-[#E5E1D8] shadow-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-4 h-4 text-[#1A1A1A]" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center bg-white/85 hover:bg-white border border-[#E5E1D8] shadow-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Next image"
              >
                <ChevronRight className="w-4 h-4 text-[#1A1A1A]" />
              </button>
            </>
          )}

          {/* Zoom button */}
          <button
            onClick={() => openLightbox(activeIndex)}
            className="absolute bottom-3 right-3 z-20 w-8 h-8 flex items-center justify-center bg-white/85 hover:bg-white border border-[#E5E1D8] shadow-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="View full size"
          >
            <ZoomIn className="w-3.5 h-3.5 text-[#1A1A1A]" />
          </button>

          {/* Dot indicators — mobile only */}
          {displayImages.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 sm:hidden">
              {displayImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goTo(idx)}
                  className={`rounded-full transition-all ${
                    idx === activeIndex
                      ? 'w-4 h-1.5 bg-[#C5A059]'
                      : 'w-1.5 h-1.5 bg-white/70 hover:bg-white'
                  }`}
                  aria-label={`Image ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Thumbnail strip — desktop ─────────────────────────────── */}
        {displayImages.length > 1 && (
          <div
            className="hidden sm:flex items-center gap-2 overflow-x-auto pb-1 scroll-smooth"
            role="listbox"
            aria-label="Product image thumbnails"
          >
            {displayImages.map((src, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                role="option"
                aria-selected={idx === activeIndex}
                className={`relative shrink-0 w-[72px] h-[88px] overflow-hidden border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                  idx === activeIndex
                    ? 'border-[#C5A059] shadow-sm'
                    : 'border-[#E5E1D8] opacity-60 hover:opacity-100 hover:border-[#C5A059]'
                }`}
              >
                <img
                  src={imgErrors[idx] ? fallback : src}
                  alt={`Thumbnail ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  onError={() => handleImgError(idx)}
                  className="w-full h-full object-cover object-top"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ──────────────────────────────────────────────────── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-10"
            aria-label="Close lightbox"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Counter */}
          <span className="absolute top-4 left-4 text-white/50 text-xs font-mono">
            {lightboxIndex + 1} / {displayImages.length}
          </span>

          {/* Prev */}
          {displayImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => safeIndex(i - 1)); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white transition-colors z-10"
              aria-label="Previous"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Image */}
          <img
            src={imgErrors[lightboxIndex] ? fallback : displayImages[lightboxIndex]}
            alt={`${title} full view`}
            className="max-w-[92vw] max-h-[88vh] object-contain"
            onClick={(e) => e.stopPropagation()}
            onError={() => handleImgError(lightboxIndex)}
          />

          {/* Next */}
          {displayImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => safeIndex(i + 1)); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white transition-colors z-10"
              aria-label="Next"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {/* Dot row in lightbox */}
          {displayImages.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {displayImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(idx); }}
                  className={`rounded-full transition-all ${
                    idx === lightboxIndex
                      ? 'w-5 h-1.5 bg-[#C5A059]'
                      : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`Go to image ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};
