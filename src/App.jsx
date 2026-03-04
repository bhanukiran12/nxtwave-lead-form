import { useEffect, useRef, useState } from 'react';
import './App.css';
import StepOne from './components/StepOne';
import StepTwo from './components/StepTwo';
import StepThree from './components/StepThree';
import SuccessStep from './components/SuccessStep';
import {
  DRAFT_USER_API_KEY,
  DRAFT_USER_API_URL,
  GRAD_YEARS_CLASSROOM,
  GRAD_YEARS_ONLINE,
  PARENT_PAGE_URL,
  PARENT_WINDOW_ORIGIN,
  SEGMENT_TRACK_URL,
  SEGMENT_WRITE_KEY,
  SHEETS_URL
} from './constants/formConstants';
import useDataLayer from './hooks/useDataLayer';
import useOtp from './hooks/useOtp';
import useSubmissionPayload from './hooks/useSubmissionPayload';

const sanitiseName = (v) => v.replace(/[^a-zA-Z\s]/g, '').replace(/\s{2,}/g, ' ');
const sanitiseMobile = (v) => v.replace(/\D/g, '').slice(0, 10);
const escapeHtml = (v) =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isValidName = (v) => /^[a-zA-Z\s]{3,60}$/.test(v.trim());
const isValidMobile = (v) => /^\d{10}$/.test(v.trim());

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
  const [year, month, day] = ymd.split('-').map(Number);
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

