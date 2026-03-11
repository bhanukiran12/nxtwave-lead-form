import { useEffect, useState } from 'react';
import { FORM_ID, LEAD_CATEGORY, STEP_ID } from '../constants/formConstants';

const pad2 = (num) => String(num).padStart(2, '0');
const formatDateYMD = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const formatDateTimeYMDHMS = (date) => `${formatDateYMD(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

function parseDemoSlot(demoValue) {
  if (!demoValue) return { slotDate: '', slotDateTime: '', timeSlot: '' };
  const parts = demoValue.split(' - ');
  if (parts.length !== 2) return { slotDate: '', slotDateTime: '', timeSlot: '' };

  const dayLabel = (parts[0] || '').trim().toLowerCase();
  const timeRaw = (parts[1] || '').trim().toUpperCase();
  const timeMatch = timeRaw.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (!timeMatch) return { slotDate: '', slotDateTime: '', timeSlot: '' };

  const now = new Date();
  const slotDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dayLabel === 'tomorrow') slotDateObj.setDate(slotDateObj.getDate() + 1);

  let hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);
  const meridian = timeMatch[3];
  if (meridian === 'PM' && hour !== 12) hour += 12;
  if (meridian === 'AM' && hour === 12) hour = 0;

  const slotStart = new Date(slotDateObj);
  slotStart.setHours(hour, minute, 0, 0);
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

  const startHour12 = slotStart.getHours() % 12 || 12;
  const endHour12 = slotEnd.getHours() % 12 || 12;
  const startMeridian = slotStart.getHours() >= 12 ? 'PM' : 'AM';
  const endMeridian = slotEnd.getHours() >= 12 ? 'PM' : 'AM';

  return {
    slotDate: formatDateYMD(slotStart),
    slotDateTime: formatDateTimeYMDHMS(slotStart),
    timeSlot: `${startHour12}${startMeridian} - ${endHour12}${endMeridian}`
  };
}

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
  if (mode === 'Online') return 'Learn Online';
  return mode || '';
}

export default function useSubmissionPayload({ parentOrigin, parentPageUrl }) {
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

    const allowedOrigins = new Set([parentOrigin, resolvedReferrerOrigin].filter(Boolean));
    const requestTargetOrigin = resolvedReferrerOrigin || parentOrigin || '*';

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
      window.parent.postMessage({ type: 'REQUEST_PARENT_URL_CONTEXT' }, requestTargetOrigin);
      window.parent.postMessage({ type: 'REQUEST_PARENT_UTM' }, requestTargetOrigin);

      // Retry once to avoid missing parent data because of load-order timing.
      const timer = setTimeout(() => {
        window.parent.postMessage({ type: 'REQUEST_PARENT_URL_CONTEXT' }, requestTargetOrigin);
        window.parent.postMessage({ type: 'REQUEST_PARENT_UTM' }, requestTargetOrigin);
      }, 800);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
      };
    }

    return () => window.removeEventListener('message', onMessage);
  }, [parentOrigin]);

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
    if (parentPageUrl) return parentPageUrl;

    const referrer = document.referrer || '';
    if (referrer.startsWith(parentOrigin)) return referrer;
    return window.location.href;
  };

  const buildSubmissionPayload = (store) => {
    const slotInfo = parseDemoSlot(store.demo);
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
        acceptTAndCAndPrivacyPolicy: true,
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
      user_id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `user_${Date.now()}`,
      form_submission_datetime: formatDateTimeYMDHMS(now)
    };
  };

  return { buildSubmissionPayload, extractUtmParams };
}
