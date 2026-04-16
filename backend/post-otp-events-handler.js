const DRAFT_USER_API_URL = process.env.DRAFT_USER_API_URL || 'https://ib-user-accounts-backend-gamma-apis.ccbp.in/api/nxtwave_clients/user/account/draft/v1/';
const DRAFT_USER_API_KEY = process.env.DRAFT_USER_API_KEY || 'aX6TI0JV.GD0Bz43ntlBHsRZAqFBeGE0zB0SdRWqh';
const DRAFT_USER_CSRF_COOKIE = process.env.DRAFT_USER_CSRF_COOKIE || 'csrftoken=xNTQubRZDn4VCec5riyDHDxtEMdN4Fuh';

const SEGMENT_TRACK_URL = process.env.SEGMENT_TRACK_URL || 'https://api.segment.io/v1/track';
const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY || 'Ghu35SHftVD7AJsVsPxgwhYtCBXlHuJc';
const CRM_TRACK_ACTIVITY_URL = process.env.CRM_TRACK_ACTIVITY_URL || 'https://crm-integrations-apis.flowwai.work/api/sales_crm_core/track_activity/v1/';
const CRM_API_KEY = process.env.CRM_API_KEY || 'JewJk6ZrbaMWWHuYjSvwOHHdOO4m2s';

// CORS headers - explicitly set for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://nxtwave-lead.netlify.app',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-api-key, Cookie',
  'Access-Control-Max-Age': '86400'
};

