import React from 'react';
import { 
  Phone, 
  MapPin, 
  Clock, 
  Mail, 
  MessageCircle, 
  ShieldCheck, 
  Sparkles, 
  CreditCard, 
  ArrowUpRight,
  Lock
} from 'lucide-react';
import { Category } from '../../types';

interface FooterProps {
  categories: Category[];
  onSelectCategory: (categoryId: string | null) => void;
  onOpenStoreModal: () => void;
  onOpenAdminPortal: () => void;
  onOpenTrackOrder: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  categories,
  onSelectCategory,
  onOpenStoreModal,
  onOpenAdminPortal,
  onOpenTrackOrder
}) => {
  return (
    <footer className="bg-[#1A1A1A] text-[#FAF9F6] pt-16 pb-12 border-t border-[#333] selection:bg-[#C5A059] selection:text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-[#333]">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 bg-[#262626] border border-[#C5A059]/40 flex items-center justify-center shrink-0 text-[#C5A059]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-[0.2em] font-medium text-white">
                Handcrafted Couture
              </h4>
              <p className="text-[11px] text-[#8E8A81] mt-1 leading-relaxed">
                Authentic Jaipur Zardozi, Gota Patti & Banarasi weaving by ancestral artisans.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 bg-[#262626] border border-[#C5A059]/40 flex items-center justify-center shrink-0 text-[#C5A059]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-[0.2em] font-medium text-white">
                Insured White-Glove Transit
              </h4>
              <p className="text-[11px] text-[#8E8A81] mt-1 leading-relaxed">
                Complimentary insured delivery across India via Blue Dart Apex Luxury.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 bg-[#262626] border border-[#C5A059]/40 flex items-center justify-center shrink-0 text-[#C5A059]">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-[0.2em] font-medium text-white">
                Atelier Concierge Hotline
              </h4>
              <p className="text-[11px] text-[#8E8A81] mt-1 leading-relaxed">
                Call +91 8000461784 for custom bridal fittings and imperial bespoke orders.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 bg-[#262626] border border-[#C5A059]/40 flex items-center justify-center shrink-0 text-[#C5A059]">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-[0.2em] font-medium text-white">
                Secure Checkout
              </h4>
              <p className="text-[11px] text-[#8E8A81] mt-1 leading-relaxed">
                256-Bit Encrypted UPI, Cards, Net Banking & Cash on Delivery.
              </p>
            </div>
          </div>
        </div>

        {/* Main Footer Links & Mandatory Store Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 py-12 border-b border-[#333]">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] tracking-[0.3em] uppercase text-[#C5A059] font-cinzel font-medium">
                HAUTE COUTURE
              </span>
            </div>
            <h3 className="text-3xl font-serif font-light text-white tracking-[0.3em] uppercase">
              ROYALS
            </h3>
            <p className="text-xs text-[#8E8A81] leading-relaxed max-w-sm font-light">
              ROYALS is an elite Indian luxury fashion house embodying the splendor of Rajputana royalty. Each bridal lehenga, royal achkan, and Banarasi drape is masterfully hand-woven in our Jaipur atelier with purest gold zari and heirloom silk.
            </p>
            
            {/* Quick WhatsApp & Call Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="tel:8000461784"
                className="inline-flex items-center gap-2 px-5 py-2 border border-[#444] text-[10px] uppercase tracking-widest text-white hover:bg-[#333] transition-colors"
              >
                <Phone className="w-3 h-3" />
                <span>Call: 8000461784</span>
              </a>

              <a
                href="https://wa.me/918000461784"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#C5A059] hover:bg-[#B38D45] text-white text-[10px] uppercase tracking-widest transition-colors font-medium"
              >
                <MessageCircle className="w-3 h-3" />
                <span>WhatsApp Atelier</span>
              </a>
            </div>
          </div>

          {/* Couture Collections */}
          <div>
            <h4 className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#C5A059] mb-4 font-cinzel">
              Haute Collections
            </h4>
            <ul className="space-y-2.5 text-xs text-[#8E8A81]">
              <li>
                <button
                  onClick={() => onSelectCategory(null)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  All Masterpieces
                </button>
              </li>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => onSelectCategory(cat.id)}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Client Services & Tracking */}
          <div>
            <h4 className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#C5A059] mb-4 font-cinzel">
              Client Services
            </h4>
            <ul className="space-y-2.5 text-xs text-[#8E8A81]">
              <li>
                <button
                  onClick={onOpenTrackOrder}
                  className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer font-medium text-[#C5A059]"
                >
                  <span>Track Your Order</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenStoreModal}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Book Atelier Appointment
                </button>
              </li>
              <li>
                <a href="#size-guide" onClick={(e) => { e.preventDefault(); onOpenStoreModal(); }} className="hover:text-white transition-colors">
                  Custom Sizing & Measurements
                </a>
              </li>
              <li>
                <a href="#care" onClick={(e) => { e.preventDefault(); onOpenStoreModal(); }} className="hover:text-white transition-colors">
                  Heirloom Preservation Care
                </a>
              </li>
              <li>
                <a href="tel:8000461784" className="hover:text-white transition-colors">
                  VIP Stylist Consultation
                </a>
              </li>
            </ul>
          </div>

          {/* Mandatory Store Information & Operating Hours */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#C5A059] mb-4 font-cinzel">
              Jaipur Flagship Atelier
            </h4>
            
            <div className="flex items-start gap-2.5 text-xs text-[#8E8A81]">
              <MapPin className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-white">ROYALS Flagship Store</p>
                <p className="mt-0.5">Road No. 6,</p>
                <p>District Chaksu, Jaipur,</p>
                <p>Rajasthan, India - 303901</p>
                <button
                  onClick={onOpenStoreModal}
                  className="mt-1.5 text-[11px] text-[#C5A059] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>View Atelier Location</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-[#8E8A81] pt-2">
              <Clock className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-white">Business Hours (IST)</p>
                <p className="mt-0.5">Mon - Sat: 10:00 AM - 8:30 PM</p>
                <p>Sunday: 11:00 AM - 7:00 PM</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-xs text-[#8E8A81] pt-1">
              <Mail className="w-4 h-4 text-[#C5A059] shrink-0" />
              <span>concierge@royals.com</span>
            </div>
          </div>

        </div>

        {/* Bottom Copyright & Discreet Admin Access */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8E8A81]">
          <div>
            <p>© 2026 ROYALS HAUTE COUTURE. All Rights Reserved. GSTIN: 08AAACR8942K1Z5.</p>
            <p className="text-[11px] text-[#6B6658] mt-0.5">
              Road No. 6, District Chaksu, Jaipur, Rajasthan, India • Phone: +91 8000461784
            </p>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={onOpenStoreModal}
              className="hover:text-[#C5A059] transition-colors cursor-pointer text-xs uppercase tracking-wider"
            >
              Jaipur Store Locator
            </button>

            {/* Hidden admin access trigger */}
            <button
              onClick={onOpenAdminPortal}
              className="inline-flex items-center gap-1 text-[#6B6658] hover:text-[#C5A059] transition-colors text-[11px] cursor-pointer"
              title="Atelier Internal Portal"
            >
              <Lock className="w-3 h-3" />
              <span>Atelier Ops</span>
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
