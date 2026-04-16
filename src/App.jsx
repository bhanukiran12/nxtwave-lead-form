import { useEffect, useRef, useState } from 'react';
import './App.css';
import StepOne from './components/StepOne';
import StepTwo from './components/StepTwo';
import StepThree from './components/StepThree';
import SuccessStep from './components/SuccessStep';
import {
  FORM_ID,
  GRAD_YEARS_CLASSROOM,
  GRAD_YEARS_ONLINE,
  PARENT_PAGE_URLS,
  PARENT_WINDOW_ORIGINS,
  POST_OTP_EVENTS_API_URL,
  SHEETS_STAGE_NAME,
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

function App() {
  const [step, setStep] = useState(1);
  const [store, setStore] = useState({ name: '', mobile: '', mode: '', gradYear: '', state: '', demo: '' });
  const [nameValue, setNameValue] = useState('');
  const [mobileValue, setMobileValue] = useState('');

  const confettiRef = useRef({ canvas: null, ctx: null, particles: [], animId: null });

  const {
    sessionId,
    trackStepView,
    trackFieldInteraction,
    trackOtpAction,
    trackFormSubmission
  } = useDataLayer({
    parentOrigins: PARENT_WINDOW_ORIGINS,
    parentPageUrls: PARENT_PAGE_URLS,
    formId: FORM_ID
  });

  const { buildSubmissionPayload } = useSubmissionPayload({
    parentOrigins: PARENT_WINDOW_ORIGINS,
    parentPageUrls: PARENT_PAGE_URLS
  });

  const onOtpVerified = async () => {
    triggerConfetti();
    trackFormSubmission('completed', {
      mode: store.mode,
      gradYear: store.gradYear,
      state: store.state
    });
    setStep('success');

    const submissionPayload = buildSubmissionPayload(store);

    let draftUserId = '';
    try {
      const response = await fetch(POST_OTP_EVENTS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: store.mobile,
          submissionPayload
        })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || `Backend API failed with status ${response.status}`);
      }
      draftUserId = json?.uuid || json?.userId || json?.user_id || '';
      if (draftUserId) {
        submissionPayload.user_id = draftUserId;
      }
    } catch (err) {
      // preserve existing behaviour on failure; fallback to built user_id
      console.error('[onOtpVerified] Draft user lookup failed:', err); 
    }

    await postStageDataToSheet('final', {
      name: store.name,
      mobile: store.mobile,
      mode: store.mode,
      gradYear: store.gradYear,
      state: store.state,
      demo: store.demo,
      otpVerified: true,
      submitted: true,
      formSubmissionId: submissionPayload.form_submission_id,
      formSubmissionDatetime: submissionPayload.form_submission_datetime,
      submissionPayload,
      userId: draftUserId
    });

    fetch(SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submissionPayload)
    }).catch(() => {});
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

  const postStageDataToSheet = (stage, data) => {
    const activeSessionId = sessionId || sessionStorage.getItem('nxtwave_session_id') || '';
    if (!activeSessionId) return Promise.resolve();

    return fetch(SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheetName: SHEETS_STAGE_NAME,
        sessionId: activeSessionId,
        stage,
        data
      })
    }).catch(() => {});
  };

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
    postStageDataToSheet('step1', {
      name: safeName,
      mobile,
      mode: store.mode
    });

    triggerConfetti();
    setStep(2);
    trackStepView(2);
  };

  const handleGoToStep3 = () => {
    if (!step2Valid) return;
    trackFieldInteraction('gradYear', store.gradYear);
    trackFieldInteraction('state', store.state);
    if (store.demo) {
      trackFieldInteraction('demo', store.demo);
    }
    postStageDataToSheet('step2', {
      name: store.name,
      mobile: store.mobile,
      mode: store.mode,
      gradYear: store.gradYear,
      state: store.state,
      demo: store.demo
    });

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
            otpProviderReady={otp.otpProviderReady}
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
