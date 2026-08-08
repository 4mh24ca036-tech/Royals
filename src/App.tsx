/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { api } from './services/api';
import { Product, Category, StoreInfo } from './types';

// Layout Components
import { AnnouncementBar } from './components/layout/AnnouncementBar';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { MobileBottomNav } from './components/layout/MobileBottomNav';

// Home Components
import { HeroCarousel } from './components/home/HeroCarousel';
import { HeritageStory } from './components/home/HeritageStory';
import { BespokeAtelierCTA } from './components/home/BespokeAtelierCTA';
import { ProductCard } from './components/product/ProductCard';

// Product & Shop Components
import { ProductListingView } from './components/product/ProductListingView';
import { ProductDetailModal } from './components/product/ProductDetailModal';

// Cart & Checkout
import { CartDrawer } from './components/cart/CartDrawer';
import { CheckoutPage } from './components/checkout/CheckoutPage';
import { ReceiptPage } from './components/checkout/ReceiptPage';

// Tracking & Profile
import { OrderTrackingView } from './components/tracking/OrderTrackingView';
import { UserProfileModal } from './components/profile/UserProfileModal';
import { AuthModal } from './components/auth/AuthModal';

// Store & Search & Admin
import { StoreLocatorModal } from './components/store/StoreLocatorModal';
import { SearchModal } from './components/search/SearchModal';
import { AdminPortal } from './components/admin/AdminPortal';

import { Sparkles, MessageCircle, Phone, ArrowRight, Star } from 'lucide-react';

