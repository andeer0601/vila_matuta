export type Role = 'customer' | 'admin';
export type IngredientCategory = 'base' | 'protein' | 'side' | 'complete_dish';
export type ShiftName = 'Manhã' | 'Tarde' | 'Noite';
export type OrderType = 'single' | 'package' | 'credit_usage';
export type OrderStatus = 'pending' | 'paid' | 'preparing' | 'in_delivery' | 'delivered' | 'cancelled';
export type PaymentMethod = 'pix' | 'credit_card' | 'credits';

export interface AllowedEmail {
  id: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface Profile {
  disabled_at?: string | null;
  preferred_delivery_period?: ShiftName | null;
  primary_address_id?: string | null;
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  complement: string | null;
  city: string | null;
  state: string;
  dietary_restrictions: string[];
  dietary_notes: string | null;
  role: Role;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  portion_grams: number;
  unit: string;
  description?: string | null;
  image_url?: string | null;
  is_available: boolean;
  created_at: string;
}

export interface Package {
  id: string;
  name: string;
  meal_count: number;
  total_price: number;
  unit_price: number;
  description?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CustomerCredit {
  id: string;
  user_id: string;
  available_meals: number;
  total_purchased: number;
  updated_at: string;
}

export interface ShiftConfig {
  id: string;
  day_of_week: number; // 0-6
  shift_name: ShiftName;
  max_orders_capacity: number;
  is_active: boolean;
}

export interface ShippingAddressSnapshot {
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  complement?: string;
  city: string;
  state: string;
  recipient_name: string;
  recipient_phone: string;
}

export interface Order {
  payment_link_state?: 'none'|'ready'|'expired'|'review';
  payment_link_expires_at?: string|null;
  checkout_needs_attention?: boolean;
  reservation_expires_at?: string | null;
  deliveries?: import('@/lib/scheduling').DeliveryPlan[];
  needs_rescheduling?: boolean;
  id: string;
  user_id: string;
  order_type: OrderType;
  status: OrderStatus;
  total_amount: number;
  quantity_meals: number;
  delivery_date: string | null; // YYYY-MM-DD
  delivery_shift: ShiftName | null;
  payment_method: PaymentMethod;
  infinitepay_tx_id?: string | null;
  infinitepay_checkout_url?: string | null;
  infinitepay_pix_code?: string | null;
  shipping_address_snapshot?: ShippingAddressSnapshot | null;
  notes?: string | null;
  created_at: string;
  paid_at?: string | null;
  // Joined fields
  profile?: Profile;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_type: 'custom' | 'complete_dish';
  name: string;
  base_id?: string | null;
  protein_id?: string | null;
  side1_id?: string | null;
  side2_id?: string | null;
  complete_dish_id?: string | null;
  quantity: number;
  special_instructions?: string | null;
  created_at: string;
  // Joined relations
  base?: Ingredient;
  protein?: Ingredient;
  side1?: Ingredient;
  side2?: Ingredient;
  complete_dish?: Ingredient;
}

export interface CustomMealSelection {
  tempId: string;
  type: 'custom' | 'complete_dish';
  name: string;
  base?: Ingredient;
  protein?: Ingredient;
  side1?: Ingredient;
  side2?: Ingredient;
  completeDish?: Ingredient;
  specialInstructions?: string;
  quantity: number;
}
