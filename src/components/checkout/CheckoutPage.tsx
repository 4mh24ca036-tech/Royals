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
  const [deliveryInstructions, setDeliveryInstructions] = useState<string>('');
  const [giftPackaging, setGiftPackaging] = useState<boolean>(false);
  
  // Validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full Name is required';
    
    if (!phone.trim()) {
      errs.phone = 'Phone Number is required';
    } else if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      errs.phone = 'Please enter a valid 10-digit Indian phone number starting with 6-9';
    }

    if (!email.trim()) {
      errs.email = 'Email Address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (!addressLine1.trim()) errs.addressLine1 = 'Address Line 1 is required';
    if (!city.trim()) errs.city = 'City is required';
    if (!state.trim()) errs.state = 'State is required';
    
    if (!pincode.trim()) {
      errs.pincode = 'PIN Code is required';
    } else if (!/^\d{6}$/.test(pincode.trim())) {
      errs.pincode = 'PIN Code must be a 6-digit number';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Handle address auto-fill from saved addresses
  const handleSelectSavedAddress = (addr: any) => {
    setFullName(addr.full_name);
    setPhone(addr.phone);
    setAddressLine1(addr.address_line1);
    setAddressLine2(addr.address_line2 || '');
    setCity(addr.city);
    setState(addr.state);
    setPincode(addr.pincode);
    // Clear errors when a saved address is selected
    setFormErrors({});
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) {
      alert('Please correct all validation errors in the shipping details before placing your order.');
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
          email,
          addressLine1,
          addressLine2,
          city,
          state,
          pincode,
          country: 'India',
          deliveryInstructions,
          giftPackaging
        },
        items: items.map((it) => ({
          productId: it.productId,
          productTitle: it.title,
          size: it.size,
          color: it.color,
          quantity: it.quantity,
          unitPrice: it.price
        })),
        paymentMethod: 'Manual Verification',
        couponCode: appliedCoupon,
        userId: user?.id
      };

      const response = await api.createOrder(orderPayload);
      const order = response.order;
      setCreatedOrder(order);
      clearCart();

      // Automatically open official receipt page in new tab
      const receiptUrl = `${window.location.origin}/receipt?id=${order.id}`;
      window.open(receiptUrl, '_blank');

      // Also trigger instant PDF download
      downloadPaymentReceiptPdf(order);

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
      `Hello ROYALS,\n\nI have placed an order.\n\nOrder ID: ${createdOrder.order_number}\nTracking ID: ${createdOrder.tracking_id}\n\nI have attached my receipt and payment screenshot.\n\nPlease verify my payment and begin processing my order.`
    )}`;

    return (
      <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto bg-[#FAF9F6] min-h-screen">
        <div className="bg-white border border-[#E5E1D8] shadow-sm p-6 sm:p-10 text-center space-y-8">
          
          {/* Success Check Badge */}
          <div className="w-16 h-16 bg-[#1A1A1A] border border-[#C5A059] mx-auto flex items-center justify-center text-[#C5A059] shadow-sm rounded-full">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-[#C5A059] font-cinzel font-medium">
              <Sparkles className="w-3 h-3" />
              <span>Official Receipt & Order Registered</span>
              <Sparkles className="w-3 h-3" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif italic font-light text-[#1A1A1A] tracking-wide">
              Official Receipt Ready
            </h1>
            <p className="text-xs sm:text-sm text-[#6B6658] max-w-md mx-auto font-light leading-relaxed">
              Thank you, <strong className="font-medium text-[#1A1A1A]">{createdOrder.customer_name}</strong>. Your official order receipt has been generated and downloaded. Follow the instructions below to complete verification.
            </p>
          </div>

          {/* Verification Steps Banner */}
          <div className="p-6 bg-[#FAF9F6] border border-[#E5E1D8] text-left space-y-3.5 rounded-2xl">
            <h4 className="text-xs uppercase tracking-[0.25em] font-cinzel font-bold text-[#C5A059] border-b border-[#E5E1D8] pb-2">
              How to complete your order:
            </h4>
            <ol className="list-decimal list-inside text-xs text-[#6B6658] space-y-2 font-light">
              <li>Review the downloaded official receipt (or redownload below).</li>
              <li>Make your manual payment (bank transfer/UPI) as discussed with our atelier concierge.</li>
              <li>Tap the <strong className="font-semibold text-[#1A1A1A]">Inquire on WhatsApp</strong> button to open our chat with prefilled order details.</li>
              <li>Attach your <strong className="font-semibold text-[#1A1A1A]">Receipt PDF</strong> and a <strong className="font-semibold text-[#1A1A1A]">Payment Screenshot</strong> in WhatsApp.</li>
              <li>Our Jaipur Atelier will manually verify and begin tailoring your masterpiece.</li>
            </ol>
          </div>

          {/* Order Details Card */}
          <div className="p-6 bg-[#FAF9F6] border border-[#E5E1D8] text-left grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs rounded-2xl">
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

          {/* Actions Bar */}
          <div className="space-y-4 pt-4 border-t border-[#E5E1D8]">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-8 py-3.5 bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] uppercase tracking-[0.2em] font-medium transition-colors flex items-center justify-center gap-2 shadow-sm rounded-full"
              >
                <MessageCircle className="w-4 h-4 text-emerald-100" />
                <span>Inquire on WhatsApp</span>
              </a>

              <button
                onClick={() => downloadPaymentReceiptPdf(createdOrder)}
                className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-[#FAF9F6] border border-[#E5E1D8] text-[#1A1A1A] text-[11px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer rounded-full flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-[#C5A059]" />
                <span>Download Receipt PDF</span>
              </button>

              <button
                onClick={() => downloadInvoicePdf(createdOrder)}
                className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-[#FAF9F6] border border-[#E5E1D8] text-[#1A1A1A] text-[11px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer rounded-full flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4 text-[#C5A059]" />
                <span>Tax Invoice</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                onClick={() => onTrackOrder(createdOrder.order_number)}
                className="text-xs font-semibold text-[#8C785A] hover:text-[#1A1A1A] transition-colors underline cursor-pointer"
              >
                Track Live Shipment Status
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={onBackToShopping}
                className="text-xs font-semibold text-[#8C785A] hover:text-[#1A1A1A] transition-colors underline cursor-pointer"
              >
                Continue Exploring Collection
              </button>
          </div>
          </div>

        </div>
      </div>
    );
  }

  // CHECKOUT STEPS VIEW
  return (
    <div className="py-8 bg-[#FAF9F6] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        
        {/* Back button & Title */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onBackToShopping}
            className="inline-flex items-center gap-2 text-[11px] font-medium text-[#6B6658] hover:text-[#1A1A1A] uppercase tracking-[0.2em] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Return to Atelier</span>
          </button>

          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#8E8A81]">
            <Lock className="w-3 h-3 text-[#C5A059]" />
            <span>Secured Jaipur Atelier Checkout</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          
          {/* Main Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Step Indicators */}
            <div className="grid grid-cols-3 gap-2 pb-2">
              <div className={`p-3 border text-center transition-all rounded-xl ${
                step === 1 ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-[#8E8A81] border-[#E5E1D8]'
              }`}>
                <span className="text-[9px] uppercase tracking-[0.2em] font-medium block font-cinzel">Step 1</span>
                <span className="text-[11px] sm:text-xs uppercase tracking-wider font-medium">Shipping Details</span>
              </div>

              <div className={`p-3 border text-center transition-all rounded-xl ${
                step === 2 ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-[#8E8A81] border-[#E5E1D8]'
              }`}>
                <span className="text-[9px] uppercase tracking-[0.2em] font-medium block font-cinzel">Step 2</span>
                <span className="text-[11px] sm:text-xs uppercase tracking-wider font-medium font-sans">Packaging & Delivery</span>
              </div>

              <div className={`p-3 border text-center transition-all rounded-xl ${
                step === 3 ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-[#8E8A81] border-[#E5E1D8]'
              }`}>
                <span className="text-[9px] uppercase tracking-[0.2em] font-medium block font-cinzel">Step 3</span>
                <span className="text-[11px] sm:text-xs uppercase tracking-wider font-medium">Review Order</span>
              </div>
            </div>

            {/* STEP 1: SHIPPING ADDRESS */}
            {step === 1 && (
              <div className="p-6 sm:p-8 bg-white border border-[#E5E1D8] shadow-sm space-y-6 rounded-2xl">
                <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4">
                  <h3 className="text-lg font-serif italic font-light text-[#1A1A1A]">
                    Shipping & Delivery Details
                  </h3>
                  <span className="text-[10px] uppercase tracking-wider text-[#C5A059] font-medium">Complimentary Pan-India Transit</span>
                </div>

                {/* Saved addresses selector if logged in */}
                {addresses.length > 0 && (
                  <div className="p-4 bg-[#FAF9F6] border border-[#E5E1D8] space-y-2 rounded-xl">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] block">Select Saved Address:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {addresses.map((addr) => (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => handleSelectSavedAddress(addr)}
                          className="p-3 border border-[#E5E1D8] bg-white text-left text-xs hover:border-[#C5A059] transition-colors cursor-pointer rounded-lg"
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
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (formErrors.fullName) setFormErrors(prev => ({ ...prev, fullName: '' }));
                      }}
                      placeholder="e.g. Radhika Sharma"
                      className={`w-full p-3 border text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059] rounded-xl ${
                        formErrors.fullName ? 'border-red-500' : 'border-[#E5E1D8]'
                      }`}
                    />
                    {formErrors.fullName && <p className="text-red-500 text-[10px] mt-1 font-light">{formErrors.fullName}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">Phone Number (For Delivery OTP) *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: '' }));
                      }}
                      placeholder="e.g. 9876543210"
                      className={`w-full p-3 border text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059] rounded-xl ${
                        formErrors.phone ? 'border-red-500' : 'border-[#E5E1D8]'
                      }`}
                    />
                    {formErrors.phone && <p className="text-red-500 text-[10px] mt-1 font-light">{formErrors.phone}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }));
                      }}
                      placeholder="e.g. radhika@example.com"
                      className={`w-full p-3 border text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059] rounded-xl ${
                        formErrors.email ? 'border-red-500' : 'border-[#E5E1D8]'
                      }`}
                    />
                    {formErrors.email && <p className="text-red-500 text-[10px] mt-1 font-light">{formErrors.email}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">Address Line 1 (Flat, House No., Building) *</label>
                    <input
                      type="text"
                      required
                      value={addressLine1}
                      onChange={(e) => {
                        setAddressLine1(e.target.value);
                        if (formErrors.addressLine1) setFormErrors(prev => ({ ...prev, addressLine1: '' }));
                      }}
                      placeholder="e.g. Palace Villa 4, Civil Lines"
                      className={`w-full p-3 border text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059] rounded-xl ${
                        formErrors.addressLine1 ? 'border-red-500' : 'border-[#E5E1D8]'
                      }`}
                    />
                    {formErrors.addressLine1 && <p className="text-red-500 text-[10px] mt-1 font-light">{formErrors.addressLine1}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">Address Line 2 (Street, Landmark)</label>
                    <input
                      type="text"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder="e.g. Near Heritage Haveli"
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059] rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (formErrors.city) setFormErrors(prev => ({ ...prev, city: '' }));
                      }}
                      placeholder="e.g. Jaipur"
                      className={`w-full p-3 border text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059] rounded-xl ${
                        formErrors.city ? 'border-red-500' : 'border-[#E5E1D8]'
                      }`}
                    />
                    {formErrors.city && <p className="text-red-500 text-[10px] mt-1 font-light">{formErrors.city}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">PIN Code *</label>
                    <input
                      type="text"
                      required
                      value={pincode}
                      onChange={(e) => {
                        setPincode(e.target.value);
                        if (formErrors.pincode) setFormErrors(prev => ({ ...prev, pincode: '' }));
                      }}
                      placeholder="e.g. 302001"
                      className={`w-full p-3 border text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059] rounded-xl ${
                        formErrors.pincode ? 'border-red-500' : 'border-[#E5E1D8]'
                      }`}
                    />
                    {formErrors.pincode && <p className="text-red-500 text-[10px] mt-1 font-light">{formErrors.pincode}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">State *</label>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059] rounded-xl"
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
                      className="w-full p-3 border border-[#E5E1D8] text-xs bg-[#F5F2ED] text-[#6B6658] rounded-xl"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => {
                      if (validateForm()) {
                        setStep(2);
                      } else {
                        alert('Please fill in all mandatory fields with valid values.');
                      }
                    }}
                    className="px-8 py-3 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer rounded-xl"
                  >
                    Continue to Packaging
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PACKAGING & COURIER */}
            {step === 2 && (
              <div className="p-6 sm:p-8 bg-white border border-[#E5E1D8] shadow-sm space-y-6 rounded-2xl">
                <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4">
                  <h3 className="text-lg font-serif italic font-light text-[#1A1A1A]">
                    Royal Packaging & Courier Partner
                  </h3>
                  <span className="text-[10px] uppercase tracking-wider text-[#C5A059] font-medium">Insured White-Glove Transit</span>
                </div>

                {/* Packaging Selection */}
                <div className="space-y-3">
                  <div className="p-4 border border-[#C5A059] bg-[#FAF9F6] flex items-start gap-4 rounded-xl">
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
                  <div className="p-4 border border-[#E5E1D8] bg-white flex items-center justify-between rounded-xl">
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

                {/* Estimated Delivery Time */}
                <div className="p-4 bg-[#FAF9F6] border border-[#E5E1D8] text-xs text-[#3A3632] space-y-1 rounded-xl">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[#8E8A81] block">Estimated Delivery:</span>
                  <p className="font-serif italic font-light text-sm text-[#1A1A1A]">Calculated 8 Days from Payment Verification</p>
                  <p className="text-[#6B6658] font-light">Your order is hand-fitted and checked before dispatch.</p>
                </div>

                {/* Delivery Instructions */}
                <div className="space-y-2 pt-2">
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-[#1A1A1A] mb-1">
                    Delivery Instructions (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    placeholder="e.g. Leave with security guard, call before delivery, etc."
                    className="w-full p-3 border border-[#E5E1D8] text-xs bg-[#FAF9F6] focus:bg-white focus:outline-none focus:border-[#C5A059] rounded-xl"
                  />
                </div>

                {/* Gift Packaging Information */}
                <div className="pt-2">
                  <label className="flex items-start gap-3 cursor-pointer p-4 border border-[#E5E1D8] bg-[#FAF9F6] hover:border-[#C5A059] transition-colors rounded-xl">
                    <input
                      type="checkbox"
                      checked={giftPackaging}
                      onChange={(e) => setGiftPackaging(e.target.checked)}
                      className="mt-0.5 rounded border-[#E5E1D8] text-[#C5A059] focus:ring-[#C5A059]"
                    />
                    <div>
                      <span className="text-xs font-medium text-[#1A1A1A] uppercase tracking-wider block">
                        Add Imperial Gift Packaging & Custom Card
                      </span>
                      <span className="text-[11px] text-[#6B6658] font-light mt-0.5 block">
                        Enclose a handwritten calligraphy card and wrap in signature gold ribbon. (Complimentary)
                      </span>
                    </div>
                  </label>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-[#E5E1D8]">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-2.5 border border-[#E5E1D8] text-[10px] uppercase tracking-wider font-medium text-[#6B6658] hover:bg-[#FAF9F6] rounded-xl"
                  >
                    Back to Address
                  </button>

                  <button
                    onClick={() => setStep(3)}
                    className="px-8 py-3 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer rounded-xl"
                  >
                    Proceed to Review Order
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: REVIEW ORDER */}
            {step === 3 && (
              <div className="p-6 sm:p-8 bg-white border border-[#E5E1D8] shadow-sm space-y-6 rounded-2xl">
                <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4">
                  <h3 className="text-lg font-serif italic font-light text-[#1A1A1A]">
                    Review Your Couture Order
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#6B6658] font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>Secure Review</span>
                  </div>
                </div>

                {/* Order Summary & Products Review */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#8E8A81] font-cinzel">
                    Ordered Ensembles
                  </h4>
                  <div className="divide-y divide-[#E5E1D8]">
                    {items.map((item) => (
                      <div key={item.id} className="py-3.5 flex items-center gap-4">
                        <div className="w-14 h-16 bg-[#F5F2ED] overflow-hidden shrink-0 border border-[#E5E1D8]">
                          <img src={item.image} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover object-top" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs uppercase tracking-wider font-medium text-[#1A1A1A] truncate">{item.title}</p>
                          <p className="text-[11px] text-[#6B6658] font-light">Size: {item.size} • Qty: {item.quantity}</p>
                          <p className="text-xs font-semibold text-[#1A1A1A] mt-0.5">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shipping & Transit Review */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E5E1D8]">
                  <div className="space-y-1.5">
                    <h5 className="text-[10px] font-medium uppercase tracking-wider text-[#8E8A81] font-cinzel">Shipping Address</h5>
                    <div className="text-xs text-[#3A3632] leading-relaxed">
                      <p className="font-medium text-[#1A1A1A]">{fullName}</p>
                      <p>{phone} • {email}</p>
                      <p className="mt-1">{addressLine1}</p>
                      {addressLine2 && <p>{addressLine2}</p>}
                      <p>{city}, {state} - {pincode}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h5 className="text-[10px] font-medium uppercase tracking-wider text-[#8E8A81] font-cinzel">Transit Details</h5>
                    <div className="text-xs text-[#3A3632] space-y-1">
                      <p><span className="font-medium text-[#1A1A1A]">Packaging:</span> Complimentary Velvet Trunk Box</p>
                      <p><span className="font-medium text-[#1A1A1A]">Courier:</span> Blue Dart Apex Luxury Express</p>
                      {giftPackaging && <p className="text-[#C5A059] font-medium">✨ Premium Gift Wrapping requested</p>}
                      {deliveryInstructions && (
                        <div className="mt-1.5">
                          <span className="font-medium text-[#1A1A1A] block">Instructions:</span>
                          <p className="italic text-[#6B6658] bg-[#FAF8F5] p-2.5 border border-[#E5E1D8] mt-1 text-[11px] rounded-lg">
                            "{deliveryInstructions}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="pt-4 border-t border-[#E5E1D8] space-y-2 text-xs text-[#6B6658]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="text-[#1A1A1A]">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-[#C5A059] font-medium">
                      <span>Discount ({appliedCoupon})</span>
                      <span>- ₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>12% GST (Inclusive)</span>
                    <span className="text-[#1A1A1A]">₹{gstAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>White-Glove Delivery</span>
                    <span className="text-emerald-700 font-medium">FREE</span>
                  </div>
                  <div className="flex justify-between text-sm uppercase tracking-wider font-semibold text-[#1A1A1A] pt-2 border-t border-[#E5E1D8]">
                    <span>Grand Total</span>
                    <span>₹{grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-[#E5E1D8]">
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-2.5 border border-[#E5E1D8] text-[10px] uppercase tracking-wider font-medium text-[#6B6658] rounded-xl"
                  >
                    Back
                  </button>

                  <button
                    onClick={handlePlaceOrder}
                    disabled={isSubmitting}
                    className="px-8 py-3 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 rounded-xl"
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
            <div className="bg-white border border-[#E5E1D8] p-6 shadow-sm sticky top-28 space-y-6 rounded-2xl">
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
              <div className="p-3 bg-[#FAF9F6] border border-[#E5E1D8] flex items-center justify-between text-xs rounded-xl">
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
