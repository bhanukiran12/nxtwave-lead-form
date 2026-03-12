import { useEffect, useRef } from 'react';

function toPostMessageSafeValue(value) {
  const seen = new WeakSet();
  return JSON.parse(
    JSON.stringify(value, (_, val) => {
      if (typeof val === 'function' || typeof val === 'symbol' || typeof val === 'undefined') return null;
      if (typeof val === 'bigint') return String(val);
      if (val && typeof val === 'object') {
        if (seen.has(val)) return null;
        seen.add(val);
      }
      return val;
    })
  );
}

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function getNextUniqueEventId(existing = []) {
  const max = existing.reduce((acc, item) => {
    const val = Number(item?.['gtm.uniqueEventId'] || 0);
    return Number.isFinite(val) ? Math.max(acc, val) : acc;
  }, 0);
  return max + 1;
}

function hasTrackedPageLoadInRuntime() {
  return Boolean(window.__nxtwavePageLoadTracked__);
}

function markPageLoadTrackedInRuntime() {
  window.__nxtwavePageLoadTracked__ = true;
}

function getFrontendPathIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    const cleanPath = parsed.pathname.replace(/^\/+|\/+$/g, '');
    if (!cleanPath) return '';
    return cleanPath.split('/')[0].toLowerCase();
  } catch {
    return '';
  }
}

function normalizeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function withWwwVariants(origin) {
  if (!origin) return [];
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;
    const protocol = parsed.protocol;
    const port = parsed.port ? `:${parsed.port}` : '';
    if (host.startsWith('www.')) {
      return [origin, `${protocol}//${host.replace(/^www\./, '')}${port}`];
    }
    return [origin, `${protocol}//www.${host}${port}`];
  } catch {
    return [origin];
  }
}

