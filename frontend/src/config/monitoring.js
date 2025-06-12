import * as Sentry from "@sentry/react";
import { BrowserTracing, Replay } from "@sentry/tracing";
import { Dedupe, ExtraErrorData } from "@sentry/integrations";

export const initializeMonitoring = (userContext = {}) => {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.warn('Sentry DSN not configured');
    return;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      new BrowserTracing({
        tracePropagationTargets: [/^https:\/\/thalya\.ai/],
      }),
      new Dedupe(),
      new ExtraErrorData({ depth: 10 }),
      new Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    beforeSend(event, hint) {
      if (import.meta.env.DEV) {
        console.log('Sentry event:', event);
        return null;
      }
      const error = hint?.originalException;
      if (error?.name === 'NetworkError') {
        event.fingerprint = ['network-error'];
      }
      // Filter sensitive data
      if (event.request?.data) {
        event.request.data = '[Filtered]';
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'xhr') {
        // Remove sensitive data from URLs/headers
        breadcrumb.data = {
          ...breadcrumb.data,
          url: breadcrumb.data.url.split('?')[0],
        };
      }
      return breadcrumb;
    },
  });

  // Set user context if available
  if (Object.keys(userContext).length) {
    Sentry.setUser(userContext);
  }

  // Add performance monitoring
  const performance = {
    marks: new Map(),
    measures: new Map(),

    start(name) {
      this.marks.set(name, performance.now());
    },

    end(name) {
      const start = this.marks.get(name);
      if (start) {
        const duration = performance.now() - start;
        this.measures.set(name, duration);
        Sentry.captureMessage('Performance', {
          extra: { metric: name, duration }
        });
      }
    }
  };

  return { performance };
};