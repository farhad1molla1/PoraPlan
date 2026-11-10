import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: (errorCode?: string) => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
          action?: string;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
    };
    onTurnstileLoaded?: () => void;
  }
}

export interface TurnstileRef {
  reset: () => void;
  getResponse: () => string | undefined;
  refreshToken: () => Promise<string>;
}

export interface TurnstileWidgetProps {
  siteKey: string;
  onSuccess?: (token: string) => void;
  onError?: (error?: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  action?: string;
  className?: string;
}

export const TurnstileWidget = forwardRef<TurnstileRef, TurnstileWidgetProps>(
  ({ siteKey, onSuccess, onError, onExpire, theme = 'auto', action, className = '' }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const pendingTokenResolveRef = useRef<((token: string) => void) | null>(null);

    const handleSuccess = useCallback(
      (token: string) => {
        if (pendingTokenResolveRef.current) {
          pendingTokenResolveRef.current(token);
          pendingTokenResolveRef.current = null;
        }
        onSuccess?.(token);
      },
      [onSuccess]
    );

    const handleExpire = useCallback(() => {
      onExpire?.();
      // Auto-reset when token expires so a fresh token is prepared
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    }, [onExpire]);

    const handleError = useCallback(
      (errorCode?: string) => {
        onError?.(errorCode);
      },
      [onError]
    );

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
        getResponse: () => {
          if (widgetIdRef.current && window.turnstile) {
            return window.turnstile.getResponse(widgetIdRef.current);
          }
          return undefined;
        },
        refreshToken: () => {
          return new Promise<string>((resolve) => {
            pendingTokenResolveRef.current = resolve;
            if (widgetIdRef.current && window.turnstile) {
              window.turnstile.reset(widgetIdRef.current);
            }
          });
        },
      }),
      []
    );

    useEffect(() => {
      if (!siteKey || !containerRef.current) {
        return;
      }

      let isMounted = true;

      const renderWidget = () => {
        if (!containerRef.current || !window.turnstile || !isMounted) {
          return;
        }

        // Avoid rendering multiple times in the same container
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Ignore removal errors
          }
          widgetIdRef.current = null;
        }

        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: handleSuccess,
            'expired-callback': handleExpire,
            'error-callback': handleError,
            theme,
            action,
            size: 'normal',
          });
          widgetIdRef.current = id;
        } catch {
          // Fallback if render encounters an unexpected state
        }
      };

      // If turnstile script is not yet loaded, inject it
      const scriptId = 'cloudflare-turnstile-script';
      let script = document.getElementById(scriptId) as HTMLScriptElement | null;

      if (!window.turnstile) {
        if (!script) {
          script = document.createElement('script');
          script.id = scriptId;
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
        }

        const prevOnLoaded = window.onTurnstileLoaded;
        window.onTurnstileLoaded = () => {
          prevOnLoaded?.();
          if (isMounted) {
            renderWidget();
          }
        };

        script.addEventListener('load', renderWidget);
      } else {
        renderWidget();
      }

      return () => {
        isMounted = false;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Ignore cleanup errors on unmount
          }
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, theme, action, handleSuccess, handleExpire, handleError]);

    if (!siteKey) {
      return null;
    }

    return (
      <div className={`flex justify-center my-3 ${className}`}>
        <div ref={containerRef} />
      </div>
    );
  }
);

TurnstileWidget.displayName = 'TurnstileWidget';
