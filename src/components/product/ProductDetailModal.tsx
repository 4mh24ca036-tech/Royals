import React, { useState } from 'react';
import {
  X,
  Heart,
  ShoppingBag,
  Sparkles,
  Truck,
  ShieldCheck,
  Ruler,
  Phone,
  MessageCircle,
  Star,
  Check,
  ArrowRight,
  Send
} from 'lucide-react';
import { Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { api } from '../../services/api';
import { SizeGuideModal } from './SizeGuideModal';
import { ProductImageGallery } from './ProductImageGallery';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onProceedToCheckout?: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onProceedToCheckout
}) => {
  const { addToCart, setIsCartDrawerOpen } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'details' | 'care' | 'reviews'>('details');

  // Review Form state
  const [reviewerName, setReviewerName] = useState<string>('');
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewSubmitting, setReviewSubmitting] = useState<boolean>(false);
  const [reviewSuccess, setReviewSuccess] = useState<boolean>(false);

  if (!isOpen || !product) return null;

  const currentSize = selectedSize || product.sizes[0] || 'Standard';
  const hasDiscount = product.discount_price && product.discount_price < product.price;
  const effectivePrice = hasDiscount ? product.discount_price! : product.price;
  const inWishlist = isInWishlist(product.id);

  // Estimated delivery date (Current Date + 8 Days)
  const estDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const estDateFormatted = `${String(estDate.getDate()).padStart(2, '0')} ${monthNames[estDate.getMonth()]} ${estDate.getFullYear()}`;

  const handleAddToCart = () => {
    addToCart(product, currentSize, product.color, quantity);
  };

  const handleBuyNow = () => {
    addToCart(product, currentSize, product.color, quantity);
    onClose();
    if (onProceedToCheckout) {
      onProceedToCheckout();
    } else {
      setIsCartDrawerOpen(true);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewerName || !reviewComment) return;

    setReviewSubmitting(true);
    try {
      await api.submitProductReview(product.id, {
        userName: reviewerName,
        rating: reviewRating,
        comment: reviewComment
      });
      setReviewSuccess(true);
      setReviewerName('');
      setReviewComment('');
      setTimeout(() => setReviewSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hello ROYALS Atelier, I am interested in inquiring about ${product.title} (SKU: ${product.id}). Is custom sizing and immediate delivery available?`
  );
  const whatsappUrl = `https://wa.me/918000461784?text=${whatsappMessage}`;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto">
        <div className="relative w-full max-w-5xl bg-[#FAF9F6] shadow-2xl border border-[#E5E1D8] overflow-hidden my-auto max-h-[92vh] flex flex-col">

          {/* Top Bar with Close */}
          <div className="px-6 py-3.5 bg-[#F5F2ED] border-b border-[#E5E1D8] flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-medium text-[#C5A059] uppercase tracking-[0.3em] font-cinzel">
              <Sparkles className="w-3 h-3 text-[#C5A059]" />
              <span>Lucknow Atelier Masterpiece</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-[#6B6658] hover:text-[#1A1A1A] transition-colors cursor-pointer"
              aria-label="Close product view"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body: Two Column Layout */}
          <div className="overflow-y-auto flex-1 p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">

              {/* Left Column: Image Gallery (6 cols) */}
              <div className="lg:col-span-6 space-y-4">
                <ProductImageGallery
                  images={product.images}
                  title={product.title}
                  preloadCover={true}
                />
              </div>

              {/* Right Column: Details & Actions (6 cols) */}
              <div className="lg:col-span-6 space-y-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-[#8E8A81] uppercase tracking-[0.25em] font-medium font-cinzel">
                    <span>{product.category_name}</span>
                    <div className="flex items-center gap-1 text-[#1A1A1A] font-medium">
                      <Star className="w-3.5 h-3.5 fill-[#C5A059] text-[#C5A059]" />
                      <span>{product.rating.toFixed(2)} ({product.review_count} Reviews)</span>
                    </div>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-serif italic font-light text-[#1A1A1A] tracking-wide mt-1.5 leading-snug">
                    {product.title}
                  </h2>

                  {/* Pricing Box */}
                  <div className="mt-3 p-4 bg-[#F5F2ED] border border-[#E5E1D8] flex items-baseline justify-between">
                    <div>
                      <div className="flex items-baseline gap-3">
                        <span className="text-2xl sm:text-3xl font-serif font-light text-[#1A1A1A]">
                          ₹{effectivePrice.toLocaleString('en-IN')}
                        </span>
                        {hasDiscount && (
                          <span className="text-base text-[#8E8A81] line-through">
                            ₹{product.price.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#6B6658] uppercase tracking-wider block mt-0.5">
                        Inclusive of 12% GST • Insured White-Glove Delivery
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 bg-white border border-[#E5E1D8] text-[#1A1A1A] text-[9px] font-medium uppercase tracking-[0.2em]">
                        {product.stock > 0 ? `In Stock (${product.stock})` : 'Made to Order'}
                      </span>
                    </div>
                  </div>

                  {/* Size Selector */}
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#1A1A1A] font-cinzel">
                        Select Fit / Size:
                      </span>
                      <button
                        onClick={() => setIsSizeGuideOpen(true)}
                        className="inline-flex items-center gap-1 text-[10px] text-[#C5A059] hover:text-[#1A1A1A] uppercase tracking-wider font-medium cursor-pointer"
                      >
                        <Ruler className="w-3.5 h-3.5" />
                        <span>Size Guide</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {product.sizes.map((sz) => (
                        <button
                          key={sz}
                          onClick={() => setSelectedSize(sz)}
                          className={`px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all cursor-pointer ${currentSize === sz
                              ? 'bg-[#1A1A1A] text-white border border-[#1A1A1A]'
                              : 'bg-white border border-[#E5E1D8] text-[#6B6658] hover:border-[#C5A059] hover:text-[#1A1A1A]'
                            }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Delivery Calculator */}
                  <div className="mt-6 p-4 bg-white border border-[#E5E1D8] flex items-start gap-3">
                    <Truck className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
                    <div className="text-xs text-[#6B6658] space-y-0.5">
                      <p className="font-medium text-[#1A1A1A]">
                        Estimated Delivery by <span className="text-[#C5A059] font-semibold">{estDateFormatted}</span>
                      </p>
                      <p className="text-[11px] font-light">Complimentary Insured Transit via Blue Dart Apex Luxury across India.</p>
                    </div>
                  </div>

                  {/* Tabs: Specifications, Care, Reviews */}
                  <div className="mt-6 pt-4 border-t border-[#E5E1D8]">
                    <div className="flex items-center gap-6 border-b border-[#E5E1D8] pb-2 text-[10px] font-medium uppercase tracking-[0.2em] font-cinzel">
                      <button
                        onClick={() => setActiveTab('details')}
                        className={`pb-1 cursor-pointer transition-colors ${activeTab === 'details' ? 'text-[#C5A059] border-b-2 border-[#C5A059]' : 'text-[#8E8A81] hover:text-[#1A1A1A]'}`}
                      >
                        Fabric & Craft
                      </button>
                      <button
                        onClick={() => setActiveTab('care')}
                        className={`pb-1 cursor-pointer transition-colors ${activeTab === 'care' ? 'text-[#C5A059] border-b-2 border-[#C5A059]' : 'text-[#8E8A81] hover:text-[#1A1A1A]'}`}
                      >
                        Care & Preservation
                      </button>
                      <button
                        onClick={() => setActiveTab('reviews')}
                        className={`pb-1 cursor-pointer transition-colors ${activeTab === 'reviews' ? 'text-[#C5A059] border-b-2 border-[#C5A059]' : 'text-[#8E8A81] hover:text-[#1A1A1A]'}`}
                      >
                        Reviews ({product.review_count})
                      </button>
                    </div>

                    <div className="pt-3 text-xs text-[#6B6658] leading-relaxed">
                      {activeTab === 'details' && (
                        <div className="space-y-2">
                          <p className="font-light">{product.description}</p>
                          <div className="grid grid-cols-2 gap-2 pt-2 text-[#1A1A1A]">
                            <p><span className="text-[#8E8A81] uppercase text-[10px] tracking-wider">Fabric:</span> {product.fabric}</p>
                            <p><span className="text-[#8E8A81] uppercase text-[10px] tracking-wider">Embroidery:</span> {product.embroidery}</p>
                            <p><span className="text-[#8E8A81] uppercase text-[10px] tracking-wider">Color:</span> {product.color}</p>
                            <p><span className="text-[#8E8A81] uppercase text-[10px] tracking-wider">Origin:</span> Lucknow Atelier, Uttar Pradesh</p>
                          </div>
                        </div>
                      )}

                      {activeTab === 'care' && (
                        <div className="space-y-1.5 font-light">
                          <p className="font-medium text-[#1A1A1A]">{product.care_instructions}</p>
                          <p>Delivered in an archival custom preservation trunk to protect hand Zardozi embroidery.</p>
                        </div>
                      )}

                      {activeTab === 'reviews' && (
                        <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                          {product.reviews && product.reviews.length > 0 ? (
                            product.reviews.map((r, idx) => (
                              <div key={idx} className="p-3 bg-white border border-[#E5E1D8]">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-[#1A1A1A] text-xs">{r.user_name}</span>
                                  <div className="flex text-[#C5A059]">
                                    {[...Array(r.rating)].map((_, i) => (
                                      <Star key={i} className="w-3 h-3 fill-current" />
                                    ))}
                                  </div>
                                </div>
                                <p className="mt-1 text-xs text-[#6B6658] font-light">{r.comment}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-[#8E8A81] text-xs">No client reviews yet. Be the first to review.</p>
                          )}

                          {/* Submit Review Form */}
                          <form onSubmit={handleReviewSubmit} className="pt-3 border-t border-[#E5E1D8] space-y-2">
                            <span className="font-medium text-[#1A1A1A] text-xs uppercase tracking-wider block">Write a Review</span>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="Your Name"
                                required
                                value={reviewerName}
                                onChange={(e) => setReviewerName(e.target.value)}
                                className="p-2 border border-[#E5E1D8] text-xs bg-white text-[#1A1A1A]"
                              />
                              <select
                                value={reviewRating}
                                onChange={(e) => setReviewRating(Number(e.target.value))}
                                className="p-2 border border-[#E5E1D8] text-xs bg-white text-[#1A1A1A]"
                              >
                                <option value={5}>5 Stars - Outstanding</option>
                                <option value={4}>4 Stars - Very Good</option>
                                <option value={3}>3 Stars - Good</option>
                              </select>
                            </div>
                            <textarea
                              placeholder="Share your experience regarding craftsmanship, fit, and elegance..."
                              required
                              rows={2}
                              value={reviewComment}
                              onChange={(e) => setReviewComment(e.target.value)}
                              className="w-full p-2 border border-[#E5E1D8] text-xs bg-white text-[#1A1A1A]"
                            />
                            <button
                              type="submit"
                              disabled={reviewSubmitting}
                              className="px-5 py-2 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer"
                            >
                              {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                            </button>
                            {reviewSuccess && (
                              <p className="text-[#C5A059] font-medium text-[11px]">
                                Thank you! Your review has been recorded.
                              </p>
                            )}
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Sticky Action Buttons */}
                <div className="pt-6 border-t border-[#E5E1D8] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={handleAddToCart}
                      className="py-3.5 px-6 bg-white hover:bg-[#FAF9F6] border border-[#1A1A1A] text-[#1A1A1A] text-[11px] uppercase tracking-[0.2em] font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4 text-[#C5A059]" />
                      <span>Add to Bag</span>
                    </button>

                    <button
                      onClick={handleBuyNow}
                      className="py-3.5 px-6 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] uppercase tracking-[0.2em] font-medium flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                    >
                      <span>Checkout</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2.5 px-4 border border-[#E5E1D8] hover:bg-[#F5F2ED] text-[#1A1A1A] text-[10px] uppercase tracking-[0.2em] font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 text-[#C5A059]" />
                      <span>Inquire on WhatsApp</span>
                    </a>

                    <button
                      onClick={() => toggleWishlist(product)}
                      className={`p-2.5 border transition-colors cursor-pointer ${inWishlist ? 'bg-[#1A1A1A] text-[#C5A059] border-[#1A1A1A]' : 'bg-white border-[#E5E1D8] text-[#6B6658]'
                        }`}
                      aria-label="Save to Wishlist"
                    >
                      <Heart className={`w-4 h-4 ${inWishlist ? 'fill-[#C5A059]' : ''}`} />
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Sizing Guide Modal Sub-component */}
      <SizeGuideModal
        isOpen={isSizeGuideOpen}
        onClose={() => setIsSizeGuideOpen(false)}
      />
    </>
  );
};
