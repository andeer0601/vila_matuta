import type { CustomMealSelection, Order, ShiftName, ShippingAddressSnapshot } from '@/types/database';
export const DAILY_CAPACITY = 120;
export type DeliveryPlan = { id: string; date: string; quantities: Record<string, number>; period?: ShiftName | null; preferred_period?: ShiftName | null; address?: ShippingAddressSnapshot; address_mode?: 'primary' | 'specific'; address_id?: string; status?: 'scheduled' | 'preparing' | 'ready' | 'in_delivery' | 'delivered'; status_updated_at?: string };
export type Capacity = Record<string, number>;
export type CapacityLimits = Record<string, number>;
export const productionLimit = (date: string, limits: CapacityLimits = {}) => limits[date] ?? DAILY_CAPACITY;
export function validateCapacityChange(date:string, limit:unknown, committed:number, today=todayInSaoPaulo()) {
  if(!isProductionDate(date,today)) return 'Data inválida';
  if(typeof limit!=='number'||!Number.isInteger(limit)||limit<2||limit>10000) return 'Informe uma capacidade inteira entre 2 e 10.000.';
  if(limit<committed) return 'A capacidade não pode ser menor que as vagas comprometidas.';
  return null;
}
export function todayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function addDateDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function isProductionDate(date: string, today = todayInSaoPaulo()) {
  const d = new Date(`${date}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date && date > today && [1, 3, 5].includes(d.getUTCDay());
}
export function nextAvailableDate(from = addDateDays(todayInSaoPaulo(), 1), capacity: Capacity = {}, quantity = 2, limits: CapacityLimits = {}): string {
  for (let i = 0; i < 730; i++) {
    const date = addDateDays(from, i);
    if (isProductionDate(date) && productionLimit(date, limits) - (capacity[date] || 0) >= quantity) return date;
  }
  return '';
}
export function planCount(plan: DeliveryPlan) { return Object.values(plan.quantities).reduce((a, b) => a + b, 0); }
export function allocated(plans: DeliveryPlan[], id: string) { return plans.reduce((a, p) => a + (p.quantities[id] || 0), 0); }
export function validatePlan(items: Pick<CustomMealSelection, 'tempId' | 'quantity'>[], plans: DeliveryPlan[], capacity: Capacity = {}, requireAll = false, today = todayInSaoPaulo(), limits: CapacityLimits = {}) {
  if (!items.length || items.some(i => !Number.isInteger(i.quantity) || i.quantity < 2 || i.quantity > 10000)) return 'Cada combinação precisa ter pelo menos 2 unidades.';
  if (!plans.length || plans.length > 200) return 'Adicione pelo menos uma entrega (máximo de 200).';
  const dates = new Set<string>();
  for (const plan of plans) {
    if (!isProductionDate(plan.date, today)) return 'Escolha segunda, quarta ou sexta, a partir de amanhã.';
    if (dates.has(plan.date)) return 'Use uma única linha para cada data de entrega.';
    dates.add(plan.date);
    if (!planCount(plan)) return 'Distribua as marmitas em todas as entregas ou remova as linhas vazias.';
    for (const [id, qty] of Object.entries(plan.quantities)) {
      if (!items.some(i => i.tempId === id) || !Number.isInteger(qty) || (qty !== 0 && qty < 2)) return 'Selecione no mínimo 2 unidades de cada sabor por entrega.';
    }
    if (planCount(plan) + (capacity[plan.date] || 0) > productionLimit(plan.date, limits)) return `A produção de ${plan.date.split('-').reverse().join('/')} não comporta essa quantidade. Escolha outra data.`;
  }
  for (const item of items) {
    const remaining = item.quantity - allocated(plans, item.tempId);
    if (remaining < 0) return 'A distribuição ultrapassa a quantidade comprada de um sabor.';
    if (remaining === 1) return 'Não pode sobrar apenas 1 unidade de um sabor. Deixe pelo menos 2 ou agende todas.';
    if (requireAll && remaining) return 'Distribua todas as marmitas para receber tudo em uma entrega.';
  }
  return null;
}
export function capacityFromOrders(orders: Order[]): Capacity {
  const capacity: Capacity = {};
  for (const order of orders) {
    if (!['paid', 'preparing', 'in_delivery', 'delivered'].includes(order.status) && !(order.status === 'pending' && order.reservation_expires_at && new Date(order.reservation_expires_at).getTime() > Date.now())) continue;
    for (const plan of order.deliveries || []) capacity[plan.date] = (capacity[plan.date] || 0) + planCount(plan);
  }
  return capacity;
}
export function productionOrders(orders: Order[]): Order[] {
  return orders.filter(o => ['paid','preparing','in_delivery','delivered'].includes(o.status)).flatMap(o => (o.deliveries || []).map(d => ({ ...o, shipping_address_snapshot: d.address || o.shipping_address_snapshot, delivery_shift: d.period || d.preferred_period || o.profile?.preferred_delivery_period || o.delivery_shift, delivery_date: d.date, quantity_meals: planCount(d), items: (o.items || []).map(i => ({ ...i, quantity: d.quantities[i.id] || 0 })).filter(i => i.quantity > 0) })));
}
export const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const deliveryStatusLabels = {scheduled:'Agendada',preparing:'Em preparo',ready:'Pronta',in_delivery:'A caminho',delivered:'Entregue'};
