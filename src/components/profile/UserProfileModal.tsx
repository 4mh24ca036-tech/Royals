import React, { useState, useEffect } from 'react';
import { 
  X, 
  User as UserIcon, 
  Package, 
  MapPin, 
  Bell, 
  LogOut, 
  Plus, 
  Trash2, 
  FileText, 
  Receipt, 
  Truck, 
  Sparkles,
  Phone,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Order } from '../../types';
import { downloadInvoicePdf, downloadPaymentReceiptPdf, downloadOrderSummaryPdf } from '../../services/pdfGenerator';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackOrder: (orderNumber: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onTrackOrder
}) => {
  const { user, addresses, notifications, unreadNotificationCount, logout, addAddress, deleteAddress, markNotificationAsRead } = useAuth();

  const [activeTab, setActiveTab] = useState<'orders' | 'addresses' | 'notifications'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Address form
  const [isAddingAddress, setIsAddingAddress] = useState<boolean>(false);
  const [newFullName, setNewFullName] = useState<string>(user?.name || '');
  const [newPhone, setNewPhone] = useState<string>(user?.phone || '');
  const [newLine1, setNewLine1] = useState<string>('');
  const [newLine2, setNewLine2] = useState<string>('');
  const [newCity, setNewCity] = useState<string>('');
  const [newState, setNewState] = useState<string>('Rajasthan');
  const [newPincode, setNewPincode] = useState<string>('');

  useEffect(() => {
    if (isOpen && user) {
      setIsLoadingOrders(true);
      setOrdersError(null);
      api.getUserOrders()
        .then((res) => setOrders(res))
        .catch((err) => {
          console.error('Failed to load user orders:', err);
          setOrdersError(err instanceof Error ? err.message : 'Unable to load your orders.');
        })
        .finally(() => setIsLoadingOrders(false));
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName || !newPhone || !newLine1 || !newCity || !newPincode) return;

    setAddressError(null);
    try {
      await addAddress({
        fullName: newFullName,
        phone: newPhone,
        addressLine1: newLine1,
        addressLine2: newLine2,
        city: newCity,
        state: newState,
        pincode: newPincode,
        isDefault: addresses.length === 0
      });
      setIsAddingAddress(false);
      setNewLine1('');
      setNewLine2('');
      setNewCity('');
      setNewPincode('');
    } catch (err) {
      console.error('Failed to add address:', err);
      setAddressError(err instanceof Error ? err.message : 'Unable to save this address.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-[#FAF9F6] border border-[#E5E1D8] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Profile Header */}
        <div className="p-6 bg-[#F5F2ED] border-b border-[#E5E1D8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#1A1A1A] border border-[#C5A059] flex items-center justify-center text-[#C5A059] font-serif italic text-xl">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-serif italic font-light text-[#1A1A1A]">{user.name}</h3>
                <span className="px-2.5 py-0.5 bg-[#C5A059] text-white text-[9px] uppercase tracking-[0.2em] font-medium font-cinzel">
                  Imperial Patron
                </span>
              </div>
              <p className="text-[11px] text-[#6B6658] mt-0.5 font-light">{user.email} {user.phone && `• ${user.phone}`}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="px-4 py-2 bg-white hover:bg-[#FAF9F6] text-[#1A1A1A] border border-[#E5E1D8] text-[10px] uppercase tracking-[0.15em] font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <LogOut className="w-3 h-3 text-[#C5A059]" />
              <span>Sign Out</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-[#1A1A1A] hover:text-[#C5A059] hover:bg-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-[#E5E1D8] bg-white flex items-center gap-6 text-[11px] uppercase tracking-[0.2em] font-medium font-cinzel">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3.5 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'orders' ? 'text-[#C5A059] border-b-2 border-[#C5A059] font-semibold' : 'text-[#8E8A81] hover:text-[#1A1A1A]'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Orders ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('addresses')}
            className={`py-3.5 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'addresses' ? 'text-[#C5A059] border-b-2 border-[#C5A059] font-semibold' : 'text-[#8E8A81] hover:text-[#1A1A1A]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Addresses ({addresses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-3.5 flex items-center gap-2 cursor-pointer transition-colors relative ${
              activeTab === 'notifications' ? 'text-[#C5A059] border-b-2 border-[#C5A059] font-semibold' : 'text-[#8E8A81] hover:text-[#1A1A1A]'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Notifications</span>
            {unreadNotificationCount > 0 && (
              <span className="w-3.5 h-3.5 bg-[#C5A059] text-white text-[8px] flex items-center justify-center font-bold">
                {unreadNotificationCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {ordersError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-[11px] font-light">
                  {ordersError}
                </div>
              )}
              {isLoadingOrders ? (
                <div className="text-center py-12 text-xs text-[#8E8A81] font-light">Loading your royal order dossier...</div>
              ) : orders.length > 0 ? (
                orders.map((o) => (
                  <div key={o.id} className="p-5 bg-white border border-[#E5E1D8] shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E1D8] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif italic text-base text-[#1A1A1A]">Order #{o.order_number}</span>
                          <span className="px-2.5 py-0.5 bg-[#1A1A1A] text-white text-[9px] uppercase tracking-[0.15em] font-medium">
                            {o.order_status}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B6658] mt-0.5 font-light">
                          Placed on {new Date(o.created_at).toLocaleDateString('en-GB')} • Total: <strong className="font-medium text-[#1A1A1A]">₹{o.grand_total.toLocaleString('en-IN')}</strong>
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          onClose();
                          onTrackOrder(o.order_number);
                        }}
                        className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium flex items-center gap-1.5 cursor-pointer self-start transition-colors"
                      >
                        <Truck className="w-3 h-3 text-[#C5A059]" />
                        <span>Track Consignment</span>
                      </button>
                    </div>

                    {/* Enclosed Items */}
                    <div className="space-y-2">
                      {o.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-[#6B6658] font-light">
                          <span>{it.quantity}x {it.product_title} ({it.size})</span>
                          <span className="font-medium text-[#1A1A1A]">₹{it.total_price.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>

                    {/* PDF Actions */}
                    <div className="pt-2 border-t border-[#F5F2ED] flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => downloadInvoicePdf(o)}
                        className="px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#F5F2ED] border border-[#E5E1D8] text-[10px] uppercase tracking-wider font-medium text-[#1A1A1A] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <FileText className="w-3 h-3 text-[#C5A059]" />
                        <span>Invoice PDF</span>
                      </button>

                      <button
                        onClick={() => downloadPaymentReceiptPdf(o)}
                        className="px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#F5F2ED] border border-[#E5E1D8] text-[10px] uppercase tracking-wider font-medium text-[#1A1A1A] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Receipt className="w-3 h-3 text-[#C5A059]" />
                        <span>Receipt PDF</span>
                      </button>

                      <button
                        onClick={() => downloadOrderSummaryPdf(o)}
                        className="px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#F5F2ED] border border-[#E5E1D8] text-[10px] uppercase tracking-wider font-medium text-[#1A1A1A] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <FileText className="w-3 h-3 text-[#C5A059]" />
                        <span>Summary Dossier</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-xs text-[#8E8A81] font-light">
                  You have not placed any orders yet.
                </div>
              )}
            </div>
          )}

          {/* ADDRESSES TAB */}
          {activeTab === 'addresses' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-serif italic font-light text-sm text-[#1A1A1A]">Saved Delivery Destinations</h4>
                {!isAddingAddress && (
                  <button
                    onClick={() => setIsAddingAddress(true)}
                    className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add New Address</span>
                  </button>
                )}
              </div>

              {isAddingAddress && (
                <form onSubmit={handleSaveAddress} className="p-5 bg-white border border-[#E5E1D8] space-y-4">
                  <h5 className="text-[10px] uppercase tracking-[0.2em] font-cinzel font-medium text-[#1A1A1A]">New Shipping Destination</h5>
                  {addressError && (
                    <p className="p-3 bg-red-50 border border-red-200 text-red-800 text-[11px] font-light">{addressError}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Recipient Full Name"
                      required
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      className="p-2.5 border border-[#E5E1D8] text-xs bg-[#FAF9F6] font-light"
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      required
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="p-2.5 border border-[#E5E1D8] text-xs bg-[#FAF9F6] font-light"
                    />
                    <input
                      type="text"
                      placeholder="Address Line 1"
                      required
                      value={newLine1}
                      onChange={(e) => setNewLine1(e.target.value)}
                      className="sm:col-span-2 p-2.5 border border-[#E5E1D8] text-xs bg-[#FAF9F6] font-light"
                    />
                    <input
                      type="text"
                      placeholder="Address Line 2 (Optional)"
                      value={newLine2}
                      onChange={(e) => setNewLine2(e.target.value)}
                      className="sm:col-span-2 p-2.5 border border-[#E5E1D8] text-xs bg-[#FAF9F6] font-light"
                    />
                    <input
                      type="text"
                      placeholder="City"
                      required
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                      className="p-2.5 border border-[#E5E1D8] text-xs bg-[#FAF9F6] font-light"
                    />
                    <input
                      type="text"
                      placeholder="Pincode"
                      required
                      value={newPincode}
                      onChange={(e) => setNewPincode(e.target.value)}
                      className="p-2.5 border border-[#E5E1D8] text-xs bg-[#FAF9F6] font-light"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingAddress(false)}
                      className="px-4 py-2 border border-[#E5E1D8] text-[10px] uppercase tracking-wider text-[#6B6658] font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium transition-colors"
                    >
                      Save Destination
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <div key={addr.id} className="p-4 bg-white border border-[#E5E1D8] flex justify-between items-start">
                    <div className="space-y-1 text-xs font-light text-[#6B6658]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#1A1A1A] uppercase tracking-wider">{addr.full_name}</span>
                        {addr.is_default && (
                          <span className="px-2 py-0.5 bg-[#F5F2ED] text-[#C5A059] text-[9px] uppercase tracking-wider font-cinzel font-medium">Default</span>
                        )}
                      </div>
                      <p>{addr.address_line1}</p>
                      {addr.address_line2 && <p>{addr.address_line2}</p>}
                      <p>{addr.city}, {addr.state} - {addr.pincode}</p>
                      <p className="pt-1 text-[#8E8A81]">Phone: {addr.phone}</p>
                    </div>

                    <button
                      onClick={() => deleteAddress(addr.id)}
                      className="text-[#8E8A81] hover:text-[#1A1A1A] p-1 cursor-pointer transition-colors"
                      title="Delete address"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="space-y-3">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markNotificationAsRead(n.id)}
                    className={`p-4 border transition-colors cursor-pointer flex items-start gap-3 ${
                      n.is_read === 0 ? 'bg-white border-[#C5A059] shadow-2xs' : 'bg-[#FAF9F6] border-[#E5E1D8] opacity-80'
                    }`}
                  >
                    <div className="w-8 h-8 bg-[#F5F2ED] border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shrink-0 mt-0.5">
                      <Bell className="w-3.5 h-3.5" />
                    </div>

                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs uppercase tracking-wider font-medium text-[#1A1A1A]">{n.title}</h5>
                        <span className="text-[10px] text-[#8E8A81]">
                          {new Date(n.created_at).toLocaleString('en-GB')}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B6658] leading-relaxed font-light">{n.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-xs text-[#8E8A81] font-light">No notifications at this time.</div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
