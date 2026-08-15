import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Store, Bell, Search, User as UserIcon, LogOut, Shield, ChevronDown, Check, Calendar, Phone, MessageSquare, AlertCircle, Clock } from 'lucide-react';
import { apiRequest } from '../../api/client';

interface HeaderProps {
  onSearchSelect?: (item: any) => void;
  onOpenNotifications?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNotifications }) => {
  const { user, stores, activeStoreId, setActiveStoreId, logout } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifSummary, setNotifSummary] = useState<any>(null);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const loadNotifs = async () => {
    try {
      const res = await apiRequest('/api/notifications');
      setNotifications(res.notifications || []);
      setNotifSummary(res.summary || null);
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    if (user) loadNotifs();
  }, [user, activeStoreId]);

  const handleGlobalSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val || val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await apiRequest(`/api/products?search=${encodeURIComponent(val)}`);
      setSearchResults(res.products?.slice(0, 5) || []);
    } catch (err) {
      setSearchResults([]);
    }
  };

  const activeStore = stores.find(s => s.id === activeStoreId) || { name: 'Hubballi Main Hub', code: 'HUB01' };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-slate-100 z-30 sticky top-0 shadow-md">
      {/* Search Bar */}
      <div className="relative w-80 max-w-xs md:max-w-md">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400" />
          <input
            type="text"
            placeholder="Global search (Product, Barcode, Customer)..."
            value={searchQuery}
            onChange={(e) => handleGlobalSearch(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden text-sm">
            {searchResults.map((p) => (
              <div
                key={p.id}
                className="p-2.5 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0 flex items-center justify-between"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <div>
                  <div className="font-medium text-emerald-400">{p.name}</div>
                  <div className="text-xs text-slate-400">SKU: {p.sku} | Barcode: {p.primary_barcode}</div>
                </div>
                <div className="text-right font-semibold text-slate-200">₹{p.selling_price}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-4">
        {/* Single Store Indicator */}
        <div className="flex items-center space-x-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-lg text-sm">
          <Store className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-200">Shri Revanasiddeshwara Agro Center, Kalaghatagi</span>
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifDropdown(!showNotifDropdown);
              loadNotifs();
            }}
            className="relative p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors"
            title="System Alerts & Udhaar Payment Reminders"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-bold text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center animate-pulse">
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div className="absolute right-0 mt-2 w-80 md:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden text-sm">
              <div className="p-3.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-slate-100">Udhaar Payment Promises</span>
                </div>
                <span className="bg-amber-500/10 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                  {notifications.length} Alerts
                </span>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 space-y-1">
                    <Check className="w-8 h-8 text-emerald-400 mx-auto opacity-80" />
                    <p className="text-xs font-medium text-slate-300">No pending payment promise dates due today!</p>
                    <p className="text-[10px] text-slate-500">All customer credit commitments are up to date.</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const isOverdue = n.type === 'credit_overdue';
                    const isToday = n.type === 'credit_due_today';
                    const cleanMobile = (n.customer_mobile || '').replace(/\D/g, '');

                    return (
                      <div
                        key={n.id}
                        className={`p-3 transition-colors ${
                          isOverdue ? 'bg-rose-950/20 hover:bg-rose-900/30' : isToday ? 'bg-amber-950/20 hover:bg-amber-900/30' : 'hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start space-x-2">
                            {isOverdue ? (
                              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            ) : isToday ? (
                              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
                            ) : (
                              <Calendar className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <span className={`text-xs font-bold ${isOverdue ? 'text-rose-400' : isToday ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {n.title}
                                </span>
                                <span className="text-[10px] text-slate-400">({n.invoice_number})</span>
                              </div>
                              <p className="text-xs text-slate-200 mt-0.5 font-medium">{n.message}</p>
                              <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-2">
                                <span>Promised Date: <strong className="text-slate-200">{n.due_date}</strong></span>
                                <span>•</span>
                                <span className="font-bold text-amber-300">₹{n.balance_due?.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Direct Contact Actions */}
                        {n.customer_mobile && (
                          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-end space-x-2 text-[11px]">
                            <a
                              href={`tel:${n.customer_mobile}`}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-md flex items-center space-x-1 font-medium"
                            >
                              <Phone className="w-3 h-3 text-emerald-400" />
                              <span>Call {n.customer_mobile}</span>
                            </a>
                            <a
                              href={`https://wa.me/91${cleanMobile}?text=${encodeURIComponent(`Namaste ${n.customer_name}, this is a gentle reminder from Shri Revanasiddeshwara Agro Center regarding payment of ₹${n.balance_due} for Invoice #${n.invoice_number} promised on ${n.due_date}. Thank you!`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-md flex items-center space-x-1 font-medium"
                            >
                              <MessageSquare className="w-3 h-3 text-emerald-400" />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-2.5 bg-slate-800/80 border-t border-slate-700 text-center">
                <button
                  onClick={() => setShowNotifDropdown(false)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Close Reminders
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 pl-2 pr-3 py-1 rounded-lg transition-colors"
          >
            <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center font-bold text-xs text-white">
              {user ? user.name.charAt(0) : 'A'}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-xs font-semibold text-slate-100">{user ? user.name : 'Shri. Ramesh'}</div>
              <div className="text-[10px] text-emerald-400 font-medium">{user ? user.roleName : 'Super Admin'}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showProfileDropdown && (
            <div className="absolute right-0 mt-1.5 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 text-sm">
              <div className="px-3 py-2 border-b border-slate-700">
                <div className="font-semibold text-slate-100">{user?.name}</div>
                <div className="text-xs text-slate-400">@{user?.username} ({user?.roleName})</div>
              </div>
              <div className="px-3 py-2 text-xs text-slate-400 flex items-center space-x-1 border-b border-slate-700">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>RBAC Active | {user?.permissions.length || 24} Perms</span>
              </div>
              <button
                onClick={logout}
                className="w-full text-left px-3 py-2 text-rose-400 hover:bg-slate-700/80 flex items-center space-x-2 font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
