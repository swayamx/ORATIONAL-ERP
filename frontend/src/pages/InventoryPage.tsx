import React, { useState, useEffect } from 'react';
import {
  Boxes,
  MapPin,
  Tag,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  SlidersHorizontal,
  Layers,
  History
} from 'lucide-react';
import api from '../services/api.js';
import { StatCard } from '../components/StatCard.js';
import { useAuth } from '../context/AuthContext.js';

interface InventoryItem {
  id: string;
  itemId: string;
  item: {
    id: string;
    sku: string;
    name: string;
    category: string;
    uom: string;
  };
  locationId: string;
  location: {
    id: string;
    code: string;
    name: string;
  };
  batchNumber: string;
  physicalQuantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  availableQuantity: number;
  updatedAt: string;
}

interface LocationOption {
  id: string;
  code: string;
  name: string;
}

export const InventoryPage: React.FC = () => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Stock Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<InventoryItem | null>(null);
  const [physicalDelta, setPhysicalDelta] = useState<number>(0);
  const [damagedDelta, setDamagedDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedLocation) params.append('locationId', selectedLocation);
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);

      const [invRes, locRes] = await Promise.all([
        api.get(`/inventory?${params.toString()}`),
        api.get('/inventory/locations')
      ]);

      setInventory(invRes.data.data);
      setLocations(locRes.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedLocation, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInventory();
  };

  const handleOpenAdjust = (item: InventoryItem) => {
    setSelectedRecord(item);
    setPhysicalDelta(0);
    setDamagedDelta(0);
    setAdjustReason('');
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setAdjustSubmitting(true);
    setError(null);

    try {
      await api.post('/inventory/adjust', {
        inventoryId: selectedRecord.id,
        physicalDelta: Number(physicalDelta),
        damagedDelta: Number(damagedDelta),
        reason: adjustReason
      });
      setAdjustModalOpen(false);
      await fetchInventory();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to apply adjustment');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Aggregated totals
  const totalPhysical = inventory.reduce((s, i) => s + i.physicalQuantity, 0);
  const totalReserved = inventory.reduce((s, i) => s + i.reservedQuantity, 0);
  const totalDamaged = inventory.reduce((s, i) => s + i.damagedQuantity, 0);
  const totalAvailable = inventory.reduce((s, i) => s + i.availableQuantity, 0);

  const canManageInventory = user?.role === 'ADMIN' || user?.role === 'OPERATIONS';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Management</h1>
          <p className="text-sm text-slate-500">
            Real-time multi-location physical, reserved, damaged, and available quantities
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchInventory}
            className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Physical Stock"
          value={totalPhysical}
          subtitle="Total on warehouse floor"
          icon={<Boxes className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Reserved Stock"
          value={totalReserved}
          subtitle="Committed to customer orders"
          icon={<Layers className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          title="Damaged Stock"
          value={totalDamaged}
          subtitle="Quarantined / non-usable"
          icon={<AlertTriangle className="w-6 h-6" />}
          color="amber"
        />
        <StatCard
          title="Available Stock"
          value={totalAvailable}
          subtitle="Physical - Reserved - Damaged"
          icon={<Tag className="w-6 h-6" />}
          color="emerald"
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search by SKU, item name, or batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Location Filter */}
          <div className="flex items-center space-x-1.5">
            <MapPin className="w-4 h-4 text-slate-400" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-1.5">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Categories</option>
              <option value="RAW_MATERIAL">Raw Material</option>
              <option value="COMPONENT">Component</option>
              <option value="FINISHED_GOOD">Finished Good</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Item & SKU</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Location</th>
                <th className="px-6 py-3.5">Batch</th>
                <th className="px-6 py-3.5 text-right">Physical</th>
                <th className="px-6 py-3.5 text-right">Reserved</th>
                <th className="px-6 py-3.5 text-right">Damaged</th>
                <th className="px-6 py-3.5 text-right">Available</th>
                {canManageInventory && <th className="px-6 py-3.5 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    Loading inventory records...
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    No inventory records match the selected filters.
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{item.item.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{item.item.sku}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {item.item.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      <div className="flex items-center space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.location.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">
                      {item.batchNumber}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-800">
                      {item.physicalQuantity} {item.item.uom}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-purple-700">
                      {item.reservedQuantity} {item.item.uom}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-amber-700">
                      {item.damagedQuantity} {item.item.uom}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                          item.availableQuantity === 0
                            ? 'bg-rose-100 text-rose-800'
                            : item.availableQuantity < 30
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.availableQuantity} {item.item.uom}
                      </span>
                    </td>
                    {canManageInventory && (
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleOpenAdjust(item)}
                          className="px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 rounded border border-sky-200 transition-colors"
                        >
                          Adjust / Damage
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust / Damaged Stock Modal */}
      {adjustModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Adjust Inventory Stock
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {selectedRecord.item.name} ({selectedRecord.location.name} • {selectedRecord.batchNumber})
            </p>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
                <div>
                  <span className="text-slate-500 block">Current Physical:</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {selectedRecord.physicalQuantity} {selectedRecord.item.uom}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Current Available:</span>
                  <span className="font-bold text-emerald-600 text-sm">
                    {selectedRecord.availableQuantity} {selectedRecord.item.uom}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Physical Delta (+ / -)
                </label>
                <input
                  type="number"
                  value={physicalDelta}
                  onChange={(e) => setPhysicalDelta(Number(e.target.value))}
                  placeholder="e.g. 10 or -5"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400">
                  Positive to receive new stock, negative to write off.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Damaged Stock Delta (+ / -)
                </label>
                <input
                  type="number"
                  value={damagedDelta}
                  onChange={(e) => setDamagedDelta(Number(e.target.value))}
                  placeholder="e.g. 5"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400">
                  Damaged units automatically reduce available stock.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Adjustment *
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Warehouse intake or damaged during forklift movement"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {adjustSubmitting ? 'Saving...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
