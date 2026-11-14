import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

/**
 * Without an error boundary, any render error left the user staring at a blank
 * white page (React unmounts the whole tree). This shows a recoverable screen.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100 p-6" role="alert">
        <div className="max-w-md w-full text-center bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold mb-2">خطای غیرمنتظره / Unexpected error</h1>
          <p className="text-sm text-gray-400 mb-6">
            مشکلی پیش آمد. صفحه را دوباره بارگذاری کنید.
            <br />
            Something went wrong. Please reload the page.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            بارگذاری دوباره / Reload
          </button>
        </div>
      </div>
    );
  }
}
