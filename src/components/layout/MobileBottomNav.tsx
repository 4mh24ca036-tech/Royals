import React from 'react';
import { Home, Sparkles, Search, Heart, ShoppingBag, Truck } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';

interface MobileBottomNavProps {
  currentTab: 'home' | 'shop' | 'tracking';
  onSelectTab: (tab: 'home' | 'shop' | 'tracking') => void;
  onOpenSearch: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenSearch
}) => {
  const { itemCount, setIsCartDrawerOpen } = useCart();
  const { wishlistCount } = useWishlist();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-t border-[#E5E1D8] px-3 py-2 shadow-lg">
      <div className="flex items-center justify-around">
        {/* Home */}
        <button
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center gap-1 p-1 text-[10px] uppercase tracking-wider font-medium transition-colors ${
            currentTab === 'home' ? 'text-[#C5A059]' : 'text-[#6B6658]'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>

        {/* Collections */}
        <button
          onClick={() => onSelectTab('shop')}
          className={`flex flex-col items-center gap-1 p-1 text-[10px] uppercase tracking-wider font-medium transition-colors ${
            currentTab === 'shop' ? 'text-[#C5A059]' : 'text-[#6B6658]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Couture</span>
        </button>

        {/* Search */}
        <button
          onClick={onOpenSearch}
          className="flex flex-col items-center gap-1 p-1 text-[10px] uppercase tracking-wider font-medium text-[#6B6658] hover:text-[#C5A059] transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search</span>
        </button>

        {/* Track */}
        <button
          onClick={() => onSelectTab('tracking')}
          className={`flex flex-col items-center gap-1 p-1 text-[10px] uppercase tracking-wider font-medium transition-colors ${
            currentTab === 'tracking' ? 'text-[#C5A059]' : 'text-[#6B6658]'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Track</span>
        </button>

        {/* Bag */}
        <button
          onClick={() => setIsCartDrawerOpen(true)}
          className="flex flex-col items-center gap-1 p-1 text-[10px] uppercase tracking-wider font-medium text-[#6B6658] hover:text-[#C5A059] transition-colors relative"
        >
          <div className="relative">
            <ShoppingBag className="w-4 h-4" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 bg-[#C5A059] text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </div>
          <span>Bag</span>
        </button>
      </div>
    </div>
  );
};
