import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Tag, 
  ShieldCheck, 
  Truck, 
  ArrowRight, 
  Sparkles,
  Phone,
  Check
} from 'lucide-react';
import { useCart } from '../../context/CartContext';

interface CartDrawerProps {
  onProceedToCheckout: () => void;
  onExplore: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  onProceedToCheckout,
  onExplore
}) => {
  const {
    items,
    itemCount,
    subtotal,
    gstAmount,
    discountAmount,
    deliveryFee,
    grandTotal,
    appliedCoupon,
    couponMessage,
    isCartDrawerOpen,
    setIsCartDrawerOpen,
    removeFromCart,
    updateQuantity,
    applyCoupon,
    removeCoupon
  } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  if (!isCartDrawerOpen) return null;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setIsApplyingCoupon(true);
    await applyCoupon(couponInput);
    setIsApplyingCoupon(false);
    setCouponInput('');
  };

  const handleCheckout = () => {
    setIsCartDrawerOpen(false);
    onProceedToCheckout();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartDrawerOpen(false)}
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-md bg-[#FAF9F6] h-full shadow-2xl flex flex-col z-10 border-l border-[#E5E1D8]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#F5F2ED] border-b border-[#E5E1D8] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-4 h-4 text-[#C5A059]" />
            <div>
              <h3 className="font-serif italic font-light text-lg text-[#1A1A1A] tracking-wide">
                Your Couture Bag
              </h3>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#8E8A81] font-cinzel">
                {itemCount} {itemCount === 1 ? 'Creation' : 'Creations'} Selected
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsCartDrawerOpen(false)}
            className="p-1.5 text-[#6B6658] hover:text-[#1A1A1A] transition-colors cursor-pointer"
            aria-label="Close cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {items.length > 0 ? (
            items.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-white border border-[#E5E1D8] shadow-sm flex gap-4"
              >
                {/* Image */}
                <div className="w-20 h-24 bg-[#F5F2ED] overflow-hidden shrink-0 border border-[#E5E1D8]">
                  <img
                    src={item.image || '/uploads/prod_boutique_01/garment-01.jpeg'}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs uppercase tracking-wider font-medium text-[#1A1A1A] line-clamp-1">
                        {item.title}
                      </h4>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-[#8E8A81] hover:text-[#8C2D19] p-0.5 cursor-pointer transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#6B6658] mt-1">
                      <span className="bg-[#F5F2ED] px-1.5 py-0.5 border border-[#E5E1D8]">Size: {item.size}</span>
                      <span>Color: {item.color}</span>
                    </div>
                  </div>

                  {/* Quantity & Price */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-[#E5E1D8]">
                    <div className="flex items-center border border-[#E5E1D8] bg-[#FAF9F6]">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1 text-[#6B6658] hover:text-[#1A1A1A] cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-medium text-[#1A1A1A]">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1 text-[#6B6658] hover:text-[#1A1A1A] cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-medium text-[#1A1A1A]">
                        ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16 space-y-4">
              <ShoppingBag className="w-10 h-10 text-[#C5A059] mx-auto opacity-50" />
              <h4 className="font-serif italic font-light text-lg text-[#1A1A1A]">Your Bag is Empty</h4>
              <p className="text-xs text-[#6B6658] max-w-xs mx-auto font-light">
                Explore our handcrafted bridal lehengas, royal achkans, and archival drapes to begin your selection.
              </p>
              <button
                onClick={() => {
                  setIsCartDrawerOpen(false);
                  onExplore();
                }}
                className="px-7 py-3 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer"
              >
                Explore Haute Couture
              </button>
            </div>
          )}
        </div>

        {/* Footer with Calculation & Checkout */}
        {items.length > 0 && (
          <div className="p-5 sm:p-6 bg-[#F5F2ED] border-t border-[#E5E1D8] space-y-4">
            
            {/* Coupon Section */}
            <div>
              {appliedCoupon ? (
                <div className="p-2.5 bg-white border border-[#C5A059] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#1A1A1A] font-medium">
                    <Tag className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span className="text-[11px]">Coupon <strong>{appliedCoupon}</strong> Applied: ₹{discountAmount.toLocaleString('en-IN')} Off</span>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="text-[#8C2D19] hover:underline font-medium text-[11px] uppercase tracking-wider cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-[#8E8A81] absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Coupon Code (e.g. ROYALFIRST)"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      className="w-full pl-8 pr-3 py-2 border border-[#E5E1D8] text-xs bg-white uppercase font-medium focus:outline-none focus:border-[#C5A059]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isApplyingCoupon || !couponInput.trim()}
                    className="px-5 py-2 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {isApplyingCoupon ? '...' : 'Apply'}
                  </button>
                </form>
              )}

              {couponMessage && (
                <p className="text-[11px] mt-1 text-[#C5A059] font-medium">{couponMessage}</p>
              )}
            </div>

            {/* Price Calculations */}
            <div className="space-y-1.5 text-xs text-[#6B6658] pt-2 border-t border-[#E5E1D8]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-[#C5A059] font-medium">
                  <span>Discount</span>
                  <span>- ₹{discountAmount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>GST (12% Apparel Tax)</span>
                <span>₹{gstAmount.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between">
                <span>Insured Courier</span>
                <span>{deliveryFee === 0 ? <strong className="text-[#1A1A1A] font-medium">COMPLIMENTARY</strong> : `₹${deliveryFee}`}</span>
              </div>

              <div className="flex justify-between text-xs uppercase tracking-wider font-medium text-[#1A1A1A] pt-2 border-t border-[#E5E1D8]">
                <span>Grand Total</span>
                <span className="text-sm font-semibold text-[#1A1A1A]">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              className="w-full py-3.5 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] uppercase tracking-[0.2em] font-medium flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer group"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Trust Assurance */}
            <div className="flex items-center justify-center gap-4 text-[9px] uppercase tracking-wider text-[#8E8A81]">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#C5A059]" />
                100% Insured
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Truck className="w-3 h-3 text-[#C5A059]" />
                Blue Dart Luxury
              </span>
              <span>•</span>
              <a href="tel:8000461784" className="hover:text-[#1A1A1A]">
                Concierge: 8000461784
              </a>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
