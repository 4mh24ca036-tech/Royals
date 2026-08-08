import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Phone, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';

// ── Types ──────────────────────────────────────────────────────────────────
interface BannerSlide {
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
}

interface HeroCarouselProps {
  onExplore: (categoryId?: string) => void;
  onOpenStoreModal: () => void;
}

// ── Fallback slides — shown only if the API fails completely ───────────────
// These use the existing /images/ files that are committed in the repo so the
// homepage is never blank, even before any banner is uploaded.
const FALLBACK_SLIDES: BannerSlide[] = [
  {
    id: 'fallback_1',
    title: 'THE IMPERIAL KURTA ATELIER',
    subtitle: 'HERITAGE COUTURE 2026',
    description: 'Handcrafted in pure handloom raw silk, Chanderi, and organza with antique Jaipur Zardozi, Chikankari, and real 24K gold mukaish work.',
    image_url: '/images/hero_royal_kurtas.jpg',
    mobile_image_url: '',
    button_text: 'Explore Royal Kurtas',
    button_link: '',
    tag: 'Haute Couture Kurtas',
    category_id: 'cat_mens_kurtas',
    display_order: 0,
    is_active: true
  },
  {
    id: 'fallback_2',
    title: 'LUCKNOWI CHIKANKARI & MUKAISH',
    subtitle: "DESIGNER WOMEN'S KURTA SETS",
    description: 'Ethereal pastel georgettes, scalloped organza dupattas, and intricate hand needlecraft tailored for festive grandeur.',
    image_url: '/images/women_chikankari_kurta.jpg',
    mobile_image_url: '',
    button_text: "Explore Women's Kurtas",
    button_link: '',
    tag: "Women's Couture",
    category_id: 'cat_womens_kurtas',
    display_order: 1,
    is_active: true
  },
  {
    id: 'fallback_3',
    title: 'THE MAHARAJA RAW SILK SETS',
    subtitle: "REGAL MEN'S ETHNIC COUTURE",
    description: 'Pure handloom raw silk kurta pajama sets and structured Bandhgalas with handcrafted 24K gold plated Jaipur crest buttons.',
    image_url: '/images/mens_raw_silk_kurta.jpg',
    mobile_image_url: '',
    button_text: "Explore Men's Silk Kurtas",
    button_link: '',
    tag: "Men's Silk Kurtas",
    category_id: 'cat_bandhgala_kurtas',
    display_order: 2,
    is_active: true
  }
];

