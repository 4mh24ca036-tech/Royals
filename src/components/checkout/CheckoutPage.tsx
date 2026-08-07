import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Truck, 
  CreditCard, 
  QrCode, 
  Building2, 
  Banknote, 
  Lock, 
  ArrowLeft, 
  CheckCircle2, 
  Download, 
  MessageCircle, 
  Phone, 
  FileText, 
  Receipt,
  Sparkles,
  MapPin
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Order } from '../../types';
import { downloadInvoicePdf, downloadPaymentReceiptPdf, downloadOrderSummaryPdf } from '../../services/pdfGenerator';

interface CheckoutPageProps {
  onBackToShopping: () => void;
  onTrackOrder: (orderNumber: string) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  onBackToShopping,
  onTrackOrder
}) => {
  const { items, subtotal, discountAmount, gstAmount, deliveryFee, grandTotal, appliedCoupon, clearCart } = useCart();
  const { user, addresses } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 'success'>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // Form states
  const [fullName, setFullName] = useState<string>(user?.name || '');
  const [email, setEmail] = useState<string>(user?.email || '');
  const [phone, setPhone] = useState<string>(user?.phone || '');
  const [addressLine1, setAddressLine1] = useState<string>('');
  const [addressLine2, setAddressLine2] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('Rajasthan');
  const [pincode, setPincode] = useState<string>('');
  
  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Card' | 'NetBanking' | 'COD'>('UPI');
  const [upiId, setUpiId] = useState<string>('');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvv, setCardCvv] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<string>('HDFC Bank');

  // Handle address auto-fill from saved addresses
  const handleSelectSavedAddress = (addr: any) => {
    setFullName(addr.full_name);
    setPhone(addr.phone);
    setAddressLine1(addr.address_line1);
    setAddressLine2(addr.address_line2 || '');
    setCity(addr.city);
    setState(addr.state);
    setPincode(addr.pincode);
  };

  const handlePlaceOrder = async () => {
    if (!fullName || !email || !phone || !addressLine1 || !city || !pincode) {
      alert('Please fill all mandatory shipping address details.');
      setStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const orderPayload = {
        customerName: fullName,
        customerEmail: email,
        customerPhone: phone,
        shippingAddress: {
          fullName,
          phone,
          addressLine1,
          addressLine2,
          city,
          state,
          pincode,
          country: 'India'
        },
        items: items.map((it) => ({
          productId: it.productId,
          productTitle: it.title,
          size: it.size,
          color: it.color,
          quantity: it.quantity,
          unitPrice: it.price
        })),
        paymentMethod: paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : `Online - ${paymentMethod}`,
        couponCode: appliedCoupon,
        userId: user?.id
      };

      const response = await api.createOrder(orderPayload);
      setCreatedOrder(response.order);
      clearCart();
      setStep('success');
    } catch (err: any) {
      alert(err.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ORDER CONFIRMED VIEW
  if (step === 'success' && createdOrder) {
    const whatsappUrl = `https://wa.me/918000461784?text=${encodeURIComponent(
      `Hello ROYALS,\n\nI have placed an order.\n\nOrder ID: ${createdOrder.order_number}\nTracking ID: ${createdOrder.tracking_id}\n\nI have attached:\n• Receipt PDF\n• Payment Screenshot\n\nPlease verify my payment.`
    )}`;

    return (
      <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto bg-[#FAF9F6] min-h-screen">
        <div className="bg-white border border-[#E5E1D8] shadow-sm p-6 sm:p-10 text-center space-y-8">
          
          {/* Success Check Badge */}
          <div className="w-16 h-16 bg-[#1A1A1A] border border-[#C5A059] mx-auto flex items-center justify-center text-[#C5A059] shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-[#C5A059] font-cinzel font-medium">
              <Sparkles className="w-3 h-3" />
              <span>Consignment Registered in Atelier</span>
              <Sparkles className="w-3 h-3" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif italic font-light text-[#1A1A1A] tracking-wide">
              Order Confirmed
            </h1>
            <p className="text-xs text-[#6B6658] max-w-md mx-auto font-light">
              Thank you, <strong className="font-medium text-[#1A1A1A]">{createdOrder.customer_name}</strong>. Your couture ensemble is now being prepared for handcrafted tailoring and quality inspection.
            </p>
          </div>

          {/* Order Details Card */}
          <div className="p-6 bg-[#FAF9F6] border border-[#E5E1D8] text-left grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-[#8E8A81] font-medium uppercase tracking-[0.2em] text-[10px] font-cinzel block">Order Number</span>
              <span className="text-sm font-serif font-light text-[#1A1A1A] mt-0.5 block">#{createdOrder.order_number}</span>
            </div>
            <div>
              <span className="text-[#8E8A81] font-medium uppercase tracking-[0.2em] text-[10px] font-cinzel block">Tracking ID</span>
              <span className="text-xs font-mono font-medium text-[#1A1A1A] mt-0.5 block">{createdOrder.tracking_id}</span>
            </div>
            <div>
              <span className="text-[#8E8A81] font-medium uppercase tracking-[0.2em] text-[10px] font-cinzel block">Estimated Delivery</span>
              <span className="text-xs font-medium text-[#C5A059] mt-0.5 block">{createdOrder.estimated_delivery_date}</span>
            </div>
          </div>

          {/* Download Receipt PDF Button */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-cinzel font-medium tracking-[0.25em] text-[#8E8A81] block">
              Official Receipt Documentation
            </span>

            <button
              onClick={() => downloadInvoicePdf(createdOrder)}
              className="w-full p-4 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] uppercase tracking-wider font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4 text-[#C5A059]" />
              <span>Download Receipt PDF</span>
            </button>
          </div>

          {/* WhatsApp Inquiry Button */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-cinzel font-medium tracking-[0.25em] text-[#8E8A81] block">
              Payment Verification
            </span>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full p-4 bg-[#25D366] hover:bg-[#128C7E] text-white text-[11px] uppercase tracking-wider font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <MessageCircle className="w-4 h-4 text-white" />
              <span>Inquire on WhatsApp</span>
            </a>
            <p className="text-[10px] text-[#6B6658] font-light">
              Send receipt PDF and payment screenshot for verification
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-[#E5E1D8]">
            <button
              onClick={() => onTrackOrder(createdOrder.order_number)}
              className="px-8 py-3 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer shadow-sm"
            >
              Track Live Shipment
            </button>

            <button
              onClick={onBackToShopping}
              className="px-8 py-3 bg-white hover:bg-[#FAF9F6] border border-[#E5E1D8] text-[#1A1A1A] text-[11px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer"
            >
              Continue Exploring
            </button>
          </div>

        </div>
      </div>
    );
  }

  // CHECKOUT STEPS VIEW
  return (
    <div className="py-10 bg-[#FAF9F6] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        
        {/* Back button & Title */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={onBackToShopping}
            className="inline-flex items-center gap-2 text-[11px] font-medium text-[#6B6658] hover:text-[#1A1A1A] uppercase tracking-[0.2em] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Return to Atelier</span>
          </button>

          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#8E8A81]">
            <Lock className="w-3 h-3 text-[#C5A059]" />
            <span>256-Bit Encrypted Imperial Checkout</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          
          {/* Main Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Step Indicators */}
            <div className="grid grid-cols-3 gap-2 pb-2">
              <div className={`p-3 border text-center transition-all ${
                step === 1 ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-[#8E8A81] border-[#E5E1D8]'
              }`}>
                <span className="text-[9px] uppercase tracking-[0.2em] font-medium block font-cinzel">Step 1</span>
                <span className="text-xs uppercase tracking-wider font-medium">Shipping Details</span>
              </div>

              <div className={`p-3 border text-center transition-all ${
                step === 2 ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-[#8E8A81] border-[#E5E1D8]'
              }`}>
                <span className="text-[9px] uppercase tracking-[0.2em] font-medium block font-cinzel">Step 2</span>
                <span className="text-xs uppercase tracking-wider font-medium">Packaging & Transit</span>
              </div>

              <div className={`p-3 border text-center transition-all ${
                step === 3 ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-[#8E8A81] border-[#E5E1D8]'
              }`}>
                <span className="text-[9px] uppercase tracking-[0.2em] font-medium block font-cinzel">Step 3</span>
                <span className="text-xs uppercase tracking-wider font-medium">Payment Option</span>
              </div>
            </div>

            {/* STEP 1: SHIPPING ADDRESS */}
            {step === 1 && (
              <div className="p-6 sm:p-8 bg-white border border-[#E5E1D8] shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4">
                  <h3 className="text-lg font-serif italic font-light text-[#1A1A1A]">
                    Shipping & Delivery Details
                  </h3>
                  <span className="text-[10px] uppercase tracking-wider text-[#C5A059] font-medium">Complimentary Pan-India Transit</span>
                </div>

                {/* Saved addresses selector if logged in */}
                {addresses.length > 0 && (
                  <div className="p-4 bg-[#FAF9F6] border border-[#E5E1D8] space-y-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] block">Select Saved Address:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {addresses.map((addr) => (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => handleSelectSavedAddress(addr)}
                          className="p-3 border border-[#E5E1D8] bg-white text-left text-xs hover:border-[#C5A059] transition-colors cursor-pointer"
                        >
                          <p className="font-medium text-[#1A1A1A]">{addr.full_name}</p>
                          <p className="text-[#6B6658] truncate font-light text-[11px]">{addr.address_line1}, {addr.city}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Radhika Sharma"
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">Phone Number (For Delivery OTP) *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. radhika@example.com"
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">Address Line 1 (Flat, House No., Building) *</label>
                    <input
                      type="text"
                      required
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="e.g. Palace Villa 4, Civil Lines"
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">Address Line 2 (Street, Landmark)</label>
                    <input
                      type="text"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder="e.g. Near Heritage Haveli"
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Jaipur"
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">Pincode *</label>
                    <input
                      type="text"
                      required
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="e.g. 302001"
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">State *</label>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059]"
                    >
                      <option value="Rajasthan">Rajasthan</option>
                      <option value="Maharashtra">Maharashtra</option>
                      <option value="Delhi NCR">Delhi NCR</option>
                      <option value="Gujarat">Gujarat</option>
                      <option value="Karnataka">Karnataka</option>
                      <option value="Tamil Nadu">Tamil Nadu</option>
                      <option value="Uttar Pradesh">Uttar Pradesh</option>
                      <option value="West Bengal">West Bengal</option>
                      <option value="Punjab">Punjab</option>
                      <option value="Telangana">Telangana</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">Country</label>
                    <input
                      type="text"
                      disabled
                      value="India"
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-[#F5F2ED] text-[#6B6658]"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => {
                      if (!fullName || !email || !phone || !addressLine1 || !city || !pincode) {
                        alert('Please fill in all mandatory fields.');
                        return;
                      }
                      setStep(2);
                    }}
                    className="px-8 py-3 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer"
                  >
                    Continue to Packaging
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PACKAGING & COURIER */}
            {step === 2 && (
              <div className="p-6 sm:p-8 bg-white border border-[#E5E1D8] shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4">
                  <h3 className="text-lg font-serif italic font-light text-[#1A1A1A]">
                    Royal Packaging & Courier Partner
                  </h3>
                  <span className="text-[10px] uppercase tracking-wider text-[#C5A059] font-medium">Insured White-Glove Transit</span>
                </div>

                {/* Packaging Selection */}
                <div className="space-y-3">
                  <div className="p-4 border border-[#C5A059] bg-[#FAF9F6] flex items-start gap-4">
                    <Sparkles className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-medium text-[#1A1A1A] uppercase tracking-wider">
                          Complimentary Royal Trunk Box & Garment Bag
                        </h4>
                        <span className="text-[10px] uppercase tracking-wider font-medium text-[#C5A059]">INCLUDED</span>
                      </div>
                      <p className="text-xs text-[#6B6658] mt-1 leading-relaxed font-light">
                        Handcrafted velvet preservation trunk with humidity-resistant inserts and scented muslin wrap.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Courier Partner Selection */}
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] block">Courier Partner:</span>
                  <div className="p-4 border border-[#E5E1D8] bg-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Truck className="w-4 h-4 text-[#C5A059]" />
                      <div>
                        <p className="text-xs font-medium text-[#1A1A1A]">Blue Dart Apex Luxury Express</p>
                        <p className="text-[11px] text-[#6B6658] font-light">Air Courier with live tracking & tamper-proof seal</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A]">FREE</span>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-[#E5E1D8]">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-2.5 border border-[#E5E1D8] text-[10px] uppercase tracking-wider font-medium text-[#6B6658] hover:bg-[#FAF9F6]"
                  >
                    Back to Address
                  </button>

                  <button
                    onClick={() => setStep(3)}
                    className="px-8 py-3 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer"
                  >
                    Proceed to Payment
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: PAYMENT METHOD */}
            {step === 3 && (
              <div className="p-6 sm:p-8 bg-white border border-[#E5E1D8] shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4">
                  <h3 className="text-lg font-serif italic font-light text-[#1A1A1A]">
                    Select Payment Method
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#6B6658] font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>256-Bit SSL Secured</span>
                  </div>
                </div>

                {/* Payment Option Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI')}
                    className={`p-3 border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'UPI' ? 'border-[#C5A059] bg-[#FAF9F6]' : 'border-[#E5E1D8] bg-white'
                    }`}
                  >
                    <QrCode className="w-4 h-4 text-[#C5A059]" />
                    <span className="text-[11px] uppercase tracking-wider font-medium text-[#1A1A1A]">UPI / QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Card')}
                    className={`p-3 border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'Card' ? 'border-[#C5A059] bg-[#FAF9F6]' : 'border-[#E5E1D8] bg-white'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-[#C5A059]" />
                    <span className="text-[11px] uppercase tracking-wider font-medium text-[#1A1A1A]">Credit / Debit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('NetBanking')}
                    className={`p-3 border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'NetBanking' ? 'border-[#C5A059] bg-[#FAF9F6]' : 'border-[#E5E1D8] bg-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-[#C5A059]" />
                    <span className="text-[11px] uppercase tracking-wider font-medium text-[#1A1A1A]">Net Banking</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('COD')}
                    className={`p-3 border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'COD' ? 'border-[#C5A059] bg-[#FAF9F6]' : 'border-[#E5E1D8] bg-white'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-[#C5A059]" />
                    <span className="text-[11px] uppercase tracking-wider font-medium text-[#1A1A1A]">Cash On Delivery</span>
                  </button>
                </div>

                {/* Sub-inputs for each method */}
                {paymentMethod === 'UPI' && (
                  <div className="p-4 bg-[#FAF9F6] border border-[#E5E1D8] space-y-3">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] block">Instant UPI Gateway</span>
                    <input
                      type="text"
                      placeholder="Enter UPI ID (e.g. mobile@okhdfcbank / yourname@upi)"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-white focus:outline-none focus:border-[#C5A059]"
                    />
                    <p className="text-[11px] text-[#6B6658] font-light">
                      Supports Google Pay, PhonePe, Paytm, BHIM, and Cred UPI.
                    </p>
                  </div>
                )}

                {paymentMethod === 'Card' && (
                  <div className="p-4 bg-[#FAF9F6] border border-[#E5E1D8] space-y-3">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] block">Card Details</span>
                    <input
                      type="text"
                      placeholder="Card Number (XXXX XXXX XXXX XXXX)"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-white"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="p-3 border border-[#E5E1D8] text-xs bg-white"
                      />
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="CVV"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="p-3 border border-[#E5E1D8] text-xs bg-white"
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === 'NetBanking' && (
                  <div className="p-4 bg-[#FAF9F6] border border-[#E5E1D8] space-y-3">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] block">Select Banking Partner</span>
                    <select
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-white"
                    >
                      <option value="HDFC Bank">HDFC Bank</option>
                      <option value="ICICI Bank">ICICI Bank</option>
                      <option value="State Bank of India">State Bank of India</option>
                      <option value="Axis Bank">Axis Bank</option>
                      <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                    </select>
                  </div>
                )}

                {paymentMethod === 'COD' && (
                  <div className="p-4 bg-[#FAF9F6] border border-[#E5E1D8] space-y-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] block">Cash on Delivery Verification</span>
                    <p className="text-xs text-[#6B6658] font-light">
                      Our concierge team will verify transit details via phone call (+91 8000461784) before dispatching the high-value couture shipment.
                    </p>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-between border-t border-[#E5E1D8]">
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-2.5 border border-[#E5E1D8] text-[10px] uppercase tracking-wider font-medium text-[#6B6658]"
                  >
                    Back
                  </button>

                  <button
                    onClick={handlePlaceOrder}
                    disabled={isSubmitting}
                    className="px-8 py-3 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    <Receipt className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>{isSubmitting ? 'Generating Receipt...' : 'Generate Official Receipt'}</span>
                  </button>
                </div>

              </div>
            )}

          </div>

          {/* Right Column: Order Summary (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-[#E5E1D8] p-6 shadow-sm sticky top-28 space-y-6">
              <h3 className="font-serif italic font-light text-lg text-[#1A1A1A] border-b border-[#E5E1D8] pb-3">
                Order Summary ({items.length})
              </h3>

              {/* Items List */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-14 h-16 bg-[#F5F2ED] overflow-hidden shrink-0 border border-[#E5E1D8]">
                      <img src={item.image} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover object-top" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs uppercase tracking-wider font-medium text-[#1A1A1A] truncate">{item.title}</p>
                      <p className="text-[11px] text-[#6B6658] font-light">Size: {item.size} • Qty: {item.quantity}</p>
                      <p className="text-xs font-medium text-[#1A1A1A] mt-0.5">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Breakdown */}
              <div className="space-y-2 text-xs text-[#6B6658] pt-4 border-t border-[#E5E1D8]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-[#C5A059] font-medium">
                    <span>Discount ({appliedCoupon})</span>
                    <span>- ₹{discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>12% GST (Inclusive)</span>
                  <span>₹{gstAmount.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between">
                  <span>White-Glove Delivery</span>
                  <span>{deliveryFee === 0 ? <strong className="text-[#1A1A1A] font-medium">FREE</strong> : `₹${deliveryFee}`}</span>
                </div>

                <div className="flex justify-between text-xs uppercase tracking-wider font-semibold text-[#1A1A1A] pt-3 border-t border-[#E5E1D8]">
                  <span>Total Amount</span>
                  <span className="text-sm">₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Store Helpline badge */}
              <div className="p-3 bg-[#FAF9F6] border border-[#E5E1D8] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#6B6658]">
                  <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span className="text-[11px] uppercase tracking-wider font-medium">Jaipur Atelier:</span>
                </div>
                <a href="tel:8000461784" className="font-medium text-[#1A1A1A] hover:text-[#C5A059]">
                  8000461784
                </a>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
