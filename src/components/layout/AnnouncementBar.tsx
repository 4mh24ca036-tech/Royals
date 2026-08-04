import React from 'react';
import { Phone, Sparkles, ShieldCheck } from 'lucide-react';

interface AnnouncementBarProps {
  onOpenStoreModal?: () => void;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ onOpenStoreModal }) => {
  return (
    <div className="bg-[#1A1A1A] text-[#FAF9F6] text-[10px] sm:text-[11px] py-2 px-4 border-b border-[#333] tracking-[0.18em] uppercase font-medium">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-[#C5A059] shrink-0" />
          <span className="font-light">
            Complimentary White-Glove Insured Delivery Across India on Royal Orders
          </span>
        </div>

        <div className="flex items-center gap-4 text-[#8E8A81]">
          <button
            onClick={onOpenStoreModal}
            className="hover:text-[#C5A059] transition-colors hidden md:inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>Jaipur Atelier: Road No. 6, Chaksu</span>
          </button>
          
          <a
            href="tel:8000461784"
            className="inline-flex items-center gap-1.5 text-[#C5A059] hover:text-[#B38D45] font-medium transition-colors"
          >
            <Phone className="w-2.5 h-2.5" />
            <span>+91 8000461784</span>
          </a>

          <div className="hidden lg:flex items-center gap-1 text-[#8E8A81]">
            <ShieldCheck className="w-3 h-3 text-[#C5A059]" />
            <span>Handcrafted Heritage</span>
          </div>
        </div>
      </div>
    </div>
  );
};
