import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, Product } from '../types';
import { api } from '../services/api';

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  gstAmount: number;
  discountAmount: number;
  deliveryFee: number;
  grandTotal: number;
  appliedCoupon: string | null;
  couponMessage: string | null;
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (open: boolean) => void;
  addToCart: (product: Product, size: string, color?: string, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('royals_cart_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(() => {
    return localStorage.getItem('royals_applied_coupon') || null;
  });

  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);

  // Persist items to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('royals_cart_items', JSON.stringify(items));
    } catch (err) {
      console.error('Failed to persist cart:', err);
    }
  }, [items]);

  // Compute Subtotal
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Validate coupon when subtotal changes
  useEffect(() => {
    if (appliedCoupon && subtotal > 0) {
      api.validateCoupon(appliedCoupon, subtotal)
        .then((res) => {
          setCouponDiscount(res.discountAmount);
          setCouponMessage(res.message);
        })
        .catch(() => {
          setAppliedCoupon(null);
          setCouponDiscount(0);
          setCouponMessage(null);
          localStorage.removeItem('royals_applied_coupon');
        });
    } else {
      setCouponDiscount(0);
      setCouponMessage(null);
    }
  }, [subtotal, appliedCoupon]);

  const discountAmount = couponDiscount;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  // GST 12% on ethnic apparel
  const gstAmount = subtotal > 0 ? Math.round(taxableAmount * 0.12) : 0;
  // Free delivery above 5000
  const deliveryFee = subtotal > 0 ? (taxableAmount >= 5000 ? 0 : 250) : 0;
  const grandTotal = subtotal > 0 ? taxableAmount + gstAmount + deliveryFee : 0;

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product: Product, size: string, color?: string, quantity: number = 1) => {
    const selectedColor = color || product.color || 'Royal Classic';
    const effectivePrice = product.discount_price && product.discount_price < product.price ? product.discount_price : product.price;

    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (it) => it.productId === product.id && it.size === size && it.color === selectedColor
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      } else {
        const newItem: CartItem = {
          id: `${product.id}_${size}_${selectedColor}_${Date.now()}`,
          productId: product.id,
          title: product.title,
          image: product.images[0] || '/uploads/prod_boutique_01/garment-01.jpeg',
          price: effectivePrice,
          originalPrice: product.price,
          size,
          color: selectedColor,
          quantity,
          fabric: product.fabric
        };
        return [...prev, newItem];
      }
    });

    setIsCartDrawerOpen(true);
  };

  const removeFromCart = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, quantity } : it))
    );
  };

  const applyCoupon = async (code: string): Promise<boolean> => {
    try {
      const cleanCode = code.trim().toUpperCase();
      const res = await api.validateCoupon(cleanCode, subtotal);
      setAppliedCoupon(res.code);
      setCouponDiscount(res.discountAmount);
      setCouponMessage(res.message);
      localStorage.setItem('royals_applied_coupon', res.code);
      return true;
    } catch (err: any) {
      setCouponMessage(err.message || 'Invalid coupon code');
      return false;
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponMessage(null);
    localStorage.removeItem('royals_applied_coupon');
  };

  const clearCart = () => {
    setItems([]);
    removeCoupon();
    localStorage.removeItem('royals_cart_items');
  };

  return (
    <CartContext.Provider
      value={{
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
        addToCart,
        removeFromCart,
        updateQuantity,
        applyCoupon,
        removeCoupon,
        clearCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
