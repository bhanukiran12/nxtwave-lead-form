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

export default function useDataLayer({ parentOrigin }) {
  const formDataLayerRef = useRef(null);
  const uniqueEventIdRef = useRef(1);
  const targetOriginRef = useRef(parentOrigin);

  useEffect(() => {
    // postMessage requires strict origin format: scheme + host (+ optional port), no path.
    try {
      targetOriginRef.current = new URL(parentOrigin).origin;
    } catch {
      targetOriginRef.current = parentOrigin;
    }
  }, [parentOrigin]);

  const pushDataLayerEvent = (eventName, eventData = {}) => {
    if (!formDataLayerRef.current) return;

    const fdl = formDataLayerRef.current;
    const uniqueEventId = uniqueEventIdRef.current++;

    const event = {
      event: eventName,
      timestamp: new Date().toISOString(),
      sessionId: fdl.sessionId,
      'gtm.uniqueEventId': uniqueEventId,
      ...eventData
    };

    fdl.events.push(event);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);

    if (window.parent && window.parent !== window) {
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

    pushDataLayerEvent(`otp_${action}`, {
      attemptNumber: fdl.formMetrics.otpAttempts,
      ...details
    });
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

    formDataLayerRef.current = {
      sessionId,
      startTime: new Date().toISOString(),
      pageUrl: window.location.href,
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
