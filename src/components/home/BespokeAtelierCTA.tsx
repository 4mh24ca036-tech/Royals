import React from 'react';
import { MessageCircle, Phone, Calendar, Sparkles, MapPin } from 'lucide-react';

interface BespokeAtelierCTAProps {
  onOpenStoreModal: () => void;
}

export const BespokeAtelierCTA: React.FC<BespokeAtelierCTAProps> = ({ onOpenStoreModal }) => {
  return (
    <section className="py-20 bg-[#1A1A1A] text-white relative overflow-hidden border-y border-[#333]">
      {/* Subtle background luxury glow */}
      <div className="absolute -right-40 -top-40 w-96 h-96 bg-[#C5A059]/5 blur-3xl" />
      <div className="absolute -left-40 -bottom-40 w-96 h-96 bg-[#C5A059]/5 blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-[#C5A059]">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-cinzel font-medium tracking-[0.3em]">
              BESPOKE BRIDAL APPOINTMENTS
            </span>
            <Sparkles className="w-3.5 h-3.5" />
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif italic font-light tracking-wide text-white">
            Experience Private Atelier Fittings in Jaipur
          </h2>

          <p className="text-xs sm:text-sm md:text-base text-[#8E8A81] font-light leading-relaxed">
            Every bride and groom is paired with a dedicated Royal Master Tailor. Enjoy private silhouette trials, custom color dyeing, personalized crest embroidery, and heirloom trunk packing.
          </p>

          {/* Store Address Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#262626] border border-[#444] text-[11px] uppercase tracking-wider text-[#FAF9F6]">
            <MapPin className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Road No. 6, District Chaksu, Jaipur, Rajasthan, India</span>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a
              href="https://wa.me/918000461784?text=Hello%20ROYALS%2C%20I%20would%20like%20to%20book%20a%20Bespoke%20Bridal%20Atelier%20Appointment."
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#C5A059] hover:bg-[#B38D45] text-white font-medium text-[11px] uppercase tracking-[0.2em] transition-all duration-300 shadow-md"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Concierge</span>
            </a>

            <a
              href="tel:8000461784"
              className="inline-flex items-center gap-2 px-8 py-3.5 border border-[#444] hover:bg-[#262626] text-white font-medium text-[11px] uppercase tracking-[0.2em] transition-all"
            >
              <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Call: 8000461784</span>
            </a>

            <button
              onClick={onOpenStoreModal}
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-[#FAF9F6] text-[#1A1A1A] font-medium text-[11px] uppercase tracking-[0.2em] transition-all cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Store Map & Hours</span>
            </button>
          </div>

        </div>

      </div>
    </section>
  );
};
