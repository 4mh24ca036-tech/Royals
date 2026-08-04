import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, Phone, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, authModalMode, setAuthModalMode, login, register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (authModalMode === 'login') {
        await login({ email, password });
      } else {
        await register({ name, email, phone, password });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#FAF9F6] border border-[#E5E1D8] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 bg-[#F5F2ED] border-b border-[#E5E1D8] text-center relative">
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="absolute top-4 right-4 p-2 text-[#1A1A1A] hover:text-[#C5A059] hover:bg-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-1.5 text-[9px] uppercase font-cinzel font-medium text-[#C5A059] tracking-[0.3em]">
            <Sparkles className="w-2.5 h-2.5" />
            <span>JAIPUR HAUTE ATELIER</span>
            <Sparkles className="w-2.5 h-2.5" />
          </div>
          <h3 className="text-2xl font-serif italic font-light text-[#1A1A1A] tracking-wide mt-1">
            {authModalMode === 'login' ? 'Patron Sign In' : 'Join ROYALS Atelier'}
          </h3>
          <p className="text-[11px] text-[#6B6658] mt-1 font-light">
            {authModalMode === 'login'
              ? 'Access saved couture measurements & order dossier'
              : 'Create an account for bespoke fitting updates and private previews'}
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-white border border-[#E5E1D8] text-[#1A1A1A] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#C5A059]" />
              <span className="font-light">{errorMessage}</span>
            </div>
          )}

          {authModalMode === 'register' && (
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-[#1A1A1A] mb-1 font-cinzel">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#8E8A81] absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Princess Ananya Rathore"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-[#E5E1D8] text-xs bg-white focus:outline-none focus:border-[#C5A059] font-light"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-[#1A1A1A] mb-1 font-cinzel">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#8E8A81] absolute left-3 top-3" />
              <input
                type="email"
                required
                placeholder="e.g. ananya@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-[#E5E1D8] text-xs bg-white focus:outline-none focus:border-[#C5A059] font-light"
              />
            </div>
          </div>

          {authModalMode === 'register' && (
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-[#1A1A1A] mb-1 font-cinzel">Phone Number (Optional)</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#8E8A81] absolute left-3 top-3" />
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-[#E5E1D8] text-xs bg-white focus:outline-none focus:border-[#C5A059] font-light"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] font-medium text-[#1A1A1A] mb-1 font-cinzel">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#8E8A81] absolute left-3 top-3" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-[#E5E1D8] text-xs bg-white focus:outline-none focus:border-[#C5A059] font-light"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-medium transition-all shadow-sm cursor-pointer disabled:opacity-50 mt-2"
          >
            {isSubmitting
              ? 'Authenticating...'
              : authModalMode === 'login'
              ? 'Sign In to Account'
              : 'Create Patron Profile'}
          </button>

          {/* Toggle Mode */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setAuthModalMode(authModalMode === 'login' ? 'register' : 'login');
              }}
              className="text-xs text-[#8E8A81] hover:text-[#C5A059] font-light underline cursor-pointer"
            >
              {authModalMode === 'login'
                ? "Don't have an account? Join ROYALS Atelier"
                : 'Already a patron? Sign in here'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
