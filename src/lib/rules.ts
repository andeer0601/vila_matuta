import { isProductionDate, nextAvailableDate } from '@/lib/scheduling';
import { format, addDays, isBefore, startOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Order, OrderItem } from '@/types/database';

/**
 * TABELA DE VALORES PROGRESSIVOS POR QUANTIDADE
 * - Kit 10: R$ 180,00 (R$ 18,00 / un)
 * - Kit 20: R$ 320,00 (R$ 16,00 / un)
 * - Kit 30: R$ 450,00 (R$ 15,00 / un)
 * - Acima de 30 unidades: R$ 14,00 fixo por refeição
 */
export function calculateVolumePrice(quantity: number): {
  totalPrice: number;
  unitPrice: number;
  savingsTotal: number;
} {
  if (quantity <= 0) {
    return { totalPrice: 0, unitPrice: 0, savingsTotal: 0 };
  }

  const basePricePerMeal = 18.0; // Preço base unitário de referência
  let totalPrice = 0;

  if (quantity <= 10) {
    // 1 a 10 marmitas: R$ 18,00 por unidade
    totalPrice = quantity * 18.0;
  } else if (quantity <= 20) {
    // De 11 a 20: R$ 180,00 para as primeiras 10 + R$ 14,00 por unidade adicional (20 = R$ 320,00)
    totalPrice = 180.0 + (quantity - 10) * 14.0;
  } else if (quantity <= 30) {
    // De 21 a 30: R$ 320,00 para as primeiras 20 + R$ 13,00 por unidade adicional (30 = R$ 450,00)
    totalPrice = 320.0 + (quantity - 20) * 13.0;
  } else {
    // Acima de 30 marmitas: R$ 14,00 por refeição fixo
    totalPrice = quantity * 14.0;
  }

  const unitPrice = Number((totalPrice / quantity).toFixed(2));
  const fullPriceReference = quantity * basePricePerMeal;
  const savingsTotal = Math.max(0, Number((fullPriceReference - totalPrice).toFixed(2)));

  return {
    totalPrice: Number(totalPrice.toFixed(2)),
    unitPrice,
    savingsTotal,
  };
}

export function getMinimumDeliveryDate(_isAdmin = false): Date {
  return new Date(nextAvailableDate() + 'T12:00:00');
}
export function isDeliveryDateValid(dateString: string, _isAdmin = false) {
  const isValid = isProductionDate(dateString);
  return { isValid, minDateString: nextAvailableDate(), message: isValid ? undefined : 'Escolha segunda, quarta ou sexta, a partir de amanhã.' };
}

/**
 * FORMATAÇÃO DE ENDEREÇO PARA DESPACHO RÁPIDO (UBER FLASH / 99 ENTREGA)
 */
export function formatAddressForDeliveryDispatch(order: Order): string {
  const addr = order.shipping_address_snapshot;
  const profile = order.profile;
  const customerName = addr?.recipient_name || profile?.full_name || 'Cliente Vila Matuta';
  const customerPhone = addr?.recipient_phone || profile?.phone || 'Não informado';

  let text = `📦 VILA MATUTA - ENTREGA #${order.id.slice(0, 8).toUpperCase()}\n`;
  text += `👤 Cliente: ${customerName}\n`;
  text += `📱 Telefone: ${customerPhone}\n`;

  if (addr) {
    text += `📍 Endereço: ${addr.street}, ${addr.number}`;
    if (addr.complement) text += ` (${addr.complement})`;
    text += ` - ${addr.neighborhood}, ${addr.city}/${addr.state}\n`;
    text += `📮 CEP: ${addr.cep}\n`;
  } else if (profile?.street) {
    text += `📍 Endereço: ${profile.street}, ${profile.number || 'S/N'}`;
    if (profile.complement) text += ` (${profile.complement})`;
    text += ` - ${profile.neighborhood || ''}, ${profile.city || ''}/${profile.state || 'SP'}\n`;
    text += `📮 CEP: ${profile.cep || ''}\n`;
  }

  text += `🍱 Qtd Marmitas: ${order.quantity_meals} un\n`;
  if (order.delivery_shift) text += `⏰ Turno: ${order.delivery_shift}\n`;

  if (profile?.dietary_restrictions && profile.dietary_restrictions.length > 0) {
    text += `⚠️ RESTRIÇÕES ALIMENTARES: ${profile.dietary_restrictions.join(', ')}\n`;
  }

  if (order.notes) {
    text += `📝 Obs: ${order.notes}\n`;
  }

  return text;
}