function App() {
  const [step, setStep] = useState(1);
  const [store, setStore] = useState({ name: '', mobile: '', mode: '', gradYear: '', state: '', demo: '' });
  const [nameValue, setNameValue] = useState('');
  const [mobileValue, setMobileValue] = useState('');

  const confettiRef = useRef({ canvas: null, ctx: null, particles: [], animId: null });

  const {
    trackStepView,
    trackFieldInteraction,
    trackOtpAction,
    trackFormSubmission
  } = useDataLayer({ parentOrigin: PARENT_WINDOW_ORIGIN });

  const { buildSubmissionPayload } = useSubmissionPayload({
    parentOrigin: PARENT_WINDOW_ORIGIN,
    parentPageUrl: PARENT_PAGE_URL
  });

  const createDraftUserAndGetUuid = async (phoneNumber) => {
    const payload = {
      clientKeyDetailsId: 1,
      data: JSON.stringify({
        phone_number: phoneNumber,
        country_code: '+91'
      })
    };

    console.log('[DraftUser] Request payload:', payload);
    const response = await fetch(DRAFT_USER_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': DRAFT_USER_API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('[DraftUser] API error status:', response.status);
      throw new Error(`Draft user API failed with status ${response.status}`);
    }

    const json = await response.json();
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
    console.log('[DraftUser] API response:', json);
    console.log('[DraftUser] Resolved UUID:', uuid);
    return uuid;
  };

  const sendSegmentTrack = async (payload, uuid) => {
    const formData = payload?.form_data || {};
    const trackBody = {
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
      writeKey: SEGMENT_WRITE_KEY
    };

    console.log('[Segment] Track payload:', trackBody);
    const response = await fetch(SEGMENT_TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trackBody)
    });
    if (!response.ok) {
      console.error('[Segment] Track failed status:', response.status);
      throw new Error(`Segment track failed with status ${response.status}`);
    }
    console.log('[Segment] Track success status:', response.status);
  };

  const onOtpVerified = async () => {
    triggerConfetti();
    trackFormSubmission('completed', {
      mode: store.mode,
      gradYear: store.gradYear,
      state: store.state
    });
    setStep('success');

    const submissionPayload = buildSubmissionPayload(store);
    console.log('[Sheets] Submission payload:', submissionPayload);
    fetch(SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submissionPayload)
    })
      .then(() => {
        console.log('[Sheets] Request sent (no-cors mode, response not readable).');
      })
      .catch((err) => {
        console.error('[Sheets] Request failed:', err);
      });

    // 1) Create draft user and fetch UUID, 2) fire segment track with that UUID.
    try {
      console.log('[Flow] Starting DraftUser -> Segment flow');
      const uuid = await createDraftUserAndGetUuid(store.mobile);
      await sendSegmentTrack(submissionPayload, uuid);
      console.log('[Flow] DraftUser -> Segment flow completed successfully');
    } catch (err) {
      console.error('[Flow] DraftUser -> Segment flow failed:', err);
      // keep booking success flow non-blocking even if analytics APIs fail
    }
  };

  const otp = useOtp({
    mobile: store.mobile,
    onOtpAction: trackOtpAction,
    onVerified: onOtpVerified
  });

  const yearsList = store.mode === 'In Classroom' ? GRAD_YEARS_CLASSROOM : GRAD_YEARS_ONLINE;
  const isClassroom = store.mode === 'In Classroom';

  const step1Valid = isValidName(nameValue) && isValidMobile(mobileValue) && !!store.mode;
  const step2Valid = store.gradYear && store.state && (isClassroom || store.demo);

  const nameHasError = nameValue.trim() && !isValidName(nameValue);
  const mobileHasError = mobileValue.trim() && !isValidMobile(mobileValue);

  const triggerConfetti = () => {
    const env = confettiRef.current;
    if (!env.canvas || !env.ctx) return;

    const canvas = env.canvas;
    const ctx = env.ctx;
    const colors = ['#4F46E5', '#6366F1', '#16A34A', '#F59E0B', '#EC4899', '#06B6D4', '#F97316'];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();

    for (let i = 0; i < 100; i += 1) {
      env.particles.push({
        x: canvas.width / 2,
        y: canvas.height * 0.45,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.8) * 14,
        size: Math.random() * 9 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 9,
        shape: Math.random() > 0.5 ? 'rect' : 'circle'
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      env.particles = env.particles.filter((p) => p.alpha > 0.02);

      env.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28;
        p.vx *= 0.99;
        p.alpha -= 0.017;
        p.rotation += p.rotSpeed;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      if (env.particles.length > 0) {
        env.animId = requestAnimationFrame(animate);
      } else {
        env.animId = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    if (!env.animId) animate();
  };

  const handleGoToStep2 = () => {
    if (!step1Valid) return;

    const safeName = escapeHtml(nameValue.trim());
    const mobile = mobileValue.trim();

    setStore((prev) => ({
      ...prev,
      name: safeName,
      mobile,
      demo: prev.mode === 'In Classroom' ? '' : prev.demo,
      gradYear: ''
    }));

    trackFieldInteraction('name', safeName);
    trackFieldInteraction('mobile', mobile);

    triggerConfetti();
    setStep(2);
    trackStepView(2);
  };

  const handleGoToStep3 = () => {
    if (!step2Valid) return;

    trackFieldInteraction('gradYear', store.gradYear);
    trackFieldInteraction('state', store.state);
    trackFieldInteraction('demo', store.demo);

    triggerConfetti();
    setStep(3);
    trackStepView(3);
  };

  const goBack = (toStep) => {
    if (step === 3) otp.stopOtpTimer();
    setStep(toStep);
    trackStepView(toStep);
  };

  useEffect(() => {
    trackStepView(1);
  }, []);

  useEffect(() => {
    if (step === 3) {
      otp.initializeOtpFlow();
    }
  }, [step]);

  useEffect(() => {
    if (store.mode === 'In Classroom' && store.demo) {
      setStore((prev) => ({ ...prev, demo: '' }));
    }

    if (store.gradYear && !yearsList.includes(store.gradYear)) {
      setStore((prev) => ({ ...prev, gradYear: '' }));
    }
  }, [store.mode]);

  useEffect(() => {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return () => {};

    const ctx = canvas.getContext('2d');
    confettiRef.current.canvas = canvas;
    confettiRef.current.ctx = ctx;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      if (confettiRef.current.animId) cancelAnimationFrame(confettiRef.current.animId);
      otp.stopOtpTimer();
    };
  }, []);

  return (
    <>
      <canvas id="confetti-canvas" />

      <div className="form-card">
        {step === 1 && (
          <StepOne
            nameValue={nameValue}
            setNameValue={setNameValue}
            mobileValue={mobileValue}
            setMobileValue={setMobileValue}
            mode={store.mode}
            setMode={(mode) => setStore((prev) => ({ ...prev, mode }))}
            nameHasError={nameHasError}
            mobileHasError={mobileHasError}
            step1Valid={step1Valid}
            onContinue={handleGoToStep2}
            sanitiseName={sanitiseName}
            sanitiseMobile={sanitiseMobile}
          />
        )}

        {step === 2 && (
          <StepTwo
            store={store}
            setStore={setStore}
            yearsList={yearsList}
            isClassroom={isClassroom}
            step2Valid={step2Valid}
            onContinue={handleGoToStep3}
            onBack={() => goBack(1)}
          />
        )}

        {step === 3 && (
          <StepThree
            mobile={store.mobile}
            otpDigits={otp.otpDigits}
            otpError={otp.otpError}
            otpStatus={otp.otpStatus}
            resendSeconds={otp.resendSeconds}
            verifyLoading={otp.verifyLoading}
            firebaseReady={otp.firebaseReady}
            onOtpRef={otp.setOtpRef}
            onOtpInput={otp.handleOtpInput}
            onOtpKeyDown={otp.handleOtpKeyDown}
            onOtpPaste={otp.handleOtpPaste}
            onResend={otp.resendOtp}
            onVerify={otp.verifyOtp}
            onBack={() => goBack(2)}
          />
        )}

        {step === 'success' && <SuccessStep isClassroom={isClassroom} demo={store.demo} />}
      </div>
    </>
  );
}

export default App;
