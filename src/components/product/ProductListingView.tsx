import React, { useState, useMemo } from 'react';
import { 
  Filter, 
  SlidersHorizontal, 
  X, 
  Sparkles, 
  ArrowUpDown, 
  Check, 
  Search, 
  RefreshCw 
} from 'lucide-react';
import { Product, Category } from '../../types';
import { ProductCard } from './ProductCard';

interface ProductListingViewProps {
  products: Product[];
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  searchQuery: string;
  onClearSearch: () => void;
  onQuickView: (product: Product) => void;
  wishlistOnly?: boolean;
}

export const ProductListingView: React.FC<ProductListingViewProps> = ({
  products,
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onClearSearch,
  onQuickView,
  wishlistOnly = false
}) => {
  const [selectedFabric, setSelectedFabric] = useState<string>('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [showOnlyNewArrivals, setShowOnlyNewArrivals] = useState<boolean>(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  // Extract unique fabrics from products
  const fabrics = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.fabric) set.add(p.fabric);
    });
    return Array.from(set);
  }, [products]);

  // Filter and Sort logic
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategory && selectedCategory !== 'wishlist_filter' && p.category_id !== selectedCategory) {
        return false;
      }

      // Fabric filter
      if (selectedFabric !== 'all' && p.fabric !== selectedFabric) {
        return false;
      }

      // Special badge filter
      if (showOnlyNewArrivals && !p.is_new_arrival) {
        return false;
      }

      // Price range filter
      const effectivePrice = p.discount_price && p.discount_price < p.price ? p.discount_price : p.price;
      if (selectedPriceRange === 'under_50k' && effectivePrice >= 50000) return false;
      if (selectedPriceRange === '50k_100k' && (effectivePrice < 50000 || effectivePrice > 100000)) return false;
      if (selectedPriceRange === '100k_200k' && (effectivePrice < 100000 || effectivePrice > 200000)) return false;
      if (selectedPriceRange === 'above_200k' && effectivePrice <= 200000) return false;

      // Search query filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchDesc = p.description.toLowerCase().includes(q);
        const matchFabric = p.fabric.toLowerCase().includes(q);
        const matchCat = p.category_name.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchFabric && !matchCat) return false;
      }

      return true;
    }).sort((a, b) => {
      const priceA = a.discount_price || a.price;
      const priceB = b.discount_price || b.price;

      if (sortBy === 'price_asc') return priceA - priceB;
      if (sortBy === 'price_desc') return priceB - priceA;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'newest') return (b.is_new_arrival ? 1 : 0) - (a.is_new_arrival ? 1 : 0);
      return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
    });
  }, [products, selectedCategory, selectedFabric, selectedPriceRange, showOnlyNewArrivals, searchQuery, sortBy]);

  const activeCategoryObj = categories.find((c) => c.id === selectedCategory);

  const resetAllFilters = () => {
    setSelectedFabric('all');
    setSelectedPriceRange('all');
    setShowOnlyNewArrivals(false);
    setSortBy('featured');
    onSelectCategory(null);
    if (searchQuery) onClearSearch();
  };

  const hasActiveFilters = selectedCategory !== null || selectedFabric !== 'all' || selectedPriceRange !== 'all' || showOnlyNewArrivals || searchQuery !== '';

  return (
    <section className="py-10 bg-[#FAF9F6] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        
        {/* Page Title & Breadcrumb */}
        <div className="mb-8 space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-[#8E8A81] uppercase tracking-[0.25em] font-cinzel">
            <span>Jaipur Haute Couture</span>
            <span>/</span>
            <span className="text-[#C5A059]">{wishlistOnly ? 'Saved Wishlist' : activeCategoryObj ? activeCategoryObj.name : 'All Ensembles'}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-serif italic font-light text-[#1A1A1A] tracking-wide">
                {wishlistOnly ? 'Saved Ensembles' : activeCategoryObj ? activeCategoryObj.name : 'The Royal Archive'}
              </h1>
              <p className="text-xs sm:text-sm text-[#6B6658] mt-1 font-light">
                {wishlistOnly
                  ? 'Your curated selections of handcrafted masterpieces.'
                  : activeCategoryObj
                  ? activeCategoryObj.description
                  : 'Exclusive bridal lehengas, achkans, and Banarasi drapes handcrafted with pure gold zari.'}
              </p>
            </div>

            <span className="text-[11px] font-medium text-[#8E8A81] uppercase tracking-[0.2em] shrink-0">
              {filteredProducts.length} Creations
            </span>
          </div>
        </div>

        {/* Search Active Banner */}
        {searchQuery && (
          <div className="mb-6 p-4 bg-[#F5F2ED] border border-[#E5E1D8] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#1A1A1A]">
              <Search className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Search results for: <strong className="font-medium">"{searchQuery}"</strong></span>
            </div>
            <button
              onClick={onClearSearch}
              className="text-[11px] uppercase tracking-wider text-[#6B6658] hover:text-[#1A1A1A] font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>Clear Search</span>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Category Filter Bar */}
        <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => onSelectCategory(null)}
            className={`px-5 py-2 text-[10px] uppercase tracking-[0.2em] font-medium whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === null
                ? 'bg-[#1A1A1A] text-white shadow-sm'
                : 'bg-white border border-[#E5E1D8] text-[#6B6658] hover:border-[#C5A059] hover:text-[#1A1A1A]'
            }`}
          >
            All Collections ({products.length})
          </button>

          {categories.map((cat) => {
            const count = products.filter((p) => p.category_id === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-5 py-2 text-[10px] uppercase tracking-[0.2em] font-medium whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#1A1A1A] text-white shadow-sm'
                    : 'bg-white border border-[#E5E1D8] text-[#6B6658] hover:border-[#C5A059] hover:text-[#1A1A1A]'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Filter Controls & Sorting Toolbar */}
        <div className="mb-8 p-4 bg-white border border-[#E5E1D8] shadow-sm flex flex-wrap items-center justify-between gap-4">
          
          {/* Left: Filter dropdowns on desktop */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[#6B6658] mr-2 font-cinzel">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Filters:</span>
            </div>

            {/* Price Range Filter */}
            <select
              value={selectedPriceRange}
              onChange={(e) => setSelectedPriceRange(e.target.value)}
              className="px-3 py-1.5 border border-[#E5E1D8] text-[11px] text-[#1A1A1A] bg-[#FAF9F6] focus:outline-none focus:border-[#C5A059] cursor-pointer"
            >
              <option value="all">All Price Tiers</option>
              <option value="under_50k">Under ₹50,000</option>
              <option value="50k_100k">₹50,000 - ₹1,00,000</option>
              <option value="100k_200k">₹1,00,000 - ₹2,00,000</option>
              <option value="above_200k">Imperial (Above ₹2,00,000)</option>
            </select>

            {/* Fabric Filter */}
            {fabrics.length > 0 && (
              <select
                value={selectedFabric}
                onChange={(e) => setSelectedFabric(e.target.value)}
                className="px-3 py-1.5 border border-[#E5E1D8] text-[11px] text-[#1A1A1A] bg-[#FAF9F6] focus:outline-none focus:border-[#C5A059] cursor-pointer"
              >
                <option value="all">All Fabrics</option>
                {fabrics.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            )}

            {/* New Arrivals Toggle */}
            <button
              onClick={() => setShowOnlyNewArrivals(!showOnlyNewArrivals)}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                showOnlyNewArrivals
                  ? 'bg-[#1A1A1A] text-[#C5A059] border-[#1A1A1A]'
                  : 'bg-[#FAF9F6] border-[#E5E1D8] text-[#6B6658] hover:border-[#C5A059]'
              }`}
            >
              <Sparkles className="w-3 h-3 text-[#C5A059]" />
              <span>New Arrivals Only</span>
            </button>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="px-3 py-1.5 text-[11px] text-[#8C2D19] hover:text-[#5E1E11] uppercase tracking-wider font-medium flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Mobile Filter Trigger Button */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="px-4 py-2 border border-[#E5E1D8] bg-[#FAF9F6] text-xs font-medium text-[#1A1A1A] flex items-center gap-2"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Filters {hasActiveFilters && '•'}</span>
            </button>

            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="text-xs text-[#8C2D19] font-medium"
              >
                Reset
              </button>
            )}
          </div>

          {/* Right: Sorting Selector */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] text-[#8E8A81] hidden sm:inline uppercase tracking-wider">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3.5 py-1.5 border border-[#E5E1D8] text-[11px] font-medium text-[#1A1A1A] bg-[#FAF9F6] focus:outline-none focus:border-[#C5A059] cursor-pointer"
            >
              <option value="featured">Signature Pieces</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="newest">New Arrivals</option>
            </select>
          </div>

        </div>

        {/* Product Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
            {filteredProducts.map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                onQuickView={onQuickView}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white border border-[#E5E1D8] p-8 space-y-4 max-w-lg mx-auto shadow-sm">
            <Sparkles className="w-8 h-8 text-[#C5A059] mx-auto" />
            <h3 className="text-xl font-serif italic font-light text-[#1A1A1A]">
              No creations match your filters
            </h3>
            <p className="text-xs text-[#6B6658] leading-relaxed font-light">
              Try adjusting your price range, fabric preferences, or explore our full archival collection.
            </p>
            <button
              onClick={resetAllFilters}
              className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}

      </div>

      {/* Mobile Filter Drawer */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileFilterOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-[#FAF9F6] h-full shadow-2xl flex flex-col z-10 p-6 overflow-y-auto border-r border-[#E5E1D8]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E1D8]">
              <h3 className="font-serif italic text-lg text-[#1A1A1A]">
                Filter Creations
              </h3>
              <button onClick={() => setIsMobileFilterOpen(false)} className="p-1">
                <X className="w-5 h-5 text-[#1A1A1A]" />
              </button>
            </div>

            <div className="py-6 space-y-6 flex-1">
              {/* Price */}
              <div className="space-y-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6B6658] font-cinzel">Price Tier</span>
                <select
                  value={selectedPriceRange}
                  onChange={(e) => setSelectedPriceRange(e.target.value)}
                  className="w-full p-2 border border-[#E5E1D8] text-xs bg-white text-[#1A1A1A]"
                >
                  <option value="all">All Price Tiers</option>
                  <option value="under_50k">Under ₹50,000</option>
                  <option value="50k_100k">₹50,000 - ₹1,00,000</option>
                  <option value="100k_200k">₹1,00,000 - ₹2,00,000</option>
                  <option value="above_200k">Above ₹2,00,000</option>
                </select>
              </div>

              {/* Fabric */}
              {fabrics.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6B6658] font-cinzel">Fabric Weave</span>
                  <select
                    value={selectedFabric}
                    onChange={(e) => setSelectedFabric(e.target.value)}
                    className="w-full p-2 border border-[#E5E1D8] text-xs bg-white text-[#1A1A1A]"
                  >
                    <option value="all">All Fabrics</option>
                    {fabrics.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* New arrivals */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-[#1A1A1A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyNewArrivals}
                    onChange={(e) => setShowOnlyNewArrivals(e.target.checked)}
                    className="accent-[#C5A059]"
                  />
                  <span>New Arrivals Only</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E1D8] flex gap-2">
              <button
                onClick={resetAllFilters}
                className="flex-1 py-2.5 border border-[#E5E1D8] text-[10px] uppercase tracking-wider font-medium text-[#6B6658] bg-white"
              >
                Reset
              </button>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="flex-1 py-2.5 bg-[#1A1A1A] text-white text-[10px] uppercase tracking-wider font-medium"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
