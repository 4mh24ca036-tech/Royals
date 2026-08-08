import React from 'react';
import { Sparkles, Crown, MapPin, Compass, ShieldCheck } from 'lucide-react';

interface HeritageStoryProps {
  onOpenStoreModal: () => void;
}

export const HeritageStory: React.FC<HeritageStoryProps> = ({ onOpenStoreModal }) => {
  return (
    <section className="py-20 bg-[#F5F2ED] border-y border-[#E5E1D8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Editorial Image Collage */}
          <div className="relative">
            <div className="aspect-[4/5] overflow-hidden shadow-xl border border-[#E5E1D8] bg-[#EAE7E0]">
              <img
                src="/images/kurta_chanderi_sharara.jpg"
                alt="Lucknow Royal Atelier Craftsmanship"
                loading="eager"
                decoding="async"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  if (!el.dataset.fallback) {
                    el.dataset.fallback = '1';
                    el.src = '/uploads/prod_boutique_02/garment-02.jpeg';
                  }
                }}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Overlapping Gold Floating Badge */}
            <div className="absolute -bottom-6 -right-4 sm:bottom-6 sm:-right-6 bg-[#1A1A1A] text-white p-6 border border-[#E5E1D8]/30 shadow-2xl max-w-xs space-y-2">
              <div className="flex items-center gap-2 text-[#C5A059]">
                <Crown className="w-4 h-4" />
                <span className="text-[9px] uppercase font-cinzel font-medium tracking-[0.25em]">
                  ROYAL HERITAGE
                </span>
              </div>
              <p className="text-xs text-[#D8D2C2] leading-relaxed font-light">
                4th Generation Court Embroidery Masters of Lucknow, preserving 400 years of Nawabi textile heritage.
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-[10px] text-[#C5A059] uppercase tracking-wider">
                <MapPin className="w-3 h-3" />
                <span>Chowk, Lucknow</span>
              </div>
            </div>
          </div>

          {/* Right Column: Story & Philosophy */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 text-[#C5A059]">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase font-cinzel font-medium tracking-[0.3em] text-[#6B6658]">
                THE ATELIER LEGACY
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif italic font-light text-[#1A1A1A] tracking-wide leading-tight">
              Where Imperial Grandeur Meets Contemporary Indian Elegance
            </h2>

            <p className="text-xs sm:text-sm md:text-base text-[#6B6658] leading-relaxed font-light">
              Founded in the City of Nawabs, Lucknow, Lucknow Chikan Emporium redefines Indian haute couture through uncompromising craftsmanship. Every silhouette is an ode to timeless Nawabi elegance—incorporating intricate Zardozi wirework, hand-tied Chikankari motifs, and antique gold zari sourced from master weavers.
            </p>

            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[#E5E1D8]">
              <div>
                <span className="block text-2xl sm:text-3xl font-serif font-light text-[#1A1A1A]">
                  480+
                </span>
                <span className="text-[10px] text-[#8E8A81] uppercase tracking-[0.2em] mt-1 block">
                  Artisan Hours / Ensemble
                </span>
              </div>

              <div>
                <span className="block text-2xl sm:text-3xl font-serif font-light text-[#1A1A1A]">
                  24K Gold
                </span>
                <span className="text-[10px] text-[#8E8A81] uppercase tracking-[0.2em] mt-1 block">
                  Gilded Zari & Mukaish Badla
                </span>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              <button
                onClick={onOpenStoreModal}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Visit Lucknow Atelier</span>
              </button>

              <a
                href="https://wa.me/918000461784"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-[#FAF9F6] border border-[#E5E1D8] text-[#1A1A1A] text-[11px] uppercase tracking-[0.2em] font-medium transition-colors"
              >
                <span>WhatsApp Concierge</span>
              </a>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
