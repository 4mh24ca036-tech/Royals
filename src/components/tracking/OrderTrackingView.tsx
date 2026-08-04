import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Search, 
  CheckCircle2, 
  Clock, 
  Package, 
  Sparkles, 
  FileText, 
  Receipt, 
  Download, 
  MessageCircle, 
  Phone, 
  ShieldCheck, 
  MapPin,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';
import { TrackingData, Order } from '../../types';
import { downloadInvoicePdf, downloadPaymentReceiptPdf, downloadOrderSummaryPdf } from '../../services/pdfGenerator';

interface OrderTrackingViewProps {
  initialQuery?: string;
  onExplore: () => void;
}

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({
  initialQuery = '',
  onExplore
}) => {
  const [query, setQuery] = useState<string>(initialQuery);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchTracking = async (searchStr: string) => {
    if (!searchStr.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await api.trackOrder(searchStr.trim());
      setTrackingData(data);
    } catch (err: any) {
      setTrackingData(null);
      setErrorMessage(err.message || 'Unable to locate consignment with the provided reference.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      fetchTracking(initialQuery);
    }
  }, [initialQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTracking(query);
  };

  const order = trackingData?.order;

  return (
    <section className="py-12 bg-[#FAF9F6] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-[#C5A059] font-cinzel font-medium">
            <Sparkles className="w-3 h-3" />
            <span>Couture Consignment Tracking</span>
            <Sparkles className="w-3 h-3" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif italic font-light text-[#1A1A1A] tracking-wide">
            Track Your Order
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6658] max-w-md mx-auto leading-relaxed font-light">
            Enter your Order Number (e.g. <span className="font-mono font-medium text-[#1A1A1A]">RYL-2026-89410</span>) or Blue Dart Tracking Reference to view live milestone updates.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8E8A81] absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder="e.g. RYL-2026-89410 or BLUEDART-RYL-89410-APEX"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-[#E5E1D8] text-xs bg-white focus:outline-none focus:border-[#C5A059] shadow-2xs font-light"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-8 py-3 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer shadow-sm disabled:opacity-50"
          >
            {isLoading ? 'Searching...' : 'Track'}
          </button>
        </form>

        {/* Error State */}
        {errorMessage && (
          <div className="p-4 bg-white border border-[#E5E1D8] text-[#1A1A1A] text-xs flex items-center gap-3 max-w-xl mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#C5A059]" />
            <div className="flex-1">
              <p className="font-medium text-xs">{errorMessage}</p>
              <p className="text-[11px] text-[#6B6658] mt-0.5 font-light">
                Need help? Call our concierge team at <a href="tel:8000461784" className="underline font-medium text-[#1A1A1A]">+91 8000461784</a>.
              </p>
            </div>
          </div>
        )}

        {/* Tracking Details View */}
        {order && trackingData && (
          <div className="bg-white border border-[#E5E1D8] shadow-sm p-6 sm:p-8 space-y-8">
            
            {/* Status Summary Banner */}
            <div className="p-5 bg-[#FAF9F6] border border-[#E5E1D8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-cinzel font-medium text-[#8E8A81] tracking-wider">Consignment Status:</span>
                  <span className="px-3 py-1 bg-[#1A1A1A] text-white text-[10px] font-medium uppercase tracking-[0.2em]">
                    {order.order_status}
                  </span>
                </div>
                <h3 className="text-lg font-serif italic font-light text-[#1A1A1A]">
                  Order #{order.order_number}
                </h3>
                <p className="text-xs text-[#6B6658] font-light">
                  Placed on {new Date(order.created_at).toLocaleDateString('en-GB')} • Insured Courier: {order.courier_name || 'Blue Dart Apex Luxury'}
                </p>
              </div>

              <div className="sm:text-right">
                <span className="text-[10px] text-[#8E8A81] uppercase tracking-[0.2em] font-cinzel font-medium block">Estimated Delivery</span>
                <span className="text-sm font-medium text-[#C5A059] mt-0.5 block">
                  {order.estimated_delivery_date}
                </span>
                <span className="text-[11px] text-[#6B6658] font-light">Tracking Ref: {order.tracking_id}</span>
              </div>
            </div>

            {/* 8-Stage Visual Timeline */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#8E8A81] font-cinzel">
                Atelier Milestones & Transit Log
              </h4>

              <div className="relative pl-6 sm:pl-8 space-y-6 before:content-[''] before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-[#E5E1D8]">
                {trackingData.timeline && trackingData.timeline.map((step: any, idx: number) => {
                  const isDone = step.isCompleted ?? step.completed ?? false;
                  const isCurrent = step.isCurrent ?? false;
                  const title = step.label || step.title || step.status;
                  const timeDisplay = step.date ? `${step.date}${step.time ? ' • ' + step.time : ''}` : (step.timestamp ? new Date(step.timestamp).toLocaleString('en-GB') : null);
                  const description = step.description || step.notes;

                  return (
                    <div key={idx} className="relative flex items-start gap-4">
                      {/* Milestone Dot */}
                      <div className={`absolute -left-6 sm:-left-8 w-6 h-6 flex items-center justify-center text-[10px] font-medium ring-4 ring-white ${
                        isDone ? 'bg-[#1A1A1A] text-[#C5A059]' : isCurrent ? 'bg-[#C5A059] text-white' : 'bg-[#E5E1D8] text-[#8E8A81]'
                      }`}>
                        {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                      </div>

                      {/* Step Content */}
                      <div className={`flex-1 p-4 border ${isCurrent ? 'bg-white border-[#C5A059] shadow-2xs' : 'bg-[#FAF9F6] border-[#E5E1D8]'}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <h5 className={`text-xs uppercase tracking-wider font-medium ${isDone || isCurrent ? 'text-[#1A1A1A]' : 'text-[#8E8A81]'}`}>
                              {title}
                            </h5>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full bg-[#C5A059] text-white text-[8px] uppercase tracking-wider font-bold">
                                Current Stage
                              </span>
                            )}
                          </div>
                          {timeDisplay ? (
                            <span className="text-[10px] font-mono text-[#8E8A81]">
                              {timeDisplay}
                            </span>
                          ) : (
                            <span className="text-[9px] uppercase tracking-wider text-[#A89F91] font-mono">
                              Pending
                            </span>
                          )}
                        </div>
                        {description && (
                          <p className="text-xs text-[#6B6658] mt-1 leading-relaxed font-light">
                            {description}
                          </p>
                        )}
                        {step.updatedBy && (
                          <p className="text-[9px] text-[#A89F91] mt-1">
                            Logged by: {step.updatedBy}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Enclosed Items Grid */}
            <div className="pt-4 border-t border-[#E5E1D8] space-y-3">
              <h4 className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#8E8A81] font-cinzel">
                Enclosed Royal Creations
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="p-3.5 bg-[#FAF9F6] border border-[#E5E1D8] flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-[#1A1A1A] uppercase tracking-wider">{item.product_title}</p>
                      <p className="text-[#6B6658] font-light text-[11px]">Size: {item.size} • Qty: {item.quantity}</p>
                    </div>
                    <span className="font-medium text-[#1A1A1A]">₹{item.total_price.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Three PDF Download Actions */}
            <div className="pt-4 border-t border-[#E5E1D8] space-y-3">
              <span className="text-[10px] uppercase font-cinzel font-medium tracking-[0.25em] text-[#8E8A81] block">
                Official Order Documentation
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => downloadInvoicePdf(order)}
                  className="p-3 bg-[#FAF9F6] hover:bg-[#F5F2ED] border border-[#E5E1D8] text-[11px] uppercase tracking-wider font-medium text-[#1A1A1A] flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Tax Invoice</span>
                </button>

                <button
                  onClick={() => downloadPaymentReceiptPdf(order)}
                  className="p-3 bg-[#FAF9F6] hover:bg-[#F5F2ED] border border-[#E5E1D8] text-[11px] uppercase tracking-wider font-medium text-[#1A1A1A] flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Receipt className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Payment Receipt</span>
                </button>

                <button
                  onClick={() => downloadOrderSummaryPdf(order)}
                  className="p-3 bg-[#FAF9F6] hover:bg-[#F5F2ED] border border-[#E5E1D8] text-[11px] uppercase tracking-wider font-medium text-[#1A1A1A] flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Order Dossier</span>
                </button>
              </div>
            </div>

            {/* Direct WhatsApp Concierge Help */}
            <div className="p-5 bg-[#F5F2ED] border border-[#E5E1D8] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#1A1A1A] font-medium text-xs uppercase tracking-wider">
                  <MessageCircle className="w-4 h-4 text-[#C5A059]" />
                  <span>Assistance with Consignment #{order.order_number}</span>
                </div>
                <p className="text-[#6B6658] font-light">
                  Our Jaipur Atelier team can expedite delivery or answer fitting queries in real-time.
                </p>
              </div>

              <div className="flex gap-2 shrink-0">
                <a
                  href={`https://wa.me/918000461784?text=${encodeURIComponent(
                    `Hello ROYALS, I am checking the status of Order #${order.order_number}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 bg-[#C5A059] hover:bg-[#B38D45] text-white font-medium text-[10px] uppercase tracking-[0.2em] flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Atelier</span>
                </a>

                <a
                  href="tel:8000461784"
                  className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-black text-white font-medium text-[10px] uppercase tracking-[0.2em] flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Call 8000461784</span>
                </a>
              </div>
            </div>

          </div>
        )}

      </div>
    </section>
  );
};
