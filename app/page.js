'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  LayoutDashboard, Users, UserPlus, MessageSquare, Settings, LogOut, Search,
  Phone, PhoneOff, ThumbsUp, ThumbsDown, Clock, Plus, Download, Globe,
  Bell, ChevronRight, TrendingUp, Activity, Mail, Send, Trash2, Edit, Eye
} from 'lucide-react';
import { translations, isRTL } from '@/lib/translations';

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6366F1', '#8B5CF6'];
const GENDER_COLORS = ['#3B82F6', '#EC4899'];

export default function App() {
  const [locale, setLocale] = useState('en');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsTotalPages, setLeadsTotalPages] = useState(1);
  const [leadsFilter, setLeadsFilter] = useState('ALL');
  const [leadsSearch, setLeadsSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState({ inbox: [], sent: [] });
  const [activities, setActivities] = useState([]);
  
  // Dialog states
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [leadForm, setLeadForm] = useState({ fullName: '', phone: '', city: '', age: '', gender: 'MALE' });
  const [userForm, setUserForm] = useState({ email: '', password: '', name: '', role: 'EMPLOYEE' });
  const [messageForm, setMessageForm] = useState({ toId: '', toName: '', subject: '', content: '', isBroadcast: false });
  const [statusNotes, setStatusNotes] = useState('');
  const [pendingStatus, setPendingStatus] = useState('');

  const t = useCallback((key) => translations[locale]?.[key] || translations.en[key] || key, [locale]);
  const rtl = isRTL(locale);

  const apiCall = useCallback(async (endpoint, options = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await fetch(`/api${endpoint}`, { ...options, headers });
    const data = await response.json();
    
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }, [token]);

  // Initialize app
  useEffect(() => {
    const savedToken = localStorage.getItem('crm_token');
    const savedUser = localStorage.getItem('crm_user');
    const savedLocale = localStorage.getItem('crm_locale') || 'en';
    
    setLocale(savedLocale);
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
    
    // Seed database
    fetch('/api/seed').catch(() => {});
    setLoading(false);
  }, []);

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchDashboardStats();
      fetchLeads();
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') {
        fetchUsers();
        fetchActivities();
      }
      fetchMessages();
    }
  }, [isAuthenticated, token, user]);

  // Fetch leads when filter/search changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchLeads();
    }
  }, [leadsPage, leadsFilter, leadsSearch]);

  const fetchDashboardStats = async () => {
    try {
      const data = await apiCall('/dashboard/stats');
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchLeads = async () => {
    try {
      const params = new URLSearchParams({
        page: leadsPage.toString(),
        limit: '10',
        ...(leadsFilter !== 'ALL' && { status: leadsFilter }),
        ...(leadsSearch && { search: leadsSearch })
      });
      const data = await apiCall(`/leads?${params}`);
      setLeads(data.items || []);
      setLeadsTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await apiCall('/users');
      setUsers(data.items || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const data = await apiCall('/messages');
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchActivities = async () => {
    try {
      const data = await apiCall('/activities');
      setActivities(data.items || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm)
      });
      
      setToken(data.token);
      setUser(data.user);
      setIsAuthenticated(true);
      localStorage.setItem('crm_token', data.token);
      localStorage.setItem('crm_user', JSON.stringify(data.user));
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setActiveTab('dashboard');
  };

  const handleLocaleChange = (newLocale) => {
    setLocale(newLocale);
    localStorage.setItem('crm_locale', newLocale);
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    try {
      await apiCall('/leads', {
        method: 'POST',
        body: JSON.stringify({
          ...leadForm,
          age: leadForm.age ? parseInt(leadForm.age) : null
        })
      });
      setShowLeadDialog(false);
      setLeadForm({ fullName: '', phone: '', city: '', age: '', gender: 'MALE' });
      fetchLeads();
      fetchDashboardStats();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await apiCall('/users', {
        method: 'POST',
        body: JSON.stringify(userForm)
      });
      setShowUserDialog(false);
      setUserForm({ email: '', password: '', name: '', role: 'EMPLOYEE' });
      fetchUsers();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleUpdateLeadStatus = async (leadId, status) => {
    if (status === 'INTERESTED') {
      setSelectedLead(leads.find(l => l.id === leadId));
      setPendingStatus(status);
      setShowStatusDialog(true);
      return;
    }
    
    try {
      await apiCall(`/leads/${leadId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      fetchLeads();
      fetchDashboardStats();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleConfirmInterestedStatus = async () => {
    if (!selectedLead) return;
    try {
      await apiCall(`/leads/${selectedLead.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: pendingStatus, notes: statusNotes })
      });
      setShowStatusDialog(false);
      setSelectedLead(null);
      setStatusNotes('');
      setPendingStatus('');
      fetchLeads();
      fetchDashboardStats();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await apiCall(`/leads/${leadId}`, { method: 'DELETE' });
      fetchLeads();
      fetchDashboardStats();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await apiCall(`/users/${userId}`, { method: 'DELETE' });
      fetchUsers();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    try {
      await apiCall('/messages', {
        method: 'POST',
        body: JSON.stringify(messageForm)
      });
      setShowMessageDialog(false);
      setMessageForm({ toId: '', toName: '', subject: '', content: '', isBroadcast: false });
      fetchMessages();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/leads/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads.csv';
      a.click();
    } catch (error) {
      alert('Export failed');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      NEW: 'bg-blue-100 text-blue-800',
      INTERESTED: 'bg-green-100 text-green-800',
      NOT_INTERESTED: 'bg-red-100 text-red-800',
      NO_ANSWER: 'bg-yellow-100 text-yellow-800',
      PHONE_OFF: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      NEW: t('new'),
      INTERESTED: t('interested'),
      NOT_INTERESTED: t('notInterested'),
      NO_ANSWER: t('noAnswer'),
      PHONE_OFF: t('phoneOff')
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{labels[status] || status}</Badge>;
  };

  const getRoleBadge = (role) => {
    const styles = {
      SUPER_ADMIN: 'bg-purple-100 text-purple-800',
      ADMIN: 'bg-blue-100 text-blue-800',
      EMPLOYEE: 'bg-green-100 text-green-800',
      VIEWER: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      SUPER_ADMIN: t('superAdmin'),
      ADMIN: t('admin'),
      EMPLOYEE: t('employee'),
      VIEWER: t('viewer')
    };
    return <Badge className={styles[role]}>{labels[role]}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // Login Page
  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 ${rtl ? 'rtl' : 'ltr'}`} dir={rtl ? 'rtl' : 'ltr'}>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-white/60" />
          <Select value={locale} onValueChange={handleLocaleChange}>
            <SelectTrigger className="w-24 bg-white/10 border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ar">العربية</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4">
              <LayoutDashboard className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">{t('welcomeBack')}</CardTitle>
            <CardDescription className="text-white/60">{t('signInToContinue')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
                  {loginError}
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-white/80">{t('email')}</Label>
                <Input
                  type="email"
                  placeholder="admin@crm.com"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">{t('password')}</Label>
                <Input
                  type="password"
                  placeholder="password123"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                {t('login')}
              </Button>
              <p className="text-center text-white/40 text-sm mt-4">
                Demo: admin@crm.com / password123
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className={`min-h-screen bg-slate-50 ${rtl ? 'rtl' : 'ltr'}`} dir={rtl ? 'rtl' : 'ltr'}>
      {/* Sidebar */}
      <aside className={`fixed top-0 ${rtl ? 'right-0' : 'left-0'} h-full w-64 bg-slate-900 text-white z-50`}>
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">{t('appName')}</span>
          </div>
        </div>
        
        <nav className="px-4 space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`}
          >
            <LayoutDashboard className="h-5 w-5" />
            {t('dashboard')}
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'leads' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`}
          >
            <Users className="h-5 w-5" />
            {t('leads')}
          </button>
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'users' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`}
            >
              <UserPlus className="h-5 w-5" />
              {t('users')}
            </button>
          )}
          <button
            onClick={() => setActiveTab('messages')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'messages' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`}
          >
            <MessageSquare className="h-5 w-5" />
            {t('messages')}
            {messages.inbox?.filter(m => !m.read).length > 0 && (
              <Badge className="ml-auto bg-red-500">{messages.inbox.filter(m => !m.read).length}</Badge>
            )}
          </button>
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
            <button
              onClick={() => setActiveTab('activity')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'activity' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`}
            >
              <Activity className="h-5 w-5" />
              {t('activityLog')}
            </button>
          )}
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
              {user?.name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-white/60">{getRoleBadge(user?.role)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={locale} onValueChange={handleLocaleChange}>
              <SelectTrigger className="flex-1 bg-white/10 border-white/20 text-white text-sm">
                <Globe className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-white/60 hover:text-white hover:bg-white/10">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`${rtl ? 'mr-64' : 'ml-64'} p-8`}>
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{t('dashboard')}</h1>
                <p className="text-slate-500 mt-1">Welcome back, {user?.name}</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">{t('totalLeads')}</p>
                      <p className="text-3xl font-bold mt-1">{stats?.totalLeads || 0}</p>
                    </div>
                    <Users className="h-10 w-10 text-blue-200" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm">{t('interestedLeads')}</p>
                      <p className="text-3xl font-bold mt-1">{stats?.interested || 0}</p>
                    </div>
                    <ThumbsUp className="h-10 w-10 text-green-200" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-100 text-sm">{t('notInterestedLeads')}</p>
                      <p className="text-3xl font-bold mt-1">{stats?.notInterested || 0}</p>
                    </div>
                    <ThumbsDown className="h-10 w-10 text-red-200" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm">{t('conversionRate')}</p>
                      <p className="text-3xl font-bold mt-1">{stats?.conversionRate || 0}%</p>
                    </div>
                    <TrendingUp className="h-10 w-10 text-purple-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('statusDistribution')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats?.statusDistribution || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {(stats?.statusDistribution || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('genderDistribution')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: t('male'), value: stats?.genderDistribution?.male || 0 },
                            { name: t('female'), value: stats?.genderDistribution?.female || 0 }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {GENDER_COLORS.map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Employee Performance */}
            {stats?.employeePerformance?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('employeePerformance')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.employeePerformance}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="total" fill="#3B82F6" name="Total Leads" />
                        <Bar dataKey="interested" fill="#10B981" name="Interested" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{t('leads')}</h1>
                <p className="text-slate-500 mt-1">Manage your customer leads</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('export')}
                </Button>
                {user?.role !== 'VIEWER' && (
                  <Dialog open={showLeadDialog} onOpenChange={setShowLeadDialog}>
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-to-r from-purple-500 to-pink-500">
                        <Plus className="h-4 w-4 mr-2" />
                        {t('addLead')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('addLead')}</DialogTitle>
                        <DialogDescription>Create a new lead in the system</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreateLead} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>{t('fullName')} *</Label>
                            <Input
                              value={leadForm.fullName}
                              onChange={(e) => setLeadForm({ ...leadForm, fullName: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('phone')} *</Label>
                            <Input
                              value={leadForm.phone}
                              onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('city')}</Label>
                            <Input
                              value={leadForm.city}
                              onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('age')}</Label>
                            <Input
                              type="number"
                              value={leadForm.age}
                              onChange={(e) => setLeadForm({ ...leadForm, age: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2 col-span-2">
                            <Label>{t('gender')}</Label>
                            <Select value={leadForm.gender} onValueChange={(v) => setLeadForm({ ...leadForm, gender: v })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MALE">{t('male')}</SelectItem>
                                <SelectItem value="FEMALE">{t('female')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-3">
                          <Button type="button" variant="outline" onClick={() => setShowLeadDialog(false)}>
                            {t('cancel')}
                          </Button>
                          <Button type="submit">{t('save')}</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder={t('search') + '...'}
                      value={leadsSearch}
                      onChange={(e) => setLeadsSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={leadsFilter} onValueChange={(v) => { setLeadsFilter(v); setLeadsPage(1); }}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder={t('filter')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="NEW">{t('new')}</SelectItem>
                      <SelectItem value="INTERESTED">{t('interested')}</SelectItem>
                      <SelectItem value="NOT_INTERESTED">{t('notInterested')}</SelectItem>
                      <SelectItem value="NO_ANSWER">{t('noAnswer')}</SelectItem>
                      <SelectItem value="PHONE_OFF">{t('phoneOff')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Leads Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left p-4 font-medium text-slate-600">{t('fullName')}</th>
                        <th className="text-left p-4 font-medium text-slate-600">{t('phone')}</th>
                        <th className="text-left p-4 font-medium text-slate-600">{t('city')}</th>
                        <th className="text-left p-4 font-medium text-slate-600">{t('gender')}</th>
                        <th className="text-left p-4 font-medium text-slate-600">{t('status')}</th>
                        <th className="text-left p-4 font-medium text-slate-600">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-slate-50">
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{lead.fullName}</p>
                              <p className="text-sm text-slate-500">{lead.age} yrs</p>
                            </div>
                          </td>
                          <td className="p-4">{lead.phone}</td>
                          <td className="p-4">{lead.city}</td>
                          <td className="p-4">
                            <Badge variant="outline">{lead.gender === 'MALE' ? t('male') : t('female')}</Badge>
                          </td>
                          <td className="p-4">{getStatusBadge(lead.status)}</td>
                          <td className="p-4">
                            {user?.role !== 'VIEWER' && (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateLeadStatus(lead.id, 'NO_ANSWER')}
                                  title={t('noAnswer')}
                                >
                                  <Phone className="h-4 w-4 text-yellow-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateLeadStatus(lead.id, 'PHONE_OFF')}
                                  title={t('phoneOff')}
                                >
                                  <PhoneOff className="h-4 w-4 text-gray-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateLeadStatus(lead.id, 'NOT_INTERESTED')}
                                  title={t('notInterested')}
                                >
                                  <ThumbsDown className="h-4 w-4 text-red-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateLeadStatus(lead.id, 'INTERESTED')}
                                  title={t('interested')}
                                >
                                  <ThumbsUp className="h-4 w-4 text-green-500" />
                                </Button>
                                {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteLead(lead.id)}
                                    title={t('delete')}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                <div className="p-4 border-t flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page {leadsPage} of {leadsTotalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={leadsPage === 1}
                      onClick={() => setLeadsPage(p => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={leadsPage >= leadsTotalPages}
                      onClick={() => setLeadsPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{t('users')}</h1>
                <p className="text-slate-500 mt-1">Manage system users</p>
              </div>
              <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-500 to-pink-500">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('createUser')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('createUser')}</DialogTitle>
                    <DialogDescription>Add a new user to the system</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('name')} *</Label>
                      <Input
                        value={userForm.name}
                        onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('email')} *</Label>
                      <Input
                        type="email"
                        value={userForm.email}
                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('password')} *</Label>
                      <Input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('role')}</Label>
                      <Select value={userForm.role} onValueChange={(v) => setUserForm({ ...userForm, role: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {user?.role === 'SUPER_ADMIN' && (
                            <SelectItem value="ADMIN">{t('admin')}</SelectItem>
                          )}
                          <SelectItem value="EMPLOYEE">{t('employee')}</SelectItem>
                          <SelectItem value="VIEWER">{t('viewer')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setShowUserDialog(false)}>
                        {t('cancel')}
                      </Button>
                      <Button type="submit">{t('save')}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.map((u) => (
                <Card key={u.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-lg font-medium">
                          {u.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-sm text-slate-500">{u.email}</p>
                          <div className="mt-1">{getRoleBadge(u.role)}</div>
                        </div>
                      </div>
                      {user?.role === 'SUPER_ADMIN' && u.id !== user?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteUser(u.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{t('messages')}</h1>
                <p className="text-slate-500 mt-1">Internal messaging system</p>
              </div>
              <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-500 to-pink-500">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('newMessage')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('newMessage')}</DialogTitle>
                    <DialogDescription>Send a message to users</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSendMessage} className="space-y-4">
                    {user?.role === 'SUPER_ADMIN' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="broadcast"
                          checked={messageForm.isBroadcast}
                          onChange={(e) => setMessageForm({ ...messageForm, isBroadcast: e.target.checked })}
                          className="rounded"
                        />
                        <Label htmlFor="broadcast">{t('broadcast')}</Label>
                      </div>
                    )}
                    {!messageForm.isBroadcast && (
                      <div className="space-y-2">
                        <Label>{t('to')} *</Label>
                        <Select
                          value={messageForm.toId}
                          onValueChange={(v) => {
                            const selectedUser = users.find(u => u.id === v);
                            setMessageForm({ ...messageForm, toId: v, toName: selectedUser?.name || '' });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select recipient" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.filter(u => u.id !== user?.id).map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>{t('subject')} *</Label>
                      <Input
                        value={messageForm.subject}
                        onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('message')} *</Label>
                      <Textarea
                        value={messageForm.content}
                        onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                        required
                        rows={4}
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setShowMessageDialog(false)}>
                        {t('cancel')}
                      </Button>
                      <Button type="submit">
                        <Send className="h-4 w-4 mr-2" />
                        {t('send')}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Tabs defaultValue="inbox">
              <TabsList>
                <TabsTrigger value="inbox">
                  <Mail className="h-4 w-4 mr-2" />
                  {t('inbox')} ({messages.inbox?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="sent">
                  <Send className="h-4 w-4 mr-2" />
                  {t('sent')} ({messages.sent?.length || 0})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="inbox" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                      {messages.inbox?.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">{t('noMessages')}</div>
                      ) : (
                        <div className="divide-y">
                          {messages.inbox?.map((msg) => (
                            <div key={msg.id} className={`p-4 hover:bg-slate-50 ${!msg.read ? 'bg-blue-50/50' : ''}`}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{msg.fromName}</span>
                                    {msg.isBroadcast && <Badge variant="secondary">Broadcast</Badge>}
                                    {!msg.read && <Badge className="bg-blue-500">New</Badge>}
                                  </div>
                                  <p className="font-medium mt-1">{msg.subject}</p>
                                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{msg.content}</p>
                                  <p className="text-xs text-slate-400 mt-2">
                                    {new Date(msg.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="sent" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                      {messages.sent?.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">{t('noMessages')}</div>
                      ) : (
                        <div className="divide-y">
                          {messages.sent?.map((msg) => (
                            <div key={msg.id} className="p-4 hover:bg-slate-50">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500">To:</span>
                                    <span className="font-medium">{msg.toName}</span>
                                    {msg.isBroadcast && <Badge variant="secondary">Broadcast</Badge>}
                                  </div>
                                  <p className="font-medium mt-1">{msg.subject}</p>
                                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{msg.content}</p>
                                  <p className="text-xs text-slate-400 mt-2">
                                    {new Date(msg.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Activity Log Tab */}
        {activeTab === 'activity' && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{t('activityLog')}</h1>
              <p className="text-slate-500 mt-1">Track all system activities</p>
            </div>

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="divide-y">
                    {activities.map((activity) => (
                      <div key={activity.id} className="p-4 hover:bg-slate-50">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-sm">
                            {activity.userName?.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{activity.userName}</span>
                              <Badge variant="outline">{activity.action.replace(/_/g, ' ')}</Badge>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{activity.description}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {new Date(activity.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Status Update Dialog for Interested */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update to Interested</DialogTitle>
            <DialogDescription>Add notes for this interested lead</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('notes')}</Label>
              <Textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Enter notes about why this lead is interested..."
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowStatusDialog(false); setStatusNotes(''); }}>
                {t('cancel')}
              </Button>
              <Button onClick={handleConfirmInterestedStatus} className="bg-green-500 hover:bg-green-600">
                <ThumbsUp className="h-4 w-4 mr-2" />
                Confirm Interested
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
