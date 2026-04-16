import { useEffect, useState } from 'react';
import { FORM_ID, LEAD_CATEGORY, STEP_ID } from '../constants/formConstants';
import { formatDateTimeYMDHMS, parseDemoSlotValue } from '../utils/demoSlots';

function extractUtmFromSearchParams(params) {
  const utm = {};
  for (const [key, value] of params.entries()) {
    if (key.toLowerCase().startsWith('utm_')) utm[key.toLowerCase()] = value;
  }
  return utm;
}

function extractUtmLikeParams(payload) {
  const incoming = {};
  Object.keys(payload || {}).forEach((key) => {
    if (key.toLowerCase().startsWith('utm_')) incoming[key.toLowerCase()] = String(payload[key] || '');
  });
  return incoming;
}

function extractUtmFromUrl(url) {
  try {
    const parsed = new URL(url);
    return extractUtmFromSearchParams(parsed.searchParams);
  } catch {
    return {};
  }
}

function getPreferredModeValue(mode) {
  if (mode === 'In Classroom') return 'Learn at Training Center (Offline)';
  if (mode === 'Online') return 'Learn from Home (Online)';
  return mode || '';
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

export default function useSubmissionPayload({ parentOrigins, parentPageUrls }) {
  const [parentUtmFromMessage, setParentUtmFromMessage] = useState({});
  const [parentUrlFromMessage, setParentUrlFromMessage] = useState('');

  useEffect(() => {
    const resolvedReferrerOrigin = (() => {
      try {
        if (!document.referrer) return '';
        return new URL(document.referrer).origin;
      } catch {
        return '';
      }
    })();

    const allOrigins = new Set();
    (parentOrigins || []).forEach(origin => {
      withWwwVariants(origin).forEach(v => allOrigins.add(v));
    });
    if (resolvedReferrerOrigin) {
      withWwwVariants(resolvedReferrerOrigin).forEach(v => allOrigins.add(v));
    }
    const requestTargetOrigins = [...allOrigins, '*'];

    const onMessage = (event) => {
      if (event.source !== window.parent) return;

      const data = event.data || {};

      if (data.type === 'PARENT_URL_CONTEXT' && typeof data.url === 'string') {
        setParentUrlFromMessage(data.url);
        setParentUtmFromMessage((prev) => ({ ...prev, ...extractUtmFromUrl(data.url) }));
      }

      if ((data.type === 'PARENT_UTM' || data.type === 'UTM_PARAMS') && data.payload && typeof data.payload === 'object') {
        const incoming = extractUtmLikeParams(data.payload);
        setParentUtmFromMessage((prev) => ({ ...prev, ...incoming }));
      }
    };

    window.addEventListener('message', onMessage);

    if (window.parent && window.parent !== window) {
      requestTargetOrigins.forEach(origin => {
        window.parent.postMessage({ type: 'REQUEST_PARENT_URL_CONTEXT' }, origin);
        window.parent.postMessage({ type: 'REQUEST_PARENT_UTM' }, origin);
      });

      const timer = setTimeout(() => {
        requestTargetOrigins.forEach(origin => {
          window.parent.postMessage({ type: 'REQUEST_PARENT_URL_CONTEXT' }, origin);
          window.parent.postMessage({ type: 'REQUEST_PARENT_UTM' }, origin);
        });
      }, 800);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
      };
    }

    return () => window.removeEventListener('message', onMessage);
  }, [parentOrigins]);

  const extractUtmParams = () => {
    const fromReferrer = extractUtmFromUrl(document.referrer || '');

    let fromParentLocation = {};
    try {
      if (window.parent && window.parent !== window && window.parent.location?.href) {
        fromParentLocation = extractUtmFromUrl(window.parent.location.href);
      }
    } catch {
      // cross-origin restricted
    }

    const fromIframeUrl = extractUtmFromUrl(window.location.href);
    return { ...fromReferrer, ...fromParentLocation, ...parentUtmFromMessage, ...fromIframeUrl };
  };

  const resolveFrontendUrl = () => {
    if (parentUrlFromMessage) return parentUrlFromMessage;
    if (parentPageUrls && parentPageUrls.length > 0) return parentPageUrls[0];

    const referrer = document.referrer || '';
    if (parentOrigins && parentOrigins.some(origin => referrer.startsWith(origin))) return referrer;
    return window.location.href;
  };

  const buildSubmissionPayload = (store) => {
    const slotInfo = parseDemoSlotValue(store.demo);
    const utmParams = extractUtmParams();
    const now = new Date();
    const frontendUrl = resolveFrontendUrl();

    return {
      form_data: {
        selected_webinar_slot_datetime: slotInfo.slotDateTime,
        fullName: store.name,
        language: 'Telugu',
        stepId: STEP_ID,
        phoneNumber: store.mobile,
        frontend_url: frontendUrl,
        whatsappInfoStatus: true,
        acceptTAndPrivacyPolicy: true,
        lead_category: LEAD_CATEGORY,
        graduationYear: store.gradYear,
        state: store.state,
        nativeState: store.state,
        preferredMode: getPreferredModeValue(store.mode),
        timeSlots: slotInfo.timeSlot,
        selectADateToBookASlot: slotInfo.slotDate,
        yearOfGraduation: store.gradYear,
        interestedCareerPath: 'Software job',
        dedicateLearningHours: 'More than 4 hours',
        ...utmParams
      },
      form_id: FORM_ID,
      form_submission_id: String(Date.now()),
      // Placeholder: actual user_id is set from DraftUser API response in App.jsx
      user_id: '',
      form_submission_datetime: formatDateTimeYMDHMS(now)
    };
  };

  return { buildSubmissionPayload, extractUtmParams };
}