/**
 * CONSOLIDAÇÃO DA LISTA DE COMPRAS (FICHA TÉCNICA)
 * Gramaturas máximas por categoria:
 * - Base: 150g
 * - Proteína: 100g
 * - Legumes / Acompanhamentos: 80g
 * - Prato Completo: 400g
 */
export interface ConsolidatedShoppingItem {
  ingredientId: string;
  name: string;
  category: 'base' | 'protein' | 'side' | 'complete_dish';
  totalGrams: number;
  totalKg: number;
  portionCount: number;
  standardPortionGrams: number;
}

export function calculateShoppingList(orders: Order[]): {
  itemsByCategory: Record<string, ConsolidatedShoppingItem[]>;
  totalMealsCount: number;
  totalWeightKg: number;
} {
  const itemsMap = new Map<string, ConsolidatedShoppingItem>();
  let totalMealsCount = 0;

  for (const order of orders) {
    if (!['paid', 'preparing', 'in_delivery', 'delivered'].includes(order.status)) continue;

    const items = order.items || [];
    for (const item of items) {
      const qty = item.quantity || 1;
      totalMealsCount += qty;

      if (item.item_type === 'complete_dish' && item.complete_dish) {
        const d = item.complete_dish;
        const portion = d.portion_grams || 400;
        accumulateItem(itemsMap, d.id, d.name, 'complete_dish', portion, qty);
      } else {
        if (item.base) {
          accumulateItem(itemsMap, item.base.id, item.base.name, 'base', item.base.portion_grams || 150, qty);
        }
        if (item.protein) {
          accumulateItem(itemsMap, item.protein.id, item.protein.name, 'protein', item.protein.portion_grams || 100, qty);
        }
        if (item.side1) {
          accumulateItem(itemsMap, item.side1.id, item.side1.name, 'side', item.side1.portion_grams || 80, qty);
        }
        if (item.side2) {
          accumulateItem(itemsMap, item.side2.id, item.side2.name, 'side', item.side2.portion_grams || 80, qty);
        }
      }
    }
  }

  const itemsByCategory: Record<string, ConsolidatedShoppingItem[]> = {
    base: [],
    protein: [],
    side: [],
    complete_dish: [],
  };

  let totalGramsAll = 0;

  for (const item of Array.from(itemsMap.values())) {
    itemsByCategory[item.category]?.push(item);
    totalGramsAll += item.totalGrams;
  }

  // Ordenar itens por peso decrescente dentro de cada categoria
  for (const cat in itemsByCategory) {
    itemsByCategory[cat].sort((a, b) => b.totalGrams - a.totalGrams);
  }

  return {
    itemsByCategory,
    totalMealsCount,
    totalWeightKg: Number((totalGramsAll / 1000).toFixed(2)),
  };
}

function accumulateItem(
  map: Map<string, ConsolidatedShoppingItem>,
  id: string,
  name: string,
  category: 'base' | 'protein' | 'side' | 'complete_dish',
  portionGrams: number,
  quantity: number
) {
  const existing = map.get(id);
  if (existing) {
    existing.portionCount += quantity;
    existing.totalGrams += portionGrams * quantity;
    existing.totalKg = Number((existing.totalGrams / 1000).toFixed(3));
  } else {
    const totalGrams = portionGrams * quantity;
    map.set(id, {
      ingredientId: id,
      name,
      category,
      standardPortionGrams: portionGrams,
      portionCount: quantity,
      totalGrams,
      totalKg: Number((totalGrams / 1000).toFixed(3)),
    });
  }
}

/**
 * FORMATAÇÃO DE TELEFONE BRASILEIRO (99) 99999-9999
 */
export function formatBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * FORMATAÇÃO DE CEP BRASILEIRO 00000-000
 */
export function formatBrazilianCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}
