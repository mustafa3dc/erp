import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  lang?: 'ar' | 'en';
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ZiloX Error Boundary] Uncaught runtime exception caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      const isAr = this.props.lang !== 'en';

      return (
        <div 
          style={{
            minHeight: '400px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
            textAlign: 'center',
            background: 'var(--card, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--border, #e2e8f0)',
            margin: '16px 0',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
          }}
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div 
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              border: '1px solid rgba(239, 68, 68, 0.25)'
            }}
          >
            <AlertTriangle size={28} />
          </div>

          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground, #0f172a)' }}>
            {isAr ? 'حدث خطأ غير متوقع أثناء عرض هذه النافذة' : 'An unexpected error occurred in this view'}
          </h3>

          <p style={{ margin: '0 0 20px 0', fontSize: '13.5px', color: 'var(--muted-foreground, #64748b)', maxWidth: '480px' }}>
            {isAr 
              ? 'قام النظام بحماية قاعدة البيانات والجلسة النشطة. يمكنك النقر أدناه لإعادة تشغيل الواجهة بأمان.'
              : 'The system protected the database and active session. Click below to safely reload the view.'}
          </p>

          {this.state.error && (
            <div 
              style={{
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#dc2626',
                fontFamily: 'monospace',
                maxWidth: '540px',
                overflowX: 'auto',
                marginBottom: '20px',
                textAlign: 'left'
              }}
              dir="ltr"
            >
              {this.state.error.message || String(this.state.error)}
            </div>
          )}

          <button
            type="button"
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: '8px',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: '13.5px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
            }}
          >
            <RefreshCw size={16} />
            <span>{isAr ? 'إعادة تحميل الواجهة واستعادة النظام' : 'Reload View & Recover'}</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

