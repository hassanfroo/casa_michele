
import { Order, OrderStatus, IngredientAvailability, Cocktail } from '../types';

const STORAGE_KEYS = {
  COCKTAILS: 'ceb_cocktails_v5', // Bumped version to v5 to force refresh with strict taste profiles
  ORDERS: 'ceb_orders',
  AVAILABILITY: 'ceb_availability_prefix_', // Appends event code
};

export const MockDB = {
  getCocktails: (): Cocktail[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COCKTAILS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("DB Error parsing cocktails", e);
      return [];
    }
  },

  saveCocktails: (cocktails: Cocktail[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.COCKTAILS, JSON.stringify(cocktails));
    } catch (e) {
      console.error("DB Error saving cocktails", e);
    }
  },

  getOrders: (eventCode: string): Order[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      const allOrders: Order[] = data ? JSON.parse(data) : [];
      return allOrders.filter(o => o.eventCode === eventCode && o.status !== 'deleted');
    } catch (e) {
      console.error("DB Error parsing orders", e);
      return [];
    }
  },

  createOrder: (order: Order) => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      const allOrders: Order[] = data ? JSON.parse(data) : [];
      allOrders.push(order);
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(allOrders));
    } catch (e) {
      console.error("DB Error creating order", e);
    }
  },

  updateOrderStatus: (orderId: string, status: OrderStatus) => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      const allOrders: Order[] = data ? JSON.parse(data) : [];
      const updated = allOrders.map(o => o.id === orderId ? { ...o, status } : o);
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
    } catch (e) {
      console.error("DB Error updating order", e);
    }
  },

  getAvailability: (eventCode: string): IngredientAvailability => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AVAILABILITY + eventCode);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error("DB Error parsing availability", e);
      return {};
    }
  },

  setAvailability: (eventCode: string, availability: IngredientAvailability) => {
    try {
      localStorage.setItem(STORAGE_KEYS.AVAILABILITY + eventCode, JSON.stringify(availability));
    } catch (e) {
      console.error("DB Error saving availability", e);
    }
  }
};
