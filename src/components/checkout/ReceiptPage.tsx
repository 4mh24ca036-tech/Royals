import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  Sparkles, 
  Download, 
  MessageCircle, 
  FileText, 
  Truck, 
  ShieldCheck, 
  MapPin, 
  ArrowLeft,
  Building2,
  Lock,
  Printer
} from 'lucide-react';
import { Order } from '../../types';
import { api } from '../../services/api';
import { downloadInvoicePdf, downloadPaymentReceiptPdf, downloadOrderSummaryPdf } from '../../services/pdfGenerator';

interface ReceiptPageProps {
  orderId?: string;
  orderData?: Order | null;
  onBackToShopping?: () => void;
  onTrackOrder?: (orderNumber: string) => void;
}

export const ReceiptPage: React.FC<ReceiptPageProps> = ({
  orderId,
  orderData,
  onBackToShopping,
  onTrackOrder
}) => {
  const [order, setOrder] = useState<Order | null>(orderData || null);
  const [isLoading, setIsLoading] = useState<boolean>(!orderData && !!orderId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderData) {
      setOrder(orderData);
      return;
    }

    // Read order ID from URL query parameters if not explicitly passed
    const params = new URLSearchParams(window.location.search);
    const idFromQuery = orderId || params.get('id') || params.get('orderId');

    if (!idFromQuery) {
      setError('No Order Reference provided in URL.');
      setIsLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        setIsLoading(true);
        const data = await api.getOrder(idFromQuery);
        setOrder(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load order receipt.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, orderData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs uppercase tracking-[0.25em] font-cinzel text-[#8C785A]">
          Retrieving Official Atelier Receipt...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white border border-[#E5E1D8] p-8 max-w-md w-full shadow-sm space-y-4 rounded-2xl">
          <p className="text-red-700 text-sm font-medium">{error || 'Order not found'}</p>
          <button
            onClick={onBackToShopping || (() => (window.location.href = '/'))}
            className="px-6 py-2.5 bg-[#1A1A1A] text-white text-xs uppercase tracking-widest rounded-full cursor-pointer hover:bg-[#333]"
          >
            Return to Store
          </button>
        </div>
      </div>
    );
  }

  const whatsappUrl = `https://wa.me/918000461784?text=${encodeURIComponent(
    `Hello ROYALS Jaipur Atelier,\n\nI have placed an order and generated my official receipt.\n\nOrder Number: #${order.order_number}\nTracking ID: ${order.tracking_id}\nTotal Amount: ₹${order.grand_total.toLocaleString('en-IN')}\n\nI have attached my payment receipt and screenshot. Please verify.`
  )}`;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] font-sans selection:bg-[#C5A880] selection:text-black py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation / Action bar */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E1D8]">
          <button
            onClick={onBackToShopping || (() => (window.location.href = '/'))}
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-medium text-[#6B6658] hover:text-[#1A1A1A] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>Back to Atelier Store</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-xs text-[#8C785A] hover:text-[#1A1A1A] font-medium cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#C5A059]" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <span className="text-gray-300">|</span>
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8E8A81]">
              <Lock className="w-3 h-3 text-[#C5A059]" />
              <span>Computer Verified Receipt</span>
            </div>
          </div>
        </div>

        {/* Main Printable Receipt Card */}
        <div className="bg-white border border-[#E5E1D8] shadow-sm p-6 sm:p-10 space-y-8 rounded-2xl relative overflow-hidden">
          
          {/* Top Gold Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#C5A059] via-[#E5C384] to-[#C5A059]" />

          {/* Header Brand Seal */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-[#E8DFD8]">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[#C5A880] text-[10px] font-bold uppercase tracking-[0.3em] font-cinzel">
                <Sparkles className="w-3 h-3" />
                <span>OFFICIAL ATELIER RECEIPT</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#1A1A1A] tracking-wider mt-1">
                R O Y A L S
              </h1>
              <p className="text-[11px] text-[#8C785A] font-sans tracking-wide uppercase mt-0.5">
                Haute Couture & Heritage Indian Ethnic Wear
              </p>
            </div>

            <div className="text-left sm:text-right text-xs text-[#6B6658] space-y-1 font-light">
              <p className="font-semibold text-[#1A1A1A]">Jaipur Atelier Headquarters</p>
              <p>Road No. 6, District Chaksu, Jaipur</p>
              <p>Rajasthan 303901, India</p>
              <p className="text-[#C5A059] font-mono text-[11px]">GSTIN: 08AAACR8942K1Z5</p>
            </div>
          </div>

          {/* Status Badge Banner */}
          <div className="bg-[#FAF9F6] border border-[#E5E1D8] p-4 sm:p-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-12 h-12 bg-[#1A1A1A] border border-[#C5A059] text-[#C5A059] flex items-center justify-center rounded-full flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-cinzel uppercase tracking-[0.25em] text-[#C5A059] font-bold block">
                  ORDER REGISTERED & AWAITING VERIFICATION
                </span>
                <h3 className="text-base font-serif font-medium text-[#1A1A1A]">
                  Order #{order.order_number}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 text-right">
              <span className="inline-block px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold rounded-full uppercase tracking-wider">
                {order.order_status}
              </span>
            </div>
          </div>

          {/* Key Order Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-[#FAF9F6] p-4 border border-[#E5E1D8] rounded-xl text-xs">
            <div>
              <span className="text-[#8E8A81] uppercase text-[9px] font-cinzel tracking-wider block font-bold">Order Number</span>
              <span className="font-serif text-sm font-semibold text-[#1A1A1A]">#{order.order_number}</span>
            </div>
            <div>
              <span className="text-[#8E8A81] uppercase text-[9px] font-cinzel tracking-wider block font-bold">Tracking Reference</span>
              <span className="font-mono font-medium text-xs text-[#1A1A1A]">{order.tracking_id}</span>
            </div>
            <div>
              <span className="text-[#8E8A81] uppercase text-[9px] font-cinzel tracking-wider block font-bold">Payment Method</span>
              <span className="font-medium text-xs text-[#1A1A1A]">{order.payment_method}</span>
            </div>
            <div>
              <span className="text-[#8E8A81] uppercase text-[9px] font-cinzel tracking-wider block font-bold">Estimated Delivery</span>
              <span className="font-semibold text-xs text-[#C5A059]">{order.estimated_delivery_date}</span>
            </div>
          </div>

          {/* Customer & Shipping Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#6B6658]">
            <div className="p-4 border border-[#E5E1D8] rounded-xl space-y-2">
              <h4 className="font-cinzel text-[10px] uppercase tracking-widest font-bold text-[#C5A059] border-b border-[#E5E1D8] pb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Customer Information</span>
              </h4>
              <p className="font-medium text-[#1A1A1A] text-sm">{order.customer_name}</p>
              <p>Email: {order.customer_email}</p>
              <p>Phone: +91 {order.customer_phone}</p>
            </div>

            <div className="p-4 border border-[#E5E1D8] rounded-xl space-y-2">
              <h4 className="font-cinzel text-[10px] uppercase tracking-widest font-bold text-[#C5A059] border-b border-[#E5E1D8] pb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Delivery Address</span>
              </h4>
              <p className="font-medium text-[#1A1A1A]">
                {order.shipping_address.addressLine1}
                {order.shipping_address.addressLine2 ? `, ${order.shipping_address.addressLine2}` : ''}
              </p>
              <p>
                {order.shipping_address.city}, {order.shipping_address.state} - {order.shipping_address.pincode}
              </p>
              <p className="text-[11px] text-[#8C785A]">Courier: {order.courier_name || 'Blue Dart Apex Luxury'}</p>
            </div>
          </div>

          {/* Itemized Order Items Table */}
          <div className="space-y-3">
            <h4 className="font-cinzel text-xs uppercase tracking-widest font-bold text-[#1A1A1A]">
              Ordered Couture Masterpieces ({order.items.length})
            </h4>

            <div className="border border-[#E5E1D8] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1A1A1A] text-white font-cinzel uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Item Details</th>
                    <th className="py-3 px-4 text-center">Size</th>
                    <th className="py-3 px-4 text-center">Qty</th>
                    <th className="py-3 px-4 text-right">Unit Price</th>
                    <th className="py-3 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1D8] bg-white">
                  {order.items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-[#FAF9F6] transition-colors">
                      <td className="py-3 px-4 flex items-center gap-3">
                        {item.product_image && (
                          <img
                            src={item.product_image}
                            alt={item.product_title}
                            className="w-12 h-14 object-cover border border-[#E5E1D8] rounded-md flex-shrink-0"
                          />
                        )}
                        <div>
                          <p className="font-serif font-medium text-[#1A1A1A] text-sm">{item.product_title}</p>
                          <p className="text-[10px] text-[#8C785A] uppercase">{item.color || 'Royal Classic'}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-[#6B6658]">{item.size || 'Standard'}</td>
                      <td className="py-3 px-4 text-center font-semibold text-[#1A1A1A]">{item.quantity}</td>
                      <td className="py-3 px-4 text-right text-[#6B6658]">₹{Number(item.unit_price).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-right font-semibold text-[#1A1A1A]">
                        ₹{(Number(item.unit_price) * Number(item.quantity)).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Summary Breakdown */}
          <div className="flex flex-col sm:flex-row justify-end">
            <div className="w-full sm:w-80 bg-[#FAF9F6] border border-[#E5E1D8] p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-[#6B6658]">
                <span>Items Subtotal:</span>
                <span>₹{order.subtotal.toLocaleString('en-IN')}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Coupons & Privileges Discount:</span>
                  <span>-₹{order.discount_amount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-[#6B6658]">
                <span>GST (12% Ethnic Apparel Tax):</span>
                <span>+₹{order.gst_amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-[#6B6658]">
                <span>Insured Express Shipping:</span>
                <span>{order.delivery_fee === 0 ? 'FREE (Complimentary Luxury Delivery)' : `+₹${order.delivery_fee}`}</span>
              </div>
              <div className="pt-2 border-t border-[#E5E1D8] flex justify-between items-baseline font-bold">
                <span className="font-cinzel text-xs uppercase tracking-wider text-[#1A1A1A]">Grand Total:</span>
                <span className="text-base font-serif text-[#C5A059]">₹{order.grand_total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Payment & Verification Guidance Box */}
          <div className="p-5 bg-gradient-to-r from-[#FAF8F5] to-[#F5EFE6] border border-[#C5A059]/40 rounded-xl space-y-3">
            <h4 className="text-xs font-cinzel font-bold uppercase tracking-widest text-[#C5A059] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
              <span>Jaipur Atelier Verification Instructions</span>
            </h4>
            <p className="text-xs text-[#6B6658] leading-relaxed font-light">
              To complete your bespoke order tailoring, please transfer the total of <strong className="font-semibold text-[#1A1A1A]">₹{order.grand_total.toLocaleString('en-IN')}</strong> to our bank/UPI account and tap the WhatsApp button below to share your payment screenshot.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 border border-[#E5E1D8] rounded-lg">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#8E8A81] block font-bold font-cinzel">Atelier Bank Details</span>
                <p className="font-medium text-[#1A1A1A]">ROYALS Luxury Fashion Pvt Ltd</p>
                <p className="text-[11px] text-[#6B6658]">A/C: 980046178490 (HDFC Bank Jaipur)</p>
                <p className="text-[11px] text-[#6B6658]">IFSC: HDFC0001842</p>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#8E8A81] block font-bold font-cinzel">Atelier Direct UPI</span>
                <p className="font-semibold text-[#C5A059]">royals.atelier@hdfcbank</p>
                <p className="text-[11px] text-[#6B6658]">UPI Phone: +91 8000461784</p>
              </div>
            </div>
          </div>

        </div>

        {/* Action Bar Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto px-8 py-3.5 bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] uppercase tracking-[0.2em] font-medium transition-colors flex items-center justify-center gap-2.5 shadow-md rounded-full"
          >
            <MessageCircle className="w-4 h-4 text-emerald-100" />
            <span>Inquire & Send Receipt on WhatsApp</span>
          </a>

          <button
            onClick={() => downloadPaymentReceiptPdf(order)}
            className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-[#FAF9F6] border border-[#E5E1D8] text-[#1A1A1A] text-[11px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer rounded-full flex items-center justify-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4 text-[#C5A059]" />
            <span>Download Receipt PDF</span>
          </button>

          <button
            onClick={() => downloadInvoicePdf(order)}
            className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-[#FAF9F6] border border-[#E5E1D8] text-[#1A1A1A] text-[11px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer rounded-full flex items-center justify-center gap-2 shadow-sm"
          >
            <FileText className="w-4 h-4 text-[#C5A059]" />
            <span>Download Tax Invoice</span>
          </button>

          {onTrackOrder && (
            <button
              onClick={() => onTrackOrder(order.order_number)}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#1A1A1A] hover:bg-[#333] text-white text-[11px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer rounded-full flex items-center justify-center gap-2 shadow-sm"
            >
              <Truck className="w-4 h-4 text-[#C5A059]" />
              <span>Track Shipment Live</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
