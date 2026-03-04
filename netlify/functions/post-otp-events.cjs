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

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const submissionPayload = body.submissionPayload || {};
    const formData = submissionPayload.form_data || {};
    const phoneNumber = String(body.phoneNumber || formData.phoneNumber || '').trim();

    if (!phoneNumber) {
      return json(400, { ok: false, error: 'phoneNumber is required' });
    }

    const draftApiUrl = process.env.DRAFT_USER_API_URL ||
      'https://ib-user-accounts-backend-gamma-apis.ccbp.in/api/nxtwave_clients/user/account/draft/v1/';
    const draftApiKey = process.env.DRAFT_USER_API_KEY || '';
    const segmentTrackUrl = process.env.SEGMENT_TRACK_URL || 'https://api.segment.io/v1/track';
    const segmentWriteKey = process.env.SEGMENT_WRITE_KEY || '';

    if (!draftApiKey) {
      return json(500, { ok: false, error: 'Missing DRAFT_USER_API_KEY env var' });
    }

    if (!segmentWriteKey) {
      return json(500, { ok: false, error: 'Missing SEGMENT_WRITE_KEY env var' });
    }

    const draftPayload = {
      clientKeyDetailsId: 1,
      data: JSON.stringify({
        phone_number: phoneNumber,
        country_code: '+91'
      })
    };

    console.log('[DraftUser] Request payload:', draftPayload);
    const draftRes = await fetch(draftApiUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': draftApiKey
      },
      body: JSON.stringify(draftPayload)
    });

    if (!draftRes.ok) {
      const draftErrText = await draftRes.text().catch(() => '');
      console.error('[DraftUser] Failed:', draftRes.status, draftErrText);
      return json(502, { ok: false, error: `Draft user API failed (${draftRes.status})` });
    }

    const draftJson = await draftRes.json().catch(() => ({}));
    const uuid = (
      draftJson?.uuid ||
      draftJson?.user_id ||
      draftJson?.userId ||
      draftJson?.id ||
      draftJson?.data?.uuid ||
      draftJson?.data?.user_id ||
      draftJson?.data?.userId ||
      ''
    );

    console.log('[DraftUser] Response:', draftJson);
    console.log('[DraftUser] Resolved UUID:', uuid);

    const segmentPayload = {
      event: 'Demo Registration Success',
      properties: {
        utm_campaign: formData.utm_campaign || null,
        utm_source: formData.utm_source || null,
        utm_medium: formData.utm_medium || null,
        lead_category: formData.lead_category || 'intensive_lead',
        intermediate_completion_year: formData.intermediateOr12CompletionYear || null,
        utm_term: formData.utm_term || null,
        utm_content: formData.utm_content || null,
        interested_career_path: formData.interestedCareerPath || null,
        occupation: formData.currentOccupation || null,
        no_of_hours_can_be_spent_on_learning: formData.dedicateLearningHours || null,
        year_of_graduation: formData.graduationYear || formData.yearOfGraduation || null,
        user_preferred_time: formData.timeSlots || formatPreferredTime(formData.selected_webinar_slot_datetime),
        demo_datetime: toIsoWithIst(formData.selected_webinar_slot_datetime),
        user_preferred_date: formatPreferredDate(formData.selectADateToBookASlot),
        preferred_language: formData.language || 'Telugu',
        degree: formData.degree || 'B.Tech / BE'
      },
      userId: uuid || '',
      writeKey: segmentWriteKey
    };

    console.log('[Segment] Request payload:', segmentPayload);
    const segmentRes = await fetch(segmentTrackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(segmentPayload)
    });

    if (!segmentRes.ok) {
      const segErrText = await segmentRes.text().catch(() => '');
      console.error('[Segment] Failed:', segmentRes.status, segErrText);
      return json(502, { ok: false, error: `Segment track failed (${segmentRes.status})`, uuid });
    }

    console.log('[Segment] Success status:', segmentRes.status);
    return json(200, { ok: true, uuid });
  } catch (err) {
    console.error('[post-otp-events] Error:', err);
    return json(500, { ok: false, error: err?.message || 'Unexpected error' });
  }
};
