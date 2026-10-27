import React, { useState } from 'react';
import {
  Users,
  LogIn,
  Settings,
  Shield,
  Plus,
  Edit2,
  Trash2,
  Download,
  Calendar,
  Filter,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import AiAdminTab from '../../features/ai/components/AiAdminTab';

// Mock users data
const MOCK_USERS = [
  {
    id: 1,
    name: 'Sarah Johnson',
    email: 'sarah.johnson@company.com',
    role: 'Admin',
    status: 'Active',
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  },
  {
    id: 2,
    name: 'Michael Chen',
    email: 'michael.chen@company.com',
    role: 'Finance',
    status: 'Active',
    lastLogin: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
  },
  {
    id: 3,
    name: 'Emma Rodriguez',
    email: 'emma.rodriguez@company.com',
    role: 'HR',
    status: 'Active',
    lastLogin: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
  },
  {
    id: 4,
    name: 'James Williams',
    email: 'james.williams@company.com',
    role: 'Analyst',
    status: 'Active',
    lastLogin: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
  },
  {
    id: 5,
    name: 'Lisa Thompson',
    email: 'lisa.thompson@company.com',
    role: 'Finance',
    status: 'Suspended',
    lastLogin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  },
  {
    id: 6,
    name: 'David Park',
    email: 'david.park@company.com',
    role: 'Viewer',
    status: 'Active',
    lastLogin: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
  },
  {
    id: 7,
    name: 'Angela Martinez',
    email: 'angela.martinez@company.com',
    role: 'Admin',
    status: 'Active',
    lastLogin: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
  },
  {
    id: 8,
    name: 'Robert Kim',
    email: 'robert.kim@company.com',
    role: 'Analyst',
    status: 'Active',
    lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
  },
  {
    id: 9,
    name: 'Jennifer Lee',
    email: 'jennifer.lee@company.com',
    role: 'Finance',
    status: 'Active',
    lastLogin: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
  },
  {
    id: 10,
    name: 'Christopher Davis',
    email: 'christopher.davis@company.com',
    role: 'HR',
    status: 'Active',
    lastLogin: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
  },
];

// Mock system settings
const SYSTEM_SETTINGS = {
  calculation: {
    frequency: 'Monthly',
    fxRateSource: 'Treasury',
    roundingPrecision: '2 decimal places',
  },
  integration: {
    apiRateLimit: '1000 requests/hour',
    retryPolicy: 'Exponential backoff',
    timeout: '30 seconds',
  },
  notification: {
    emailAlertsOnFailure: true,
    approvalRequests: true,
  },
  display: {
    defaultCurrency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    timezone: 'UTC-5 (EST)',
  },
};

// Mock PII fields
const PII_FIELDS = [
  { field: 'Employee Name', masked: true },
  { field: 'Email Address', masked: true },
  { field: 'Salary Information', masked: true },
  { field: 'Department', masked: false },
  { field: 'Job Title', masked: false },
];

// Role color mapping
const ROLE_COLORS = {
  Admin: 'bg-purple-100 text-purple-800',
  Finance: 'bg-blue-100 text-blue-800',
  HR: 'bg-green-100 text-green-800',
  Analyst: 'bg-orange-100 text-orange-800',
  Viewer: 'bg-gray-100 text-gray-800',
};

// Status color mapping
const STATUS_COLORS = {
  Active: 'text-green-600',
  Suspended: 'text-red-600',
};

// Format relative time
const formatRelativeTime = (date) => {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '-';
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return d.toLocaleDateString();
};

// Tab component
const Tab = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-3 font-medium border-b-2 transition-colors ${
      isActive
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-600 hover:text-gray-900'
    }`}
  >
    {label}
  </button>
);

// User Management Tab
const UserManagementTab = () => {
  const { users, addUser, deleteUser, countries, currentUser } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', username: '', password: '',
    role: 'Viewer', allCountries: false, allowedCountries: [],
  });

  const ROLES = ['Admin (Global)', 'Finance', 'HR', 'Regional Lead', 'Analyst', 'Viewer'];

  const resetForm = () => {
    setForm({ name: '', email: '', username: '', password: '', role: 'Viewer', allCountries: false, allowedCountries: [] });
    setError('');
  };

  const toggleCountry = (code) => {
    setForm(f => ({
      ...f,
      allowedCountries: f.allowedCountries.includes(code)
        ? f.allowedCountries.filter(c => c !== code)
        : [...f.allowedCountries, code],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const allowed = form.allCountries ? ['*'] : form.allowedCountries;
    if (!form.allCountries && allowed.length === 0) {
      setError('Select at least one country, or enable All Countries.');
      return;
    }
    const result = addUser({ ...form, allowedCountries: allowed });
    if (!result.ok) { setError(result.error); return; }
    resetForm();
    setShowAddForm(false);
  };

  const handleDelete = (username) => {
    if (username === currentUser?.username) { alert("You can't delete yourself."); return; }
    if (!confirm(`Delete user "${username}"?`)) return;
    const r = deleteUser(username);
    if (!r.ok) alert(r.error);
  };

  const formatScope = (allowed) => {
    if (!allowed || allowed.length === 0) return 'No Access';
    if (allowed.includes('*')) return 'All Countries';
    return allowed.join(', ');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">User Accounts</h3>
          <p className="text-xs text-gray-500 mt-1">{users.length} user{users.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Add User
        </button>
      </div>

      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-4">
          <h4 className="font-semibold text-gray-900 mb-4">New User</h4>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Full Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="email"
                placeholder="Email Address"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Username (login)"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Temporary Password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent md:col-span-2"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Allowed Countries</label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.allCountries}
                    onChange={(e) => setForm({ ...form, allCountries: e.target.checked })}
                  />
                  All Countries (Global access)
                </label>
              </div>
              {!form.allCountries && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-3 bg-white border border-gray-200 rounded-lg">
                  {countries.map(c => (
                    <label key={c.code} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={form.allowedCountries.includes(c.code)}
                        onChange={() => toggleCountry(c.code)}
                      />
                      <span className="font-mono text-xs text-gray-500">{c.code}</span>
                      <span className="truncate">{c.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { resetForm(); setShowAddForm(false); }}
                className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create User
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Username</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Allowed Countries</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.username} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">{user.username}</td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700 text-xs">{formatScope(user.allowedCountries)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(user.username)}
                    className="text-red-600 hover:text-red-800 disabled:text-gray-300"
                    disabled={user.username === 'admin'}
                    title={user.username === 'admin' ? 'Primary admin cannot be deleted' : 'Delete user'}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Audit Trail Tab
const AuditTrailTab = ({ auditLog }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const CATEGORIES = ['All', 'Configuration', 'Calculation', 'Data', 'Reporting', 'Approval', 'Security'];

  const filteredLog = auditLog.filter((entry) => {
    const categoryMatch = selectedCategory === 'All' || entry.category === selectedCategory;
    return categoryMatch;
  });

  const getCategoryColor = (category) => {
    const colors = {
      Configuration: 'bg-blue-100 text-blue-800',
      Calculation: 'bg-purple-100 text-purple-800',
      Data: 'bg-orange-100 text-orange-800',
      Reporting: 'bg-green-100 text-green-800',
      Approval: 'bg-yellow-100 text-yellow-800',
      Security: 'bg-red-100 text-red-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Audit Trail</h3>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
          <Download size={18} />
          Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Timestamp</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">User</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Action</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Target</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Category</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLog.map((entry, idx) => (
              <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                  {formatRelativeTime(entry.timestamp)}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{entry.user}</td>
                <td className="px-4 py-3 text-gray-700">{entry.action}</td>
                <td className="px-4 py-3 text-gray-600">{entry.target}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getCategoryColor(entry.category)}`}>
                    {entry.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{entry.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredLog.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="mx-auto mb-2 opacity-50" size={32} />
          <p>No audit entries found for the selected filters</p>
        </div>
      )}
    </div>
  );
};

