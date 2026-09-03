import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  MapPin,
  User as UserIcon,
  Layers,
  ArrowLeftRight
} from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';

interface WorkOrder {
  id: string;
  workOrderNumber: string;
  locationId: string;
  location: {
    id: string;
    code: string;
    name: string;
  };
  itemId: string;
  item: {
    id: string;
    sku: string;
    name: string;
    uom: string;
  };
  requiredQuantity: number;
  availableAtLocation: number;
  shortage: number;
  hasShortage: boolean;
  alternativeLocations: Array<{
    locationId: string;
    locationName: string;
    availableQuantity: number;
  }>;
  assignedUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: string;
}

export const WorkOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [requiredQuantity, setRequiredQuantity] = useState<number>(100);
  const [assignedUserId, setAssignedUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const [woRes, locRes, itemRes, userRes] = await Promise.all([
        api.get('/work-orders'),
        api.get('/inventory/locations'),
        api.get('/inventory/items'),
        api.get('/auth/users')
      ]);

      setWorkOrders(woRes.data.data);
      setLocations(locRes.data.data);
      setItems(itemRes.data.data);
      setUsersList(userRes.data.data);

      if (locRes.data.data.length > 0 && !selectedLocationId) {
        setSelectedLocationId(locRes.data.data[0].id);
      }
      if (itemRes.data.data.length > 0 && !selectedItemId) {
        setSelectedItemId(itemRes.data.data[0].id);
      }
      if (userRes.data.data.length > 0 && !assignedUserId) {
        setAssignedUserId(userRes.data.data[0].id);
      }

      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api.post('/work-orders', {
        locationId: selectedLocationId,
        itemId: selectedItemId,
        requiredQuantity: Number(requiredQuantity),
        assignedUserId: assignedUserId
      });

      setCreateModalOpen(false);
      await fetchWorkOrders();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create work order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (
    id: string,
    newStatus: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED'
  ) => {
    try {
      await api.patch(`/work-orders/${id}/status`, { status: newStatus });
      await fetchWorkOrders();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update status');
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 mr-1" /> Assigned
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
            <Layers className="w-3 h-3 mr-1" /> In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Work Orders & Stock Check</h1>
          <p className="text-sm text-slate-500">
            Create production work orders with automated shortage calculations
          </p>
        </div>

        {isAdmin ? (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Work Order
          </button>
        ) : (
          <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg border border-slate-200">
            Work Order creation restricted to <strong>Admin</strong>
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Work Orders List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Work Order ID</th>
                <th className="px-6 py-3.5">Item Required</th>
                <th className="px-6 py-3.5">Location</th>
                <th className="px-6 py-3.5 text-right">Required</th>
                <th className="px-6 py-3.5 text-right">Available at Location</th>
                <th className="px-6 py-3.5 text-center">Shortage Status</th>
                <th className="px-6 py-3.5">Assigned To</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    Loading work orders...
                  </td>
                </tr>
              ) : workOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    No work orders found. Click "Create Work Order" to create one.
                  </td>
                </tr>
              ) : (
                workOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">
                      {wo.workOrderNumber}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{wo.item.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{wo.item.sku}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      <div className="flex items-center space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{wo.location.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-800">
                      {wo.requiredQuantity} {wo.item.uom}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-600">
                      {wo.availableAtLocation} {wo.item.uom}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {wo.hasShortage ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                            Shortage: {wo.shortage} {wo.item.uom}
                          </span>
                          {wo.alternativeLocations && wo.alternativeLocations.length > 0 && (
                            <button
                              onClick={() => navigate('/transfers')}
                              className="mt-1 text-[11px] text-sky-700 hover:underline font-semibold flex items-center"
                            >
                              Available at {wo.alternativeLocations[0].locationName}{' '}
                              <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Sufficient Stock
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      <div className="flex items-center space-x-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{wo.assignedUser?.name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{statusBadge(wo.status)}</td>
                    <td className="px-6 py-4 text-center">
                      {wo.status !== 'COMPLETED' && (
                        <select
                          value={wo.status}
                          onChange={(e) =>
                            handleStatusChange(
                              wo.id,
                              e.target.value as 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED'
                            )
                          }
                          className="px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-700 focus:outline-none"
                        >
                          <option value="ASSIGNED">Assigned</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Work Order Modal (Admin Only) */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Create Work Order
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Allocate materials to a production work order. The system will automatically check stock and calculate shortage.
            </p>

            <form onSubmit={handleCreateWorkOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Location *
                </label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Required Material / Item *
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Required Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={requiredQuantity}
                  onChange={(e) => setRequiredQuantity(Number(e.target.value))}
                  placeholder="e.g. 100"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Assign User *
                </label>
                <select
                  value={assignedUserId}
                  onChange={(e) => setAssignedUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create & Check Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
