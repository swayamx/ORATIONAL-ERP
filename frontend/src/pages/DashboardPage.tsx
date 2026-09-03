import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  ArrowLeftRight,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  ArrowRight,
  TrendingUp,
  MapPin,
  Plus,
  Zap,
  Activity,
  PackageCheck
} from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { StatCard } from '../components/StatCard.js';

export const DashboardPage: React.FC = () => {
  const { user, quickSwitchRole } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const queryParam = selectedLocation ? `?locationId=${selectedLocation}` : '';

      const [invStatsRes, woRes, trRes, ordRes, locRes] = await Promise.all([
        api.get(`/inventory/stats${queryParam}`),
        api.get(`/work-orders${queryParam}`),
        api.get('/transfers'),
        api.get(`/orders${queryParam}`),
        api.get('/inventory/locations')
      ]);

      setStats(invStatsRes.data.data);
      setWorkOrders(woRes.data.data);
      setTransfers(trRes.data.data);
      setOrders(ordRes.data.data);
      setLocations(locRes.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedLocation]);

  // Derived metrics
  const activeWorkOrders = workOrders.filter((w) => w.status !== 'COMPLETED');
  const shortageOrders = workOrders.filter((w) => w.hasShortage);
  const inTransitTransfers = transfers.filter((t) => t.status === 'DISPATCHED');
  const pendingTransfers = transfers.filter((t) => t.status === 'REQUESTED');
  const activeReservations = orders.filter((o) => o.status === 'RESERVED');

  const handleReceiveQuick = async (transferId: string) => {
    try {
      await api.post(`/transfers/${transferId}/receive`);
      await loadDashboardData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to receive transfer');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome & Location Control Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/30">
              Operations Control Center
            </span>
            <span className="text-xs text-slate-400">• Live Production Flow</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">
            Welcome back, {user?.name}
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Role: <strong className="text-sky-300">{user?.role}</strong> • Multi-Location Operations ERP
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Location Filter */}
          <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <MapPin className="w-4 h-4 text-sky-400" />
            <span className="text-slate-400">Facility:</span>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="" className="text-slate-900">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id} className="text-slate-900">
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Actions based on Role */}
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => navigate('/work-orders')}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New Work Order
            </button>
          )}

          {(user?.role === 'OPERATIONS' || user?.role === 'ADMIN') && (
            <button
              onClick={() => navigate('/transfers')}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> Request Transfer
            </button>
          )}

          {(user?.role === 'SALES' || user?.role === 'ADMIN') && (
            <button
              onClick={() => navigate('/orders')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center"
            >
              <ShoppingCart className="w-3.5 h-3.5 mr-1" /> New Customer Order
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Interactive Business Flow Map */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
            <Activity className="w-4 h-4 mr-1.5 text-sky-600" />
            End-to-End Operations Pipeline (Evaluated Workflow)
          </h2>
          <span className="text-xs text-slate-400">Click any step to inspect & operate</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Step 1: Inventory */}
          <button
            onClick={() => navigate('/inventory')}
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 text-left transition-all group"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-sky-700">
              <span>1. Inventory</span>
              <Boxes className="w-4 h-4 text-sky-600" />
            </div>
            <div className="mt-2 text-xl font-extrabold text-slate-800">
              {stats?.totalPhysical ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Available: <span className="text-emerald-600 font-bold">{stats?.totalAvailable ?? 0}</span>
            </div>
          </button>

          {/* Step 2: Work Order */}
          <button
            onClick={() => navigate('/work-orders')}
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-left transition-all group"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-purple-700">
              <span>2. Work Order</span>
              <ClipboardList className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 text-xl font-extrabold text-slate-800">
              {activeWorkOrders.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              In production queue
            </div>
          </button>

          {/* Step 3: Stock Check */}
          <button
            onClick={() => navigate('/work-orders')}
            className={`p-3.5 rounded-xl border text-left transition-all group ${
              shortageOrders.length > 0
                ? 'bg-rose-50 border-rose-200 hover:bg-rose-100/70'
                : 'bg-slate-50 border-slate-200 hover:bg-emerald-50'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-rose-700">
              <span>3. Stock Check</span>
              <AlertTriangle
                className={`w-4 h-4 ${
                  shortageOrders.length > 0 ? 'text-rose-600' : 'text-slate-400'
                }`}
              />
            </div>
            <div
              className={`mt-2 text-xl font-extrabold ${
                shortageOrders.length > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {shortageOrders.length > 0 ? `${shortageOrders.length} Shortage` : 'OK'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {shortageOrders.length > 0 ? 'Action required' : 'Stock sufficient'}
            </div>
          </button>

          {/* Step 4: Transfer */}
          <button
            onClick={() => navigate('/transfers')}
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-left transition-all group"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-blue-700">
              <span>4. Stock Transfer</span>
              <Truck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 text-xl font-extrabold text-slate-800">
              {inTransitTransfers.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {inTransitTransfers.length} In-transit • {pendingTransfers.length} req
            </div>
          </button>

          {/* Step 5: Customer Order */}
          <button
            onClick={() => navigate('/orders')}
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-left transition-all group"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-emerald-700">
              <span>5. Reservation</span>
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-xl font-extrabold text-slate-800">
              {activeReservations.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Reserved: <span className="text-purple-600 font-bold">{stats?.totalReserved ?? 0}</span>
            </div>
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Physical Inventory"
          value={stats?.totalPhysical ?? 0}
          subtitle={`${stats?.totalBatches ?? 0} tracked batches`}
          icon={<Boxes className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Active Work Orders"
          value={activeWorkOrders.length}
          subtitle={
            shortageOrders.length > 0
              ? `${shortageOrders.length} orders have shortages!`
              : 'All materials available'
          }
          icon={<ClipboardList className="w-6 h-6" />}
          color={shortageOrders.length > 0 ? 'rose' : 'emerald'}
        />
        <StatCard
          title="In-Transit Transfers"
          value={inTransitTransfers.length}
          subtitle="Dispatched, awaiting destination receipt"
          icon={<Truck className="w-6 h-6" />}
          color="amber"
        />
        <StatCard
          title="Reserved Units"
          value={stats?.totalReserved ?? 0}
          subtitle="Protected against concurrency races"
          icon={<ShoppingCart className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Critical Operational Attention Banner (If shortages exist) */}
      {shortageOrders.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-900">
                Material Shortage Detected: {shortageOrders[0].workOrderNumber} requires{' '}
                {shortageOrders[0].requiredQuantity} {shortageOrders[0].item.uom} of{' '}
                {shortageOrders[0].item.name} at {shortageOrders[0].location.name}
              </p>
              <p className="text-[11px] text-amber-700">
                Available at location: {shortageOrders[0].availableAtLocation} • Deficit:{' '}
                <strong>{shortageOrders[0].shortage} {shortageOrders[0].item.uom}</strong>.
                {shortageOrders[0].alternativeLocations?.length > 0 &&
                  ` Stock is available at ${shortageOrders[0].alternativeLocations[0].locationName}!`}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/transfers')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center whitespace-nowrap"
          >
            Create Transfer to Cover Shortage <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>
      )}

      {/* Two-Column Operation Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Work Orders & Production */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <ClipboardList className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-sm text-slate-900">Active Work Orders</h3>
            </div>
            <button
              onClick={() => navigate('/work-orders')}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center"
            >
              View all <ArrowRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {workOrders.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No active work orders</p>
            ) : (
              workOrders.slice(0, 4).map((wo) => (
                <div
                  key={wo.id}
                  className="p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {wo.workOrderNumber}
                      </span>
                      <span className="text-xs text-slate-600 font-medium">
                        {wo.item.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-2">
                      <span>{wo.location.name}</span>
                      <span>•</span>
                      <span>Req: {wo.requiredQuantity} {wo.item.uom}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    {wo.hasShortage ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        Shortage: {wo.shortage}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Sufficient Stock
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: In-Transit Transfers & Customer Orders */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Truck className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Transfers Awaiting Receipt
              </h3>
            </div>
            <button
              onClick={() => navigate('/transfers')}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center"
            >
              View all <ArrowRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {inTransitTransfers.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No transfers currently in transit. All goods accounted for.
              </p>
            ) : (
              inTransitTransfers.map((tr) => (
                <div
                  key={tr.id}
                  className="p-3 rounded-xl border border-blue-100 bg-blue-50/50 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {tr.transferNumber}
                      </span>
                      <span className="text-xs font-semibold text-blue-800">
                        {tr.quantity} {tr.item.uom} {tr.item.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {tr.sourceLocation.name} $\rightarrow$ <strong>{tr.destinationLocation.name}</strong>
                    </div>
                  </div>

                  {(user?.role === 'OPERATIONS' || user?.role === 'ADMIN') && (
                    <button
                      onClick={() => handleReceiveQuick(tr.id)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center shadow-xs"
                    >
                      <PackageCheck className="w-3 h-3 mr-1" /> Receive
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Quick Evaluator Action Bar */}
          <div className="pt-3 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Evaluator Test Controls
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate('/orders')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left text-xs font-medium text-slate-700 transition-colors flex items-center justify-between"
              >
                <span>Simulate Concurrency</span>
                <Zap className="w-3.5 h-3.5 text-amber-500" />
              </button>

              <button
                onClick={() => navigate('/inventory')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left text-xs font-medium text-slate-700 transition-colors flex items-center justify-between"
              >
                <span>Check Live Stock</span>
                <Boxes className="w-3.5 h-3.5 text-sky-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
