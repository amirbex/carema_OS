import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, testConnection } from './lib/firebase';
import DashboardLayout from './components/DashboardLayout';
import TimelineView from './components/TimelineView';
import ProjectsView from './components/ProjectsView';
import ChatView from './components/ChatView';
import { I18nProvider } from './context/I18nContext';
import { ToastProvider } from './context/ToastContext';
import { FocusProvider } from './context/FocusContext';

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      setAuthError('');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      console.error(e);
      setAuthError(e.message || 'Google sign in failed');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e: any) {
      console.error(e);
      setAuthError(e.message || 'Authentication failed');
    }
  };

  const loginDemoUser = async () => {
    setAuthError('');
    const demoEmail = 'demo@carema.app';
    const demoPass = 'demo123456';
    try {
      await signInWithEmailAndPassword(auth, demoEmail, demoPass);
    } catch {
      try {
        await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
      } catch (err: any) {
        setAuthError(err.message || 'Demo login failed');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white p-4">
        <div className="max-w-md w-full p-8 border border-gray-800 rounded-xl bg-gray-900 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 flex items-center justify-center rounded-full mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">CaReMa OS</h1>
          <p className="text-gray-400 mb-8">Career & Research Manager Operating System.</p>
          
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
              required
            />
            {authError && <p className="text-red-400 text-xs text-left">{authError}</p>}
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            onClick={loginWithGoogle}
            type="button"
            className="w-full bg-white hover:bg-gray-100 text-gray-900 py-3 px-4 rounded-lg font-medium transition-colors mb-3 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </button>

          <button
            onClick={loginDemoUser}
            type="button"
            className="w-full bg-gray-800 hover:bg-gray-700 text-emerald-400 border border-emerald-500/30 py-2.5 px-4 rounded-lg font-medium transition-colors mb-4 text-sm flex items-center justify-center gap-2"
          >
            <span>ورود سریع با اکانت دمو (Demo Account)</span>
          </button>

          <div className="bg-gray-950/70 border border-gray-800/80 rounded-lg p-3 text-xs text-left text-gray-400 mb-4 space-y-1">
            <div className="font-semibold text-gray-300 mb-1">اطلاعات ورود تستی (Demo Credentials):</div>
            <div><span className="text-gray-500">ایمیل:</span> <code className="text-emerald-400 select-all">demo@carema.app</code></div>
            <div><span className="text-gray-500">رمز عبور:</span> <code className="text-emerald-400 select-all">demo123456</code></div>
          </div>
          
          <button 
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-gray-400 hover:text-emerald-400 transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <FocusProvider>
          <BrowserRouter>
            <AuthWrapper>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard/projects" replace />} />
                <Route path="/dashboard" element={<DashboardLayout />}>
                  <Route path="timeline" element={<TimelineView />} />
                  <Route path="projects" element={<ProjectsView />} />
                  <Route path="chat" element={<ChatView />} />
                </Route>
                <Route path="/chat" element={<Navigate to="/dashboard/chat" replace />} />
              </Routes>
            </AuthWrapper>
          </BrowserRouter>
        </FocusProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
