import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Heart, 
  ShoppingBag, 
  User as UserIcon, 
  Menu, 
  X, 
  Phone, 
  Truck, 
  Bell, 
  Compass,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { Category } from '../../types';

interface NavbarProps {
  categories: Category[];
  currentCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  onOpenSearch: () => void;
  onOpenTrackOrder: () => void;
  onOpenProfile: () => void;
  onOpenStoreModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  categories,
  currentCategory,
  onSelectCategory,
  onOpenSearch,
  onOpenTrackOrder,
  onOpenProfile,
  onOpenStoreModal
}) => {
  const { itemCount, setIsCartDrawerOpen } = useCart();
  const { wishlistCount } = useWishlist();
  const { user, isAuthenticated, unreadNotificationCount, setIsAuthModalOpen } = useAuth();

  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCategoryClick = (catId: string | null) => {
    onSelectCategory(catId);
    setIsMobileMenuOpen(false);
  };

  const handleAccountClick = () => {
    if (isAuthenticated) {
      onOpenProfile();
    } else {
      setIsAuthModalOpen(true);
    }
  };

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          isScrolled
            ? 'bg-[#FAF9F6]/95 backdrop-blur-md shadow-sm border-b border-[#E5E1D8]'
            : 'bg-[#FAF9F6] border-b border-[#E5E1D8]'
        }`}
      >
        {/* Main Header Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="flex items-center justify-between h-20 sm:h-24 relative">
            
            {/* Left Column: Mobile Menu Toggle, Search & Track Order */}
            <div className="flex items-center gap-3 md:gap-5 flex-1">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 -ml-2 text-[#1A1A1A] hover:text-[#C5A059] lg:hidden transition-colors cursor-pointer"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                onClick={onOpenSearch}
                className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E5E1D8] hover:border-[#C5A059] text-[11px] uppercase tracking-[0.15em] text-[#6B6658] bg-white/80 hover:bg-white transition-all cursor-pointer shadow-2xs"
              >
                <Search className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Search Couture</span>
                <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[9px] bg-[#F5F2ED] text-[#8E8A81] rounded border border-[#E5E1D8]">⌘K</kbd>
              </button>

              <button
                onClick={onOpenTrackOrder}
                className="hidden md:flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-[#1A1A1A] hover:text-[#C5A059] transition-colors cursor-pointer font-medium"
              >
                <Truck className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>My Orders</span>
              </button>
            </div>

            {/* Center Column: Royal Crest Logo */}
            <div className="flex flex-col items-center justify-center shrink-0 cursor-pointer text-center px-4" onClick={() => handleCategoryClick(null)}>
              <div className="flex items-center gap-1.5 text-[#C5A059]">
                <Sparkles className="w-2.5 h-2.5" />
                <span className="text-[9px] tracking-[0.3em] uppercase font-cinzel font-medium text-[#6B6658]">
                  HAUTE COUTURE
                </span>
                <Sparkles className="w-2.5 h-2.5" />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-light tracking-[0.35em] text-[#1A1A1A] uppercase leading-none mt-1">
                ROYALS
              </h1>
              <span className="text-[8px] tracking-[0.4em] uppercase text-[#8E8A81] mt-1 font-sans font-medium">
                JAIPUR • ATELIER
              </span>
            </div>

            {/* Right Column: Actions (Search Mobile, Phone, Wishlist, Profile, Bag) */}
            <div className="flex items-center justify-end gap-2 sm:gap-4 flex-1">
              <button
                onClick={onOpenSearch}
                className="p-2 text-[#1A1A1A] hover:text-[#C5A059] sm:hidden transition-colors cursor-pointer"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Call Atelier CTA */}
              <a
                href="tel:8000461784"
                className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E5E1D8] hover:border-[#C5A059] text-[11px] uppercase tracking-[0.15em] text-[#1A1A1A] hover:text-[#C5A059] transition-colors shadow-2xs font-medium"
                title="Call Jaipur Atelier: 8000461784"
              >
                <Phone className="w-3 h-3 text-[#C5A059]" />
                <span>8000461784</span>
              </a>

              {/* Wishlist */}
              <button
                onClick={() => {
                  onSelectCategory('wishlist_filter');
                }}
                className="p-2 relative text-[#1A1A1A] hover:text-[#C5A059] transition-colors cursor-pointer"
                aria-label="Wishlist"
              >
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-[#C5A059] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </button>

              {/* Account / Notifications */}
              <button
                onClick={handleAccountClick}
                className="p-2 relative text-[#1A1A1A] hover:text-[#C5A059] transition-colors cursor-pointer"
                aria-label="Customer Account"
              >
                <UserIcon className="w-5 h-5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#C5A059] rounded-full ring-2 ring-white" />
                )}
              </button>

              {/* Shopping Bag */}
              <button
                onClick={() => setIsCartDrawerOpen(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-[#1A1A1A] text-white hover:bg-[#C5A059] transition-all duration-300 cursor-pointer shadow-sm text-[11px] uppercase tracking-[0.2em] font-medium"
                aria-label="Shopping Bag"
              >
                <div className="relative">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#E5E1D8]" />
                  {itemCount > 0 && (
                    <span className="absolute -top-2 -right-2 w-3.5 h-3.5 bg-[#C5A059] text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-[#1A1A1A]">
                      {itemCount}
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline">
                  Bag {itemCount > 0 ? `(${itemCount})` : '(0)'}
                </span>
              </button>
            </div>

          </div>

          {/* Desktop Navigation Category Links */}
          <nav className="hidden lg:flex items-center justify-center border-t border-[#E5E1D8] py-3.5 gap-8">
            <button
              onClick={() => handleCategoryClick(null)}
              className={`text-[11px] uppercase tracking-[0.2em] transition-colors cursor-pointer font-medium ${
                currentCategory === null
                  ? 'text-[#C5A059] font-semibold border-b border-[#C5A059] pb-0.5'
                  : 'text-[#1A1A1A] hover:text-[#C5A059]'
              }`}
            >
              Collections
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={`text-[11px] uppercase tracking-[0.2em] transition-colors cursor-pointer font-medium ${
                  currentCategory === cat.id
                    ? 'text-[#C5A059] font-semibold border-b border-[#C5A059] pb-0.5'
                    : 'text-[#1A1A1A] hover:text-[#C5A059]'
                }`}
              >
                {cat.name}
              </button>
            ))}

            <button
              onClick={onOpenStoreModal}
              className="text-[11px] uppercase tracking-[0.2em] text-[#6B6658] hover:text-[#C5A059] flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>Jaipur Atelier</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-4/5 max-w-sm bg-[#FAF9F6] h-full shadow-2xl flex flex-col z-10 overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#E5E1D8] flex items-center justify-between bg-[#F5F2ED]">
              <div>
                <span className="text-[9px] tracking-[0.3em] uppercase text-[#6B6658] font-cinzel font-medium">
                  HAUTE COUTURE
                </span>
                <h2 className="text-2xl font-serif font-light text-[#1A1A1A] uppercase tracking-[0.25em]">
                  ROYALS
                </h2>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-[#1A1A1A] hover:text-[#C5A059] cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="p-4 border-b border-[#E5E1D8] grid grid-cols-2 gap-2 bg-white">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenTrackOrder();
                }}
                className="flex items-center justify-center gap-2 p-2.5 border border-[#E5E1D8] text-[10px] uppercase tracking-wider font-medium text-[#1A1A1A] hover:border-[#C5A059] transition-colors"
              >
                <Truck className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>My Orders</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleAccountClick();
                }}
                className="flex items-center justify-center gap-2 p-2.5 border border-[#E5E1D8] text-[10px] uppercase tracking-wider font-medium text-[#1A1A1A] hover:border-[#C5A059] transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>{isAuthenticated ? 'My Account' : 'Join ROYALS'}</span>
              </button>
            </div>

            {/* Category Navigation */}
            <div className="p-6 flex-1 space-y-4">
              <span className="text-[10px] font-medium tracking-[0.25em] text-[#6B6658] uppercase block">
                Heritage Collections
              </span>

              <div className="space-y-1.5">
                <button
                  onClick={() => handleCategoryClick(null)}
                  className={`w-full text-left py-2.5 px-3 text-xs uppercase tracking-[0.15em] transition-colors flex items-center justify-between border-b border-[#E5E1D8]/60 ${
                    currentCategory === null
                      ? 'text-[#C5A059] font-semibold'
                      : 'text-[#1A1A1A] hover:text-[#C5A059]'
                  }`}
                >
                  <span>All Collections</span>
                  <Sparkles className="w-3 h-3 text-[#C5A059]" />
                </button>

                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className={`w-full text-left py-2.5 px-3 text-xs uppercase tracking-[0.15em] transition-colors flex items-center justify-between border-b border-[#E5E1D8]/60 ${
                      currentCategory === cat.id
                        ? 'text-[#C5A059] font-semibold'
                        : 'text-[#1A1A1A] hover:text-[#C5A059]'
                    }`}
                  >
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>

              {/* Jaipur Atelier Information Box */}
              <div className="mt-8 p-4 bg-[#F5F2ED] border border-[#E5E1D8] space-y-3">
                <div className="flex items-center gap-2 text-xs font-serif italic text-[#1A1A1A]">
                  <Compass className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Jaipur Flagship Atelier</span>
                </div>
                <p className="text-[11px] text-[#6B6658] leading-relaxed">
                  Road No. 6, District Chaksu, Jaipur, Rajasthan, India
                </p>
                <div className="pt-2 border-t border-[#E5E1D8] flex flex-col gap-2">
                  <a
                    href="tel:8000461784"
                    className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider font-medium text-[#1A1A1A] hover:text-[#C5A059]"
                  >
                    <Phone className="w-3 h-3 text-[#C5A059]" />
                    <span>Call: +91 8000461784</span>
                  </a>
                  <a
                    href="https://wa.me/918000461784"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider font-medium text-[#C5A059] hover:text-[#B38D45]"
                  >
                    <span>WhatsApp Concierge</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom Footer */}
            <div className="p-4 bg-[#1A1A1A] text-white text-[10px] uppercase tracking-[0.2em] text-center border-t border-[#333]">
              <span className="text-[#C5A059]">ROYALS</span> • Heritage Indian Ethnic Wear
            </div>
          </div>
        </div>
      )}
    </>
  );
};
