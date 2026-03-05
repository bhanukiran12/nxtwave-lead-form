const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT || 3001);

// CORS configuration - allow requests from Netlify frontend
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-api-key', 'Cookie']
}));

app.use(express.json({ limit: '2mb' }));

const DRAFT_USER_API_URL = process.env.DRAFT_USER_API_URL || 'https://ib-user-accounts-backend-gamma-apis.ccbp.in/api/nxtwave_clients/user/account/draft/v1/';
const DRAFT_USER_API_KEY = process.env.DRAFT_USER_API_KEY || 'aX6TI0JV.GD0Bz43ntlBHsRZAqFBeGE0zB0SdRWqh';
const DRAFT_USER_CSRF_COOKIE = process.env.DRAFT_USER_CSRF_COOKIE || 'csrftoken=xNTQubRZDn4VCec5riyDHDxtEMdN4Fuh';

const SEGMENT_TRACK_URL = process.env.SEGMENT_TRACK_URL || 'https://api.segment.io/v1/track';
const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY || 'pSF1EDPoC6XzbKeiyn2N3StqrlGdPHFT';

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

  const uuid = (
    json?.uuid ||
    json?.user_id ||
    json?.userId ||
    json?.id ||
    json?.data?.uuid ||
    json?.data?.user_id ||
    json?.data?.userId ||
    ''
  );

  console.log('[DraftUser] Resolved UUID:', uuid);
  return uuid;
}

async function callSegmentTrack(submissionPayload, userId) {
  const formData = submissionPayload?.form_data || {};
  if (!userId) {
    throw new Error('UUID is required for Segment tracking');
  }

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
      year_of_graduation: formData.graduationYear || formData.yearOfGraduation || null
    },
    userId: userId,
    writeKey: SEGMENT_WRITE_KEY
  };

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

  console.log('[Segment] Track success status:', response.status);
}

// API route for post-otp-events
app.post('/api/post-otp-events', async (req, res) => {
  try {
    const phoneNumber = String(req.body?.phoneNumber || '').trim();
    const submissionPayload = req.body?.submissionPayload || {};

    if (!phoneNumber) {
      return res.status(400).json({ ok: false, error: 'phoneNumber is required' });
    }

    console.log('[Flow] Starting DraftUser -> Segment flow');
    let uuid = '';
    try {
      uuid = await callDraftUserApi(phoneNumber);
    } catch (err) {
      console.error('[Flow] DraftUser UUID failed:', err);
      return res.status(502).json({ ok: false, error: 'Draft user API failed. UUID not available.' });
    }

    await callSegmentTrack(submissionPayload, uuid);
    console.log('[Flow] DraftUser -> Segment flow completed successfully');
    return res.status(200).json({ ok: true, uuid });
  } catch (err) {
    console.error('[Flow] Failed:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Unexpected server error' });
  }
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`[backend] Express server listening on http://localhost:${PORT}`);
});
