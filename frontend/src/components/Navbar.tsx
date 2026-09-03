import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  ArrowLeftRight,
  ShoppingCart,
  LogOut,
  UserCheck,
  ShieldAlert,
  Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const Navbar: React.FC = () => {
  const { user, logout, quickSwitchRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Inventory', path: '/inventory', icon: Boxes },
    { name: 'Work Orders', path: '/work-orders', icon: ClipboardList },
    { name: 'Internal Transfers', path: '/transfers', icon: ArrowLeftRight },
    { name: 'Customer Orders', path: '/orders', icon: ShoppingCart }
  ];

  const roleBadgeColors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
    OPERATIONS: 'bg-blue-100 text-blue-800 border-blue-200',
    SALES: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-sm font-bold text-lg">
              OP
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base leading-none block">
                Mini Operations ERP
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Multi-Location Enterprise Flow
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sky-50 text-sky-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User Profile & 1-Click Role Switcher */}
          <div className="flex items-center space-x-3">
            {user && (
              <div className="flex items-center space-x-2">
                {/* 1-Click Quick Demo Switcher */}
                <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                  <span className="px-2 font-medium text-slate-500 flex items-center">
                    Switch:
                  </span>
                  <button
                    onClick={() => quickSwitchRole('ADMIN')}
                    className={`px-2 py-1 rounded font-medium transition-all ${
                      user.role === 'ADMIN'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Admin
                  </button>
                  <button
                    onClick={() => quickSwitchRole('OPERATIONS')}
                    className={`px-2 py-1 rounded font-medium transition-all ${
                      user.role === 'OPERATIONS'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Ops
                  </button>
                  <button
                    onClick={() => quickSwitchRole('SALES')}
                    className={`px-2 py-1 rounded font-medium transition-all ${
                      user.role === 'SALES'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Sales
                  </button>
                </div>

                {/* Active Role Badge */}
                <span
                  className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                    roleBadgeColors[user.role] || 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {user.role}
                </span>

                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-slate-800 leading-tight">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {user.email}
                  </p>
                </div>

                <button
                  onClick={handleLogout}
                  title="Log out"
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-slate-200 px-4 py-2 flex justify-around bg-slate-50">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `p-2 rounded-md ${
                  isActive ? 'text-sky-600 font-bold' : 'text-slate-600'
                }`
              }
            >
              <Icon className="w-5 h-5" />
            </NavLink>
          );
        })}
      </div>
    </header>
  );
};
