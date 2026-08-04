import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Phone, ArrowRight } from 'lucide-react';

interface HeroCarouselProps {
  onExplore: (categoryId?: string) => void;
  onOpenStoreModal: () => void;
}

const SLIDES = [
  {
    id: 1,
    title: 'THE IMPERIAL KURTA ATELIER',
    subtitle: 'HERITAGE COUTURE 2026',
    description: 'Handcrafted in pure handloom raw silk, Chanderi, and organza with antique Jaipur Zardozi, Chikankari, and real 24K gold mukaish work.',
    image: '/images/hero_royal_kurtas.jpg',
    tag: 'Haute Couture Kurtas',
    categoryId: 'cat_mens_kurtas',
    cta: 'Explore Royal Kurtas'
  },
  {
    id: 2,
    title: 'LUCKNOWI CHIKANKARI & MUKAISH',
    subtitle: "DESIGNER WOMEN'S KURTA SETS",
    description: 'Ethereal pastel georgettes, scalloped organza dupattas, and intricate hand needlecraft tailored for festive grandeur.',
    image: '/images/women_chikankari_kurta.jpg',
    tag: "Women's Couture",
    categoryId: 'cat_womens_kurtas',
    cta: "Explore Women's Kurtas"
  },
  {
    id: 3,
    title: 'THE MAHARAJA RAW SILK SETS',
    subtitle: "REGAL MEN'S ETHNIC COUTURE",
    description: 'Pure handloom raw silk kurta pajama sets and structured Bandhgalas with handcrafted 24K gold plated Jaipur crest buttons.',
    image: '/images/mens_raw_silk_kurta.jpg',
    tag: "Men's Silk Kurtas",
    categoryId: 'cat_bandhgala_kurtas',
    cta: "Explore Men's Silk Kurtas"
  }
];

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ onExplore, onOpenStoreModal }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  const slide = SLIDES[currentSlide];

  return (
    <div className="relative w-full h-[600px] sm:h-[680px] md:h-[760px] bg-[#121212] overflow-hidden text-white">
      {/* Background Slides */}
      {SLIDES.map((s, idx) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
          } transform transition-transform duration-7000`}
        >
          {/* Image */}
          <img
            src={s.image}
            alt={s.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-top"
          />

          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-black/30" />
          <div className="absolute inset-0 bg-black/25" />
        </div>
      ))}

      {/* Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto h-full px-6 sm:px-8 lg:px-12 flex flex-col justify-end pb-16 sm:pb-24">
        <div className="max-w-2xl space-y-4">
          
          {/* Subtitle Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#1A1A1A]/80 backdrop-blur-md border border-[#E5E1D8]/30 text-[10px] uppercase tracking-[0.3em] text-[#C5A059] font-cinzel font-medium">
            <Sparkles className="w-3 h-3 text-[#C5A059]" />
            <span>{slide.subtitle}</span>
          </div>

          {/* Main Title */}
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-serif italic font-light text-[#FAF9F6] tracking-wide leading-tight drop-shadow-sm">
            {slide.title}
          </h2>

          {/* Description */}
          <p className="text-xs sm:text-sm md:text-base text-[#D8D2C2] font-light leading-relaxed max-w-xl">
            {slide.description}
          </p>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-4">
            <button
              onClick={() => onExplore(slide.categoryId)}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] uppercase tracking-[0.2em] font-medium transition-all duration-300 border border-[#E5E1D8]/30 hover:border-transparent cursor-pointer group shadow-sm"
            >
              <span>{slide.cta}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>

            <a
              href="tel:8000461784"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-black/40 hover:bg-[#1A1A1A] backdrop-blur-md border border-[#E5E1D8]/40 text-[#FAF9F6] text-[11px] uppercase tracking-[0.2em] font-medium transition-all"
            >
              <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Jaipur Atelier</span>
            </a>
          </div>
        </div>

        {/* Slide Indicators & Navigation Arrows */}
        <div className="absolute bottom-8 right-6 sm:right-12 flex items-center gap-4 z-20">
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-1 transition-all duration-300 cursor-pointer ${
                  idx === currentSlide ? 'w-8 bg-[#C5A059]' : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

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
        </div>

      </div>
    </div>
  );
};
