import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  Package, 
  ShoppingBag, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Edit, 
  LogOut, 
  X, 
  Search, 
  Tag, 
  CheckCircle, 
  CheckCircle2,
  Sparkles,
  Layers,
  FileText,
  Receipt,
  Calendar,
  Clock,
  Truck,
  Eye,
  EyeOff,
  Bell,
  Volume2,
  VolumeX,
  RefreshCw,
  Download,
  MessageCircle,
  Phone,
  ExternalLink,
  ChevronRight,
  Filter,
  BarChart3,
  CreditCard,
  MapPin,
  Check
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../services/api';
import { AdminStats, Order, Product, Category, Coupon, InventoryItem } from '../../types';
import { downloadInvoicePdf, downloadPaymentReceiptPdf, downloadOrderSummaryPdf } from '../../services/pdfGenerator';
import { formatINR, formatDate } from '../../utils/format';

interface AdminPortalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onProductUpdated: () => void;
}

const CANONICAL_STATUSES = [
  'Order Placed',
  'Payment Confirmed',
  'Preparing Order',
  'Packed',
  'Shipped',
  'Out For Delivery',
  'Delivered',
  'Cancelled'
] as const;

export const AdminPortal: React.FC<AdminPortalProps> = ({
  isOpen,
  onClose,
  categories,
  onProductUpdated
}) => {
  const { admin, isAdminAuthenticated, login, logout } = useAdminAuth();

  // Login form states
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Royals@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Admin active section tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'products' | 'customers' | 'analytics' | 'inventory' | 'coupons'>('dashboard');

  // Loaded data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Search & Filter states
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');

  // Selected Order for detail & status management
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<string>('Preparing Order');
  const [statusNotes, setStatusNotes] = useState('');
  const [courierName, setCourierName] = useState('Blue Dart Apex Luxury');
  const [trackingIdInput, setTrackingIdInput] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [customDeliveryDate, setCustomDeliveryDate] = useState('');
  const [isUpdatingDeliveryDate, setIsUpdatingDeliveryDate] = useState(false);
  const [statusSuccessMessage, setStatusSuccessMessage] = useState<string | null>(null);

  // Live Toast Notification for New Orders
  const [liveToast, setLiveToast] = useState<{
    orderId: string;
    orderNumber: string;
    customerName: string;
    grandTotal: number;
    time: string;
  } | null>(null);

  const previousOrderCountRef = useRef<number>(0);

  // Product Add / Edit Modal states
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodTitle, setProdTitle] = useState('');
  const [prodCategory, setProdCategory] = useState(categories[0]?.id || 'cat_bridal_lehengas');
  const [prodPrice, setProdPrice] = useState<number>(45000);
  const [prodDiscountPrice, setProdDiscountPrice] = useState<number | null>(39999);
  const [prodFabric, setProdFabric] = useState('Pure Handloom Raw Silk & Chanderi');
  const [prodEmbroidery, setProdEmbroidery] = useState('Jaipur Heritage Hand Zardozi & Mukaish');
  const [prodColor, setProdColor] = useState('Royal Imperial Ruby');
  const [prodSizes, setProdSizes] = useState('S, M, L, XL, XXL, Custom Fit');
  const [prodStock, setProdStock] = useState<number>(12);
  const [prodDesc, setProdDesc] = useState('Exquisite artisan hand-stitched royal kurta set finished with antique gold zari work and silk linings.');
  const [prodImages, setProdImages] = useState('https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85');

  // Coupon modal state
  const [isAddingCoupon, setIsAddingCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscountType, setCouponDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [couponDiscountValue, setCouponDiscountValue] = useState<number>(15);
  const [couponMinSpend, setCouponMinSpend] = useState<number>(25000);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Play subtle chime when new order comes in
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch {
      // Audio not permitted or not supported
    }
  };

  // Load all admin data
  const loadAdminData = async (silent = false) => {
    if (!isAdminAuthenticated) return;
    if (!silent) setIsLoadingData(true);
    try {
      const [statsData, ordersData, prodsData, custData, analData, invData, coupData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminOrders(),
        api.getProducts(),
        api.getAdminCustomers(),
        api.getAdminAnalytics(),
        api.getAdminInventory(),
        api.getAdminCoupons()
      ]);

      // Check if new orders arrived
      if (previousOrderCountRef.current > 0 && ordersData.length > previousOrderCountRef.current) {
        const newest = ordersData[0];
        if (newest) {
          playChime();
          setLiveToast({
            orderId: newest.id,
            orderNumber: newest.order_number,
            customerName: newest.customer_name,
            grandTotal: newest.grand_total,
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          });
        }
      }
      previousOrderCountRef.current = ordersData.length;

      setStats(statsData);
      setOrders(ordersData);
      setProducts(prodsData);
      setCustomers(custData);
      setAnalytics(analData);
      setInventory(invData);
      setCoupons(coupData);

      // Keep selected order in sync if currently viewing one
      if (selectedOrder) {
        const updated = ordersData.find((o) => o.id === selectedOrder.id || o.order_number === selectedOrder.order_number);
        if (updated) {
          setSelectedOrder(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load admin operations data:', err);
    } finally {
      if (!silent) setIsLoadingData(false);
      setIsRefreshing(false);
    }
  };

  // Load data on open / auth change
  useEffect(() => {
    if (isOpen && isAdminAuthenticated) {
      loadAdminData();
      // Background polling every 8 seconds for real-time order sync
      const pollInterval = setInterval(() => {
        loadAdminData(true);
      }, 8000);
      return () => clearInterval(pollInterval);
    }
  }, [isOpen, isAdminAuthenticated]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      await login({ username, password });
      await loadAdminData();
    } catch (err: any) {
      setLoginError(err.message || 'Invalid administrator credentials. Please check username and password.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleOpenOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.order_status);
    setCourierName(order.courier_name || 'Blue Dart Apex Luxury');
    setTrackingIdInput(order.tracking_id || '');
    setCustomDeliveryDate(order.estimated_delivery_date || '');
    setStatusNotes('');
    setStatusSuccessMessage(null);
  };

  const handleUpdateOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setIsUpdatingStatus(true);
    setStatusSuccessMessage(null);
    try {
      const res = await api.updateOrderStatus(selectedOrder.id, {
        status: newStatus,
        notes: statusNotes,
        courierName,
        trackingId: trackingIdInput || selectedOrder.tracking_id,
        estimatedDeliveryDate: customDeliveryDate || selectedOrder.estimated_delivery_date
      });

      setStatusSuccessMessage(`Status successfully updated to "${newStatus}"! Customer has been notified.`);
      setSelectedOrder(res.order);
      await loadAdminData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to update order status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleUpdateEstimatedDelivery = async () => {
    if (!selectedOrder || !customDeliveryDate) return;
    setIsUpdatingDeliveryDate(true);
    try {
      const res = await api.updateEstimatedDeliveryDate(selectedOrder.id, {
        estimatedDeliveryDate: customDeliveryDate,
        notes: `Estimated delivery date updated to ${customDeliveryDate}`
      });
      setSelectedOrder(res.order);
      setStatusSuccessMessage(`Estimated Delivery Date updated to ${customDeliveryDate}. Customer notification sent.`);
      await loadAdminData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to update estimated delivery date');
    } finally {
      setIsUpdatingDeliveryDate(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productPayload = {
        title: prodTitle,
        category_id: prodCategory,
        category_name: categories.find((c) => c.id === prodCategory)?.name || 'Haute Couture',
        price: prodPrice,
        discount_price: prodDiscountPrice || null,
        stock: prodStock,
        fabric: prodFabric,
        embroidery: prodEmbroidery,
        color: prodColor,
        sizes: prodSizes.split(',').map((s) => s.trim()),
        images: prodImages.split(',').map((s) => s.trim()),
        description: prodDesc,
        care_instructions: 'Dry Clean Only. Preserve in heirloom muslin cloth with royal cedar blocks.',
        is_featured: 1,
        is_new_arrival: 1
      };

      if (editingProductId) {
        await api.updateProduct(editingProductId, productPayload);
      } else {
        await api.createProduct(productPayload);
      }

      setIsAddingProduct(false);
      setEditingProductId(null);
      onProductUpdated();
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to save couture product');
    }
  };

  const handleEditProductClick = (prod: Product) => {
    setEditingProductId(prod.id);
    setProdTitle(prod.title);
    setProdCategory(prod.category_id);
    setProdPrice(prod.price);
    setProdDiscountPrice(prod.discount_price || null);
    setProdFabric(prod.fabric || 'Pure Handloom Silk');
    setProdEmbroidery(prod.embroidery || 'Hand Zardozi');
    setProdColor(prod.color || 'Royal Classic');
    setProdSizes(prod.sizes ? prod.sizes.join(', ') : 'S, M, L, XL');
    setProdStock(prod.stock);
    setProdDesc(prod.description);
    setProdImages(prod.images ? prod.images.join(', ') : '');
    setIsAddingProduct(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to retire this couture creation from the catalogue?')) return;
    try {
      await api.deleteProduct(id);
      onProductUpdated();
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete product');
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAdminCoupon({
        code: couponCode.toUpperCase(),
        discount_type: couponDiscountType,
        discount_value: couponDiscountValue,
        min_spend: couponMinSpend,
        expiry_date: '2026-12-31'
      });
      setIsAddingCoupon(false);
      setCouponCode('');
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to create coupon');
    }
  };

  const handleToggleCoupon = async (id: string) => {
    try {
      await api.toggleAdminCoupon(id);
      await loadAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestock = async (invId: string) => {
    const qtyStr = prompt('Enter quantity to add to inventory:', '10');
    if (!qtyStr) return;
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) return;

    try {
      await api.restockInventory(invId, qty);
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to restock');
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((ord) => {
    const matchStatus = orderStatusFilter === 'all' || 
      ord.order_status === orderStatusFilter ||
      (orderStatusFilter === 'Preparing Order' && ord.order_status === 'Preparing') ||
      (orderStatusFilter === 'Out For Delivery' && ord.order_status === 'Out for Delivery');

    const searchLower = orderSearch.toLowerCase();
    const matchSearch = !orderSearch || 
      ord.order_number.toLowerCase().includes(searchLower) ||
      ord.customer_name.toLowerCase().includes(searchLower) ||
      ord.customer_phone.toLowerCase().includes(searchLower) ||
      ord.customer_email.toLowerCase().includes(searchLower) ||
      (ord.tracking_id && ord.tracking_id.toLowerCase().includes(searchLower));

    return matchStatus && matchSearch;
  });

  // Filter products
  const filteredProducts = products.filter((prod) => {
    const matchCat = productCategoryFilter === 'all' || prod.category_id === productCategoryFilter;
    const matchSearch = !productSearch || prod.title.toLowerCase().includes(productSearch.toLowerCase()) || (prod.fabric && prod.fabric.toLowerCase().includes(productSearch.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div id="admin-portal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden">
      
      {/* Live Toast Notification for Incoming Orders */}
      {liveToast && (
        <div 
          id="admin-live-order-toast"
          onClick={() => {
            const found = orders.find((o) => o.id === liveToast.orderId || o.order_number === liveToast.orderNumber);
            if (found) handleOpenOrderDetails(found);
            setLiveToast(null);
          }}
          className="fixed top-6 right-6 z-60 max-w-sm w-full bg-[#1A1A1A] border-2 border-[#C5A880] text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3.5 cursor-pointer animate-bounce hover:bg-[#252525] transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-[#C5A880] text-black flex items-center justify-center shrink-0 font-bold">
            <Bell className="w-5 h-5 animate-spin" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-[#C5A880] font-bold">🔔 New Order Received</span>
              <span className="text-[10px] text-[#A89F91]">{liveToast.time}</span>
            </div>
            <h5 className="font-serif font-bold text-sm text-white mt-0.5">{liveToast.customerName}</h5>
            <p className="text-xs text-[#E8DFD8]">Order #{liveToast.orderNumber} • <span className="font-bold text-[#C5A880]">{formatINR(liveToast.grandTotal)}</span></p>
            <p className="text-[10px] text-[#C5A880] mt-1 underline">Click to view & dispatch</p>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setLiveToast(null);
            }} 
            className="text-[#A89F91] hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="relative w-full max-w-7xl h-[94vh] bg-[#FAF8F5] rounded-3xl shadow-2xl border border-[#C5A880]/40 overflow-hidden flex flex-col">
        
        {/* Top Operations Command Header */}
        <header className="px-5 py-4 bg-[#141414] text-white border-b border-[#C5A880]/30 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#242424] border border-[#C5A880]/60 flex items-center justify-center text-[#C5A880] shadow-md">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-serif font-bold tracking-wide text-[#FAF8F5]">
                  ROYALS Atelier Operations
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#C5A880] text-[#121212] text-[9px] font-bold uppercase tracking-wider">
                  Production Admin
                </span>
                <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  LIVE Atelier Sync
                </span>
              </div>
              <p className="text-[11px] text-[#A89F91]">
                Jaipur Atelier & Fulfillment HQ • Server Time: <span className="font-mono text-[#FAF8F5]">{currentTime || '04:15:00 PM'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isAdminAuthenticated && (
              <>
                <button
                  id="admin-sound-toggle-btn"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? 'Order notification chimes enabled' : 'Order sound muted'}
                  className="p-2 rounded-xl bg-[#242424] hover:bg-[#333] text-[#C5A880] border border-[#C5A880]/30 transition-colors cursor-pointer"
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                </button>

                <button
                  id="admin-refresh-data-btn"
                  onClick={() => {
                    setIsRefreshing(true);
                    loadAdminData();
                  }}
                  disabled={isRefreshing}
                  title="Synchronize live orders and inventory from database"
                  className="px-3 py-1.5 rounded-xl bg-[#242424] hover:bg-[#333] text-xs text-[#E8DFD8] border border-[#C5A880]/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#C5A880] ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Sync Data</span>
                </button>

                <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-[#242424] rounded-xl border border-[#333] text-xs">
                  <div className="w-2 h-2 rounded-full bg-[#C5A880]"></div>
                  <span className="text-[#E8DFD8] font-medium">{admin?.name || 'Atelier Director'}</span>
                  <span className="text-[10px] text-[#A89F91] uppercase">({admin?.role || 'Admin'})</span>
                </div>

                <button
                  id="admin-logout-btn"
                  onClick={() => {
                    if (confirm('Sign out from ROYALS Admin Portal?')) {
                      logout();
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-xs text-red-200 border border-red-800/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            )}

            <button
              id="admin-portal-close-btn"
              onClick={onClose}
              className="p-2 text-[#A89F91] hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Portal & Return to Customer View"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ---------------------------------------------------- */}
        {/* VIEW 1: NOT AUTHENTICATED -> LUXURY LOGIN SCREEN     */}
        {/* ---------------------------------------------------- */}
        {!isAdminAuthenticated ? (
          <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 sm:p-12">
            <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-[#E8DFD8] space-y-6">
              
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-[#141414] border border-[#C5A880] flex items-center justify-center text-[#C5A880] mx-auto shadow-md">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-[#141414] tracking-wide">
                  ROYALS Atelier Access
                </h3>
                <p className="text-xs text-[#706B65] max-w-xs mx-auto leading-relaxed">
                  Enter administrative credentials to access live order fulfillment, patron communications, and inventory control.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3632] mb-1.5">
                    Username / Administrator Key
                  </label>
                  <input
                    id="admin-login-username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full p-3 rounded-xl border border-[#D8CCC2] text-xs bg-[#FAF8F5] focus:outline-none focus:border-[#C5A880] focus:bg-white text-[#141414]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3632]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-[#8C785A] hover:text-[#141414] flex items-center gap-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="admin-login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Royals@2026"
                      className="w-full p-3 rounded-xl border border-[#D8CCC2] text-xs bg-[#FAF8F5] focus:outline-none focus:border-[#C5A880] focus:bg-white text-[#141414] font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#706B65]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-[#D8CCC2] text-[#C5A880] focus:ring-[#C5A880]"
                    />
                    <span>Remember this device</span>
                  </label>
                  <span className="text-[#8C785A] font-medium">Port 3000 Auth</span>
                </div>

                <button
                  id="admin-login-submit-btn"
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3.5 rounded-full bg-[#141414] hover:bg-black text-[#FAF8F5] text-xs uppercase tracking-widest font-semibold transition-all cursor-pointer shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5 text-[#C5A880]" />
                  <span>{isLoggingIn ? 'Authenticating Key...' : 'Unlock Royal Operations'}</span>
                </button>

                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E8DFD8] text-[11px] text-[#706B65] text-center space-y-1">
                  <p>Preset Credentials:</p>
                  <p className="font-mono text-[#141414]">
                    User: <strong className="font-bold text-[#8C785A]">admin</strong> &nbsp;|&nbsp; Pass: <strong className="font-bold text-[#8C785A]">Royals@2026</strong>
                  </p>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* ---------------------------------------------------- */
          /* VIEW 2: AUTHENTICATED -> 6 DASHBOARD SECTIONS        */
          /* ---------------------------------------------------- */
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Top Section Tabs */}
            <nav className="px-6 border-b border-[#E8DFD8] bg-white flex items-center gap-2 sm:gap-6 text-xs font-semibold uppercase tracking-wider overflow-x-auto shrink-0 shadow-2xs">
              <button
                id="admin-tab-dashboard"
                onClick={() => setActiveTab('dashboard')}
                className={`py-3.5 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'dashboard' ? 'text-[#C5A880] border-b-2 border-[#C5A880] font-bold' : 'text-[#706B65] hover:text-[#141414]'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Dashboard</span>
              </button>

              <button
                id="admin-tab-orders"
                onClick={() => setActiveTab('orders')}
                className={`py-3.5 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'orders' ? 'text-[#C5A880] border-b-2 border-[#C5A880] font-bold' : 'text-[#706B65] hover:text-[#141414]'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Orders ({orders.length})</span>
              </button>

              <button
                id="admin-tab-products"
                onClick={() => setActiveTab('products')}
                className={`py-3.5 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'products' ? 'text-[#C5A880] border-b-2 border-[#C5A880] font-bold' : 'text-[#706B65] hover:text-[#141414]'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Products ({products.length})</span>
              </button>

              <button
                id="admin-tab-customers"
                onClick={() => setActiveTab('customers')}
                className={`py-3.5 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'customers' ? 'text-[#C5A880] border-b-2 border-[#C5A880] font-bold' : 'text-[#706B65] hover:text-[#141414]'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Customers ({customers.length})</span>
              </button>

              <button
                id="admin-tab-analytics"
                onClick={() => setActiveTab('analytics')}
                className={`py-3.5 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'analytics' ? 'text-[#C5A880] border-b-2 border-[#C5A880] font-bold' : 'text-[#706B65] hover:text-[#141414]'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </button>

              <button
                id="admin-tab-inventory"
                onClick={() => setActiveTab('inventory')}
                className={`py-3.5 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'inventory' ? 'text-[#C5A880] border-b-2 border-[#C5A880] font-bold' : 'text-[#706B65] hover:text-[#141414]'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Inventory ({inventory.length})</span>
              </button>

              <button
                id="admin-tab-coupons"
                onClick={() => setActiveTab('coupons')}
                className={`py-3.5 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'coupons' ? 'text-[#C5A880] border-b-2 border-[#C5A880] font-bold' : 'text-[#706B65] hover:text-[#141414]'
                }`}
              >
                <Tag className="w-4 h-4" />
                <span>Coupons ({coupons.length})</span>
              </button>
            </nav>

            {/* Panel Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
              
              {/* ==================================================== */}
              {/* SECTION 1: DASHBOARD                                 */}
              {/* ==================================================== */}
              {activeTab === 'dashboard' && stats && (
                <div className="space-y-6">
                  
                  {/* Top KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-[#8C785A] uppercase tracking-wider">Total Revenue</span>
                      <h4 className="text-2xl font-serif font-bold text-[#141414]">{formatINR(stats.totalRevenue)}</h4>
                      <p className="text-[11px] text-emerald-800 font-medium">From {stats.totalOrders} Verified Consignments</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-[#8C785A] uppercase tracking-wider">Total Orders</span>
                      <h4 className="text-2xl font-serif font-bold text-[#141414]">{stats.totalOrders}</h4>
                      <p className="text-[11px] text-[#706B65]">AOV: {formatINR(stats.avgOrderValue)}</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-[#8C785A] uppercase tracking-wider">Patrons / Customers</span>
                      <h4 className="text-2xl font-serif font-bold text-[#141414]">{stats.customersCount}</h4>
                      <p className="text-[11px] text-[#706B65]">VIP Customer Database</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-[#8C785A] uppercase tracking-wider">Couture Ensembles</span>
                      <h4 className="text-2xl font-serif font-bold text-[#141414]">{stats.productsCount}</h4>
                      <p className="text-[11px] text-[#706B65]">Across 6 Royal Categories</p>
                    </div>
                  </div>

                  {/* Status Funnel Pills Bar */}
                  <div className="p-5 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif font-bold text-sm text-[#141414]">Live Order Status Pipeline</h4>
                      <span className="text-xs text-[#8C785A]">Total: {orders.length}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                      {CANONICAL_STATUSES.map((st) => {
                        const count = stats.statusCounts[st] || 0;
                        return (
                          <div 
                            key={st}
                            onClick={() => {
                              setOrderStatusFilter(st);
                              setActiveTab('orders');
                            }}
                            className="p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F5EFE6] border border-[#E8DFD8] text-center cursor-pointer transition-colors"
                          >
                            <span className="text-[10px] text-[#706B65] font-medium block truncate">{st}</span>
                            <span className="text-sm font-bold text-[#141414] mt-0.5 block">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Action Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      onClick={() => {
                        setEditingProductId(null);
                        setProdTitle('');
                        setProdPrice(45000);
                        setProdDiscountPrice(39999);
                        setProdStock(10);
                        setIsAddingProduct(true);
                        setActiveTab('products');
                      }}
                      className="p-4 rounded-2xl bg-[#141414] hover:bg-black text-white text-left shadow-md flex items-center justify-between group cursor-pointer transition-all"
                    >
                      <div>
                        <span className="text-[10px] text-[#C5A880] uppercase tracking-widest block font-bold">Catalog Quick Action</span>
                        <h5 className="font-serif font-bold text-sm text-[#FAF8F5] mt-0.5">+ Add New Couture Kurta</h5>
                      </div>
                      <Plus className="w-5 h-5 text-[#C5A880] group-hover:rotate-90 transition-transform" />
                    </button>

                    <button
                      onClick={() => {
                        setOrderStatusFilter('Preparing Order');
                        setActiveTab('orders');
                      }}
                      className="p-4 rounded-2xl bg-white hover:bg-[#FAF8F5] border border-[#E8DFD8] text-left shadow-sm flex items-center justify-between group cursor-pointer transition-all"
                    >
                      <div>
                        <span className="text-[10px] text-[#8C785A] uppercase tracking-widest block font-bold">Fulfillment Queue</span>
                        <h5 className="font-serif font-bold text-sm text-[#141414] mt-0.5">Manage Unfulfilled Orders</h5>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#8C785A] group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button
                      onClick={() => setActiveTab('analytics')}
                      className="p-4 rounded-2xl bg-white hover:bg-[#FAF8F5] border border-[#E8DFD8] text-left shadow-sm flex items-center justify-between group cursor-pointer transition-all"
                    >
                      <div>
                        <span className="text-[10px] text-[#8C785A] uppercase tracking-widest block font-bold">Performance Audit</span>
                        <h5 className="font-serif font-bold text-sm text-[#141414] mt-0.5">View Revenue & Sales Analytics</h5>
                      </div>
                      <BarChart3 className="w-5 h-5 text-[#8C785A] group-hover:scale-110 transition-transform" />
                    </button>
                  </div>

                  {/* Recent Orders Table */}
                  <div className="p-6 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-serif font-bold text-base text-[#141414]">Live Atelier Consignments</h4>
                        <p className="text-xs text-[#706B65]">Recent client transactions recorded in database</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('orders')}
                        className="text-xs text-[#8C785A] hover:underline font-semibold cursor-pointer"
                      >
                        View Full Order Database ({orders.length}) →
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-[#FAF8F5] text-[#706B65] border-b border-[#E8DFD8]">
                            <th className="p-3">Order Number</th>
                            <th className="p-3">Patron</th>
                            <th className="p-3">Grand Total</th>
                            <th className="p-3">Payment</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Est. Delivery</th>
                            <th className="p-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E8DFD8]">
                          {orders.slice(0, 8).map((o) => (
                            <tr key={o.id} className="hover:bg-[#FAF8F5] transition-colors">
                              <td className="p-3 font-mono font-bold text-[#141414]">#{o.order_number}</td>
                              <td className="p-3">
                                <span className="font-medium text-[#141414] block">{o.customer_name}</span>
                                <span className="text-[10px] text-[#706B65]">{o.customer_phone}</span>
                              </td>
                              <td className="p-3 font-bold text-[#141414]">{formatINR(o.grand_total)}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  o.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {o.payment_method} ({o.payment_status})
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-full bg-[#141414] text-[#C5A880] text-[10px] font-bold">
                                  {o.order_status}
                                </span>
                              </td>
                              <td className="p-3 text-[#706B65] font-mono">{o.estimated_delivery_date}</td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleOpenOrderDetails(o)}
                                  className="px-3 py-1 bg-[#141414] hover:bg-[#C5A880] text-white hover:text-black text-[10px] uppercase tracking-wider font-semibold rounded-lg transition-colors cursor-pointer"
                                >
                                  Manage
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* ==================================================== */}
              {/* SECTION 2: ORDERS MANAGEMENT                         */}
              {/* ==================================================== */}
              {activeTab === 'orders' && (
                <div className="space-y-4">
                  
                  {/* Search and Filters */}
                  <div className="p-4 rounded-2xl bg-white border border-[#E8DFD8] flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1 max-w-md bg-[#FAF8F5] p-2.5 rounded-xl border border-[#D8CCC2]">
                      <Search className="w-4 h-4 text-[#8C785A]" />
                      <input
                        type="text"
                        placeholder="Search by Order #, Customer, Phone, or Tracking ID..."
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        className="w-full text-xs bg-transparent focus:outline-none"
                      />
                      {orderSearch && (
                        <button onClick={() => setOrderSearch('')} className="text-gray-400 hover:text-black">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#706B65] font-semibold">Filter Status:</span>
                      <select
                        value={orderStatusFilter}
                        onChange={(e) => setOrderStatusFilter(e.target.value)}
                        className="p-2 rounded-xl border border-[#D8CCC2] text-xs bg-[#FAF8F5] font-medium"
                      >
                        <option value="all">All Statuses ({orders.length})</option>
                        {CANONICAL_STATUSES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Orders Table */}
                  <div className="p-6 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-[#FAF8F5] text-[#706B65] border-b border-[#E8DFD8]">
                            <th className="p-3.5">Order # / Date</th>
                            <th className="p-3.5">Patron / Destination</th>
                            <th className="p-3.5">Creations</th>
                            <th className="p-3.5">Total & Payment</th>
                            <th className="p-3.5">Current Status</th>
                            <th className="p-3.5">Est. Delivery</th>
                            <th className="p-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E8DFD8]">
                          {filteredOrders.length > 0 ? (
                            filteredOrders.map((ord) => (
                              <tr key={ord.id} className="hover:bg-[#FAF8F5] transition-colors">
                                <td className="p-3.5">
                                  <span className="font-mono font-bold text-sm text-[#141414] block">#{ord.order_number}</span>
                                  <span className="text-[10px] text-[#706B65]">{formatDate(ord.created_at)}</span>
                                </td>

                                <td className="p-3.5">
                                  <span className="font-bold text-[#141414] block">{ord.customer_name}</span>
                                  <span className="text-[10px] text-[#706B65] block">{ord.customer_phone}</span>
                                  <span className="text-[10px] text-[#8C785A] truncate block max-w-xs">{ord.shipping_address?.city}, {ord.shipping_address?.state}</span>
                                </td>

                                <td className="p-3.5">
                                  <div className="space-y-1 max-w-xs">
                                    {ord.items && ord.items.map((it, idx) => (
                                      <div key={idx} className="flex items-center gap-1.5 text-[11px] text-[#3A3632]">
                                        <span className="font-medium truncate">{it.quantity}x {it.product_title}</span>
                                        <span className="text-[9px] px-1 bg-gray-100 rounded text-gray-600">({it.size})</span>
                                      </div>
                                    ))}
                                  </div>
                                </td>

                                <td className="p-3.5">
                                  <span className="font-serif font-bold text-sm text-[#141414] block">{formatINR(ord.grand_total)}</span>
                                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-bold ${
                                    ord.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {ord.payment_method} • {ord.payment_status}
                                  </span>
                                </td>

                                <td className="p-3.5">
                                  <span className="px-2.5 py-1 rounded-full bg-[#141414] text-[#C5A880] text-[10px] font-bold inline-block">
                                    {ord.order_status}
                                  </span>
                                  {ord.tracking_id && (
                                    <span className="text-[9px] font-mono text-[#706B65] block mt-1">
                                      Ref: {ord.tracking_id}
                                    </span>
                                  )}
                                </td>

                                <td className="p-3.5 font-mono text-[11px] text-[#706B65]">
                                  {ord.estimated_delivery_date}
                                </td>

                                <td className="p-3.5 text-right space-x-2">
                                  <button
                                    onClick={() => handleOpenOrderDetails(ord)}
                                    className="px-3 py-1.5 bg-[#141414] hover:bg-[#C5A880] text-white hover:text-black text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors cursor-pointer"
                                  >
                                    View & Update
                                  </button>

                                  <button
                                    onClick={() => downloadInvoicePdf(ord)}
                                    title="Download Tax Invoice PDF"
                                    className="p-1.5 rounded-lg border border-[#D8CCC2] hover:bg-[#FAF8F5] text-[#8C785A] hover:text-[#141414] transition-colors cursor-pointer inline-flex items-center"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-[#706B65]">
                                No consignments matching the selected criteria.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* ==================================================== */}
              {/* SECTION 3: PRODUCTS CATALOGUE                        */}
              {/* ==================================================== */}
              {activeTab === 'products' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white border border-[#E8DFD8] flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1 max-w-sm bg-[#FAF8F5] p-2.5 rounded-xl border border-[#D8CCC2]">
                      <Search className="w-4 h-4 text-[#8C785A]" />
                      <input
                        type="text"
                        placeholder="Search products by title or fabric..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full text-xs bg-transparent focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        value={productCategoryFilter}
                        onChange={(e) => setProductCategoryFilter(e.target.value)}
                        className="p-2 rounded-xl border border-[#D8CCC2] text-xs bg-[#FAF8F5] font-medium"
                      >
                        <option value="all">All Categories</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => {
                          setEditingProductId(null);
                          setProdTitle('');
                          setProdPrice(45000);
                          setProdDiscountPrice(39999);
                          setProdStock(10);
                          setIsAddingProduct(true);
                        }}
                        className="px-4 py-2 bg-[#141414] hover:bg-[#C5A880] text-white hover:text-black text-xs uppercase tracking-wider font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Couture Creation</span>
                      </button>
                    </div>
                  </div>

                  {/* Products Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredProducts.map((p) => (
                      <div key={p.id} className="bg-white rounded-2xl border border-[#E8DFD8] overflow-hidden shadow-sm flex flex-col justify-between">
                        <div className="relative aspect-4/3 bg-gray-100 overflow-hidden">
                          <img
                            referrerPolicy="no-referrer"
                            src={p.images?.[0] || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85'}
                            alt={p.title}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/70 text-[#FAF8F5] text-[9px] font-bold uppercase tracking-wider backdrop-blur-xs">
                            {p.category_name}
                          </span>
                          <span className={`absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            p.stock <= 3 ? 'bg-red-600 text-white' : 'bg-emerald-700 text-white'
                          }`}>
                            {p.stock} In Stock
                          </span>
                        </div>

                        <div className="p-4 space-y-2">
                          <h5 className="font-serif font-bold text-sm text-[#141414] line-clamp-1">{p.title}</h5>
                          <p className="text-[11px] text-[#706B65] line-clamp-1">{p.fabric} • {p.embroidery}</p>

                          <div className="flex items-baseline gap-2">
                            <span className="font-serif font-bold text-base text-[#141414]">
                              {formatINR((p.discount_price || p.price))}
                            </span>
                            {p.discount_price && (
                              <span className="text-xs text-gray-400 line-through">
                                {formatINR(p.price)}
                              </span>
                            )}
                          </div>

                          <div className="pt-2 border-t border-[#F5F2ED] flex items-center justify-between gap-2">
                            <button
                              onClick={() => handleEditProductClick(p)}
                              className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#E8DFD8] text-[#141414] text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors flex-1 justify-center"
                            >
                              <Edit className="w-3.5 h-3.5 text-[#8C785A]" />
                              <span>Edit</span>
                            </button>

                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Retire product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              )}

              {/* ==================================================== */}
              {/* SECTION 4: CUSTOMERS DIRECTORY                       */}
              {/* ==================================================== */}
              {activeTab === 'customers' && (
                <div className="p-6 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-base text-[#141414]">Imperial Patron Directory</h4>
                      <p className="text-xs text-[#706B65]">Customer accounts with total order values and verified contacts</p>
                    </div>
                    <span className="text-xs text-[#8C785A] font-semibold">Total Patrons: {customers.length}</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-[#FAF8F5] text-[#706B65] border-b border-[#E8DFD8]">
                          <th className="p-3">Patron Name</th>
                          <th className="p-3">Email Address</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3">Total Orders</th>
                          <th className="p-3">Lifetime Value</th>
                          <th className="p-3">Member Since</th>
                          <th className="p-3 text-right">Direct Contact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8DFD8]">
                        {customers.map((c) => (
                          <tr key={c.id} className="hover:bg-[#FAF8F5] transition-colors">
                            <td className="p-3 font-bold text-[#141414]">{c.name}</td>
                            <td className="p-3 text-[#706B65] font-mono">{c.email}</td>
                            <td className="p-3 font-mono">{c.phone || 'N/A'}</td>
                            <td className="p-3 font-bold">{c.totalOrders || 0}</td>
                            <td className="p-3 font-serif font-bold text-[#141414]">{formatINR((c.totalSpent || 0))}</td>
                            <td className="p-3 text-[#706B65]">{formatDate(c.created_at)}</td>
                            <td className="p-3 text-right">
                              {c.phone ? (
                                <a
                                  href={`https://wa.me/91${c.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                    `Greetings ${c.name} from ROYALS Atelier Jaipur.`
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>WhatsApp</span>
                                </a>
                              ) : (
                                <span className="text-[10px] text-gray-400">No phone</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* SECTION 5: ANALYTICS                                 */}
              {/* ==================================================== */}
              {activeTab === 'analytics' && analytics && (
                <div className="space-y-6">
                  
                  {/* Revenue Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-5 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-[#8C785A] uppercase tracking-wider">Settled Revenue</span>
                      <h4 className="text-2xl font-serif font-bold text-[#141414]">{formatINR(analytics.totalRevenue)}</h4>
                      <p className="text-[11px] text-emerald-800 font-medium">100% Verified in MySQL Store</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-[#8C785A] uppercase tracking-wider">Average Order Value</span>
                      <h4 className="text-2xl font-serif font-bold text-[#141414]">{formatINR(analytics.avgOrderValue)}</h4>
                      <p className="text-[11px] text-[#706B65]">High-Ticket Luxury Tier</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-[#8C785A] uppercase tracking-wider">Total Consignments</span>
                      <h4 className="text-2xl font-serif font-bold text-[#141414]">{analytics.totalOrders}</h4>
                      <p className="text-[11px] text-[#706B65]">Processed by Jaipur Atelier</p>
                    </div>
                  </div>

                  {/* Top Selling Products */}
                  <div className="p-6 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-4">
                    <h4 className="font-serif font-bold text-base text-[#141414]">Top Selling Couture Ensembles</h4>
                    
                    <div className="space-y-3">
                      {analytics.topProducts && analytics.topProducts.map((tp: any, idx: number) => (
                        <div key={tp.id} className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFD8] flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#141414] text-[#C5A880] text-xs font-bold flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <div>
                              <h5 className="font-serif font-bold text-xs text-[#141414]">{tp.title}</h5>
                              <p className="text-[10px] text-[#706B65]">{tp.count} units ordered</p>
                            </div>
                          </div>
                          <span className="font-serif font-bold text-sm text-[#141414]">{formatINR(tp.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Method Distribution */}
                  <div className="p-6 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-4">
                    <h4 className="font-serif font-bold text-base text-[#141414]">Payment Channel Distribution</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {analytics.paymentMethods && Object.entries(analytics.paymentMethods).map(([k, v]: [string, any]) => (
                        <div key={k} className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8DFD8]">
                          <span className="text-[10px] text-[#8C785A] uppercase tracking-wider font-bold block">{k}</span>
                          <span className="text-lg font-serif font-bold text-[#141414] mt-1 block">{formatINR(v.total)}</span>
                          <span className="text-[10px] text-[#706B65] mt-0.5 block">{v.count} Transactions</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* ==================================================== */}
              {/* SECTION 6: INVENTORY CONTROL                         */}
              {/* ==================================================== */}
              {activeTab === 'inventory' && (
                <div className="p-6 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-base text-[#141414]">Atelier SKU Stock Register</h4>
                      <p className="text-xs text-[#706B65]">Live inventory counts with automated low-stock warnings</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-[#FAF8F5] text-[#706B65] border-b border-[#E8DFD8]">
                          <th className="p-3">SKU</th>
                          <th className="p-3">Couture Item</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Size</th>
                          <th className="p-3">Stock Units</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8DFD8]">
                        {inventory.map((inv) => (
                          <tr key={inv.id} className="hover:bg-[#FAF8F5] transition-colors">
                            <td className="p-3 font-mono font-bold">{inv.sku}</td>
                            <td className="p-3 font-medium text-[#141414]">{inv.product_title}</td>
                            <td className="p-3 text-[#706B65]">{inv.category_name}</td>
                            <td className="p-3 font-bold">{inv.size}</td>
                            <td className="p-3 font-mono font-bold">{inv.stock_quantity}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inv.stock_quantity <= 3 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {inv.stock_quantity <= 3 ? 'Low Stock' : 'Optimal'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleRestock(inv.id)}
                                className="px-3 py-1 bg-[#141414] hover:bg-[#C5A880] text-white hover:text-black text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer"
                              >
                                + Restock
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* SECTION 7: PROMOTIONAL COUPONS                       */}
              {/* ==================================================== */}
              {activeTab === 'coupons' && (
                <div className="p-6 rounded-2xl bg-white border border-[#E8DFD8] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-base text-[#141414]">Promotional Vouchers</h4>
                      <p className="text-xs text-[#706B65]">Discount keys valid at checkout</p>
                    </div>
                    <button
                      onClick={() => setIsAddingCoupon(true)}
                      className="px-4 py-2 bg-[#141414] hover:bg-[#C5A880] text-white hover:text-black text-xs uppercase tracking-wider font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Coupon</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-[#FAF8F5] text-[#706B65] border-b border-[#E8DFD8]">
                          <th className="p-3">Code</th>
                          <th className="p-3">Discount</th>
                          <th className="p-3">Min Spend</th>
                          <th className="p-3">Usage Count</th>
                          <th className="p-3">Expiry Date</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8DFD8]">
                        {coupons.map((cp) => (
                          <tr key={cp.id} className="hover:bg-[#FAF8F5] transition-colors">
                            <td className="p-3 font-mono font-bold text-sm text-[#141414]">{cp.code}</td>
                            <td className="p-3 font-bold text-[#8C785A]">
                              {cp.discount_value}{cp.discount_type === 'percentage' ? '%' : '₹ Flat'}
                            </td>
                            <td className="p-3">{formatINR(cp.min_spend)}</td>
                            <td className="p-3 font-mono">{cp.usage_count} times</td>
                            <td className="p-3 text-[#706B65]">{cp.expiry_date}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                cp.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                              }`}>
                                {cp.is_active ? 'Active' : 'Disabled'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleToggleCoupon(cp.id)}
                                className="px-3 py-1 bg-[#FAF8F5] hover:bg-[#E8DFD8] text-[#141414] text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer border border-[#D8CCC2]"
                              >
                                {cp.is_active ? 'Disable' : 'Enable'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>

      {/* ==================================================== */}
      {/* ORDER DETAILS & STATUS UPDATE MODAL                  */}
      {/* ==================================================== */}
      {selectedOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl bg-[#FAF8F5] rounded-3xl shadow-2xl border border-[#C5A880] overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="p-5 bg-[#141414] text-white border-b border-[#C5A880]/30 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-bold text-lg text-white">
                    Consignment #{selectedOrder.order_number}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#C5A880] text-black text-[10px] font-bold uppercase">
                    {selectedOrder.order_status}
                  </span>
                </div>
                <p className="text-xs text-[#A89F91]">
                  Placed on {formatDate(selectedOrder.created_at)} • Tracking ID: {selectedOrder.tracking_id}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadInvoicePdf(selectedOrder)}
                  className="px-3 py-1.5 rounded-xl bg-[#242424] hover:bg-[#333] text-xs text-[#C5A880] border border-[#C5A880]/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tax Invoice PDF</span>
                </button>

                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 text-[#A89F91] hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {statusSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{statusSuccessMessage}</span>
                </div>
              )}

              {/* Top Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Patron & Shipping */}
                <div className="p-4 rounded-2xl bg-white border border-[#E8DFD8] space-y-2">
                  <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-[#8C785A]">
                    Patron & Destination
                  </h4>
                  <div>
                    <p className="font-bold text-sm text-[#141414]">{selectedOrder.customer_name}</p>
                    <p className="text-xs text-[#706B65]">{selectedOrder.customer_phone} • {selectedOrder.customer_email}</p>
                  </div>
                  <div className="text-xs text-[#3A3632] pt-2 border-t border-[#F5F2ED]">
                    <p>{selectedOrder.shipping_address?.addressLine1}</p>
                    {selectedOrder.shipping_address?.addressLine2 && <p>{selectedOrder.shipping_address.addressLine2}</p>}
                    <p>{selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.state} - {selectedOrder.shipping_address?.pincode}</p>
                  </div>
                  {selectedOrder.customer_phone && (
                    <a
                      href={`https://wa.me/91${selectedOrder.customer_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                        `Hello ${selectedOrder.customer_name}, this is ROYALS Atelier Jaipur updating you on Order #${selectedOrder.order_number}.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold hover:underline pt-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp Patron Directly</span>
                    </a>
                  )}
                </div>

                {/* Payment & Logistics */}
                <div className="p-4 rounded-2xl bg-white border border-[#E8DFD8] space-y-2">
                  <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-[#8C785A]">
                    Payment & Logistics
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#706B65]">Grand Total:</span>
                    <span className="font-serif font-bold text-base text-[#141414]">{formatINR(selectedOrder.grand_total)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#706B65]">Payment Method:</span>
                    <span className="font-semibold text-[#141414]">{selectedOrder.payment_method}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#706B65]">Payment Status:</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      selectedOrder.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {selectedOrder.payment_status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#706B65]">Courier Partner:</span>
                    <span className="font-semibold text-[#141414]">{selectedOrder.courier_name || 'Blue Dart Apex Luxury'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#706B65]">Estimated Delivery:</span>
                    <span className="font-bold text-[#8C785A]">{selectedOrder.estimated_delivery_date}</span>
                  </div>
                </div>

              </div>

              {/* Ordered Products */}
              <div className="p-4 rounded-2xl bg-white border border-[#E8DFD8] space-y-3">
                <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-[#8C785A]">
                  Ordered Ensembles ({selectedOrder.items?.length || 0})
                </h4>

                <div className="divide-y divide-[#E8DFD8]">
                  {selectedOrder.items && selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img
                          referrerPolicy="no-referrer"
                          src={item.product_image || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85'}
                          alt={item.product_title}
                          className="w-12 h-12 object-cover rounded-xl border border-[#E8DFD8]"
                        />
                        <div>
                          <p className="font-bold text-xs text-[#141414]">{item.product_title}</p>
                          <p className="text-[11px] text-[#706B65]">Size: <strong className="text-[#141414]">{item.size}</strong> • Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <span className="font-serif font-bold text-xs text-[#141414]">
                        {formatINR(item.total_price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Change Estimated Delivery Date */}
              <div className="p-4 rounded-2xl bg-[#F5EFE6] border border-[#C5A880]/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#8C785A]" />
                  <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-[#141414]">
                    Update Estimated Delivery Date
                  </h4>
                </div>
                <p className="text-xs text-[#706B65]">
                  Automatically initialized to Current Date + 8 Days. Updates immediately reflect in patron tracking & notifications.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={customDeliveryDate}
                    onChange={(e) => setCustomDeliveryDate(e.target.value)}
                    placeholder="e.g. 15 Aug 2026"
                    className="p-2.5 rounded-xl border border-[#D8CCC2] text-xs bg-white text-[#141414] font-medium flex-1 max-w-xs focus:outline-none focus:border-[#C5A880]"
                  />
                  <button
                    onClick={handleUpdateEstimatedDelivery}
                    disabled={isUpdatingDeliveryDate || !customDeliveryDate}
                    className="px-4 py-2.5 bg-[#141414] hover:bg-black text-white text-xs uppercase tracking-wider font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isUpdatingDeliveryDate ? 'Saving...' : 'Update Delivery Date'}
                  </button>
                </div>
              </div>

              {/* ORDER STATUS UPDATE FORM */}
              <form onSubmit={handleUpdateOrderStatus} className="p-5 rounded-2xl bg-white border border-[#E8DFD8] space-y-4">
                <div className="flex items-center gap-2 border-b border-[#E8DFD8] pb-3">
                  <Clock className="w-4 h-4 text-[#C5A880]" />
                  <h4 className="font-serif font-bold text-sm text-[#141414]">
                    Change Order Status & Create History Record
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#3A3632] mb-1">New Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#D8CCC2] text-xs bg-[#FAF8F5] font-semibold text-[#141414]"
                    >
                      {CANONICAL_STATUSES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#3A3632] mb-1">Courier Partner</label>
                    <input
                      type="text"
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#D8CCC2] text-xs bg-[#FAF8F5] text-[#141414]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#3A3632] mb-1">Tracking ID</label>
                    <input
                      type="text"
                      value={trackingIdInput}
                      onChange={(e) => setTrackingIdInput(e.target.value)}
                      placeholder="e.g. TRK-RYL-89412"
                      className="w-full p-2.5 rounded-xl border border-[#D8CCC2] text-xs bg-[#FAF8F5] text-[#141414] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3A3632] mb-1">
                    Atelier Craftsman / Status Notes
                  </label>
                  <textarea
                    rows={2}
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    placeholder="Enter custom fulfillment notes for this status update..."
                    className="w-full p-2.5 rounded-xl border border-[#D8CCC2] text-xs bg-[#FAF8F5] text-[#141414]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="w-full py-3 bg-[#141414] hover:bg-[#C5A880] text-white hover:text-black text-xs uppercase tracking-widest font-bold rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{isUpdatingStatus ? 'Saving Status & Notifying Patron...' : `Set Status to "${newStatus}" & Notify Customer`}</span>
                </button>
              </form>

              {/* ORDER STATUS HISTORY AUDIT LOG */}
              <div className="p-5 rounded-2xl bg-white border border-[#E8DFD8] space-y-3">
                <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-[#8C785A]">
                  Order Status Audit Trail (Chronological)
                </h4>

                <div className="space-y-3 pl-4 border-l-2 border-[#C5A880]/50">
                  {selectedOrder.status_history && selectedOrder.status_history.map((hist, idx) => (
                    <div key={idx} className="relative space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#141414]">{hist.status}</span>
                        <span className="text-[10px] text-[#706B65]">• {hist.date_str}, {hist.time_str}</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">By: {hist.updated_by}</span>
                      </div>
                      {hist.notes && (
                        <p className="text-xs text-[#6B6658] leading-relaxed font-light">{hist.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ADD / EDIT PRODUCT MODAL                             */}
      {/* ==================================================== */}
      {isAddingProduct && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-[#FAF8F5] rounded-3xl shadow-2xl border border-[#C5A880] overflow-hidden flex flex-col max-h-[92vh]">
            
            <div className="p-5 bg-[#141414] text-white border-b border-[#C5A880]/30 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-white">
                {editingProductId ? 'Edit Couture Creation' : 'Add New Royal Creation to Catalog'}
              </h3>
              <button onClick={() => setIsAddingProduct(false)} className="p-1 text-[#A89F91] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#3A3632] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={prodTitle}
                  onChange={(e) => setProdTitle(e.target.value)}
                  placeholder="e.g. Royal Imperial Gold Zardozi Kurta Set"
                  className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white text-[#141414]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#3A3632] mb-1">Category</label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white text-[#141414]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#3A3632] mb-1">Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={prodPrice}
                    onChange={(e) => setProdPrice(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white text-[#141414]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#3A3632] mb-1">Discount Price (₹)</label>
                  <input
                    type="number"
                    value={prodDiscountPrice || ''}
                    onChange={(e) => setProdDiscountPrice(e.target.value ? Number(e.target.value) : null)}
                    placeholder="Optional"
                    className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white text-[#141414]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#3A3632] mb-1">Fabric</label>
                  <input
                    type="text"
                    value={prodFabric}
                    onChange={(e) => setProdFabric(e.target.value)}
                    placeholder="e.g. Pure Silk Velvet"
                    className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white text-[#141414]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#3A3632] mb-1">Embroidery</label>
                  <input
                    type="text"
                    value={prodEmbroidery}
                    onChange={(e) => setProdEmbroidery(e.target.value)}
                    placeholder="e.g. Hand Zardozi"
                    className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white text-[#141414]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#3A3632] mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    value={prodStock}
                    onChange={(e) => setProdStock(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white text-[#141414]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#3A3632] mb-1">Available Sizes (comma separated)</label>
                <input
                  type="text"
                  value={prodSizes}
                  onChange={(e) => setProdSizes(e.target.value)}
                  placeholder="S, M, L, XL, Custom Fit"
                  className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white text-[#141414]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#3A3632] mb-1">Image URLs (comma separated)</label>
                <input
                  type="text"
                  required
                  value={prodImages}
                  onChange={(e) => setProdImages(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white text-[#141414]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#3A3632] mb-1">Description</label>
                <textarea
                  rows={3}
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white text-[#141414]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#141414] hover:bg-[#C5A880] text-white hover:text-black text-xs uppercase tracking-widest font-bold rounded-xl transition-all cursor-pointer shadow-md"
              >
                {editingProductId ? 'Update Creation in Catalog' : 'Publish to ROYALS Catalog'}
              </button>
            </form>

          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* CREATE COUPON MODAL                                  */}
      {/* ==================================================== */}
      {isAddingCoupon && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#FAF8F5] rounded-3xl shadow-2xl border border-[#C5A880] overflow-hidden p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#E8DFD8] pb-3">
              <h4 className="font-serif font-bold text-sm text-[#141414]">Create Promotional Coupon</h4>
              <button onClick={() => setIsAddingCoupon(false)} className="text-[#8C785A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-3">
              <div>
                <label className="block font-semibold text-[#3A3632] mb-1">Coupon Code</label>
                <input
                  type="text"
                  required
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ROYALS15"
                  className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white font-mono font-bold uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#3A3632] mb-1">Discount Type</label>
                  <select
                    value={couponDiscountType}
                    onChange={(e: any) => setCouponDiscountType(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#3A3632] mb-1">Discount Value</label>
                  <input
                    type="number"
                    required
                    value={couponDiscountValue}
                    onChange={(e) => setCouponDiscountValue(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#3A3632] mb-1">Min Spend (₹)</label>
                <input
                  type="number"
                  value={couponMinSpend}
                  onChange={(e) => setCouponMinSpend(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-[#D8CCC2] bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#141414] hover:bg-[#C5A880] text-white hover:text-black text-xs uppercase tracking-widest font-bold rounded-xl transition-colors cursor-pointer shadow-md"
              >
                Issue Coupon
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
