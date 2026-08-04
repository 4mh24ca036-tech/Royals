import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Category } from '../../types';

interface CategoryShowcaseProps {
  categories: Category[];
  onSelectCategory: (categoryId: string) => void;
}

export const CategoryShowcase: React.FC<CategoryShowcaseProps> = ({
  categories,
  onSelectCategory
}) => {
  return (
    <section className="py-20 bg-[#FAF9F6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-1.5 text-[#C5A059]">
            <Sparkles className="w-3 h-3" />
            <span className="text-[10px] uppercase font-cinzel font-medium tracking-[0.3em] text-[#6B6658]">
              THE ARCHIVAL CATALOGUE
            </span>
            <Sparkles className="w-3 h-3" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif italic font-light text-[#1A1A1A] tracking-wide">
            Couture by Category
          </h2>
          <p className="text-xs sm:text-sm text-[#6B6658] font-light leading-relaxed">
            Discover imperial bridal lehengas, hand-tailored royal achkans, and Banarasi drapes handpicked for milestone celebrations.
          </p>
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className="group relative h-[380px] sm:h-[420px] overflow-hidden cursor-pointer shadow-sm transition-all duration-500 hover:shadow-xl border border-[#E5E1D8] bg-[#F5F2ED]"
            >
              {/* Image with zoom effect */}
              <img
                src={cat.image_url}
                alt={cat.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />

              {/* Gradient Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

              {/* Text Info */}
              <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-end text-white">
                <span className="text-[10px] uppercase tracking-[0.25em] text-[#C5A059] font-cinzel font-medium">
                  Jaipur Atelier
                </span>
                <h3 className="text-2xl sm:text-3xl font-serif italic font-light tracking-wide mt-1 text-white">
                  {cat.name}
                </h3>
                <p className="text-xs text-[#D8D2C2] line-clamp-2 mt-2 font-light leading-relaxed">
                  {cat.description}
                </p>
                
                <div className="pt-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-medium text-[#C5A059] group-hover:translate-x-1 transition-transform">
                  <span>Explore Collection</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
