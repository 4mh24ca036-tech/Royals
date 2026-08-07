import React from 'react';
import { Heart, Eye, Sparkles, ShoppingBag } from 'lucide-react';
import { Product } from '../../types';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';

interface ProductCardProps {
  product: Product;
  onQuickView: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onQuickView }) => {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const inWishlist = isInWishlist(product.id);

  const hasDiscount = product.discount_price && product.discount_price < product.price;
  const effectivePrice = hasDiscount ? product.discount_price! : product.price;
  const discountPercent = hasDiscount ? Math.round(((product.price - product.discount_price!) / product.price) * 100) : 0;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    const defaultSize = product.sizes[0] || 'Standard';
    addToCart(product, defaultSize, product.color);
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product);
  };

  return (
    <div 
      onClick={() => onQuickView(product)}
      className="group relative bg-white border border-[#E5E1D8] hover:border-[#C5A059] transition-all duration-300 shadow-sm hover:shadow-md flex flex-col cursor-pointer"
    >
      {/* Product Image Stage */}
      <div className="relative aspect-[3/4] bg-[#F5F2ED] overflow-hidden">
        <img
          src={product.images[0] || '/uploads/prod_boutique_01/garment-01.jpeg'}
          alt={product.title}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const el = e.target as HTMLImageElement;
            if (!el.dataset.fallback) {
              el.dataset.fallback = '1';
              el.src = '/uploads/prod_boutique_01/garment-01.jpeg';
            }
          }}
          className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
        />

        {/* Secondary image hover effect if available */}
        {product.images[1] && (
          <img
            src={product.images[1]}
            alt={`${product.title} Alternate`}
            loading="lazy"
            decoding="async"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            className="absolute inset-0 w-full h-full object-cover object-top opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          />
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
          {product.is_new_arrival && (
            <span className="px-2 py-0.5 bg-white text-[#1A1A1A] text-[9px] uppercase tracking-wider font-medium border border-[#E5E1D8]">
              New Arrival
            </span>
          )}
          {product.is_featured && (
            <span className="px-2 py-0.5 bg-[#1A1A1A] text-[#C5A059] text-[9px] uppercase tracking-wider font-medium border border-[#333] flex items-center gap-1">
              <Sparkles className="w-2 h-2 text-[#C5A059]" />
              Signature
            </span>
          )}
          {hasDiscount && (
            <span className="px-2 py-0.5 bg-[#8C2D19] text-white text-[9px] uppercase tracking-wider font-medium">
              {discountPercent}% Off
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={handleWishlistClick}
          className={`absolute top-3 right-3 w-8 h-8 flex items-center justify-center transition-all duration-200 z-10 cursor-pointer border ${
            inWishlist
              ? 'bg-[#1A1A1A] text-[#C5A059] border-[#1A1A1A]'
              : 'bg-white/90 hover:bg-white text-[#6B6658] hover:text-[#1A1A1A] border-[#E5E1D8]'
          }`}
          aria-label="Save to Wishlist"
        >
          <Heart className={`w-3.5 h-3.5 ${inWishlist ? 'fill-[#C5A059]' : ''}`} />
        </button>

        {/* Quick View Floating Overlay on Desktop */}
        <div className="absolute inset-x-3 bottom-3 hidden sm:flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickView(product);
            }}
            className="flex-1 py-2 bg-white/95 hover:bg-white text-[#1A1A1A] border border-[#E5E1D8] text-[10px] font-medium uppercase tracking-[0.2em] flex items-center justify-center gap-1.5 shadow-sm transition-colors"
          >
            <Eye className="w-3 h-3 text-[#C5A059]" />
            <span>Quick View</span>
          </button>
          
          <button
            onClick={handleQuickAdd}
            className="w-8 h-8 bg-[#1A1A1A] hover:bg-[#C5A059] text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer"
            title="Add to Bag"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Product Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
        <div>
          <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.25em] text-[#8E8A81] font-medium font-cinzel">
            <span>{product.category_name}</span>
            <span className="text-[#C5A059]">★ {product.rating.toFixed(1)}</span>
          </div>

          <h3 className="text-[12px] uppercase tracking-[0.15em] font-medium text-[#1A1A1A] group-hover:text-[#C5A059] transition-colors line-clamp-1 mt-1 font-sans">
            {product.title}
          </h3>

          <p className="text-[11px] text-[#6B6658] line-clamp-1 font-light mt-0.5">
            {product.fabric || product.embroidery}
          </p>
        </div>

        {/* Price & Sizes */}
        <div className="pt-2.5 border-t border-[#E5E1D8] flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-medium text-[#1A1A1A]">
                ₹{effectivePrice.toLocaleString('en-IN')}
              </span>
              {hasDiscount && (
                <span className="text-[11px] text-[#8E8A81] line-through">
                  ₹{product.price.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            <span className="text-[9px] text-[#6B6658] tracking-wider uppercase block">
              Inclusive of GST
            </span>
          </div>

          <span className="text-[9px] text-[#8E8A81] uppercase tracking-wider font-medium">
            {product.sizes.length} Sizes
          </span>
        </div>
      </div>
    </div>
  );
};