function RoyalsApp() {
  // Navigation & View States
  const [currentView, setCurrentView] = useState<'home' | 'shop' | 'tracking' | 'checkout' | 'receipt'>('home');
  const [receiptOrderId, setReceiptOrderId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter & Search states
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [trackingInitialQuery, setTrackingInitialQuery] = useState<string>('');

  // Modal States
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState<boolean>(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState<boolean>(false);

  // Load Categories & Products on mount
  const loadInitialData = async () => {
    try {
      const [cats, prods, info] = await Promise.all([
        api.getCategories(),
        api.getProducts(),
        api.getStoreInfo()
      ]);
      setCategories(cats);
      setProducts(prods);
      setStoreInfo(info);
    } catch (err) {
      console.error('Failed to load initial atelier data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Check for admin or receipt route in URL
    const checkRoutes = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search;

      if (
        path === '/admin' || 
        path === '/royals-admin' || 
        hash === '#admin' || 
        hash === '#royals-admin'
      ) {
        setIsAdminPortalOpen(true);
      } else if (path === '/receipt' || search.includes('id=')) {
        const params = new URLSearchParams(search);
        const orderIdParam = params.get('id') || params.get('orderId');
        if (orderIdParam) {
          setReceiptOrderId(orderIdParam);
        }
        setCurrentView('receipt');
      }
    };

    checkRoutes();
    window.addEventListener('popstate', checkRoutes);
    window.addEventListener('hashchange', checkRoutes);

    // Atelier staff keyboard shortcut: Ctrl+Shift+A or Alt+A
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setIsAdminPortalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', checkRoutes);
      window.removeEventListener('hashchange', checkRoutes);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handlers
  const handleSelectCategory = (catId: string | null) => {
    setSelectedCategory(catId);
    setCurrentView('shop');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePerformSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentView('shop');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTrackOrder = (orderNumber: string) => {
    setTrackingInitialQuery(orderNumber);
    setCurrentView('tracking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickView = (product: Product) => {
    setQuickViewProduct(product);
  };

  // WhatsApp concierge quick url
  const floatingWhatsappUrl = `https://wa.me/918000461784?text=${encodeURIComponent(
    'Hello ROYALS Atelier Jaipur, I would like to inquire about bespoke bridal couture and private appointments.'
  )}`;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] flex flex-col font-sans selection:bg-[#C5A880] selection:text-black">
      
      {/* Top Announcement Bar */}
      <AnnouncementBar onOpenStoreModal={() => setIsStoreModalOpen(true)} />

      {/* Main Luxury Navigation */}
      <Navbar
        categories={categories}
        currentCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenTrackOrder={() => {
          setTrackingInitialQuery('');
          setCurrentView('tracking');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenStoreModal={() => setIsStoreModalOpen(true)}
      />

      {/* Main Dynamic View Content */}
      <main className="flex-1">
        {/* VIEW 1: HOME PAGE */}
        {currentView === 'home' && (
          <div>
            {/* 1. Hero Editorial Carousel */}
            <HeroCarousel
              onExplore={(catId) => {
                setSelectedCategory(catId || null);
                setCurrentView('shop');
              }}
              onOpenStoreModal={() => setIsStoreModalOpen(true)}
            />

            {/* 2. Heritage Story of Jaipur Atelier */}
            <HeritageStory onOpenStoreModal={() => setIsStoreModalOpen(true)} />

            {/* 3. Curated Masterpieces Grid */}
            <section className="py-20 bg-white border-y border-[#E8DFD8]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[#C5A880] text-xs font-semibold uppercase tracking-[0.3em] font-cinzel">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>THE ROYAL ARCHIVE</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#121212] tracking-wide mt-1">
                      Curated Masterpieces
                    </h2>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setCurrentView('shop');
                    }}
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#8C785A] hover:text-[#121212] cursor-pointer group"
                  >
                    <span>View All Collections</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#C5A880]" />
                  </button>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
                  {products.slice(0, 8).map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onQuickView={handleQuickView}
                    />
                  ))}
                </div>
              </div>
            </section>

            {/* 4. Bespoke Bridal Appointments & WhatsApp CTA */}
            <BespokeAtelierCTA onOpenStoreModal={() => setIsStoreModalOpen(true)} />
          </div>
        )}

        {/* VIEW 2: PRODUCT LISTING / SHOP VIEW */}
        {currentView === 'shop' && (
          <ProductListingView
            products={products}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={(catId) => setSelectedCategory(catId)}
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
            onQuickView={handleQuickView}
            wishlistOnly={selectedCategory === 'wishlist_filter'}
          />
        )}

        {/* VIEW 3: LIVE ORDER TRACKING */}
        {currentView === 'tracking' && (
          <OrderTrackingView
            initialQuery={trackingInitialQuery}
            onExplore={() => {
              setCurrentView('shop');
              setSelectedCategory(null);
            }}
          />
        )}

        {/* VIEW 4: IMPERIAL CHECKOUT */}
        {currentView === 'checkout' && (
          <CheckoutPage
            onBackToShopping={() => setCurrentView('shop')}
            onTrackOrder={handleTrackOrder}
          />
        )}

        {/* VIEW 5: STANDALONE OFFICIAL RECEIPT */}
        {currentView === 'receipt' && (
          <ReceiptPage
            orderId={receiptOrderId}
            onBackToShopping={() => {
              setCurrentView('shop');
              window.history.pushState({}, '', '/');
            }}
            onTrackOrder={handleTrackOrder}
          />
        )}
      </main>

      {/* Floating WhatsApp Concierge Button */}
      <a
        href={floatingWhatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-20 lg:bottom-8 right-6 z-40 p-3.5 sm:px-5 sm:py-3.5 rounded-full bg-emerald-700 hover:bg-emerald-600 text-white shadow-2xl flex items-center gap-2.5 transition-all duration-300 hover:scale-105 group border border-emerald-400/40"
        title="Chat with Jaipur Atelier Concierge (+91 8000461784)"
      >
        <MessageCircle className="w-5 h-5 text-emerald-100" />
        <span className="hidden sm:inline text-xs font-bold tracking-wide uppercase font-cinzel">
          WhatsApp Concierge
        </span>
      </a>

      {/* Footer with mandatory contact info */}
      <Footer
        categories={categories}
        onSelectCategory={handleSelectCategory}
        onOpenStoreModal={() => setIsStoreModalOpen(true)}
        onOpenAdminPortal={() => setIsAdminPortalOpen(true)}
        onOpenTrackOrder={() => {
          setTrackingInitialQuery('');
          setCurrentView('tracking');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        currentTab={currentView === 'tracking' ? 'tracking' : currentView === 'shop' ? 'shop' : 'home'}
        onSelectTab={(tab) => {
          if (tab === 'home') {
            setSelectedCategory(null);
            setCurrentView('home');
          } else if (tab === 'shop') {
            setCurrentView('shop');
          } else if (tab === 'tracking') {
            setTrackingInitialQuery('');
            setCurrentView('tracking');
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenSearch={() => setIsSearchModalOpen(true)}
      />

      {/* Modals & Drawers */}
      <ProductDetailModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        onProceedToCheckout={() => {
          setQuickViewProduct(null);
          setCurrentView('checkout');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <CartDrawer
        onProceedToCheckout={() => {
          setCurrentView('checkout');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onExplore={() => {
          setCurrentView('shop');
          setSelectedCategory(null);
        }}
      />

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        products={products}
        onSelectProduct={(p) => setQuickViewProduct(p)}
        onPerformSearch={handlePerformSearch}
      />

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onTrackOrder={handleTrackOrder}
      />

      <AuthModal />

      <StoreLocatorModal
        isOpen={isStoreModalOpen}
        onClose={() => setIsStoreModalOpen(false)}
      />

      <AdminPortal
        isOpen={isAdminPortalOpen}
        onClose={() => {
          setIsAdminPortalOpen(false);
          if (window.location.hash.includes('admin') || window.location.pathname.includes('admin')) {
            window.history.pushState({}, '', '/');
          }
        }}
        categories={categories}
        onProductUpdated={loadInitialData}
      />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <AdminAuthProvider>
            <RoyalsApp />
          </AdminAuthProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}