// ── Component ──────────────────────────────────────────────────────────────
export const HeroCarousel: React.FC<HeroCarouselProps> = ({ onExplore, onOpenStoreModal }) => {
  const [slides, setSlides] = useState<BannerSlide[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Detect mobile viewport for responsive image selection
  const [isMobile, setIsMobile] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch banners from backend ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    api.getBanners()
      .then((data) => {
        if (cancelled) return;
        setSlides(data.length > 0 ? data : FALLBACK_SLIDES);
        setIsLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSlides(FALLBACK_SLIDES);
        setIsLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Detect mobile breakpoint ─────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── Auto-advance ─────────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % Math.max(slides.length, 1));
    }, 6000);
  }, [slides.length]);

  useEffect(() => {
    if (!isLoaded || slides.length === 0) return;
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isLoaded, slides.length, resetTimer]);

  const goTo = useCallback((idx: number) => {
    setCurrentSlide(((idx % slides.length) + slides.length) % slides.length);
    resetTimer();
  }, [slides.length, resetTimer]);

  const nextSlide = () => goTo(currentSlide + 1);
  const prevSlide = () => goTo(currentSlide - 1);

  // ── Image src — prefer mobile image on small screens ────────────────
  const imgSrc = (slide: BannerSlide) =>
    isMobile && slide.mobile_image_url ? slide.mobile_image_url : slide.image_url;

  // ── Handle CTA click ─────────────────────────────────────────────────
  const handleCta = (slide: BannerSlide) => {
    if (slide.button_link && slide.button_link.trim()) {
      window.location.href = slide.button_link;
    } else if (slide.category_id) {
      onExplore(slide.category_id);
    } else {
      onExplore();
    }
  };

  // ── Loading skeleton (same dimensions, prevents layout shift) ────────
  if (!isLoaded) {
    return (
      <div className="relative w-full h-[600px] sm:h-[680px] md:h-[760px] bg-[#121212] overflow-hidden">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A]" />
      </div>
    );
  }

  if (slides.length === 0) return null;

  const slide = slides[currentSlide];

  return (
    <div className="relative w-full h-[600px] sm:h-[680px] md:h-[760px] bg-[#121212] overflow-hidden text-white">

      {/* ── Background slides ───────────────────────────────────────── */}
      {slides.map((s, idx) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <img
            src={imgSrc(s)}
            alt={s.title || 'Banner'}
            loading={idx === 0 ? 'eager' : 'lazy'}
            fetchPriority={idx === 0 ? 'high' : 'low'}
            decoding="async"
            onError={e => {
              // If uploaded image 404s, fall back to the seeded /images/ path
              const el = e.target as HTMLImageElement;
              if (!el.dataset.fallbackApplied) {
                el.dataset.fallbackApplied = '1';
                el.src = '/images/hero_royal_kurtas.jpg';
              }
            }}
            className="w-full h-full object-cover object-top"
          />
          {/* Gradients — same as original */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-black/30" />
          <div className="absolute inset-0 bg-black/25" />
        </div>
      ))}

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto h-full px-6 sm:px-8 lg:px-12 flex flex-col justify-end pb-16 sm:pb-24">
        <div className="max-w-2xl space-y-4">

          {/* Subtitle badge */}
          {slide.subtitle && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#1A1A1A]/80 backdrop-blur-md border border-[#E5E1D8]/30 text-[10px] uppercase tracking-[0.3em] text-[#C5A059] font-cinzel font-medium">
              <Sparkles className="w-3 h-3 text-[#C5A059]" />
              <span>{slide.subtitle}</span>
            </div>
          )}

          {/* Main title */}
          {slide.title && (
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-serif italic font-light text-[#FAF9F6] tracking-wide leading-tight drop-shadow-sm">
              {slide.title}
            </h2>
          )}

          {/* Description */}
          {slide.description && (
            <p className="text-xs sm:text-sm md:text-base text-[#D8D2C2] font-light leading-relaxed max-w-xl">
              {slide.description}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-4">
            {slide.button_text && (
              <button
                onClick={() => handleCta(slide)}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] uppercase tracking-[0.2em] font-medium transition-all duration-300 border border-[#E5E1D8]/30 hover:border-transparent cursor-pointer group shadow-sm"
              >
                <span>{slide.button_text}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            <a
              href="tel:8000461784"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-black/40 hover:bg-[#1A1A1A] backdrop-blur-md border border-[#E5E1D8]/40 text-[#FAF9F6] text-[11px] uppercase tracking-[0.2em] font-medium transition-all"
            >
              <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Jaipur Atelier</span>
            </a>
          </div>
        </div>

        {/* ── Slide indicators & navigation ───────────────────────── */}
        <div className="absolute bottom-8 right-6 sm:right-12 flex items-center gap-4 z-20">
          {/* Dot indicators */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-1 transition-all duration-300 cursor-pointer ${
                  idx === currentSlide ? 'w-8 bg-[#C5A059]' : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>

          {/* Prev / Next */}
          {slides.length > 1 && (
            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={prevSlide}
                className="w-9 h-9 bg-black/50 hover:bg-[#1A1A1A] backdrop-blur-md border border-[#E5E1D8]/30 flex items-center justify-center text-white transition-colors cursor-pointer"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextSlide}
                className="w-9 h-9 bg-black/50 hover:bg-[#1A1A1A] backdrop-blur-md border border-[#E5E1D8]/30 flex items-center justify-center text-white transition-colors cursor-pointer"
                aria-label="Next slide"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
