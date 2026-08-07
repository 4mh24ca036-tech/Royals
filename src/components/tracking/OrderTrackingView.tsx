import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileText, Package, Receipt, Sparkles, Truck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Order, TrackingData } from '../../types';
import { downloadInvoicePdf, downloadOrderSummaryPdf, downloadPaymentReceiptPdf } from '../../services/pdfGenerator';

interface OrderTrackingViewProps {
  initialQuery?: string;
  onExplore: () => void;
}

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({ onExplore }) => {
  const { isAuthenticated, isLoading: authLoading, setIsAuthModalOpen } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadOrders = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const loaded = await api.getUserOrders();
      setOrders(loaded);
    } catch (error: any) {
      setErrorMessage(error.message || 'We could not retrieve your order dossier.');
    } finally {
      setLoading(false);
    }
  };

  const selectOrder = async (order: Order) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      setSelected(await api.trackOrder(order.id));
    } catch (error: any) {
      setErrorMessage(error.message || 'We could not retrieve the timeline for this order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, [isAuthenticated]);

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <section className="py-12 bg-[#FAF9F6] min-h-screen">
        <div className="max-w-xl mx-auto px-4 text-center space-y-5">
          <Sparkles className="w-5 h-5 text-[#C5A059] mx-auto" />
          <h1 className="text-3xl font-serif italic font-light text-[#1A1A1A]">My Orders</h1>
          <p className="text-sm text-[#6B6658] font-light">Join ROYALS Atelier to view your private order timeline, invoices, and delivery updates.</p>
          <button onClick={() => { setIsAuthModalOpen(true); }} className="px-7 py-3 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium transition-colors">Join ROYALS Atelier</button>
        </div>
      </section>
    );
  }

  const activeOrder = selected ? orders.find((order) => order.id === selected.orderId) : undefined;
  return (
    <section className="py-10 sm:py-12 bg-[#FAF9F6] min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 space-y-7">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-[#C5A059] font-cinzel font-medium"><Sparkles className="w-3 h-3" />My ROYALS Atelier<Sparkles className="w-3 h-3" /></div>
          <h1 className="text-3xl sm:text-4xl font-serif italic font-light text-[#1A1A1A]">My Orders</h1>
          <p className="text-xs sm:text-sm text-[#6B6658] font-light">Your private orders and live delivery updates.</p>
        </div>

        {errorMessage && <div className="p-4 bg-white border border-[#E5E1D8] text-xs flex gap-3"><AlertCircle className="w-4 h-4 text-[#C5A059] shrink-0" />{errorMessage}</div>}

        {!loading && orders.length === 0 && !errorMessage && (
          <div className="bg-white border border-[#E5E1D8] p-8 text-center space-y-4"><Package className="w-7 h-7 text-[#C5A059] mx-auto" /><h2 className="font-serif italic text-xl">No orders yet</h2><button onClick={onExplore} className="text-[10px] uppercase tracking-[0.2em] text-[#C5A059] font-medium">Explore the collection</button></div>
        )}

        {orders.length > 0 && !selected && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {orders.map((order) => (
              <div key={order.id} className="bg-white border border-[#E5E1D8] p-5 space-y-4 hover:border-[#C5A059] transition-colors">
                <div className="flex gap-3">
                  <img src={order.items[0]?.product_image || '/images/catalog/royals-garment-01.jpeg'} alt="" className="w-16 h-20 object-cover border border-[#E5E1D8]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#1A1A1A] truncate">{order.items[0]?.product_title || 'Royal Couture Ensemble'}</p>
                    <p className="text-[10px] text-[#8E8A81] mt-1">{new Date(order.created_at).toLocaleDateString('en-GB')}</p>
                    <p className="text-sm text-[#C5A059] font-medium mt-1">₹{order.grand_total.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#E5E1D8]">
                  <span className="px-2.5 py-1 bg-[#1A1A1A] text-white text-[9px] uppercase tracking-wider">{order.order_status}</span>
                  <button onClick={() => selectOrder(order)} className="text-[10px] uppercase tracking-wider text-[#C5A059] font-medium hover:text-[#1A1A1A] transition-colors">Track Order</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {selected && activeOrder && (
          <div className="space-y-5">
            <button onClick={() => setSelected(null)} className="text-[10px] uppercase tracking-wider text-[#6B6658] hover:text-[#1A1A1A] transition-colors">← Back to My Orders</button>
            <article className="bg-white border border-[#E5E1D8] p-5 sm:p-7 space-y-7">
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between p-4 bg-[#FAF9F6] border border-[#E5E1D8]">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#8E8A81]">Current Status</p>
                  <h2 className="font-serif italic text-xl text-[#1A1A1A] mt-1">{selected.currentStatus}</h2>
                  <p className="text-xs text-[#6B6658] mt-1">Order #{selected.orderNumber} · {selected.orderDate}</p>
                </div>
                <span className="text-sm text-[#C5A059] font-medium">₹{selected.grandTotal.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.25em] text-[#8E8A81] font-cinzel mb-4">Delivery Timeline</h3>
                <div className="space-y-3">
                  {selected.timeline.map((step, index) => (
                    <div key={step.status} className="flex gap-3">
                      <div className={`w-6 h-6 shrink-0 flex items-center justify-center ${step.isCompleted ? 'bg-[#1A1A1A] text-[#C5A059]' : 'bg-[#E5E1D8] text-[#8E8A81]'}`}>
                        {step.isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : index + 1}
                      </div>
                      <div className="pb-3">
                        <p className="text-xs font-medium text-[#1A1A1A]">{step.label}</p>
                        <p className="text-[11px] text-[#6B6658] mt-0.5">
                          {step.isCompleted ? `${step.date} · ${step.time}` : 'Pending'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-[#E5E1D8] pt-5">
                <h3 className="text-[10px] uppercase tracking-[0.25em] text-[#8E8A81] font-cinzel mb-3">Your Order</h3>
                {activeOrder.items.map((item) => (
                  <div key={item.id} className="flex gap-3 py-2">
                    <img src={item.product_image || '/images/catalog/royals-garment-01.jpeg'} alt={item.product_title} className="w-12 h-14 object-cover border border-[#E5E1D8]" />
                    <div className="text-xs">
                      <p className="font-medium text-[#1A1A1A]">{item.product_title}</p>
                      <p className="text-[#6B6658] mt-1">Size: {item.size} · Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-[#E5E1D8] pt-5">
                <button onClick={() => { try { downloadInvoicePdf(activeOrder); } catch (error) { console.error('Failed to download invoice:', error); alert('Failed to download invoice. Please try again.'); } }} className="p-3 border border-[#E5E1D8] text-[10px] uppercase tracking-wider flex justify-center gap-2 hover:border-[#C5A059] cursor-pointer"><FileText className="w-3.5 h-3.5 text-[#C5A059]" />Invoice</button>
                <button onClick={async () => { try { await downloadPaymentReceiptPdf(activeOrder); } catch (error) { console.error('Failed to download receipt:', error); alert('Failed to download receipt. Please try again.'); } }} className="p-3 border border-[#E5E1D8] text-[10px] uppercase tracking-wider flex justify-center gap-2 hover:border-[#C5A059] cursor-pointer"><Receipt className="w-3.5 h-3.5 text-[#C5A059]" />Receipt</button>
                <button onClick={() => { try { downloadOrderSummaryPdf(activeOrder); } catch (error) { console.error('Failed to download dossier:', error); alert('Failed to download dossier. Please try again.'); } }} className="p-3 border border-[#E5E1D8] text-[10px] uppercase tracking-wider flex justify-center gap-2 hover:border-[#C5A059] cursor-pointer"><Download className="w-3.5 h-3.5 text-[#C5A059]" />Dossier</button>
              </div>
            </article>
          </div>
        )}
      </div>
    </section>
  );
};
