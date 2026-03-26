import { useState } from 'react';
import { Layout, Shield, Cpu, Activity, ArrowRight, User, Key } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
        const response = await api.post('/auth/login', { username, password });
        if (response.data.success) {
            localStorage.setItem('rexer_token', response.data.token);
            localStorage.setItem('rexer_user', JSON.stringify(response.data.user));
            navigate('/dashboard');
        }
    } catch (err: any) {
        setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative bg-[#020617]">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card relative overflow-hidden"
      >
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-primary/20 mb-2">
            <Layout className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
            Rexermi <span className="text-primary">ERP</span>
          </h1>
          <p className="text-muted-foreground">Gestión empresarial de alto rendimiento</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-white/5 py-2 px-3 rounded-lg border border-white/5">
                <Shield className="w-4 h-4 text-emerald-400" />
                RBAC Security
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-white/5 py-2 px-3 rounded-lg border border-white/5">
                <Cpu className="w-4 h-4 text-blue-400" />
                RAM Optimized
            </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold py-3 px-4 rounded-xl mb-4 text-center">
                  {error}
              </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium ml-1">Usuario</label>
            <div className="relative group">
              <User className="absolute left-3 top-3 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50 text-white"
                placeholder="Introduzca su usuario"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium ml-1">Contraseña</label>
            <div className="relative group">
              <Key className="absolute left-3 top-3 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50 text-white"
                placeholder="Contraseña"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full premium-gradient hover:opacity-90 active:scale-[0.98] text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 group mt-6 shadow-lg shadow-blue-600/20"
          >
            {loading ? (
                <Activity className="w-5 h-5 animate-spin" />
            ) : (
                <>
                    Iniciar Sesión
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center text-xs text-muted-foreground">
          REXERMI ERP v2.0.0 — Native Windows Stack
        </div>
      </motion.div>
    </div>
  );
}