function setCorsHeaders(res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

function getOrdinal(day) {
  const rem10 = day % 10;
  const rem100 = day % 100;
  if (rem10 === 1 && rem100 !== 11) return `${day}st`;
  if (rem10 === 2 && rem100 !== 12) return `${day}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${day}rd`;
  return `${day}th`;
}

function formatPreferredDate(ymd) {
  if (!ymd) return '';
  const [year, month, day] = String(ymd).split('-').map(Number);
  if (!year || !month || !day) return '';
  const dt = new Date(year, month - 1, day);
  const monthName = dt.toLocaleString('en-IN', { month: 'long' });
  return `${getOrdinal(day)} ${monthName} ${year}`;
}

function formatPreferredTime(datetimeValue) {
  if (!datetimeValue) return '';
  const [datePart, timePart] = String(datetimeValue).split(' ');
  if (!datePart || !timePart) return '';
  const [hh, mm] = timePart.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '';
  const meridian = hh >= 12 ? 'PM' : 'AM';
  const hour12 = hh % 12 || 12;
  return `${hour12}:${String(mm).padStart(2, '0')} ${meridian}`;
}

function toIsoWithIst(datetimeValue) {
  if (!datetimeValue) return '';
  const [datePart, timePart] = String(datetimeValue).split(' ');
  if (!datePart || !timePart) return '';
  return `${datePart}T${timePart}+05:30`;
}

function getPhoneDetails(phoneNumber) {
  let phone = String(phoneNumber || '').replace(/\s+/g, '');

  if (phone.startsWith('91') && phone.length === 12) {
    phone = phone.slice(2);
  }
  if (phone.startsWith('+91') && phone.length === 13) {
    phone = phone.slice(3);
  }

  if (!/^[6789]\d{9}$/.test(phone)) {
    throw new Error('Invalid phone number format');
  }

  return {
    iso2_country_code: 'IN',
    dial_code: '+91',
    phone_number: phone
  };
}

function getCRMPreferredMode(preferredMode) {
  if (preferredMode === 'Offline') return 'Learn at Training Center (Offline)';
  if (preferredMode === 'Online') return 'Learn from Home (Online)';
  return 'Learn from Home (Online)';
}

function getFieldObject(fieldName, fieldValue) {
  return { field_name: fieldName, field_value: String(fieldValue || '') };
}

async function callDraftUserApi(phoneNumber) {
  const innerJson = JSON.stringify({
    phone_number: phoneNumber,
    country_code: '+91'
  });

  const payload = {
    clientKeyDetailsId: 1,
    data: `'${innerJson}'`
  };

  console.log('[DraftUser] Request payload:', payload);

  const response = await fetch(DRAFT_USER_API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': DRAFT_USER_API_KEY,
      Cookie: DRAFT_USER_CSRF_COOKIE
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[DraftUser] API failed:', response.status, errorText);
    throw new Error(`Draft user API failed with status ${response.status}`);
  }

  const json = await response.json().catch(() => ({}));
  console.log('[DraftUser] API response:', json);

  return (
    json?.uuid ||
    json?.user_id ||
    json?.userId ||
    json?.id ||
    json?.data?.uuid ||
    json?.data?.user_id ||
    json?.data?.userId ||
    ''
  );
}

async function callSegmentTrack(submissionPayload, userId) {
  const formData = submissionPayload?.form_data || {};
  if (!userId) throw new Error('UUID is required for Segment tracking');

  // Prove name is in the form data
  console.log('[FormData] fullName received:', formData.fullName);
  console.log('[FormData] All form data:', JSON.stringify(formData));

  const body = {
    event: 'Demo Registration Success',
    properties: {
      demo_datetime: toIsoWithIst(formData.selected_webinar_slot_datetime),
      form_id: submissionPayload?.form_id || 'test-demo-form',
      frontend_form_path_id: 'intensive-english',
      lead_category: formData.lead_category || 'intensive_lead',
      preferred_language: formData.language || 'Telugu',
      user_preferred_date: formatPreferredDate(formData.selectADateToBookASlot),
      user_preferred_time: formData.timeSlots || formatPreferredTime(formData.selected_webinar_slot_datetime),
      utm_campaign: formData.utm_campaign || null,
      utm_content: formData.utm_content || null,
      utm_medium: formData.utm_medium || null,
      utm_source: formData.utm_source || null,
      utm_term: formData.utm_term || null,
      year_of_graduation: formData.graduationYear || formData.yearOfGraduation || null,
      full_name: formData.fullName || null
    },
    userId,
    writeKey: SEGMENT_WRITE_KEY
  };

  console.log('[Segment] Track payload:', JSON.stringify(body));

  console.log('[Segment] Request payload:', body);

  const response = await fetch(SEGMENT_TRACK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[Segment] API failed:', response.status, errorText);
    throw new Error(`Segment API failed with status ${response.status}`);
  }
}

async function callCRMTrackActivity(submissionPayload, uuid, phoneNumber) {
  const formData = submissionPayload?.form_data || {};
  const formId = formData.form_id || '';

  if (formId !== 'intensive-demo-form') {
    console.log('[CRM] Skipping - form_id is not intensive-demo-form:', formId);
    return;
  }

  if (!uuid) throw new Error('UUID is required for CRM track activity');

  const phoneDetails = getPhoneDetails(phoneNumber);
  const name = formData.fullName || formData.name || '';
  const yearOfGraduation = formData.graduationYear || formData.yearOfGraduation || formData.year_of_graduation || '';
  const preferredMode = formData.preferredMode || formData.preferred_mode || '';
  const nativeLanguage = formData.language || '';
  const nativeState = formData.state || formData.nativeState || formData.currentState || '';

  let frontendPathId = 'intensive';
  try {
    const frontendUrl = formData.frontend_url || '';
    if (frontendUrl) {
      const parsed = new URL(frontendUrl);
      const path = parsed.pathname.replace(/^\/+|\/+$/g, '');
      if (path) {
        frontendPathId = path.split('/')[0].toLowerCase();
      }
    }
  } catch {}

  const demoSlotDate = formData.selectADateToBookASlot || formData.demoSlotDate || '';
  const demoTimeSlot = formData.timeSlots || formData.demoTimeSlot || formData.demo || '';

  const activityDetails = [
    getFieldObject('ACT_RAD_UID', uuid),
    getFieldObject('ACT_RAD_NAME', name),
    getFieldObject('ACT_PHONE_NUMBER', JSON.stringify(phoneDetails)),
    getFieldObject('ACT_PREF_LANGUAGE', nativeLanguage),
    getFieldObject('ACT_RAD_FRNT_END_PATH_ID', frontendPathId),
    getFieldObject('ACT_RAD_UTM_SOURCE', formData.utm_source || ''),
    getFieldObject('ACT_RAD_UTM_MEDIUM', formData.utm_medium || ''),
    getFieldObject('ACT_RAD_UTM_CAMPAIGN', formData.utm_campaign || ''),
    getFieldObject('ACT_RAD_UTM_CONTENT', formData.utm_content || ''),
    getFieldObject('PREF_MODE_OF_STDY', getCRMPreferredMode(preferredMode)),
    getFieldObject('ACT_RAD_YOG', yearOfGraduation),
    getFieldObject('ACT_RAD_NATIVE_STATE', nativeState),
    getFieldObject('ACT_RAD_DEM_BKD_SLOT_DATE', demoSlotDate),
    getFieldObject('ACT_RAD_DEM_PREF_TIME_SLOT', demoTimeSlot),
    getFieldObject('ACT_RAD_LEAD_SOURCE', 'DM Meta Intensive Form'),
    getFieldObject('FORM_ID', formId)
  ];

  const body = {
    activity_reference_id: 'ACT_DEMO_FORM_SUBMIT',
    activity_details: activityDetails,
    contact_identification_type: 'PHONE_NUMBER',
    phone_number: phoneDetails
  };

  console.log('[CRM] Request payload:', JSON.stringify(body));

  const response = await fetch(CRM_TRACK_ACTIVITY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CRM_API_KEY,
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[CRM] API failed:', response.status, errorText);
    throw new Error(`CRM Track Activity API failed with status ${response.status}: ${errorText}`);
  }

  const json = await response.json().catch(() => ({}));
  console.log('[CRM] Track activity success:', json);
}

export default async function handler(req, res) {
  // Handle preflight OPTIONS request first - return 204 with CORS headers only
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(204).end();
  }

  // Set CORS headers for all other requests
  setCorsHeaders(res);

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const phoneNumber = String(req.body?.phoneNumber || '').trim();
    const submissionPayload = req.body?.submissionPayload || {};
    const formData = submissionPayload?.form_data || {};

    console.log('[Handler] Received phoneNumber:', phoneNumber);
    console.log('[Handler] Received submissionPayload:', JSON.stringify(submissionPayload));
    console.log('[Handler] UTM parameters:', {
      utm_source: formData.utm_source,
      utm_medium: formData.utm_medium,
      utm_campaign: formData.utm_campaign,
      utm_content: formData.utm_content,
      utm_term: formData.utm_term
    });

    if (!phoneNumber) {
      return res.status(400).json({ ok: false, error: 'phoneNumber is required' });
    }

    console.log('[Flow] Starting DraftUser -> Segment flow');
    const uuid = await callDraftUserApi(phoneNumber);
    console.log('[Handler] UUID received from DraftUser:', uuid);
    await callSegmentTrack(submissionPayload, uuid);
    await callCRMTrackActivity(submissionPayload, uuid, phoneNumber);
    console.log('[Flow] DraftUser -> Segment -> CRM flow completed successfully');

    return res.status(200).json({ ok: true, uuid });
  } catch (err) {
    console.error('[Flow] Failed:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Unexpected server error' });
  }
}
