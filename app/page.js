'use client';

import {
    useState,
    useEffect,
    useCallback,
    useRef
} from 'react';
import {
    Button
} from '@/components/ui/button';
import {
    Input
} from '@/components/ui/input';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import {
    Badge
} from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
    Label
} from '@/components/ui/label';
import {
    Textarea
} from '@/components/ui/textarea';
import {
    ScrollArea
} from '@/components/ui/scroll-area';
import {
    Separator
} from '@/components/ui/separator';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@/components/ui/tabs';
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import {
    LayoutDashboard,
    Users,
    UserPlus,
    MessageSquare,
    Settings,
    LogOut,
    Search,
    Phone,
    PhoneOff,
    ThumbsUp,
    ThumbsDown,
    Clock,
    Plus,
    Download,
    Globe,
    Bell,
    ChevronRight,
    TrendingUp,
    Activity,
    Mail,
    Send,
    Trash2,
    Edit,
    Eye
} from 'lucide-react';
import {
    translations,
    isRTL
} from '@/lib/translations';

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
    const [projects, setProjects] = useState([]);
    const [leads, setLeads] = useState([]);
    const [leadsPage, setLeadsPage] = useState(1);
    const [leadsTotalPages, setLeadsTotalPages] = useState(1);
    const [leadsFilter, setLeadsFilter] = useState('ALL');
    const [leadsProjectId, setLeadsProjectId] = useState('');
    const [leadsSearch, setLeadsSearch] = useState('');
    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState({
        inbox: [],
        sent: []
    });
    const [activities, setActivities] = useState([]);

    // Dialog states
    const [showLeadDialog, setShowLeadDialog] = useState(false);
    const [showUserDialog, setShowUserDialog] = useState(false);
    const [showMessageDialog, setShowMessageDialog] = useState(false);
    const [showStatusDialog, setShowStatusDialog] = useState(false);
    const [showProjectDialog, setShowProjectDialog] = useState(false);
    const [projectDialogMode, setProjectDialogMode] = useState('create');
    const [editingProjectId, setEditingProjectId] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({
        open: false,
        title: '',
        description: '',
        confirmLabel: ''
    });
    const [selectedLead, setSelectedLead] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);

    // Form states
    const [loginForm, setLoginForm] = useState({
        email: '',
        password: ''
    });
    const [loginError, setLoginError] = useState('');
    const [leadForm, setLeadForm] = useState({
        projectId: '',
        fullName: '',
        phone: '',
        city: '',
        age: '',
        gender: 'MALE',
        diploma: '',
        needs: '',
        assignedTo: ''
    });
    const [projectForm, setProjectForm] = useState({
        name: '',
        description: '',
        memberIds: []
    });
    const [userForm, setUserForm] = useState({
        email: '',
        password: '',
        name: '',
        role: 'EMPLOYEE'
    });
    const [messageForm, setMessageForm] = useState({
        toId: '',
        toName: '',
        subject: '',
        content: '',
        isBroadcast: false
    });
    const [statusNotes, setStatusNotes] = useState('');
    const [pendingStatus, setPendingStatus] = useState('');

    const t = useCallback((key) => (translations[locale] && translations[locale][key]) || translations.en[key] || key, [locale]);
    const rtl = isRTL(locale);
    const confirmActionRef = useRef(null);

    const apiCall = useCallback(async (endpoint, options = {}) => {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`/api${endpoint}`, {
            ...options,
            headers
        });
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();
        let data = null;

        if (text) {
            try {
                data = JSON.parse(text);
            } catch (_) {
                data = null;
            }
        }

        if (!response.ok) {
            const messageFromJson = data && (data.error || data.message);
            const messageFromText = text ? text.slice(0, 200) : '';
            const message = messageFromJson || messageFromText || `Request failed (${response.status})`;
            throw new Error(message);
        }

        if (contentType.includes('application/json')) {
            return data || {};
        }
        return data || text;
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
            fetchProjects();
            fetchLeads();
            if (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) {
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
    }, [leadsPage, leadsFilter, leadsProjectId, leadsSearch]);

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
                ...(leadsFilter !== 'ALL' && {
                    status: leadsFilter
                }),
                ...(leadsProjectId && {
                    projectId: leadsProjectId
                }),
                ...(leadsSearch && {
                    search: leadsSearch
                })
            });
            const data = await apiCall(`/leads?${params}`);
            setLeads(data.items || []);
            setLeadsTotalPages(data.totalPages || 1);
        } catch (error) {
            console.error('Error fetching leads:', error);
        }
    };

    const fetchProjects = async () => {
        try {
            const data = await apiCall('/projects');
            setProjects(data.items || []);
        } catch (error) {
            console.error('Error fetching projects:', error);
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
            const isAdmin = !!user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN');
            const assignedTo = isAdmin ? leadForm.assignedTo : (user && user.id);
            await apiCall('/leads', {
                method: 'POST',
                body: JSON.stringify({
                    ...leadForm,
                    assignedTo,
                    age: leadForm.age ? parseInt(leadForm.age) : null
                })
            });
            setShowLeadDialog(false);
            const keepProjectId = leadForm.projectId || leadsProjectId || '';
            setLeadForm({
                projectId: keepProjectId,
                fullName: '',
                phone: '',
                city: '',
                age: '',
                gender: 'MALE',
                diploma: '',
                needs: '',
                assignedTo: ''
            });
            fetchLeads();
            fetchDashboardStats();
        } catch (error) {
            alert(error.message);
        }
    };

    const openCreateProjectDialog = () => {
        setProjectDialogMode('create');
        setEditingProjectId(null);
        setProjectForm({
            name: '',
            description: '',
            memberIds: []
        });
        setShowProjectDialog(true);
    };

    const openEditProjectDialog = (project) => {
        setProjectDialogMode('edit');
        setEditingProjectId(project.id);
        setProjectForm({
            name: project.name || '',
            description: project.description || '',
            memberIds: (project.members || []).map(m => m.id)
        });
        setShowProjectDialog(true);
    };

    const handleSaveProject = async (e) => {
        e.preventDefault();
        try {
            if (projectDialogMode === 'edit') {
                await apiCall(`/projects/${editingProjectId}`, {
                    method: 'PUT',
                    body: JSON.stringify(projectForm)
                });
            } else {
                await apiCall('/projects', {
                    method: 'POST',
                    body: JSON.stringify(projectForm)
                });
            }
            setShowProjectDialog(false);
            setProjectDialogMode('create');
            setEditingProjectId(null);
            setProjectForm({
                name: '',
                description: '',
                memberIds: []
            });
            fetchProjects();
        } catch (error) {
            alert(error.message);
        }
    };

    const openConfirm = ({
        title,
        description,
        confirmLabel,
        onConfirm
    }) => {
        confirmActionRef.current = onConfirm;
        setConfirmDialog({
            open: true,
            title,
            description,
            confirmLabel
        });
    };

    const handleConfirmAction = async () => {
        try {
            const fn = confirmActionRef.current;
            setConfirmDialog({
                open: false,
                title: '',
                description: '',
                confirmLabel: ''
            });
            confirmActionRef.current = null;
            if (typeof fn === 'function') await fn();
        } catch (error) {
            alert((error && error.message) || 'Action failed');
        }
    };

    const handleDeleteProject = async (projectId) => {
        openConfirm({
            title: 'Delete project?',
            description: 'This will permanently delete the project.',
            confirmLabel: 'Delete',
            onConfirm: async () => {
                await apiCall(`/projects/${projectId}`, {
                    method: 'DELETE'
                });
                if (leadsProjectId === projectId) {
                    setLeadsProjectId('');
                    setLeadsPage(1);
                }
                fetchProjects();
                fetchLeads();
                fetchDashboardStats();
            }
        });
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...userForm,
                email: (userForm.email || '').trim().toLowerCase(),
                name: (userForm.name || '').trim()
            };
            await apiCall('/users', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            setShowUserDialog(false);
            setUserForm({
                email: '',
                password: '',
                name: '',
                role: 'EMPLOYEE'
            });
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
                body: JSON.stringify({
                    status
                })
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
                body: JSON.stringify({
                    status: pendingStatus,
                    notes: statusNotes
                })
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
        openConfirm({
            title: 'Delete lead?',
            description: 'This will permanently delete the lead.',
            confirmLabel: 'Delete',
            onConfirm: async () => {
                await apiCall(`/leads/${leadId}`, {
                    method: 'DELETE'
                });
                fetchLeads();
                fetchDashboardStats();
            }
        });
    };

    const handleDeleteUser = async (userId) => {
        openConfirm({
            title: 'Delete user?',
            description: 'This will permanently delete the user.',
            confirmLabel: 'Delete',
            onConfirm: async () => {
                await apiCall(`/users/${userId}`, {
                    method: 'DELETE'
                });
                fetchUsers();
            }
        });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        try {
            await apiCall('/messages', {
                method: 'POST',
                body: JSON.stringify(messageForm)
            });
            setShowMessageDialog(false);
            setMessageForm({
                toId: '',
                toName: '',
                subject: '',
                content: '',
                isBroadcast: false
            });
            fetchMessages();
        } catch (error) {
            alert(error.message);
        }
    };

    const handleExportCSV = async () => {
        try {
            const params = new URLSearchParams({
                ...(leadsProjectId && {
                    projectId: leadsProjectId
                })
            });
            const response = await fetch(`/api/leads/export?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
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
        return <Badge className = {
            styles[status] || 'bg-gray-100'
        } > {
            labels[status] || status
        } < /Badge>;
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
        return <Badge className = {
            styles[role]
        } > {
            labels[role]
        } < /Badge>;
    };

    if (loading) {
        return ( <
            div className = "min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800" >
            <
            div className = "animate-spin rounded-full h-12 w-12 border-b-2 border-white" > < /div> < /
            div >
        );
    }

    // Login Page
    if (!isAuthenticated) {
        return ( <
            div className = {
                `min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 ${rtl ? 'rtl' : 'ltr'}`
            }
            dir = {
                rtl ? 'rtl' : 'ltr'
            } >
            <
            div className = "absolute top-4 right-4 flex items-center gap-2" >
            <
            Globe className = "h-4 w-4 text-white/60" / >
            <
            Select value = {
                locale
            }
            onValueChange = {
                handleLocaleChange
            } >
            <
            SelectTrigger className = "w-24 bg-white/10 border-white/20 text-white" >
            <
            SelectValue / >
            <
            /SelectTrigger> <
            SelectContent >
            <
            SelectItem value = "en" > English < /SelectItem> <
            SelectItem value = "ar" > العربية < /SelectItem> <
            SelectItem value = "fr" > Français < /SelectItem> < /
            SelectContent > <
            /Select> < /
            div >

            <
            Card className = "w-full max-w-md bg-white/10 backdrop-blur-xl border-white/20" >
            <
            CardHeader className = "text-center space-y-2" >
            <
            div className = "mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4" >
            <
            LayoutDashboard className = "h-8 w-8 text-white" / >
            <
            /div> <
            CardTitle className = "text-2xl font-bold text-white" > {
                t('welcomeBack')
            } < /CardTitle> <
            CardDescription className = "text-white/60" > {
                t('signInToContinue')
            } < /CardDescription> < /
            CardHeader > <
            CardContent >
            <
            form onSubmit = {
                handleLogin
            }
            className = "space-y-4" > {
                loginError && ( <
                    div className = "bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm" > {
                        loginError
                    } <
                    /div>
                )
            } <
            div className = "space-y-2" >
            <
            Label className = "text-white/80" > {
                t('email')
            } < /Label> <
            Input type = "email"
            placeholder = "admin@crm.com"
            value = {
                loginForm.email
            }
            onChange = {
                (e) => setLoginForm({
                    ...loginForm,
                    email: e.target.value
                })
            }
            className = "bg-white/10 border-white/20 text-white placeholder:text-white/40"
            required /
            >
            <
            /div> <
            div className = "space-y-2" >
            <
            Label className = "text-white/80" > {
                t('password')
            } < /Label> <
            Input type = "password"
            placeholder = "password123"
            value = {
                loginForm.password
            }
            onChange = {
                (e) => setLoginForm({
                    ...loginForm,
                    password: e.target.value
                })
            }
            className = "bg-white/10 border-white/20 text-white placeholder:text-white/40"
            required /
            >
            <
            /div> <
            Button type = "submit"
            className = "w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" > {
                t('login')
            } <
            /Button>  < /
            form > <
            /CardContent>  < /
            Card > <
            /div>
        );
    }

    // Main Dashboard
    return ( <
            div className = {
                `min-h-screen bg-slate-50 ${rtl ? 'rtl' : 'ltr'}`
            }
            dir = {
                rtl ? 'rtl' : 'ltr'
            } >
            <
            AlertDialog open = {
                confirmDialog.open
            }
            onOpenChange = {
                (open) => {
                    setConfirmDialog((prev) => ({
                        ...prev,
                        open
                    }));
                }
            } >
            <
            AlertDialogContent className = "bg-gradient-to-br from-white to-slate-50 border-slate-200" >
            <
            AlertDialogHeader >
            <
            AlertDialogTitle className = "text-slate-900" > {
                confirmDialog.title
            } < /AlertDialogTitle> <
            AlertDialogDescription className = "text-slate-600" > {
                confirmDialog.description
            } < /AlertDialogDescription> < /
            AlertDialogHeader > <
            AlertDialogFooter >
            <
            AlertDialogCancel onClick = {
                () => {
                    confirmActionRef.current = null;
                }
            } > {
                t('cancel')
            } < /AlertDialogCancel> <
            AlertDialogAction onClick = {
                handleConfirmAction
            }
            className = "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90" > {
                confirmDialog.confirmLabel || t('confirm')
            } < /
            AlertDialogAction > <
            /AlertDialogFooter> < /
            AlertDialogContent > <
            /AlertDialog> {
            /* Sidebar */
        } <
        aside className = {
            `fixed top-0 ${rtl ? 'right-0' : 'left-0'} h-full w-64 bg-slate-900 text-white z-50`
        } >
        <
        div className = "p-6" >
        <
        div className = "flex items-center gap-3" >
        <
        div className = "w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center" >
        <
        LayoutDashboard className = "h-5 w-5" / >
        <
        /div> <
    span className = "text-xl font-bold" > {
        t('appName')
    } < /span> < /
    div > <
        /div>

        <
        nav className = "px-4 space-y-1" >
        <
        button onClick = {
            () => setActiveTab('dashboard')
        }
    className = {
            `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`
        } >
        <
        LayoutDashboard className = "h-5 w-5" / > {
            t('dashboard')
        } <
        /button> <
    button onClick = {
        () => setActiveTab('leads')
    }
    className = {
            `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'leads' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`
        } >
        <
        Users className = "h-5 w-5" / > {
            t('leads')
        } <
        /button> <
    button onClick = {
        () => setActiveTab('projects')
    }
    className = {
            `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'projects' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`
        } >
        <
        Settings className = "h-5 w-5" / > {
            t('projects')
        } <
        /button> {
        (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) && ( <
            button onClick = {
                () => setActiveTab('users')
            }
            className = {
                `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'users' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`
            } >
            <
            UserPlus className = "h-5 w-5" / > {
                t('users')
            } <
            /button>
        )
} <
button onClick = {
    () => setActiveTab('messages')
}
className = {
        `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'messages' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`
    } >
    <
    MessageSquare className = "h-5 w-5" / > {
        t('messages')
    } {
        ((messages.inbox || []).filter(m => !m.read).length > 0) && ( <
            Badge className = "ml-auto bg-red-500" > {
                messages.inbox.filter(m => !m.read).length
            } < /Badge>
        )
    } <
    /button> {
    (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) && ( <
        button onClick = {
            () => setActiveTab('activity')
        }
        className = {
            `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'activity' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`
        } >
        <
        Activity className = "h-5 w-5" / > {
            t('activityLog')
        } <
        /button>
    )
} <
/nav>

<
div className = "absolute bottom-0 left-0 right-0 p-4 border-t border-white/10" >
    <
    div className = "flex items-center gap-3 mb-4" >
    <
    div className = "w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center" > {
        (user && user.name ? user.name.charAt(0) : '')
    } <
    /div> <
div className = "flex-1 min-w-0" >
    <
    p className = "text-sm font-medium truncate" > {
        (user && user.name)
    } < /p> <
div className = "text-xs text-white/60" > {
        getRoleBadge(user && user.role)
    } <
    /div> < /
div > <
    /div> <
div className = "flex items-center gap-2" >
    <
    Select value = {
        locale
    }
onValueChange = {
        handleLocaleChange
    } >
    <
    SelectTrigger className = "flex-1 bg-white/10 border-white/20 text-white text-sm" >
    <
    Globe className = "h-4 w-4 mr-2" / >
    <
    SelectValue / >
    <
    /SelectTrigger> <
SelectContent >
    <
    SelectItem value = "en" > English < /SelectItem> <
SelectItem value = "ar" > العربية < /SelectItem> <
SelectItem value = "fr" > Français < /SelectItem> < /
SelectContent > <
    /Select> <
Button variant = "ghost"
size = "icon"
onClick = {
    handleLogout
}
className = "text-white/60 hover:text-white hover:bg-white/10" >
    <
    LogOut className = "h-5 w-5" / >
    <
    /Button> < /
div > <
    /div> < /
aside >

    {
        /* Main Content */
    } <
    main className = {
        `${rtl ? 'mr-64' : 'ml-64'} p-8`
    } > {
        /* Dashboard Tab */
    } {
        activeTab === 'dashboard' && ( <
            div className = "space-y-6" >
            <
            div className = "flex items-center justify-between" >
            <
            div >
            <
            h1 className = "text-3xl font-bold text-slate-900" > {
                t('dashboard')
            } < /h1> <
            p className = "text-slate-500 mt-1" > Welcome back, {
                (user && user.name)
            } < /p> < /
            div > <
            /div>

            {
                /* Stats Cards */
            } <
            div className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" >
            <
            Card className = "bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0" >
            <
            CardContent className = "p-6" >
            <
            div className = "flex items-center justify-between" >
            <
            div >
            <
            p className = "text-blue-100 text-sm" > {
                t('totalLeads')
            } < /p> <
            p className = "text-3xl font-bold mt-1" > {
                (stats && stats.totalLeads) || 0
            } < /p> < /
            div > <
            Users className = "h-10 w-10 text-blue-200" / >
            <
            /div> < /
            CardContent > <
            /Card>

            <
            Card className = "bg-gradient-to-br from-green-500 to-green-600 text-white border-0" >
            <
            CardContent className = "p-6" >
            <
            div className = "flex items-center justify-between" >
            <
            div >
            <
            p className = "text-green-100 text-sm" > {
                t('interestedLeads')
            } < /p> <
            p className = "text-3xl font-bold mt-1" > {
                (stats && stats.interested) || 0
            } < /p> < /
            div > <
            ThumbsUp className = "h-10 w-10 text-green-200" / >
            <
            /div> < /
            CardContent > <
            /Card>

            <
            Card className = "bg-gradient-to-br from-red-500 to-red-600 text-white border-0" >
            <
            CardContent className = "p-6" >
            <
            div className = "flex items-center justify-between" >
            <
            div >
            <
            p className = "text-red-100 text-sm" > {
                t('notInterestedLeads')
            } < /p> <
            p className = "text-3xl font-bold mt-1" > {
                (stats && stats.notInterested) || 0
            } < /p> < /
            div > <
            ThumbsDown className = "h-10 w-10 text-red-200" / >
            <
            /div> < /
            CardContent > <
            /Card>

            <
            Card className = "bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0" >
            <
            CardContent className = "p-6" >
            <
            div className = "flex items-center justify-between" >
            <
            div >
            <
            p className = "text-purple-100 text-sm" > {
                t('conversionRate')
            } < /p> <
            p className = "text-3xl font-bold mt-1" > {
                (stats && stats.conversionRate) || 0
            } % < /p> < /
            div > <
            TrendingUp className = "h-10 w-10 text-purple-200" / >
            <
            /div> < /
            CardContent > <
            /Card> < /
            div >

            {
                /* Charts */
            } <
            div className = "grid grid-cols-1 lg:grid-cols-2 gap-6" >
            <
            Card >
            <
            CardHeader >
            <
            CardTitle > {
                t('statusDistribution')
            } < /CardTitle> < /
            CardHeader > <
            CardContent >
            <
            div className = "h-[300px]" >
            <
            ResponsiveContainer width = "100%"
            height = "100%" >
            <
            PieChart >
            <
            Pie data = {
                (stats && stats.statusDistribution) || []
            }
            cx = "50%"
            cy = "50%"
            innerRadius = {
                60
            }
            outerRadius = {
                100
            }
            paddingAngle = {
                5
            }
            dataKey = "value" > {
                (((stats && stats.statusDistribution) || [])).map((entry, index) => ( <
                    Cell key = {
                        `cell-${index}`
                    }
                    fill = {
                        COLORS[index % COLORS.length]
                    }
                    />
                ))
            } <
            /Pie> <
            Tooltip / >
            <
            Legend / >
            <
            /PieChart> < /
            ResponsiveContainer > <
            /div> < /
            CardContent > <
            /Card>

            <
            Card >
            <
            CardHeader >
            <
            CardTitle > {
                t('genderDistribution')
            } < /CardTitle> < /
            CardHeader > <
            CardContent >
            <
            div className = "h-[300px]" >
            <
            ResponsiveContainer width = "100%"
            height = "100%" >
            <
            PieChart >
            <
            Pie data = {
                [{
                        name: t('male'),
                        value: (stats && stats.genderDistribution && stats.genderDistribution.male) || 0
                    },
                    {
                        name: t('female'),
                        value: (stats && stats.genderDistribution && stats.genderDistribution.female) || 0
                    }
                ]
            }
            cx = "50%"
            cy = "50%"
            innerRadius = {
                60
            }
            outerRadius = {
                100
            }
            paddingAngle = {
                5
            }
            dataKey = "value" > {
                GENDER_COLORS.map((color, index) => ( <
                    Cell key = {
                        `cell-${index}`
                    }
                    fill = {
                        color
                    }
                    />
                ))
            } <
            /Pie> <
            Tooltip / >
            <
            Legend / >
            <
            /PieChart> < /
            ResponsiveContainer > <
            /div> < /
            CardContent > <
            /Card> < /
            div >

            {
                /* Employee Performance */
            } {
                stats && stats.employeePerformance && stats.employeePerformance.length > 0 && ( <
                    Card >
                    <
                    CardHeader >
                    <
                    CardTitle > {
                        t('employeePerformance')
                    } < /CardTitle> < /
                    CardHeader > <
                    CardContent >
                    <
                    div className = "h-[300px]" >
                    <
                    ResponsiveContainer width = "100%"
                    height = "100%" >
                    <
                    BarChart data = {
                        stats.employeePerformance
                    } >
                    <
                    CartesianGrid strokeDasharray = "3 3" / >
                    <
                    XAxis dataKey = "name" / >
                    <
                    YAxis / >
                    <
                    Tooltip / >
                    <
                    Bar dataKey = "total"
                    fill = "#3B82F6"
                    name = "Total Leads" / >
                    <
                    Bar dataKey = "interested"
                    fill = "#10B981"
                    name = "Interested" / >
                    <
                    /BarChart> < /
                    ResponsiveContainer > <
                    /div> < /
                    CardContent > <
                    /Card>
                )
            } <
            /div>
        )
    }

{
    /* Projects Tab */
} {
    activeTab === 'projects' && ( <
            div className = "space-y-6" >
            <
            div className = "flex items-center justify-between" >
            <
            div >
            <
            h1 className = "text-3xl font-bold text-slate-900" > {
                t('projects')
            } < /h1> <
            p className = "text-slate-500 mt-1" > {
                t('projectsSubtitle')
            } < /p> < /
            div > {
                (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) && ( <
                    Dialog open = {
                        showProjectDialog
                    }
                    onOpenChange = {
                        (open) => {
                            setShowProjectDialog(open);
                            if (!open) {
                                setProjectDialogMode('create');
                                setEditingProjectId(null);
                                setProjectForm({
                                    name: '',
                                    description: '',
                                    memberIds: []
                                });
                            }
                        }
                    } >
                    <
                    DialogTrigger onClick = {
                        openCreateProjectDialog
                    }
                    className = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600" > <
                    Plus className = "h-4 w-4" / > {
                        t('addProject')
                    } < /DialogTrigger> <
                    DialogContent >
                    <
                    DialogHeader >
                    <
                    DialogTitle > {
                        projectDialogMode === 'edit' ? t('editProject') : t('addProject')
                    } < /DialogTitle> <
                    DialogDescription > {
                        projectDialogMode === 'edit' ? t('editProjectDescription') : t('createProjectDescription')
                    } < /DialogDescription> < /
                    DialogHeader > <
                    form onSubmit = {
                        handleSaveProject
                    }
                    className = "space-y-4" >
                    <
                    div className = "space-y-2" >
                    <
                    Label > {
                        t('projectName')
                    }* < /Label> <
                    Input value = {
                        projectForm.name
                    }
                    onChange = {
                        (e) => setProjectForm({
                            ...projectForm,
                            name: e.target.value
                        })
                    }
                    required /
                    >
                    <
                    /div> <
                    div className = "space-y-2" >
                    <
                    Label > {
                        t('description')
                    } < /Label> <
                    Textarea value = {
                        projectForm.description
                    }
                    onChange = {
                        (e) => setProjectForm({
                            ...projectForm,
                            description: e.target.value
                        })
                    }
                    rows = {
                        3
                    }
                    /> < /
                    div > <
                    div className = "space-y-2" >
                    <
                    Label > {
                        t('members')
                    } < /Label> <
                    ScrollArea className = "h-44 rounded-md border p-3" >
                    <
                    div className = "space-y-2" > {
                        users.filter(u => u.role === 'EMPLOYEE').map((u) => {
                            const checked = projectForm.memberIds.includes(u.id);
                            return ( <
                                label key = {
                                    u.id
                                }
                                className = "flex items-center gap-2 text-sm" >
                                <
                                input type = "checkbox"
                                checked = {
                                    checked
                                }
                                onChange = {
                                    (e) => {
                                        const next = e.target.checked ?
                                            Array.from(new Set([...projectForm.memberIds, u.id])) :
                                            projectForm.memberIds.filter(id => id !== u.id);
                                        setProjectForm({
                                            ...projectForm,
                                            memberIds: next
                                        });
                                    }
                                }
                                /> <
                                span className = "text-slate-900" > {
                                    u.name
                                } < /span> < /
                                label >
                            );
                        })
                    } {
                        users.filter(u => u.role === 'EMPLOYEE').length === 0 && ( <
                            p className = "text-sm text-slate-500" > {
                                t('noEmployees')
                            } < /p>
                        )
                    } <
                    /div> < /
                    ScrollArea > <
                    /div> <
                    div className = "flex justify-end gap-3" >
                    <
                    Button type = "button"
                    variant = "outline"
                    onClick = {
                        () => setShowProjectDialog(false)
                    } > {
                        t('cancel')
                    } <
                    /Button> <
                    Button type = "submit" > {
                        t('save')
                    } < /Button> < /
                    div > <
                    /form> < /
                    DialogContent > <
                    /Dialog>
                )
            } <
            /div>

            <
            Card >
            <
            CardContent className = "p-0" >
            <
            div className = "overflow-x-auto" >
            <
            table className = "w-full" >
            <
            thead className = "bg-slate-50 border-b" >
            <
            tr >
            <
            th className = "text-left p-4 font-medium text-slate-600" > {
                t('projectName')
            } < /th> <
            th className = "text-left p-4 font-medium text-slate-600" > {
                t('description')
            } < /th> <
            th className = "text-left p-4 font-medium text-slate-600" > {
                t('members')
            } < /th> <
            th className = "text-left p-4 font-medium text-slate-600" > {
                t('actions')
            } < /th> < /
            tr > <
            /thead> <
            tbody className = "divide-y" > {
                projects.map((p) => ( <
                        tr key = {
                            p.id
                        }
                        className = "hover:bg-slate-50" >
                        <
                        td className = "p-4" >
                        <
                        p className = "font-medium text-slate-900" > {
                            p.name
                        } < /p> < /
                        td > <
                        td className = "p-4" >
                        <
                        p className = "text-sm text-slate-700" > {
                            p.description || '-'
                        } < /p> < /
                        td > <
                        td className = "p-4" >
                        <
                        div className = "flex flex-wrap gap-2" > {
                            (p.members || []).slice(0, 6).map((m) => ( <
                                Badge key = {
                                    m.id
                                }
                                className = "bg-slate-100 text-slate-700" > {
                                    m.name
                                } < /Badge>
                            ))
                        } {
                            (p.members || []).length > 6 && ( <
                                Badge className = "bg-slate-100 text-slate-700" > +{
                                    (p.members || []).length - 6
                                } < /Badge>
                            )
                        } {
                            (p.members || []).length === 0 && ( <
                                span className = "text-sm text-slate-500" > - < /span>
                            )
                        } <
                        /div> < /
                        td > <
                        td className = "p-4" >
                        <
                        div className = "flex items-center gap-2" >
                        <
                        Button size = "sm"
                        variant = "outline"
                        onClick = {
                            () => {
                                setLeadsProjectId(p.id);
                                setLeadsPage(1);
                                setActiveTab('leads');
                            }
                        } >
                        <
                        Eye className = "h-4 w-4 mr-2" / > {
                            t('viewLeads')
                        } <
                        /Button> {
                        (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) && ( <
                            Button size = "sm"
                            variant = "outline"
                            onClick = {
                                () => openEditProjectDialog(p)
                            } >
                            <
                            Edit className = "h-4 w-4" / >
                            <
                            /Button>
                        )
                    } {
                        (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) && ( <
                            Button size = "sm"
                            variant = "outline"
                            onClick = {
                                () => handleDeleteProject(p.id)
                            } >
                            <
                            Trash2 className = "h-4 w-4" / >
                            <
                            /Button>
                        )
                    } <
                    /div> < /
                    td > <
                    /tr>
                ))
        } {
            projects.length === 0 && ( <
                tr >
                <
                td className = "p-8 text-center text-slate-500"
                colSpan = {
                    4
                } > {
                    t('noProjects')
                } <
                /td> < /
                tr >
            )
        } <
        /tbody> < /
    table > <
        /div> < /
    CardContent > <
        /Card> < /
    div >
)
}

{
    /* Leads Tab */
} {
    activeTab === 'leads' && ( <
            div className = "space-y-6" >
            <
            div className = "flex items-center justify-between" >
            <
            div >
            <
            h1 className = "text-3xl font-bold text-slate-900" > {
                t('leads')
            } < /h1> <
            p className = "text-slate-500 mt-1" > Manage your customer leads < /p> < /
            div > <
            div className = "flex items-center gap-3" >
            <
            Button variant = "outline"
            onClick = {
                handleExportCSV
            } >
            <
            Download className = "h-4 w-4 mr-2" / > {
                t('export')
            } <
            /Button> {
            user && user.role !== 'VIEWER' && ( <
                Dialog open = {
                    showLeadDialog
                }
                onOpenChange = {
                    setShowLeadDialog
                } >
                <
                DialogTrigger className = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600" > <
                Plus className = "h-4 w-4" / > {
                    t('addLead')
                } < /DialogTrigger> <
                DialogContent >
                <
                DialogHeader >
                <
                DialogTitle > {
                    t('addLead')
                } < /DialogTitle> <
                DialogDescription > Create a new lead in the system < /DialogDescription> < /
                DialogHeader > <
                form onSubmit = {
                    handleCreateLead
                }
                className = "space-y-4" >
                <
                div className = "grid grid-cols-2 gap-4" >
                <
                div className = "space-y-2 col-span-2" >
                <
                Label > {
                    t('project')
                }* < /Label> <
                Select value = {
                    leadForm.projectId
                }
                onValueChange = {
                    (v) => setLeadForm({
                        ...leadForm,
                        projectId: v,
                        assignedTo: ''
                    })
                } >
                <
                SelectTrigger >
                <
                SelectValue placeholder = {
                    t('selectProject')
                }
                /> < /
                SelectTrigger > <
                SelectContent > {
                    projects.map((p) => ( <
                        SelectItem key = {
                            p.id
                        }
                        value = {
                            p.id
                        } > {
                            p.name
                        } < /SelectItem>
                    ))
                } <
                /SelectContent> < /
                Select > <
                /div> <
                div className = "space-y-2" >
                <
                Label > {
                    t('fullName')
                }* < /Label> <
                Input value = {
                    leadForm.fullName
                }
                onChange = {
                    (e) => setLeadForm({
                        ...leadForm,
                        fullName: e.target.value
                    })
                }
                required /
                >
                <
                /div> <
                div className = "space-y-2" >
                <
                Label > {
                    t('phone')
                }* < /Label> <
                Input value = {
                    leadForm.phone
                }
                onChange = {
                    (e) => setLeadForm({
                        ...leadForm,
                        phone: e.target.value
                    })
                }
                required /
                >
                <
                /div> <
                div className = "space-y-2" >
                <
                Label > {
                    t('city')
                } < /Label> <
                Input value = {
                    leadForm.city
                }
                onChange = {
                    (e) => setLeadForm({
                        ...leadForm,
                        city: e.target.value
                    })
                }
                /> < /
                div > <
                div className = "space-y-2" >
                <
                Label > {
                    t('age')
                } < /Label> <
                Input type = "number"
                value = {
                    leadForm.age
                }
                onChange = {
                    (e) => setLeadForm({
                        ...leadForm,
                        age: e.target.value
                    })
                }
                /> < /
                div > <
                div className = "space-y-2 col-span-2" >
                <
                Label > {
                    t('gender')
                } < /Label> <
                Select value = {
                    leadForm.gender
                }
                onValueChange = {
                    (v) => setLeadForm({
                        ...leadForm,
                        gender: v
                    })
                } >
                <
                SelectTrigger >
                <
                SelectValue / >
                <
                /SelectTrigger> <
                SelectContent >
                <
                SelectItem value = "MALE" > {
                    t('male')
                } < /SelectItem> <
                SelectItem value = "FEMALE" > {
                    t('female')
                } < /SelectItem> < /
                SelectContent > <
                /Select> < /
                div > {
                    (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) && ( <
                        div className = "space-y-2 col-span-2" >
                        <
                        Label > {
                            t('assignedTo')
                        }* < /Label> <
                        Select value = {
                            leadForm.assignedTo
                        }
                        onValueChange = {
                            (v) => setLeadForm({
                                ...leadForm,
                                assignedTo: v
                            })
                        }
                        disabled = {
                            !leadForm.projectId
                        } >
                        <
                        SelectTrigger >
                        <
                        SelectValue placeholder = {
                            leadForm.projectId ? t('selectUser') : t('selectProject')
                        }
                        /> < /
                        SelectTrigger > <
                        SelectContent > {
                            (((projects.find(p => p.id === leadForm.projectId) || {}).members) || []).map((m) => ( <
                                SelectItem key = {
                                    m.id
                                }
                                value = {
                                    m.id
                                } > {
                                    m.name
                                } < /SelectItem>
                            ))
                        } <
                        /SelectContent> < /
                        Select > <
                        /div>
                    )
                } <
                div className = "space-y-2" >
                <
                Label > {
                    t('diploma')
                } < /Label> <
                Input value = {
                    leadForm.diploma
                }
                onChange = {
                    (e) => setLeadForm({
                        ...leadForm,
                        diploma: e.target.value
                    })
                }
                /> < /
                div > <
                div className = "space-y-2" >
                <
                Label > {
                    t('needs')
                } < /Label> <
                Input value = {
                    leadForm.needs
                }
                onChange = {
                    (e) => setLeadForm({
                        ...leadForm,
                        needs: e.target.value
                    })
                }
                /> < /
                div > <
                /div> <
                div className = "flex justify-end gap-3" >
                <
                Button type = "button"
                variant = "outline"
                onClick = {
                    () => setShowLeadDialog(false)
                } > {
                    t('cancel')
                } <
                /Button> <
                Button type = "submit" > {
                    t('save')
                } < /Button> < /
                div > <
                /form> < /
                DialogContent > <
                /Dialog>
            )
        } <
        /div> < /
    div >

        {
            /* Filters */
        } <
        Card >
        <
        CardContent className = "p-4" >
        <
        div className = "flex items-center gap-4" >
        <
        div className = "flex-1 relative" >
        <
        Search className = "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" / >
        <
        Input placeholder = {
            t('search') + '...'
        }
    value = {
        leadsSearch
    }
    onChange = {
        (e) => setLeadsSearch(e.target.value)
    }
    className = "pl-10" /
        >
        <
        /div> <
    Select value = {
        leadsProjectId || 'ALL'
    }
    onValueChange = {
            (v) => {
                setLeadsProjectId(v === 'ALL' ? '' : v);
                setLeadsPage(1);
            }
        } >
        <
        SelectTrigger className = "w-56" >
        <
        SelectValue placeholder = {
            t('project')
        }
    /> < /
    SelectTrigger > <
        SelectContent >
        <
        SelectItem value = "ALL" > {
            t('allProjects')
        } < /SelectItem> {
    projects.map((p) => ( <
        SelectItem key = {
            p.id
        }
        value = {
            p.id
        } > {
            p.name
        } < /SelectItem>
    ))
} <
/SelectContent> < /
Select > <
    Select value = {
        leadsFilter
    }
onValueChange = {
        (v) => {
            setLeadsFilter(v);
            setLeadsPage(1);
        }
    } >
    <
    SelectTrigger className = "w-48" >
    <
    SelectValue placeholder = {
        t('filter')
    }
/> < /
SelectTrigger > <
    SelectContent >
    <
    SelectItem value = "ALL" > All Status < /SelectItem> <
SelectItem value = "NEW" > {
    t('new')
} < /SelectItem> <
SelectItem value = "INTERESTED" > {
    t('interested')
} < /SelectItem> <
SelectItem value = "NOT_INTERESTED" > {
    t('notInterested')
} < /SelectItem> <
SelectItem value = "NO_ANSWER" > {
    t('noAnswer')
} < /SelectItem> <
SelectItem value = "PHONE_OFF" > {
    t('phoneOff')
} < /SelectItem> < /
SelectContent > <
    /Select> < /
div > <
    /CardContent> < /
Card >

    {
        /* Leads Table */
    } <
    Card >
    <
    CardContent className = "p-0" >
    <
    div className = "overflow-x-auto" >
    <
    table className = "w-full" >
    <
    thead className = "bg-slate-50 border-b" >
    <
    tr >
    <
    th className = "text-left p-4 font-medium text-slate-600" > {
        t('project')
    } < /th> <
th className = "text-left p-4 font-medium text-slate-600" > {
    t('fullName')
} < /th> <
th className = "text-left p-4 font-medium text-slate-600" > {
    t('phone')
} < /th> <
th className = "text-left p-4 font-medium text-slate-600" > {
    t('city')
} < /th> <
th className = "text-left p-4 font-medium text-slate-600" > {
    t('gender')
} < /th> <
th className = "text-left p-4 font-medium text-slate-600" > {
    t('status')
} < /th> <
th className = "text-left p-4 font-medium text-slate-600" > {
    t('actions')
} < /th> < /
tr > <
    /thead> <
tbody className = "divide-y" > {
    leads.map((lead) => ( <
            tr key = {
                lead.id
            }
            className = "hover:bg-slate-50" >
            <
            td className = "p-4" >
            <
            span className = "text-sm text-slate-700" > {
                lead.projectName || (projects.find(p => p.id === lead.projectId) || {}).name || '-'
            } < /span> < /
            td > <
            td className = "p-4" >
            <
            div >
            <
            p className = "font-medium" > {
                lead.fullName
            } < /p> <
            p className = "text-sm text-slate-500" > {
                lead.age
            }
            yrs < /p> < /
            div > <
            /td> <
            td className = "p-4" > {
                lead.phone
            } < /td> <
            td className = "p-4" > {
                lead.city
            } < /td> <
            td className = "p-4" >
            <
            Badge variant = "outline" > {
                lead.gender === 'MALE' ? t('male') : t('female')
            } < /Badge> < /
            td > <
            td className = "p-4" > {
                getStatusBadge(lead.status)
            } < /td> <
            td className = "p-4" > {
                user && user.role !== 'VIEWER' && ( <
                    div className = "flex items-center gap-1" >
                    <
                    Button size = "sm"
                    variant = "ghost"
                    onClick = {
                        () => handleUpdateLeadStatus(lead.id, 'NO_ANSWER')
                    }
                    title = {
                        t('noAnswer')
                    } >
                    <
                    Phone className = "h-4 w-4 text-yellow-500" / >
                    <
                    /Button> <
                    Button size = "sm"
                    variant = "ghost"
                    onClick = {
                        () => handleUpdateLeadStatus(lead.id, 'PHONE_OFF')
                    }
                    title = {
                        t('phoneOff')
                    } >
                    <
                    PhoneOff className = "h-4 w-4 text-gray-500" / >
                    <
                    /Button> <
                    Button size = "sm"
                    variant = "ghost"
                    onClick = {
                        () => handleUpdateLeadStatus(lead.id, 'NOT_INTERESTED')
                    }
                    title = {
                        t('notInterested')
                    } >
                    <
                    ThumbsDown className = "h-4 w-4 text-red-500" / >
                    <
                    /Button> <
                    Button size = "sm"
                    variant = "ghost"
                    onClick = {
                        () => handleUpdateLeadStatus(lead.id, 'INTERESTED')
                    }
                    title = {
                        t('interested')
                    } >
                    <
                    ThumbsUp className = "h-4 w-4 text-green-500" / >
                    <
                    /Button> {
                    (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) && ( <
                        Button size = "sm"
                        variant = "ghost"
                        onClick = {
                            () => handleDeleteLead(lead.id)
                        }
                        title = {
                            t('delete')
                        } >
                        <
                        Trash2 className = "h-4 w-4 text-red-500" / >
                        <
                        /Button>
                    )
                } <
                /div>
            )
        } <
        /td> < /
        tr >
    ))
} <
/tbody> < /
table > <
    /div>

{
    /* Pagination */
} <
div className = "p-4 border-t flex items-center justify-between" >
    <
    p className = "text-sm text-slate-500" >
    Page {
        leadsPage
    } of {
        leadsTotalPages
    } <
    /p> <
div className = "flex items-center gap-2" >
    <
    Button variant = "outline"
size = "sm"
disabled = {
    leadsPage === 1
}
onClick = {
        () => setLeadsPage(p => p - 1)
    } >
    Previous <
    /Button> <
Button variant = "outline"
size = "sm"
disabled = {
    leadsPage >= leadsTotalPages
}
onClick = {
        () => setLeadsPage(p => p + 1)
    } >
    Next <
    /Button> < /
div > <
    /div> < /
CardContent > <
    /Card> < /
div >
)
}

{
    /* Users Tab */
} {
    activeTab === 'users' && user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && ( <
            div className = "space-y-6" >
            <
            div className = "flex items-center justify-between" >
            <
            div >
            <
            h1 className = "text-3xl font-bold text-slate-900" > {
                t('users')
            } < /h1> <
            p className = "text-slate-500 mt-1" > Manage system users < /p> < /
            div > <
            Dialog open = {
                showUserDialog
            }
            onOpenChange = {
                setShowUserDialog
            } >
            <
            DialogTrigger className = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600" > <
            Plus className = "h-4 w-4" / > {
                t('createUser')
            } < /DialogTrigger> <
            DialogContent >
            <
            DialogHeader >
            <
            DialogTitle > {
                t('createUser')
            } < /DialogTitle> <
            DialogDescription > Add a new user to the system < /DialogDescription> < /
            DialogHeader > <
            form onSubmit = {
                handleCreateUser
            }
            className = "space-y-4" >
            <
            div className = "space-y-2" >
            <
            Label > {
                t('name')
            }* < /Label> <
            Input value = {
                userForm.name
            }
            onChange = {
                (e) => setUserForm({
                    ...userForm,
                    name: e.target.value
                })
            }
            required /
            >
            <
            /div> <
            div className = "space-y-2" >
            <
            Label > {
                t('email')
            }* < /Label> <
            Input type = "email"
            value = {
                userForm.email
            }
            onChange = {
                (e) => setUserForm({
                    ...userForm,
                    email: e.target.value
                })
            }
            required /
            >
            <
            /div> <
            div className = "space-y-2" >
            <
            Label > {
                t('password')
            }* < /Label> <
            Input type = "password"
            value = {
                userForm.password
            }
            onChange = {
                (e) => setUserForm({
                    ...userForm,
                    password: e.target.value
                })
            }
            required /
            >
            <
            /div> <
            div className = "space-y-2" >
            <
            Label > {
                t('role')
            } < /Label> <
            Select value = {
                userForm.role
            }
            onValueChange = {
                (v) => setUserForm({
                    ...userForm,
                    role: v
                })
            } >
            <
            SelectTrigger >
            <
            SelectValue / >
            <
            /SelectTrigger> <
            SelectContent > {
                (user && user.role === 'SUPER_ADMIN') && ( <
                    SelectItem value = "ADMIN" > {
                        t('admin')
                    } < /SelectItem>
                )
            } <
            SelectItem value = "EMPLOYEE" > {
                t('employee')
            } < /SelectItem> <
            SelectItem value = "VIEWER" > {
                t('viewer')
            } < /SelectItem> < /
            SelectContent > <
            /Select> < /
            div > <
            div className = "flex justify-end gap-3" >
            <
            Button type = "button"
            variant = "outline"
            onClick = {
                () => setShowUserDialog(false)
            } > {
                t('cancel')
            } <
            /Button> <
            Button type = "submit" > {
                t('save')
            } < /Button> < /
            div > <
            /form> < /
            DialogContent > <
            /Dialog> < /
            div >

            <
            div className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" > {
                users.map((u) => ( <
                        Card key = {
                            u.id
                        } >
                        <
                        CardContent className = "p-6" >
                        <
                        div className = "flex items-start justify-between" >
                        <
                        div className = "flex items-center gap-4" >
                        <
                        div className = "w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-lg font-medium" > {
                            (u.name ? u.name.charAt(0) : '')
                        } <
                        /div> <
                        div >
                        <
                        p className = "font-medium" > {
                            u.name
                        } < /p> <
                        p className = "text-sm text-slate-500" > {
                            u.email
                        } < /p> <
                        div className = "mt-1" > {
                            getRoleBadge(u.role)
                        } < /div> < /
                        div > <
                        /div> {
                        (user && ((user.role === 'SUPER_ADMIN' && u.id !== user.id) || (user.role === 'ADMIN' && (u.role === 'EMPLOYEE' || u.role === 'VIEWER')))) && ( <
                            Button size = "sm"
                            variant = "ghost"
                            onClick = {
                                () => handleDeleteUser(u.id)
                            } >
                            <
                            Trash2 className = "h-4 w-4 text-red-500" / >
                            <
                            /Button>
                        )
                    } <
                    /div> < /
                    CardContent > <
                    /Card>
                ))
        } <
        /div> < /
    div >
)
}

{
    /* Messages Tab */
} {
    activeTab === 'messages' && ( <
            div className = "space-y-6" >
            <
            div className = "flex items-center justify-between" >
            <
            div >
            <
            h1 className = "text-3xl font-bold text-slate-900" > {
                t('messages')
            } < /h1> <
            p className = "text-slate-500 mt-1" > Internal messaging system < /p> < /
            div > <
            Dialog open = {
                showMessageDialog
            }
            onOpenChange = {
                setShowMessageDialog
            } >
            <
            DialogTrigger className = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600" > <
            Plus className = "h-4 w-4" / > {
                t('newMessage')
            } < /DialogTrigger> <
            DialogContent >
            <
            DialogHeader >
            <
            DialogTitle > {
                t('newMessage')
            } < /DialogTitle> <
            DialogDescription > Send a message to users < /DialogDescription> < /
            DialogHeader > <
            form onSubmit = {
                handleSendMessage
            }
            className = "space-y-4" > {
                (user && user.role === 'SUPER_ADMIN') && ( <
                    div className = "flex items-center gap-2" >
                    <
                    input type = "checkbox"
                    id = "broadcast"
                    checked = {
                        messageForm.isBroadcast
                    }
                    onChange = {
                        (e) => setMessageForm({
                            ...messageForm,
                            isBroadcast: e.target.checked
                        })
                    }
                    className = "rounded" /
                    >
                    <
                    Label htmlFor = "broadcast" > {
                        t('broadcast')
                    } < /Label> < /
                    div >
                )
            } {
                !messageForm.isBroadcast && ( <
                    div className = "space-y-2" >
                    <
                    Label > {
                        t('to')
                    }* < /Label> <
                    Select value = {
                        messageForm.toId
                    }
                    onValueChange = {
                        (v) => {
                            const selectedUser = users.find(u => u.id === v);
                            setMessageForm({
                                ...messageForm,
                                toId: v,
                                toName: (selectedUser && selectedUser.name) || ''
                            });
                        }
                    } >
                    <
                    SelectTrigger >
                    <
                    SelectValue placeholder = "Select recipient" / >
                    <
                    /SelectTrigger> <
                    SelectContent > {
                        users.filter(u => !user || u.id !== user.id).map(u => ( <
                            SelectItem key = {
                                u.id
                            }
                            value = {
                                u.id
                            } > {
                                u.name
                            } < /SelectItem>
                        ))
                    } <
                    /SelectContent> < /
                    Select > <
                    /div>
                )
            } <
            div className = "space-y-2" >
            <
            Label > {
                t('subject')
            }* < /Label> <
            Input value = {
                messageForm.subject
            }
            onChange = {
                (e) => setMessageForm({
                    ...messageForm,
                    subject: e.target.value
                })
            }
            required /
            >
            <
            /div> <
            div className = "space-y-2" >
            <
            Label > {
                t('message')
            }* < /Label> <
            Textarea value = {
                messageForm.content
            }
            onChange = {
                (e) => setMessageForm({
                    ...messageForm,
                    content: e.target.value
                })
            }
            required rows = {
                4
            }
            /> < /
            div > <
            div className = "flex justify-end gap-3" >
            <
            Button type = "button"
            variant = "outline"
            onClick = {
                () => setShowMessageDialog(false)
            } > {
                t('cancel')
            } <
            /Button> <
            Button type = "submit" >
            <
            Send className = "h-4 w-4 mr-2" / > {
                t('send')
            } <
            /Button> < /
            div > <
            /form> < /
            DialogContent > <
            /Dialog> < /
            div >

            <
            Tabs defaultValue = "inbox" >
            <
            TabsList >
            <
            TabsTrigger value = "inbox" >
            <
            Mail className = "h-4 w-4 mr-2" / > {
                t('inbox')
            }({
                messages.inbox ? messages.inbox.length : 0
            }) <
            /TabsTrigger> <
            TabsTrigger value = "sent" >
            <
            Send className = "h-4 w-4 mr-2" / > {
                t('sent')
            }({
                messages.sent ? messages.sent.length : 0
            }) <
            /TabsTrigger> < /
            TabsList >

            <
            TabsContent value = "inbox"
            className = "mt-4" >
            <
            Card >
            <
            CardContent className = "p-0" >
            <
            ScrollArea className = "h-[500px]" > {
                (messages.inbox ? messages.inbox.length : 0) === 0 ? ( <
                    div className = "p-8 text-center text-slate-500" > {
                        t('noMessages')
                    } < /div>
                ) : ( <
                        div className = "divide-y" > {
                            (messages.inbox || []).map((msg) => ( <
                                    div key = {
                                        msg.id
                                    }
                                    className = {
                                        `p-4 hover:bg-slate-50 ${!msg.read ? 'bg-blue-50/50' : ''}`
                                    } >
                                    <
                                    div className = "flex items-start justify-between" >
                                    <
                                    div className = "flex-1" >
                                    <
                                    div className = "flex items-center gap-2" >
                                    <
                                    span className = "font-medium" > {
                                        msg.fromName
                                    } < /span> {
                                    msg.isBroadcast && < Badge variant = "secondary" > Broadcast < /Badge>
                                } {
                                    !msg.read && < Badge className = "bg-blue-500" > New < /Badge>
                                } <
                                /div> <
                                p className = "font-medium mt-1" > {
                                    msg.subject
                                } < /p> <
                                p className = "text-sm text-slate-500 mt-1 line-clamp-2" > {
                                    msg.content
                                } < /p> <
                                p className = "text-xs text-slate-400 mt-2" > {
                                    new Date(msg.createdAt).toLocaleString()
                                } <
                                /p> < /
                                div > <
                                /div> < /
                                div >
                            ))
                    } <
                    /div>
            )
        } <
        /ScrollArea> < /
    CardContent > <
        /Card> < /
    TabsContent >

        <
        TabsContent value = "sent"
    className = "mt-4" >
        <
        Card >
        <
        CardContent className = "p-0" >
        <
        ScrollArea className = "h-[500px]" > {
            (messages.sent ? messages.sent.length : 0) === 0 ? ( <
                div className = "p-8 text-center text-slate-500" > {
                    t('noMessages')
                } < /div>
            ) : ( <
                    div className = "divide-y" > {
                        (messages.sent || []).map((msg) => ( <
                                div key = {
                                    msg.id
                                }
                                className = "p-4 hover:bg-slate-50" >
                                <
                                div className = "flex items-start justify-between" >
                                <
                                div className = "flex-1" >
                                <
                                div className = "flex items-center gap-2" >
                                <
                                span className = "text-slate-500" > To: < /span> <
                                span className = "font-medium" > {
                                    msg.toName
                                } < /span> {
                                msg.isBroadcast && < Badge variant = "secondary" > Broadcast < /Badge>
                            } <
                            /div> <
                            p className = "font-medium mt-1" > {
                                msg.subject
                            } < /p> <
                            p className = "text-sm text-slate-500 mt-1 line-clamp-2" > {
                                msg.content
                            } < /p> <
                            p className = "text-xs text-slate-400 mt-2" > {
                                new Date(msg.createdAt).toLocaleString()
                            } <
                            /p> < /
                            div > <
                            /div> < /
                            div >
                        ))
                } <
                /div>
        )
} <
/ScrollArea> < /
CardContent > <
    /Card> < /
TabsContent > <
    /Tabs> < /
div >
)
}

{
    /* Activity Log Tab */
} {
    activeTab === 'activity' && user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && ( <
        div className = "space-y-6" >
        <
        div >
        <
        h1 className = "text-3xl font-bold text-slate-900" > {
            t('activityLog')
        } < /h1> <
        p className = "text-slate-500 mt-1" > Track all system activities < /p> < /
        div >

        <
        Card >
        <
        CardContent className = "p-0" >
        <
        ScrollArea className = "h-[600px]" >
        <
        div className = "divide-y" > {
            activities.map((activity) => ( <
                div key = {
                    activity.id
                }
                className = "p-4 hover:bg-slate-50" >
                <
                div className = "flex items-start gap-4" >
                <
                div className = "w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-sm" > {
                    activity.userName ? activity.userName.charAt(0) : ''
                } <
                /div> <
                div className = "flex-1" >
                <
                div className = "flex items-center gap-2" >
                <
                span className = "font-medium" > {
                    activity.userName
                } < /span> <
                Badge variant = "outline" > {
                    activity.action.replace(/_/g, ' ')
                } < /Badge> < /
                div > <
                p className = "text-sm text-slate-600 mt-1" > {
                    activity.description
                } < /p> <
                p className = "text-xs text-slate-400 mt-1" > {
                    new Date(activity.createdAt).toLocaleString()
                } <
                /p> < /
                div > <
                /div> < /
                div >
            ))
        } <
        /div> < /
        ScrollArea > <
        /CardContent> < /
        Card > <
        /div>
    )
} <
/main>

{
    /* Status Update Dialog for Interested */
} <
Dialog open = {
    showStatusDialog
}
onOpenChange = {
        setShowStatusDialog
    } >
    <
    DialogContent >
    <
    DialogHeader >
    <
    DialogTitle > Update to Interested < /DialogTitle> <
DialogDescription > Add notes
for this interested lead < /DialogDescription> < /
DialogHeader > <
    div className = "space-y-4" >
    <
    div className = "space-y-2" >
    <
    Label > {
        t('notes')
    } < /Label> <
Textarea
value = {
    statusNotes
}
onChange = {
    (e) => setStatusNotes(e.target.value)
}
placeholder = "Enter notes about why this lead is interested..."
rows = {
    4
}
/> < /
div > <
    div className = "flex justify-end gap-3" >
    <
    Button variant = "outline"
onClick = {
        () => {
            setShowStatusDialog(false);
            setStatusNotes('');
        }
    } > {
        t('cancel')
    } <
    /Button> <
Button onClick = {
    handleConfirmInterestedStatus
}
className = "bg-green-500 hover:bg-green-600" >
    <
    ThumbsUp className = "h-4 w-4 mr-2" / >
    Confirm Interested <
    /Button> < /
div > <
    /div> < /
DialogContent > <
    /Dialog> < /
div >
);
}