// System Settings Tab
const SystemSettingsTab = () => {
  const [settings, setSettings] = useState(SYSTEM_SETTINGS);
  const [editing, setEditing] = useState(null); // { section, key }
  const [draftValue, setDraftValue] = useState('');

  const toggleBooleanSetting = (section, key) => {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: !prev[section][key] },
    }));
  };

  const startEdit = (section, key, value) => {
    setEditing({ section, key });
    setDraftValue(value?.toString() ?? '');
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraftValue('');
  };

  const saveEdit = () => {
    if (!editing) return;
    const { section, key } = editing;
    const original = settings[section][key];
    let next = draftValue;
    if (typeof original === 'number') {
      const n = Number(draftValue);
      next = Number.isFinite(n) ? n : original;
    }
    setSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: next },
    }));
    cancelEdit();
  };

  const SettingCard = ({ title, settings: sectionSettings, section }) => (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
        <Settings size={18} />
        {title}
      </h4>
      {Object.entries(sectionSettings).map(([key, value]) => {
        const isEditing = editing && editing.section === section && editing.key === key;
        return (
          <div key={key} className="flex items-center justify-between py-2 border-t border-gray-200 pt-3 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </p>
              {isEditing ? (
                <input
                  type={typeof value === 'number' ? 'number' : 'text'}
                  value={draftValue}
                  autoFocus
                  onChange={(e) => setDraftValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  className="mt-1 w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-sm text-gray-600 mt-1 truncate">{value?.toString()}</p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {typeof value === 'boolean' ? (
                <button
                  onClick={() => toggleBooleanSetting(section, key)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {value ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
              ) : isEditing ? (
                <>
                  <button
                    onClick={saveEdit}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => startEdit(section, key, value)}
                  className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-100"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">System Configuration</h3>

      <div className="grid grid-cols-2 gap-4">
        <SettingCard title="Calculation Settings" settings={settings.calculation} section="calculation" />
        <SettingCard title="Integration Settings" settings={settings.integration} section="integration" />
        <SettingCard title="Notification Settings" settings={settings.notification} section="notification" />
        <SettingCard title="Display Settings" settings={settings.display} section="display" />
      </div>
    </div>
  );
};

// Data Lineage Diagram
const DataLineageDiagram = () => {
  const stages = [
    { label: 'Source Systems', icon: Database },
    { label: 'Integration Layer', icon: ArrowRight },
    { label: 'Data Warehouse', icon: Database },
    { label: 'Calculation Engine', icon: Settings },
    { label: 'Reports', icon: LogIn },
  ];

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
      <h4 className="font-semibold text-gray-900 mb-4">Data Lineage</h4>
      <div className="flex items-center justify-between">
        {stages.map((stage, idx) => {
          const IconComponent = stage.icon;
          return (
            <div key={idx} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className="bg-blue-100 border-2 border-blue-600 rounded-full p-3 mb-2">
                  <IconComponent size={20} className="text-blue-600" />
                </div>
                <p className="text-xs font-medium text-gray-700 text-center max-w-[80px]">{stage.label}</p>
              </div>
              {idx < stages.length - 1 && (
                <div className="flex-1 h-1 bg-blue-300 mx-3" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Compliance Status Card
const ComplianceCard = ({ title, status, description }) => {
  const isCompliant = status === 'Compliant';
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        {isCompliant ? (
          <CheckCircle size={20} className="text-green-600" />
        ) : (
          <AlertCircle size={20} className="text-yellow-600" />
        )}
      </div>
      <p className={`text-sm font-medium mb-1 ${isCompliant ? 'text-green-600' : 'text-yellow-600'}`}>
        {status}
      </p>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
};

// Integration Status Item
const IntegrationStatusItem = ({ name, status, lastSync }) => {
  const cfg = {
    connected: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Connected' },
    warning:   { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Warning' },
    offline:   { icon: AlertCircle, color: 'text-red-600',   bg: 'bg-red-50',   label: 'Offline' },
  }[status] || { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Offline' };
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border border-gray-200 ${cfg.bg}`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${cfg.color}`} />
        <div>
          <p className="text-sm font-medium text-gray-900">{name}</p>
          <p className="text-xs text-gray-600">{lastSync}</p>
        </div>
      </div>
      <span className={`text-xs font-medium px-3 py-1 rounded-full ${cfg.color} bg-white border`}>
        {cfg.label}
      </span>
    </div>
  );
};

// Data Governance Tab
const DataGovernanceTab = () => {
  const [dataRetention, setDataRetention] = useState('7 years');

  return (
    <div className="space-y-6">
      {/* Data Retention Policy */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock size={18} />
              Data Retention Policy
            </h4>
            <p className="text-sm text-gray-600 mt-1">Current retention period: {dataRetention}</p>
          </div>
          <button className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-100">
            Edit
          </button>
        </div>
      </div>

      {/* PII Controls */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Lock size={18} />
          PII Controls
        </h4>
        <div className="space-y-3">
          {PII_FIELDS.map((field, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
              <p className="text-sm font-medium text-gray-700">{field.field}</p>
              <div className="flex items-center gap-2">
                {field.masked ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                    <Lock size={12} />
                    Masked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                    <Shield size={12} />
                    Unmasked
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Lineage */}
      <DataLineageDiagram />

      {/* Data Sources & Integration Status */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-4">Data Sources & Integration Status</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <IntegrationStatusItem name="SAP S/4HANA - GL Extract" status="connected" lastSync="Last sync: 2 hours ago" />
          <IntegrationStatusItem name="Workday HRIS" status="connected" lastSync="Last sync: 4 hours ago" />
          <IntegrationStatusItem name="ADP Payroll" status="connected" lastSync="Last sync: 1 day ago" />
          <IntegrationStatusItem name="Benefits Provider API" status="warning" lastSync="Sync delayed - scheduled for 2:00 PM" />
        </div>
      </div>

      {/* Compliance Status */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-4">Compliance Status</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ComplianceCard
            title="SOX Compliance"
            status="Compliant"
            description="All audit trails and controls in place"
          />
          <ComplianceCard
            title="GDPR Readiness"
            status="Compliant"
            description="Data processing and consent mechanisms active"
          />
          <ComplianceCard
            title="Audit Readiness"
            status="Compliant"
            description="Complete data lineage and documentation available"
          />
        </div>
      </div>
    </div>
  );
};

// Main Admin Console Component
export default function AdminConsole() {
  const { auditLog, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState('Users');

  const tabs = ['Users', 'Audit', 'Settings', 'Governance', 'AI'];
  const tabIcons = {
    Users: Users,
    Audit: LogIn,
    Settings: Settings,
    Governance: Shield,
    AI: Settings,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-3xl font-bold text-gray-900">Administration Console</h1>
        <p className="text-gray-600 mt-1">System configuration, security, and governance</p>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200 mb-6 rounded-t-lg">
          <div className="flex gap-0">
            {tabs.map((tab) => (
              <Tab
                key={tab}
                label={tab}
                isActive={activeTab === tab}
                onClick={() => setActiveTab(tab)}
              />
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-6">
          {activeTab === 'Users' && <UserManagementTab />}
          {activeTab === 'Audit' && <AuditTrailTab auditLog={auditLog || []} />}
          {activeTab === 'Settings' && <SystemSettingsTab />}
          {activeTab === 'Governance' && <DataGovernanceTab />}
          {activeTab === 'AI' && <AiAdminTab />}
        </div>
      </div>
    </div>
  );
}