export default function useDataLayer({ parentOrigin, parentPageUrl, formId }) {
  const formDataLayerRef = useRef(null);
  const uniqueEventIdRef = useRef(1);
  const targetOriginRef = useRef(parentOrigin);
  const parentContextReceivedRef = useRef(false);

  useEffect(() => {
    // postMessage requires strict origin format: scheme + host (+ optional port), no path.
    // Prefer the actual embedding origin from referrer to avoid hardcoded origin mismatch.
    try {
      if (document.referrer) {
        targetOriginRef.current = new URL(document.referrer).origin;
        return;
      }
    } catch {
      // no-op: fallback to configured origin below
    }

    try {
      targetOriginRef.current = new URL(parentOrigin).origin;
    } catch {
      targetOriginRef.current = parentOrigin || '*';
    }
  }, [parentOrigin]);

  useEffect(() => {
    const referrerOrigin = normalizeOrigin(document.referrer);
    const configuredOrigin = normalizeOrigin(parentOrigin);
    const allowedOrigins = new Set([
      ...withWwwVariants(referrerOrigin),
      ...withWwwVariants(configuredOrigin)
    ].filter(Boolean));
    const requestTargetOrigins = [...allowedOrigins];
    requestTargetOrigins.push('*');

    const onMessage = (event) => {
      if (event.source !== window.parent) return;
      const isFileOriginMessage = event.origin === 'null';
      if (allowedOrigins.size > 0 && !allowedOrigins.has(event.origin) && !isFileOriginMessage) {
        console.log('[DL_PARENT_URL_CONTEXT] ignored message due to origin', {
          eventOrigin: event.origin,
          allowedOrigins: [...allowedOrigins]
        });
        return;
      }

      const data = event.data || {};
      if (data.type !== 'PARENT_URL_CONTEXT' || typeof data.url !== 'string') return;
      parentContextReceivedRef.current = true;

      const fdl = formDataLayerRef.current;
      if (!fdl) return;

      const resolvedPathId = getFrontendPathIdFromUrl(data.url)
        || fdl.frontendPathId
        || 'home';
      fdl.parentUrl = data.url;
      fdl.frontendPathId = resolvedPathId;

      console.log('[DL_PARENT_URL_CONTEXT]', {
        origin: event.origin,
        parentUrl: data.url,
        frontend_form_path_id: resolvedPathId
      });
    };

    window.addEventListener('message', onMessage);

    if (window.parent && window.parent !== window) {
      const requestContext = (reason) => {
        console.log('[DL_PARENT_URL_CONTEXT] requesting parent URL context', { reason, requestTargetOrigins });
        requestTargetOrigins.forEach((origin) => {
          window.parent.postMessage({ type: 'REQUEST_PARENT_URL_CONTEXT' }, origin);
        });
      };
      requestContext('initial');
      const retryDelays = [800, 1800, 3000, 4500, 6500];
      const timers = retryDelays.map((delayMs) => window.setTimeout(() => {
        if (parentContextReceivedRef.current) return;
        requestContext(`retry_${delayMs}ms`);
      }, delayMs));

      return () => {
        timers.forEach(clearTimeout);
        window.removeEventListener('message', onMessage);
      };
    }

    return () => window.removeEventListener('message', onMessage);
  }, [parentOrigin]);

  const pushDataLayerEvent = (eventName, eventData = {}, options = {}) => {
    if (!formDataLayerRef.current) return;

    const fdl = formDataLayerRef.current;
    const uniqueEventId = uniqueEventIdRef.current++;

    const event = {
      event: eventName,
      timestamp: new Date().toISOString(),
      sessionId: fdl.sessionId,
      form_id: fdl.formId,
      frontend_form_path_id: fdl.frontendPathId,
      'gtm.uniqueEventId': uniqueEventId,
      ...eventData
    };

    fdl.events.push(event);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);

    const shouldForwardToParent = options.forwardToParent !== false;

    if (shouldForwardToParent && window.parent && window.parent !== window) {
      try {
        window.parent.postMessage(
          { type: 'DATALAYER_UPDATE', payload: toPostMessageSafeValue(event) },
          targetOriginRef.current
        );
      } catch {
        // no-op: analytics bridge must not break flow
      }
    }
  };

  const trackStepView = (stepNumber) => {
    const fdl = formDataLayerRef.current;
    if (!fdl) return;

    if (fdl.formMetrics.viewedSteps.includes(stepNumber)) return;
    fdl.formMetrics.viewedSteps.push(stepNumber);

    pushDataLayerEvent('step_viewed', {
      step: stepNumber,
      previousSteps: fdl.formMetrics.viewedSteps.length - 1
    });
  };

  const trackFieldInteraction = (fieldName, fieldValue) => {
    const fdl = formDataLayerRef.current;
    if (!fdl) return;

    fdl.formMetrics.fieldInteractions += 1;
    fdl.formState[fieldName] = fieldValue;

    pushDataLayerEvent('field_changed', {
      fieldName,
      totalInteractions: fdl.formMetrics.fieldInteractions
    });
  };

  const trackOtpAction = (action, details = {}) => {
    const fdl = formDataLayerRef.current;
    if (!fdl) return;

    if (action === 'attempt') fdl.formMetrics.otpAttempts += 1;

    const eventName = `otp_${action}`;
    const shouldForwardToParent = eventName !== 'otp_send';

    pushDataLayerEvent(
      eventName,
      {
        attemptNumber: fdl.formMetrics.otpAttempts,
        ...details
      },
      { forwardToParent: shouldForwardToParent }
    );
  };

  const trackFormSubmission = (status, data = {}) => {
    const fdl = formDataLayerRef.current;
    if (!fdl) return;

    fdl.formMetrics.completionStatus = status;
    fdl.totalFormTime = (Date.now() - new Date(fdl.startTime).getTime()) / 1000;

    pushDataLayerEvent('form_submitted', {
      status,
      totalTimeSeconds: fdl.totalFormTime,
      fieldInteractions: fdl.formMetrics.fieldInteractions,
      validationErrors: fdl.formMetrics.validationErrors,
      ...data
    });

    try {
      localStorage.setItem(`nxtwave_form_data_${fdl.sessionId}`, JSON.stringify(fdl));
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    const sessionId = sessionStorage.getItem('nxtwave_session_id') || generateSessionId();

    uniqueEventIdRef.current = getNextUniqueEventId(window.dataLayer);
    const parentUrl = document.referrer || '';
    const frontendPathId = getFrontendPathIdFromUrl(parentUrl)
      || getFrontendPathIdFromUrl(window.location.href)
      || 'home';

    formDataLayerRef.current = {
      sessionId,
      formId: formId || '',
      frontendPathId,
      startTime: new Date().toISOString(),
      pageUrl: window.location.href,
      parentUrl,
      userAgent: navigator.userAgent,
      referrer: document.referrer || 'direct',
      formState: {},
      formMetrics: {
        viewedSteps: [],
        fieldInteractions: 0,
        validationErrors: 0,
        otpAttempts: 0,
        totalFormTime: 0,
        completionStatus: 'incomplete'
      },
      events: []
    };

    sessionStorage.setItem('nxtwave_session_id', sessionId);

    // React StrictMode can run mount effects twice in development; only track once per runtime load.
    if (!hasTrackedPageLoadInRuntime()) {
      pushDataLayerEvent('page_load', {
        pageTitle: document.title,
        pageUrl: window.location.href,
        referrer: document.referrer || 'direct'
      });
      markPageLoadTrackedInRuntime();
    }
  }, []);

  return {
    sessionId: formDataLayerRef.current?.sessionId,
    pushDataLayerEvent,
    trackStepView,
    trackFieldInteraction,
    trackOtpAction,
    trackFormSubmission
  };
}
