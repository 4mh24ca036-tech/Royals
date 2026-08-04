import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, Product } from '../types';
import { api } from '../services/api';
import { STORAGE_KEYS, readJson, readStorage, removeStorage, writeJson, writeStorage } from '../utils/storage';
import { calculateOrderTotals, sumLineItems } from '../../shared/pricing';

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
  const [items, setItems] = useState<CartItem[]>(() => readJson<CartItem[]>(STORAGE_KEYS.cartItems, []));

  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(() => readStorage(STORAGE_KEYS.appliedCoupon));

  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);

  // Persist items to localStorage
  useEffect(() => {
    writeJson(STORAGE_KEYS.cartItems, items);
  }, [items]);

  const subtotal = sumLineItems(items);

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
          removeStorage(STORAGE_KEYS.appliedCoupon);
        });
    } else {
      setCouponDiscount(0);
      setCouponMessage(null);
    }
  }, [subtotal, appliedCoupon]);

  const { discountAmount, gstAmount, deliveryFee, grandTotal } = calculateOrderTotals(subtotal, couponDiscount);

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
          image: product.images[0] || '',
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
      writeStorage(STORAGE_KEYS.appliedCoupon, res.code);
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
    removeStorage(STORAGE_KEYS.appliedCoupon);
  };

  const clearCart = () => {
    setItems([]);
    removeCoupon();
    removeStorage(STORAGE_KEYS.cartItems);
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
