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

function getFrontendPathIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    const cleanPath = parsed.pathname.replace(/^\/+|\/+$/g, '');
    if (!cleanPath) return 'home';
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

export default function useDataLayer({ parentOrigin, parentPageUrl, formId }) {
  const formDataLayerRef = useRef(null);
  const uniqueEventIdRef = useRef(1);
  const targetOriginRef = useRef(parentOrigin);

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
    const allowedOrigins = new Set([referrerOrigin, configuredOrigin].filter(Boolean));
    const requestTargetOrigin = referrerOrigin || configuredOrigin || '*';

    const onMessage = (event) => {
      if (event.source !== window.parent) return;
      if (allowedOrigins.size > 0 && !allowedOrigins.has(event.origin)) return;

      const data = event.data || {};
      if (data.type !== 'PARENT_URL_CONTEXT' || typeof data.url !== 'string') return;

      const fdl = formDataLayerRef.current;
      if (!fdl) return;

      const resolvedPathId = getFrontendPathIdFromUrl(data.url) || fdl.frontendPathId || '';
      fdl.parentUrl = data.url;
      fdl.frontendPathId = resolvedPathId;
    };

    window.addEventListener('message', onMessage);

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'REQUEST_PARENT_URL_CONTEXT' }, requestTargetOrigin);
      const timer = window.setTimeout(() => {
        window.parent.postMessage({ type: 'REQUEST_PARENT_URL_CONTEXT' }, requestTargetOrigin);
      }, 800);

      return () => {
        clearTimeout(timer);
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
      formId: fdl.formId,
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
    const pageLoadKey = `nxtwave_page_load_tracked_${sessionId}`;

    uniqueEventIdRef.current = getNextUniqueEventId(window.dataLayer);
    const parentUrl = document.referrer || parentPageUrl || '';
    const frontendPathId = getFrontendPathIdFromUrl(parentUrl) || getFrontendPathIdFromUrl(window.location.href);

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

    // React StrictMode can run mount effects twice in development; only track once per session.
    if (!sessionStorage.getItem(pageLoadKey)) {
      pushDataLayerEvent('page_load', {
        pageTitle: document.title,
        pageUrl: window.location.href,
        referrer: document.referrer || 'direct'
      });
      sessionStorage.setItem(pageLoadKey, '1');
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
