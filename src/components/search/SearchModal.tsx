import React, { useState, useEffect } from 'react';
import { Search, X, Sparkles, ArrowRight } from 'lucide-react';
import { Product } from '../../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onPerformSearch: (query: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
  onPerformSearch
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredResults = searchTerm.trim()
    ? products.filter((p) => {
        const q = searchTerm.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.category_name.toLowerCase().includes(q) ||
          p.fabric.toLowerCase().includes(q) ||
          p.embroidery.toLowerCase().includes(q) ||
          p.color.toLowerCase().includes(q)
        );
      }).slice(0, 6)
    : [];

  const trendingSearches = [
    'Bridal Lehenga',
    'Royal Sherwani',
    'Banarasi Silk Saree',
    'Zardozi Velvet',
    'Gota Patti',
    'Kundan Jewellery'
  ];

  const handleTrendingClick = (term: string) => {
    onPerformSearch(term);
    onClose();
  };

  const handleFullSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onPerformSearch(searchTerm.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:pt-20 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-[#FAF9F6] border border-[#E5E1D8] shadow-2xl overflow-hidden">
        
        {/* Search Input Bar */}
        <form onSubmit={handleFullSearch} className="p-4 sm:p-6 bg-white border-b border-[#E5E1D8] flex items-center gap-3">
          <Search className="w-4 h-4 text-[#C5A059] shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search bridal lehengas, sherwanis, Banarasi silks, fabrics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs sm:text-sm font-light text-[#1A1A1A] bg-transparent focus:outline-none placeholder:text-[#8E8A81]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="p-1 text-[#8E8A81] hover:text-[#1A1A1A] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#1A1A1A] hover:text-[#C5A059] hover:bg-[#FAF9F6] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </form>

        {/* Content Area */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          
          {/* Live Search Results */}
          {searchTerm.trim() ? (
            <div className="space-y-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#8E8A81] font-cinzel">
                Matching Creations ({filteredResults.length})
              </span>

              {filteredResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredResults.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        onSelectProduct(p);
                        onClose();
                      }}
                      className="p-3 bg-white border border-[#E5E1D8] hover:border-[#C5A059] flex items-center gap-3 cursor-pointer transition-colors group"
                    >
                      <div className="w-14 h-16 bg-[#F5F2ED] overflow-hidden shrink-0 border border-[#E5E1D8]">
                        <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover object-top" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wider text-[#1A1A1A] group-hover:text-[#C5A059] transition-colors truncate">
                          {p.title}
                        </p>
                        <p className="text-[11px] text-[#6B6658] font-light truncate">{p.category_name} • {p.fabric}</p>
                        <p className="text-xs font-medium text-[#1A1A1A] mt-0.5">
                          ₹{(p.discount_price || p.price).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#6B6658] py-4 text-center font-light">
                  No direct matches found. Press Enter to search all archives.
                </p>
              )}
            </div>
          ) : (
            /* Trending Searches */
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.25em] text-[#8E8A81] font-cinzel">
                <Sparkles className="w-3 h-3 text-[#C5A059]" />
                <span>Popular Atelier Searches</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {trendingSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => handleTrendingClick(term)}
                    className="px-3.5 py-1.5 bg-white border border-[#E5E1D8] hover:border-[#C5A059] text-[11px] uppercase tracking-wider text-[#1A1A1A] hover:text-[#C5A059] transition-colors cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
