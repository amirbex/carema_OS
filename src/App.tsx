import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { Loader2, Eye, EyeOff, Zap } from 'lucide-react';
import { auth, testConnection } from './lib/firebase';
import { describeAuthError } from './lib/errorHandlers';
import { I18nProvider, useI18n } from './context/I18nContext';
import { ToastProvider } from './context/ToastContext';
import { FocusProvider } from './context/FocusContext';
import DashboardLayout from './components/DashboardLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

const ProjectsView = lazy(() => import('./components/ProjectsView'));
const TimelineView = lazy(() => import('./components/TimelineView'));
const ChatView = lazy(() => import('./components/ChatView'));

const DEMO_EMAIL = 'demo@carema.app';
const DEMO_PASSWORD = 'demo123456';
const DEMO_ENABLED = import.meta.env.VITE_ENABLE_DEMO_LOGIN !== 'false';

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
}

function RouteFallback() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 gap-2 text-sm" role="status" aria-live="polite">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      {t('loading')}
    </div>
  );
}

function NotFound() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8 h-full">
      <span className="text-5xl font-mono text-emerald-400/70">404</span>
      <h1 className="text-lg font-semibold text-gray-100">{t('notFoundTitle')}</h1>
      <p className="text-sm text-gray-500 max-w-sm">{t('notFoundBody')}</p>
      <button
        type="button"
        onClick={() => navigate('/dashboard/projects', { replace: true })}
        className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {t('backToDashboard')}
      </button>
    </div>
  );
}

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Never leave a floating promise: the probe is informational only.
    void testConnection();

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        if (cancelled) return;
        setUser(nextUser);
        setLoading(false);
      },
      (error) => {
        if (cancelled) return;
        setAuthError(describeAuthError(error));
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    setAuthError('');
    setNotice('');
    setIsSubmitting(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      setAuthError(describeAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError('');
    setNotice('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    if (isSignUp && password.length < 6) {
      setAuthError(t('password') + ': ≥ 6');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (error) {
      setAuthError(describeAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    const trimmedEmail = email.trim();
    setAuthError('');
    setNotice('');
    if (!trimmedEmail) {
      setAuthError(t('email'));
      return;
    }
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setNotice(t('resetEmailSent'));
    } catch (error) {
      setAuthError(describeAuthError(error));
    }
  };

  const loginDemoUser = async () => {
    setAuthError('');
    setNotice('');
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
    } catch {
      try {
        await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
      } catch (error) {
        setAuthError(describeAuthError(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" aria-label={t('loading')} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white p-4">
        <div className="max-w-md w-full p-6 sm:p-8 border border-gray-800 rounded-2xl bg-gray-900">
          <div className="text-center">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 flex items-center justify-center rounded-full mx-auto mb-5">
              <Zap className="w-7 h-7" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold mb-1">CaReMa OS</h1>
            <p className="text-gray-400 mb-7 text-sm">{t('tagline')}</p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3 mb-5" noValidate>
            <label className="block">
              <span className="sr-only">{t('email')}</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t('email')}
                aria-label={t('email')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
                required
              />
            </label>

            <div className="relative">
              <label className="block">
                <span className="sr-only">{t('password')}</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  placeholder={t('password')}
                  aria-label={t('password')}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 pe-11 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
                  required
                  minLength={6}
                />
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>

            {authError && (
              <p role="alert" className="text-rose-400 text-xs text-start">
                {authError}
              </p>
            )}
            {notice && (
              <p role="status" className="text-emerald-400 text-xs text-start">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {isSubmitting ? t('signingIn') : isSignUp ? t('signUp') : t('signIn')}
            </button>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <button type="button" onClick={handlePasswordReset} className="hover:text-emerald-400 transition-colors">
                {t('forgotPassword')}
              </button>
            </div>
          </form>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-gray-900 text-gray-500">{t('orContinueWith')}</span>
            </div>
          </div>

          <button
            onClick={loginWithGoogle}
            type="button"
            disabled={isSubmitting}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 py-3 px-4 rounded-lg font-medium transition-colors mb-3 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t('google')}
          </button>

          {DEMO_ENABLED && (
            <>
              <button
                onClick={loginDemoUser}
                type="button"
                disabled={isSubmitting}
                className="w-full bg-gray-800 hover:bg-gray-700 text-emerald-400 border border-emerald-500/30 py-2.5 px-4 rounded-lg font-medium transition-colors text-sm disabled:opacity-60"
              >
                {t('demoAccount')}
              </button>

              <div className="mt-3 bg-gray-950/70 border border-gray-800/80 rounded-lg p-3 text-[11px] text-start text-gray-400 space-y-1">
                <div className="font-semibold text-gray-300">{t('demoCredentials')}</div>
                <div>
                  <span className="text-gray-500">{t('email')}:</span>{' '}
                  <code className="text-emerald-400 select-all">{DEMO_EMAIL}</code>
                </div>
                <div>
                  <span className="text-gray-500">{t('password')}:</span>{' '}
                  <code className="text-emerald-400 select-all">{DEMO_PASSWORD}</code>
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setIsSignUp((prev) => !prev);
              setAuthError('');
              setNotice('');
            }}
            className="mt-5 w-full text-sm text-gray-400 hover:text-emerald-400 transition-colors"
          >
            {isSignUp ? t('haveAccount') : t('noAccount')}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <ToastProvider>
          <FocusProvider>
            <BrowserRouter>
              <AuthWrapper>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard/projects" replace />} />
                    <Route path="/dashboard" element={<DashboardLayout />}>
                      <Route index element={<Navigate to="projects" replace />} />
                      {/* Per-route Suspense keeps the shell/sidebar mounted
                          while a lazily loaded view is fetching. */}
                      <Route path="projects" element={withSuspense(<ProjectsView />)} />
                      <Route path="timeline" element={withSuspense(<TimelineView />)} />
                      <Route path="chat" element={withSuspense(<ChatView />)} />
                      <Route path="*" element={<NotFound />} />
                    </Route>
                    <Route path="/chat" element={<Navigate to="/dashboard/chat" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AuthWrapper>
            </BrowserRouter>
          </FocusProvider>
        </ToastProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
