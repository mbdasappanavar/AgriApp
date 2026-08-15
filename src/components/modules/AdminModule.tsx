import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import {
  Settings, Shield, Users, Database, Download, Upload, Plus, Edit2,
  Building2, CheckCircle2, AlertTriangle, RefreshCw, Search,
  X, Check, Lock, Store, FileSpreadsheet, Eye, UserPlus, Save
} from 'lucide-react';

interface AdminModuleProps {
  activeSubTab?: string;
}

export const AdminModule: React.FC<AdminModuleProps> = ({ activeSubTab }) => {
  const getTabFromSubTab = (subTab?: string): 'users' | 'stores' | 'audit' | 'backup' => {
    if (subTab === 'admin_stores') return 'stores';
    if (subTab === 'admin_audit') return 'audit';
    if (subTab === 'admin_backup') return 'backup';
    return 'users';
  };

  const [activeTab, setActiveTab] = useState<'users' | 'stores' | 'audit' | 'backup'>(() =>
    getTabFromSubTab(activeSubTab)
  );

  useEffect(() => {
    setActiveTab(getTabFromSubTab(activeSubTab));
  }, [activeSubTab]);

  // Data States
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [companyForm, setCompanyForm] = useState<any>({
    business_name: '',
    legal_name: '',
    address: '',
    phone: '',
    email: '',
    pan: '',
    gstin: '',
    state: 'Karnataka',
    state_code: '29',
    financial_year: '2026-2027',
    currency: '₹',
    invoice_prefix: 'INV-',
    po_prefix: 'PO-',
    pr_prefix: 'PR-',
    terms_and_conditions: '',
    bank_details: ''
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [importJson, setImportJson] = useState('');

  // UI / Modal States
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // User Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    email: '',
    mobile: '',
    password: '',
    role_id: '',
    store_id: ''
  });

  // Role Permissions Modal
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Store Modal
  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [storeForm, setStoreForm] = useState({
    name: '',
    code: '',
    address: '',
    city: 'Kalaghatagi',
    state: 'Karnataka',
    pin: '581204',
    phone: '',
    email: '',
    gstin: ''
  });

  // Audit Detail Modal
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);

  // Loaders
  const loadUsersAndRoles = async () => {
    setIsLoading(true);
    try {
      const [uRes, rRes, sRes] = await Promise.all([
        apiRequest('/api/users'),
        apiRequest('/api/users/roles'),
        apiRequest('/api/stores')
      ]);
      setUsers(uRes.users || []);
      setRoles(rRes.roles || []);
      setAllPermissions(rRes.allPermissions || []);
      setStores(sRes.stores || []);
      if (rRes.roles && rRes.roles.length > 0 && !userForm.role_id) {
        setUserForm(prev => ({ ...prev, role_id: rRes.roles[0].id }));
      }
      if (sRes.stores && sRes.stores.length > 0 && !userForm.store_id) {
        setUserForm(prev => ({ ...prev, store_id: sRes.stores[0].id }));
      }
    } catch (e: any) {
      console.error('Failed to load user management data:', e);
      setStatusMsg({ text: 'Failed to load user management data: ' + e.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadStoresAndCompany = async () => {
    setIsLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        apiRequest('/api/stores'),
        apiRequest('/api/company')
      ]);
      setStores(sRes.stores || []);
      if (cRes.company) {
        setCompanyForm(cRes.company);
      }
    } catch (e: any) {
      console.error('Failed to load store and company settings:', e);
      setStatusMsg({ text: 'Failed to load store & company settings: ' + e.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/api/audit-logs');
      setAuditLogs(res.auditLogs || []);
    } catch (e: any) {
      console.error('Failed to load audit logs:', e);
      setStatusMsg({ text: 'Failed to load audit logs: ' + e.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setStatusMsg(null);
    if (activeTab === 'users') {
      loadUsersAndRoles();
    } else if (activeTab === 'stores') {
      loadStoresAndCompany();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  // Save Company Settings
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMsg(null);
    try {
      await apiRequest('/api/company', {
        method: 'PUT',
        body: JSON.stringify(companyForm)
      });
      setStatusMsg({ text: 'Company profile & GST settings updated successfully!', type: 'success' });
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to update company settings', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Create Store
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeForm.name.trim() || !storeForm.code.trim()) return;
    setIsLoading(true);
    try {
      await apiRequest('/api/stores', {
        method: 'POST',
        body: JSON.stringify(storeForm)
      });
      setStatusMsg({ text: `Store branch '${storeForm.name}' created successfully!`, type: 'success' });
      setShowAddStoreModal(false);
      setStoreForm({ name: '', code: '', address: '', city: 'Kalaghatagi', state: 'Karnataka', pin: '581204', phone: '', email: '', gstin: '' });
      loadStoresAndCompany();
    } catch (err: any) {
      alert('Failed to create store branch: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name || !userForm.username || !userForm.password || !userForm.role_id) return;
    setIsLoading(true);
    try {
      await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(userForm)
      });
      setStatusMsg({ text: `User @${userForm.username} created successfully!`, type: 'success' });
      setShowAddUserModal(false);
      setUserForm({ name: '', username: '', email: '', mobile: '', password: '', role_id: roles[0]?.id || '', store_id: stores[0]?.id || '' });
      loadUsersAndRoles();
    } catch (err: any) {
      alert('Failed to create user: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Update User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsLoading(true);
    try {
      await apiRequest(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingUser.name,
          email: editingUser.email,
          mobile: editingUser.mobile,
          role_id: editingUser.role_id,
          store_id: editingUser.store_id,
          is_active: editingUser.is_active,
          password: editingUser.password || undefined
        })
      });
      setStatusMsg({ text: `User @${editingUser.username} updated successfully!`, type: 'success' });
      setEditingUser(null);
      loadUsersAndRoles();
    } catch (err: any) {
      alert('Failed to update user: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Save Role Permissions
  const handleSaveRolePermissions = async () => {
    if (!editingRole) return;
    setIsLoading(true);
    try {
      await apiRequest(`/api/users/roles/${editingRole.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: selectedPermissions })
      });
      setStatusMsg({ text: `Permissions for role '${editingRole.name}' updated successfully!`, type: 'success' });
      setEditingRole(null);
      loadUsersAndRoles();
    } catch (err: any) {
      alert('Failed to save permissions: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Download Backup
  const handleDownloadBackup = () => {
    window.open('/api/backup/export', '_blank');
  };

  // Import Products
  const handleImportProducts = async () => {
    if (!importJson.trim()) return;
    setIsLoading(true);
    try {
      const parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) {
        throw new Error('Input must be a JSON array of product objects.');
      }
      const res = await apiRequest('/api/import/products', {
        method: 'POST',
        body: JSON.stringify({ products: parsed })
      });
      setStatusMsg({ text: `Import Complete: ${res.successCount} products successfully added/updated!`, type: 'success' });
      setImportJson('');
    } catch (err: any) {
      alert('Import failed: ' + (err.message || 'JSON parse error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Group permissions by category
  const permissionsByCategory: Record<string, any[]> = {};
  allPermissions.forEach(p => {
    const cat = p.category || 'General';
    if (!permissionsByCategory[cat]) permissionsByCategory[cat] = [];
    permissionsByCategory[cat].push(p);
  });

  // Filtered audit logs
  const filteredAuditLogs = auditLogs.filter(log => {
    if (!auditSearch.trim()) return true;
    const term = auditSearch.toLowerCase();
    return (
      (log.username && log.username.toLowerCase().includes(term)) ||
      (log.action && log.action.toLowerCase().includes(term)) ||
      (log.entity_type && log.entity_type.toLowerCase().includes(term)) ||
      (log.entity_id && log.entity_id.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-slate-950 min-h-screen text-slate-100">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <span>System Administration & Governance</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Role-Based Access Control (RBAC), store branch management, company GST configuration, immutable audit trail, & database tools.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeTab === 'users' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users & Role Permissions</span>
          </button>

          <button
            onClick={() => setActiveTab('stores')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeTab === 'stores' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Store Profile & Config</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeTab === 'audit' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>System Audit Trail</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeTab === 'backup' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Database & Import</span>
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between shadow ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-xs px-1 hover:opacity-80">✕</button>
        </div>
      )}

      {/* SECTION 1: USERS & ROLE PERMISSIONS */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          
          {/* User Accounts Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>System User Accounts ({users.length})</span>
                </h3>
                <p className="text-[11px] text-slate-400">Staff users with login credentials and assigned store branches</p>
              </div>

              <button
                onClick={() => setShowAddUserModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 shadow transition-all active:scale-95"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Register New Staff User</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                  <tr>
                    <th className="p-3">Staff Name & Username</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Assigned Branch Store</th>
                    <th className="p-3">Mobile & Email</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-100">{u.name}</div>
                        <div className="text-[10px] text-emerald-400 font-mono">@{u.username}</div>
                      </td>
                      <td className="p-3">
                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-semibold border border-emerald-500/20 text-[10px]">
                          {u.role_name}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 font-medium">
                        {u.store_name || 'All Store Branches'}
                      </td>
                      <td className="p-3 text-slate-400">
                        <div>{u.mobile || 'No Mobile'}</div>
                        <div className="text-[10px] text-slate-500">{u.email || ''}</div>
                      </td>
                      <td className="p-3 text-center">
                        {u.is_active ? (
                          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/30">
                            Active
                          </span>
                        ) : (
                          <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-rose-500/30">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setEditingUser({ ...u, password: '' })}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold border border-slate-700 flex items-center space-x-1 ml-auto"
                        >
                          <Edit2 className="w-3 h-3 text-emerald-400" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role Permissions Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Role-Based Access Control (RBAC) Roles</span>
              </h3>
              <p className="text-[11px] text-slate-400">Click "Configure Permissions" on any role to grant or revoke specific granular module access rights</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {roles.map(r => (
                <div key={r.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100 text-xs">{r.name}</span>
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{r.code}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2">{r.description}</p>
                    <div className="text-[10px] text-slate-300 font-semibold pt-1">
                      Granted Permissions: <span className="text-emerald-400 font-bold">{r.permissions?.length || 0}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setEditingRole(r);
                      setSelectedPermissions(r.permissions || []);
                    }}
                    className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold py-1.5 rounded-lg text-xs border border-slate-700 flex items-center justify-center space-x-1 transition-colors"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Configure Permissions</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: STORES & COMPANY CONFIG */}
      {activeTab === 'stores' && (
        <div className="space-y-6">
          
          {/* Store Branches Manager */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Store className="w-4 h-4 text-emerald-400" />
                  <span>Store Branches Directory ({stores.length})</span>
                </h3>
                <p className="text-[11px] text-slate-400">Multi-location retail branches, warehouses, and depot centers</p>
              </div>

              <button
                onClick={() => setShowAddStoreModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 shadow transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Create New Branch Store</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {stores.map(s => (
                <div key={s.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100 text-xs">{s.name}</span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{s.code}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <div>{s.address}</div>
                    <div>{s.city}, {s.state} - {s.pin}</div>
                    <div className="text-slate-300 font-mono text-[10px] pt-1">GSTIN: {s.gstin || 'N/A'}</div>
                    <div className="text-slate-400 text-[10px]">Ph: {s.phone || 'N/A'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Company & GST Settings Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>Store Profile & Tax Invoice Configuration</span>
              </h3>
              <p className="text-[11px] text-slate-400">Update company legal entity name, address, GSTIN, and printed tax invoice header/footer details</p>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Business Name (Display) *</label>
                  <input
                    type="text"
                    required
                    value={companyForm.business_name || ''}
                    onChange={e => setCompanyForm({ ...companyForm, business_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Legal Registered Entity Name</label>
                  <input
                    type="text"
                    value={companyForm.legal_name || ''}
                    onChange={e => setCompanyForm({ ...companyForm, legal_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">GSTIN Registration Number</label>
                  <input
                    type="text"
                    value={companyForm.gstin || ''}
                    onChange={e => setCompanyForm({ ...companyForm, gstin: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={companyForm.pan || ''}
                    onChange={e => setCompanyForm({ ...companyForm, pan: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Store Primary Phone</label>
                  <input
                    type="text"
                    value={companyForm.phone || ''}
                    onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Primary Email Address</label>
                  <input
                    type="email"
                    value={companyForm.email || ''}
                    onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Registered Store Address</label>
                <input
                  type="text"
                  value={companyForm.address || ''}
                  onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">State Name</label>
                  <input
                    type="text"
                    value={companyForm.state || 'Karnataka'}
                    onChange={e => setCompanyForm({ ...companyForm, state: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">GST State Code</label>
                  <input
                    type="text"
                    value={companyForm.state_code || '29'}
                    onChange={e => setCompanyForm({ ...companyForm, state_code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Financial Year</label>
                  <input
                    type="text"
                    value={companyForm.financial_year || '2026-2027'}
                    onChange={e => setCompanyForm({ ...companyForm, financial_year: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Invoice Number Prefix</label>
                  <input
                    type="text"
                    value={companyForm.invoice_prefix || 'INV-'}
                    onChange={e => setCompanyForm({ ...companyForm, invoice_prefix: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Invoice Terms & Conditions (Prints on Receipt)</label>
                  <textarea
                    rows={3}
                    value={companyForm.terms_and_conditions || ''}
                    onChange={e => setCompanyForm({ ...companyForm, terms_and_conditions: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Bank Account Details (For UPI / RTGS Bills)</label>
                  <textarea
                    rows={3}
                    value={companyForm.bank_details || ''}
                    onChange={e => setCompanyForm({ ...companyForm, bank_details: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg transition-all active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Company & Invoice Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 3: SYSTEM AUDIT TRAIL LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Immutable System Audit Trail ({auditLogs.length} events logged)</span>
              </h3>
              <p className="text-[11px] text-slate-400">Cryptographically recorded transactional activity across sales, stock, and settings</p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter logs by user/action..."
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                onClick={loadAuditLogs}
                className="p-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 hover:text-white"
                title="Refresh Audit Logs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Action Executed</th>
                  <th className="p-3">Entity Type</th>
                  <th className="p-3">Entity ID</th>
                  <th className="p-3 text-right">Payload Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500 text-xs">
                      No audit log entries matched your filter.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map(l => (
                    <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-slate-400 font-sans">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-emerald-400 font-bold">@{l.username}</td>
                      <td className="p-3">
                        <span className="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 font-semibold text-[10px]">
                          {l.action}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 font-sans">{l.entity_type}</td>
                      <td className="p-3 text-slate-400">{l.entity_id || '-'}</td>
                      <td className="p-3 text-right font-sans">
                        <button
                          onClick={() => setSelectedAuditLog(l)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-[10px] font-semibold border border-slate-700 inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View JSON</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 4: DATABASE & DATA IMPORT */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Database Backup Card */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-md flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Full Database Backup & Snapshot</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Download a binary export of the active SQLite ACID database file <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">/data/agri_store.db</code> containing all customer ledgers, sales receipts, stock batches, and financial accounting registers.
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span>Database Engine:</span>
                  <strong className="text-emerald-400 font-mono">SQLite (WAL Mode)</strong>
                </div>
                <div className="flex justify-between">
                  <span>Persistence Status:</span>
                  <strong className="text-emerald-400 font-mono">ACID Compliant</strong>
                </div>
              </div>
            </div>

            <button
              onClick={handleDownloadBackup}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download Live Database File (.db)</span>
            </button>
          </div>

          {/* Batch Product CSV / JSON Import Card */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-md flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                  <span>Batch Product Catalog JSON Import</span>
                </h3>
                <button
                  onClick={() => setImportJson(JSON.stringify([
                    {
                      code: "PDK-502",
                      sku: "SKU-PDK-502",
                      name: "Paddy Super Hybrid Seed 10kg",
                      category_id: "cat-seeds",
                      brand_id: "brand-syngenta",
                      pack_size: "10 kg",
                      unit: "Bag",
                      purchase_price: 1200,
                      mrp: 1600,
                      selling_price: 1450,
                      gst_rate: 0,
                      hsn_code: "1209",
                      reorder_level: 20
                    }
                  ], null, 2))}
                  className="text-[10px] text-teal-400 hover:underline font-semibold"
                >
                  Load Example Payload
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Paste JSON array of product objects to batch import new products into catalog:
              </p>
              <textarea
                rows={5}
                placeholder='[{"code":"PRD-101","name":"Hybrid Seed","purchase_price":100,"mrp":150,"selling_price":140,"gst_rate":0}]'
                value={importJson}
                onChange={e => setImportJson(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-teal-500 placeholder-slate-600"
              />
            </div>

            <button
              onClick={handleImportProducts}
              disabled={isLoading || !importJson.trim()}
              className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>Execute Batch Product Import</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW USER */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>Register Staff User Account</span>
              </h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patil"
                  value={userForm.name}
                  onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Login Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="ramesh"
                    value={userForm.username}
                    onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={userForm.password}
                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Assigned Role *</label>
                  <select
                    value={userForm.role_id}
                    onChange={e => setUserForm({ ...userForm, role_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Assigned Store Branch</label>
                  <select
                    value={userForm.store_id}
                    onChange={e => setUserForm({ ...userForm, store_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="9844012345"
                    value={userForm.mobile}
                    onChange={e => setUserForm({ ...userForm, mobile: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Email Address</label>
                  <input
                    type="email"
                    placeholder="ramesh@agri.com"
                    value={userForm.email}
                    onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-bold shadow"
                >
                  Register User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                <span>Edit User Account (@{editingUser.username})</span>
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Assigned Role</label>
                  <select
                    value={editingUser.role_id}
                    onChange={e => setEditingUser({ ...editingUser, role_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Assigned Store Branch</label>
                  <select
                    value={editingUser.store_id || ''}
                    onChange={e => setEditingUser({ ...editingUser, store_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Mobile Number</label>
                  <input
                    type="text"
                    value={editingUser.mobile || ''}
                    onChange={e => setEditingUser({ ...editingUser, mobile: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Reset Password (Optional)</label>
                  <input
                    type="password"
                    placeholder="Leave blank to retain"
                    value={editingUser.password || ''}
                    onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="user_active_checkbox"
                  checked={Boolean(editingUser.is_active)}
                  onChange={e => setEditingUser({ ...editingUser, is_active: e.target.checked ? 1 : 0 })}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="user_active_checkbox" className="text-slate-200 font-semibold cursor-pointer">
                  Account Enabled / Active
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-bold shadow"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ROLE PERMISSIONS */}
      {editingRole && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Configure Access Rights for Role: {editingRole.name}</span>
                </h3>
                <p className="text-[10px] text-slate-400">Select module permission flags to enable for this security profile</p>
              </div>
              <button onClick={() => setEditingRole(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {Object.keys(permissionsByCategory).map(cat => (
                <div key={cat} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-bold text-emerald-400 uppercase tracking-wider text-[11px] border-b border-slate-800/80 pb-1">
                    {cat} Permissions
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {permissionsByCategory[cat].map((p: any) => {
                      const isChecked = selectedPermissions.includes(p.code);
                      return (
                        <label
                          key={p.code}
                          className={`p-2 rounded-lg border flex items-start space-x-2 cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-100'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedPermissions(prev => prev.filter(c => c !== p.code));
                              } else {
                                setSelectedPermissions(prev => [...prev, p.code]);
                              }
                            }}
                            className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                          />
                          <div>
                            <div className="font-bold text-xs">{p.name}</div>
                            <div className="text-[10px] text-slate-400">{p.description}</div>
                            <div className="text-[9px] font-mono text-emerald-400 mt-0.5">{p.code}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800 shrink-0 text-xs">
              <span className="text-slate-400 text-[11px]">
                Granted <strong className="text-emerald-400">{selectedPermissions.length}</strong> permissions
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setEditingRole(null)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRolePermissions}
                  disabled={isLoading}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-bold shadow"
                >
                  Save Permission Matrix
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE BRANCH STORE */}
      {showAddStoreModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Store className="w-4 h-4 text-emerald-400" />
                <span>Create New Store Branch</span>
              </h3>
              <button onClick={() => setShowAddStoreModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Branch Store Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annapurna Agri - Hubballi Branch"
                  value={storeForm.name}
                  onChange={e => setStoreForm({ ...storeForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Unique Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="HUB02"
                    value={storeForm.code}
                    onChange={e => setStoreForm({ ...storeForm, code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">GSTIN</label>
                  <input
                    type="text"
                    placeholder="29AABCA1234F1Z2"
                    value={storeForm.gstin}
                    onChange={e => setStoreForm({ ...storeForm, gstin: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Address</label>
                <input
                  type="text"
                  placeholder="APMC Market Yard"
                  value={storeForm.address}
                  onChange={e => setStoreForm({ ...storeForm, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">City</label>
                  <input
                    type="text"
                    value={storeForm.city}
                    onChange={e => setStoreForm({ ...storeForm, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">State</label>
                  <input
                    type="text"
                    value={storeForm.state}
                    onChange={e => setStoreForm({ ...storeForm, state: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Pincode</label>
                  <input
                    type="text"
                    value={storeForm.pin}
                    onChange={e => setStoreForm({ ...storeForm, pin: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Phone</label>
                  <input
                    type="text"
                    value={storeForm.phone}
                    onChange={e => setStoreForm({ ...storeForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Email</label>
                  <input
                    type="email"
                    value={storeForm.email}
                    onChange={e => setStoreForm({ ...storeForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStoreModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-bold shadow"
                >
                  Create Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AUDIT LOG PAYLOAD VIEW */}
      {selectedAuditLog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Audit Log Payload Details (#{selectedAuditLog.id})</span>
              </h3>
              <button onClick={() => setSelectedAuditLog(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div>User: <strong className="text-emerald-400">@{selectedAuditLog.username}</strong></div>
                <div>Action: <strong className="text-amber-300">{selectedAuditLog.action}</strong></div>
                <div>Entity: <strong className="text-slate-200">{selectedAuditLog.entity_type} ({selectedAuditLog.entity_id || '-'})</strong></div>
                <div>Date: <strong className="text-slate-400">{new Date(selectedAuditLog.created_at).toLocaleString()}</strong></div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">New Values Payload JSON:</label>
                <pre className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-48">
                  {selectedAuditLog.new_values ? JSON.stringify(JSON.parse(selectedAuditLog.new_values), null, 2) : 'No new values recorded'}
                </pre>
              </div>

              {selectedAuditLog.old_values && (
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Old Values Payload JSON:</label>
                  <pre className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-[11px] font-mono text-rose-300 overflow-x-auto max-h-36">
                    {JSON.stringify(JSON.parse(selectedAuditLog.old_values), null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
