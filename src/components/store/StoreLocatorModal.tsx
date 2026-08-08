import React from 'react';
import { X, MapPin, Phone, Clock, MessageCircle, Navigation, Sparkles, ShieldCheck } from 'lucide-react';

interface StoreLocatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StoreLocatorModal: React.FC<StoreLocatorModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const address = 'Road No. 6, District Chaksu, Jaipur, Rajasthan, India - 303901';
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Road No. 6, Chaksu, Jaipur, Rajasthan, India')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-[#FAF9F6] border border-[#E5E1D8] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-[#F5F2ED] border-b border-[#E5E1D8] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-5 h-5 text-[#C5A059]" />
            <div>
              <span className="text-[9px] uppercase tracking-[0.25em] text-[#C5A059] font-cinzel font-medium">Flagship Store</span>
              <h3 className="text-xl font-serif italic font-light text-[#1A1A1A]">
                ROYALS Flagship Atelier & Salon
              </h3>
              <p className="text-[11px] text-[#6B6658] font-light">Jaipur, Rajasthan, India</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#1A1A1A] hover:text-[#C5A059] hover:bg-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Map Image / Visual */}
          <div className="relative aspect-[16/9] overflow-hidden border border-[#E5E1D8] bg-[#EAE7E0]">
            <img
              src="/uploads/prod_boutique_01/garment-01.jpeg"
              alt="Jaipur Royal Architecture"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-5 text-white">
              <div>
                <span className="text-[10px] uppercase tracking-[0.25em] font-cinzel text-[#C5A059]">Heritage Flagship</span>
                <p className="text-sm font-serif italic font-light">Jaipur Couture Atelier & Private Bridal Suites</p>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-white border border-[#E5E1D8] space-y-2">
              <div className="flex items-center gap-2 font-medium text-[11px] uppercase tracking-wider text-[#1A1A1A]">
                <MapPin className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Atelier Location</span>
              </div>
              <p className="text-[#6B6658] leading-relaxed font-light">
                {address}
              </p>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-[#C5A059] hover:text-[#1A1A1A] font-medium uppercase tracking-wider pt-1"
              >
                <Navigation className="w-3 h-3" />
                <span>Open in Google Maps</span>
              </a>
            </div>

            <div className="p-4 bg-white border border-[#E5E1D8] space-y-2">
              <div className="flex items-center gap-2 font-medium text-[11px] uppercase tracking-wider text-[#1A1A1A]">
                <Clock className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Operating Hours (IST)</span>
              </div>
              <div className="text-[#6B6658] space-y-1 font-light">
                <p><strong className="font-medium text-[#1A1A1A]">Monday - Saturday:</strong> 10:00 AM - 8:30 PM</p>
                <p><strong className="font-medium text-[#1A1A1A]">Sunday:</strong> 11:00 AM - 7:00 PM</p>
                <p className="text-[10px] text-[#C5A059] uppercase tracking-wider pt-1">Private VIP trials by prior booking.</p>
              </div>
            </div>
          </div>

          {/* Direct Concierge Contact Buttons */}
          <div className="p-5 bg-[#F5F2ED] border border-[#E5E1D8] space-y-3">
            <h4 className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#C5A059] font-cinzel">
              Book Private Atelier Fitting
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="https://wa.me/918000461784?text=Hello%20ROYALS%2C%20I%20would%20like%20to%20schedule%20a%20visit%20to%20the%20Jaipur%20Atelier."
                target="_blank"
                rel="noreferrer"
                className="py-3 px-4 bg-[#C5A059] hover:bg-[#B38D45] text-white font-medium text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Appointment</span>
              </a>

              <a
                href="tel:8000461784"
                className="py-3 px-4 bg-[#1A1A1A] hover:bg-black text-white font-medium text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Call +91 8000461784</span>
              </a>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
