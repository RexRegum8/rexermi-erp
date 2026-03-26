import { useEffect, useState, cloneElement, type ReactElement, type ReactNode } from 'react';
import { 
  Users, 
  Settings, 
  Activity, 
  Database, 
  Shield, 
  TrendingUp, 
  LayoutDashboard,
  Wallet,
  Zap,
  Menu,
  ChevronRight,
  LogOut,
  Cpu,
  Clock,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { cn } from '../lib/utils';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  
  // Update state
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'available' | 'downloading' | 'ready'>('idle');

  const navigate = useNavigate();
  const { lastNotification } = useNotifications();

  useEffect(() => {
    const userData = localStorage.getItem('rexer_user');
    if (userData) setUser(JSON.parse(userData));

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lastNotification) {
      const { event, data } = lastNotification;
      
      if (event === 'system:update_available') {
        setUpdateInfo(data);
        setUpdateStatus('available');
      } else if (event === 'system:update_progress') {
        setUpdateProgress(data.pct);
        setUpdateStatus('downloading');
      } else if (event === 'system:update_ready') {
        setUpdateStatus('ready');
        setUpdateProgress(100);
      }
      
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastNotification]);

  const fetchData = async () => {
    try {
        const [healthRes, auditRes] = await Promise.all([
            api.get('/health'),
            api.get('/system/audit?limit=10')
        ]);
        setStats(healthRes.data);
        setAuditLogs(auditRes.data);
    } catch (err) {
        console.error('Error fetching dashboard data', err);
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus('idle');
    try {
        const res = await api.post('/system/update/check');
        if (res.data.updateAvailable) {
            setUpdateInfo(res.data.info);
            setUpdateStatus('available');
        } else {
            setUpdateStatus('idle');
            // Show toast or something?
            alert('El sistema está actualizado');
        }
    } catch (err) {
        console.error('Error al comprobar actualizaciones', err);
    } finally {
        setIsCheckingUpdate(false);
    }
  };

  const handleDownloadUpdate = async () => {
    try {
        setUpdateStatus('downloading');
        await api.post('/system/update/download');
    } catch (err) {
        console.error('Error al iniciar descarga', err);
        setUpdateStatus('available');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('rexer_token');
    localStorage.removeItem('rexer_user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-[#020617]/50 backdrop-blur-xl hidden lg:flex flex-col">
        <div className="p-8">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                    <Zap className="w-6 h-6 text-primary" />
                </div>
                <span className="text-xl font-bold tracking-tight text-white">Rexermi <span className="text-primary">ERP</span></span>
            </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
            <NavItem icon={<LayoutDashboard />} label="Dashboard" active />
            <NavItem icon={<Wallet />} label="Contabilidad" />
            <NavItem icon={<TrendingUp />} label="Marketing" />
            <NavItem icon={<Users />} label="Usuarios" />
            <NavItem icon={<Activity />} label="Auditoría" />
            <NavItem icon={<Database />} label="Base de Datos" />
            <NavItem icon={<Settings />} label="Configuración" />
        </nav>

        {/* Update Section in Sidebar */}
        <div className="px-6 mb-6">
            <div className="glass p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Sistema</span>
                    {updateStatus === 'ready' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                </div>
                
                {updateStatus === 'idle' && (
                    <button 
                        onClick={handleCheckUpdate}
                        disabled={isCheckingUpdate}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 transition-all"
                    >
                        <RefreshCw className={cn("w-3 h-3", isCheckingUpdate && "animate-spin")} />
                        {isCheckingUpdate ? 'Comprobando...' : 'Buscar Actualización'}
                    </button>
                )}

                {(updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'ready') && (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="text-white font-bold">Nueva versión v{updateInfo?.latestVersion}</span>
                            {updateStatus === 'downloading' && <span>{updateProgress}%</span>}
                        </div>
                        
                        {updateStatus === 'downloading' ? (
                            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                <div 
                                    className="bg-primary h-full transition-all duration-300" 
                                    style={{ width: `${updateProgress}%` }}
                                />
                            </div>
                        ) : updateStatus === 'ready' ? (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
                                <p className="text-[9px] text-emerald-500 leading-tight">Lista para instalar. Reinicie el motor.</p>
                            </div>
                        ) : (
                            <button 
                                onClick={handleDownloadUpdate}
                                className="w-full py-2 bg-primary hover:bg-primary/80 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2"
                            >
                                <Download className="w-3 h-3" />
                                Descargar ahora
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>

        <div className="p-6 border-t border-white/5">
            <div className="flex items-center gap-3 p-3 glass rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center font-bold text-white uppercase">
                    {(user?.username || 'AD').substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-white">{user?.username || 'Administrador'}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">System Manager</p>
                </div>
                <LogOut 
                    className="w-5 h-5 text-muted-foreground hover:text-white transition-colors cursor-pointer" 
                    onClick={handleLogout}
                />
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto bg-gradient-to-b from-blue-600/5 to-transparent">
        {/* Top Navbar */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#020617]/20 backdrop-blur-sm sticky top-0 z-30">
            <div className="flex items-center gap-4">
                <Menu className="w-6 h-6 text-muted-foreground lg:hidden" />
                <h2 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                    Panel Principal <ChevronRight className="w-4 h-4" /> <span className="text-white">Dashboard</span>
                </h2>
            </div>
            
            <div className="flex items-center gap-4">
                {updateStatus === 'ready' && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 text-emerald-500">
                    <AlertTriangle className="w-3 h-3 animate-bounce" />
                    <span className="text-[10px] font-bold uppercase">Update Ready</span>
                  </div>
                )}
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Server v{stats?.version || '2.0'}</span>
                </div>
            </div>
        </header>

        {/* Dashboard Grid */}
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            
            {/* Hero Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Memoria RAM" 
                    value={`${stats?.memoryUsageMB || stats?.memory || '0'} MB`} 
                    subtitle="Uso de Cache sql.js" 
                    icon={<Cpu className="text-blue-400" />} 
                    trend="Estable"
                />
                <StatCard 
                    title="Uptime" 
                    value={`${Math.floor((stats?.uptime || 0) / 60)} min`} 
                    subtitle="Tiempo de actividad" 
                    icon={<Clock className="text-emerald-400" />} 
                    trend={`v${stats?.version || '2.0'}`}
                />
                <StatCard 
                    title="Hit Rate" 
                    value={`${stats?.cache?.hits || 0}`} 
                    subtitle="Cache Memory Hits" 
                    icon={<Zap className="text-amber-400" />} 
                    trend="RAM High"
                />
                <StatCard 
                    title="Security" 
                    value="RBAC" 
                    subtitle="Capabilities Activas" 
                    icon={<Shield className="text-rose-400" />} 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Real-time Activity Graph Mock */}
                <div className="lg:col-span-2 glass-card h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-8 text-white">
                        <div>
                            <h3 className="text-lg font-bold">Rendimiento en Tiempo Real</h3>
                            <p className="text-xs text-muted-foreground">Monitor de solicitudes y caché</p>
                        </div>
                    </div>
                    <div className="flex-1 border border-white/5 rounded-xl bg-white/5 flex items-center justify-center">
                        <Activity className="w-12 h-12 text-primary/20 animate-pulse" />
                    </div>
                </div>

                {/* Real Audit Logs from Backend */}
                <div className="glass-card flex flex-col">
                    <h3 className="text-lg font-bold mb-6 text-white">Auditoría Reciente</h3>
                    <div className="space-y-6 flex-1 h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {auditLogs.length > 0 ? auditLogs.map((log) => (
                          <AuditItem 
                            key={log.id}
                            user={log.username || 'System'} 
                            action={log.action} 
                            time={new Date(log.created_at).toLocaleTimeString()} 
                            color={log.action.includes('FAILURE') ? 'rose' : (log.action.includes('CREATE') ? 'blue' : 'emerald')} 
                          />
                        )) : (
                          <p className="text-center text-muted-foreground text-xs mt-20">No hay registros de auditoría</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}

// Subcomponents helper
function NavItem({ icon, label, active = false }: { icon: ReactNode, label: string, active?: boolean }) {
    return (
        <a href="#" className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
            active 
                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                : "text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent"
        )}>
            {cloneElement(icon as ReactElement<any>, { className: "w-5 h-5" })}
            {label}
        </a>
    );
}

function StatCard({ title, value, subtitle, icon, trend }: any) {
    return (
        <div className="glass-card p-6 space-y-4 hover:border-white/20 transition-colors">
            <div className="flex items-center justify-between">
                <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                    {cloneElement(icon, { className: "w-5 h-5" } as any)}
                </div>
                {trend && (
                    <span className={cn(
                        "text-[10px] font-bold px-2 py-1 rounded-full",
                        trend.toString().startsWith('+') ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"
                    )}>
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h4 className="text-2xl font-bold text-white">{value}</h4>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>
            </div>
        </div>
    );
}

function AuditItem({ user, action, time, color }: any) {
    const colors: any = {
        emerald: "bg-emerald-500",
        blue: "bg-blue-500",
        amber: "bg-amber-500",
        purple: "bg-purple-500",
        rose: "bg-rose-500"
    };

    return (
        <div className="flex gap-4 group cursor-pointer">
            <div className="relative">
                <div className={cn("w-2 h-2 rounded-full mt-1.5 z-10 relative", colors[color] || "bg-slate-500 shadow-lg shadow-current/20")} />
                <div className="absolute top-3 bottom-[-24px] left-[3px] w-[1px] bg-white/10 group-last:hidden" />
            </div>
            <div className="flex-1 pb-4">
                <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-slate-200">
                        <span className="text-primary">{user}</span> {action}
                    </p>
                    <span className="text-[10px] text-muted-foreground">{time}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 tracking-tight opacity-70">Sincronizado vía Socket.io</p>
            </div>
        </div>
    );
}
