'use client';

import { productionOrders } from '@/lib/scheduling';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Calendar,
  ChevronLeft,
  Printer,
  Download,
  ShoppingBag,
  Scale,
  ChefHat,
  Leaf,
  Beef,
  Wheat,
  Sparkles,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { calculateShoppingList } from '@/lib/rules';
import { addDays, format, parseISO, startOfDay, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ShoppingListPage() {
  const { orders: purchases } = useCart();
  const orders = productionOrders(purchases);

  const [filterMode, setFilterMode] = useState<'day' | 'week' | 'all'>('week');
  const [selectedDay, setSelectedDay] = useState(
    format(startOfDay(addDays(new Date(), 5)), 'yyyy-MM-dd')
  );

  // Filtrar pedidos baseado no modo selecionado
  const filteredOrders = orders.filter((order) => {
    if(filterMode!=='all'&&!selectedDay)return false;
    if (order.status === 'cancelled') return false;
    if (!order.delivery_date) return false;

    if (filterMode === 'day') {
      return order.delivery_date === selectedDay;
    }

    if (filterMode === 'week') {
      const orderDate = parseISO(order.delivery_date);
      const weekStart = startOfWeek(parseISO(selectedDay), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(parseISO(selectedDay), { weekStartsOn: 1 });
      return isWithinInterval(orderDate, { start: weekStart, end: weekEnd });
    }

    return true;
  });

  const report = calculateShoppingList(filteredOrders);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#EDE0D4]">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            href="/admin"
            className="shrink-0 p-2 bg-[#F5F0EB] hover:bg-[#EDE0D4] text-[#5C4033] rounded-xl transition"
            title="Voltar ao Painel"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#B94B0B] text-white text-xs font-bold uppercase tracking-wider">
                Ficha Técnica & Compras
              </span>
              <span className="text-xs text-[#8B5A2B] font-semibold">Cálculo de Gramaturas Máximas</span>
            </div>
            <h1 className="text-3xl font-bold font-serif text-[#5C4033] mt-1">
              Lista Consolidada de Ingredientes
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="px-5 py-2.5 bg-[#5C4033] hover:bg-[#3E2723] text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 self-start sm:self-auto"
        >
          <Printer className="w-4 h-4 text-[#DDB892]" />
          Imprimir / Exportar Ficha
        </button>
      </div>

      {/* Controles de Filtro de Período */}
      <div className="rustic-card p-6 bg-white border border-[#EDE0D4] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap bg-[#F5F0EB] p-1.5 rounded-xl border border-[#EDE0D4] self-start">
            <button
              type="button"
              aria-pressed={filterMode==='day'} onClick={() => setFilterMode('day')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                filterMode === 'day'
                  ? 'bg-[#5C4033] text-white shadow-sm'
                  : 'text-[#5C4033] hover:bg-[#EDE0D4]'
              }`}
            >
              Por Dia Específico
            </button>
            <button
              type="button"
              aria-pressed={filterMode==='week'} onClick={() => setFilterMode('week')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                filterMode === 'week'
                  ? 'bg-[#5C4033] text-white shadow-sm'
                  : 'text-[#5C4033] hover:bg-[#EDE0D4]'
              }`}
            >
              Semana Inteira
            </button>
            <button
              type="button"
              aria-pressed={filterMode==='all'} onClick={() => setFilterMode('all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                filterMode === 'all'
                  ? 'bg-[#5C4033] text-white shadow-sm'
                  : 'text-[#5C4033] hover:bg-[#EDE0D4]'
              }`}
            >
              Todas as produções
            </button>
          </div>

          {filterMode !== 'all' && (
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center shrink-0">
              <label className="text-xs font-bold text-[#5C4033] uppercase">Data Base:</label>
              <input
                type="date" aria-label="Data base do relatório"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="field min-w-0 sm:w-auto"
              />
            </div>
          )}
        </div>

        {/* Resumo do Período */}
        <div className="bg-[#FAF6F0] p-4 rounded-xl border border-[#EDE0D4] flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="space-y-0.5">
            <span className="text-[#8B5A2B]">Total de Marmitas Programadas:</span>
            <p className="text-xl font-bold font-serif text-[#B94B0B]">{report.totalMealsCount} marmitas</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[#8B5A2B]">Peso Total Estimado dos Ingredientes:</span>
            <p className="text-xl font-bold font-serif text-[#5C4033]">{report.totalWeightKg} kg</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[#8B5A2B]">Pedidos Considerados:</span>
            <p className="text-xl font-bold font-serif text-[#5C4033]">{filteredOrders.length} pedidos</p>
          </div>
        </div>
      </div>

      {/* RELATÓRIO CONSOLIDADO POR CATEGORIA */}
      {report.totalMealsCount === 0 ? (
        <div className="rustic-card p-12 text-center text-[#8B5A2B]">
          <ShoppingBag className="w-12 h-12 mx-auto text-[#DDB892] mb-3" />
          <h3 className="text-base font-bold text-[#5C4033]">Nenhuma marmita agendada para este período</h3>
          <p className="text-xs mt-1">Selecione outra data ou adicione pedidos para ver a consolidação de compras.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PROTEÍNAS (100g) */}
          <div className="rustic-card p-6 bg-white border border-[#EDE0D4] space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#F5F0EB]">
              <div className="p-2 rounded-xl bg-red-50 text-red-700">
                <Beef className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#5C4033] font-serif">Proteínas & Carnes</h3>
                <span className="text-xs text-[#8B5A2B]">Base: 100g por porção</span>
              </div>
            </div>

            <div className="space-y-2">
              {report.itemsByCategory.protein?.length === 0 ? (
                <p className="text-xs text-[#8B5A2B] italic">Nenhuma proteína personalizada no período.</p>
              ) : (
                report.itemsByCategory.protein?.map((item) => (
                  <div
                    key={item.ingredientId}
                    className="p-3 rounded-xl bg-[#FDFBF7] border border-[#EDE0D4] flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#5C4033]">{item.name}</p>
                      <p className="text-xs text-[#8B5A2B]">{item.portionCount} porções de 100g</p>
                    </div>
                    <span className="text-sm font-extrabold text-[#B94B0B] font-mono">
                      {item.totalKg.toFixed(2)} kg
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* BASES (150g) */}
          <div className="rustic-card p-6 bg-white border border-[#EDE0D4] space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#F5F0EB]">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-800">
                <Wheat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#5C4033] font-serif">Bases & Grãos</h3>
                <span className="text-xs text-[#8B5A2B]">Base: 150g por porção</span>
              </div>
            </div>

            <div className="space-y-2">
              {report.itemsByCategory.base?.length === 0 ? (
                <p className="text-xs text-[#8B5A2B] italic">Nenhuma base no período.</p>
              ) : (
                report.itemsByCategory.base?.map((item) => (
                  <div
                    key={item.ingredientId}
                    className="p-3 rounded-xl bg-[#FDFBF7] border border-[#EDE0D4] flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#5C4033]">{item.name}</p>
                      <p className="text-xs text-[#8B5A2B]">{item.portionCount} porções de 150g</p>
                    </div>
                    <span className="text-sm font-extrabold text-[#5C4033] font-mono">
                      {item.totalKg.toFixed(2)} kg
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LEGUMES & ACOMPANHAMENTOS (80g) */}
          <div className="rustic-card p-6 bg-white border border-[#EDE0D4] space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#F5F0EB]">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
                <Leaf className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#5C4033] font-serif">Legumes, Verduras & Acompanhamentos</h3>
                <span className="text-xs text-[#8B5A2B]">Base: 80g por porção</span>
              </div>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {report.itemsByCategory.side?.length === 0 ? (
                <p className="text-xs text-[#8B5A2B] italic">Nenhum legume no período.</p>
              ) : (
                report.itemsByCategory.side?.map((item) => (
                  <div
                    key={item.ingredientId}
                    className="p-3 rounded-xl bg-[#FDFBF7] border border-[#EDE0D4] flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#5C4033]">{item.name}</p>
                      <p className="text-xs text-[#8B5A2B]">{item.portionCount} porções de 80g</p>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-800 font-mono">
                      {item.totalKg.toFixed(2)} kg
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* PRATOS COMPLETOS (400g) */}
          <div className="rustic-card p-6 bg-white border border-[#EDE0D4] space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#F5F0EB]">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-800">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#5C4033] font-serif">Pratos Completos da Vila</h3>
                <span className="text-xs text-[#8B5A2B]">Base: ~400g por unidade</span>
              </div>
            </div>

            <div className="space-y-2">
              {report.itemsByCategory.complete_dish?.length === 0 ? (
                <p className="text-xs text-[#8B5A2B] italic">Nenhum prato completo solicitado no período.</p>
              ) : (
                report.itemsByCategory.complete_dish?.map((item) => (
                  <div
                    key={item.ingredientId}
                    className="p-3 rounded-xl bg-[#FDFBF7] border border-[#EDE0D4] flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#5C4033]">{item.name}</p>
                      <p className="text-xs text-[#8B5A2B]">Marmita completa de ~400g</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-purple-900 font-serif block">
                        {item.portionCount} un
                      </span>
                      <span className="text-xs text-[#8B5A2B]">({item.totalKg.toFixed(2)} kg)</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
