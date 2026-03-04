import { useEffect, useRef, useState } from 'react';
import { FIREBASE_CONFIG, OTP_SECONDS } from '../constants/formConstants';

export default function useOtp({ mobile, onOtpAction, onVerified }) {
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState(false);
  const [otpStatus, setOtpStatus] = useState({ message: '', type: 'info' });
  const [resendSeconds, setResendSeconds] = useState(OTP_SECONDS);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);

  const otpRefs = useRef([]);
  const otpTimerRef = useRef(null);
  const confirmationResultRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);
  const recaptchaWidgetIdRef = useRef(null);
  const otpVerifyInFlightRef = useRef(false);
  const otpVerifiedRef = useRef(false);

  const clearOtpStatus = () => setOtpStatus({ message: '', type: 'info' });
  const setOtpStatusMessage = (message, type = 'info') => setOtpStatus({ message, type });

  const stopOtpTimer = () => {
    if (otpTimerRef.current) {
      clearInterval(otpTimerRef.current);
      otpTimerRef.current = null;
    }
  };

  const startOtpTimer = () => {
    stopOtpTimer();
    setResendSeconds(OTP_SECONDS);
    otpTimerRef.current = setInterval(() => {
      setResendSeconds((prev) => {
        if (prev <= 1) {
          stopOtpTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const setOtpRef = (el, idx) => {
    otpRefs.current[idx] = el;
  };

  const focusFirstOtp = () => {
    setTimeout(() => otpRefs.current[0]?.focus(), 30);
  };

  const getOrInitRecaptcha = async () => {
    if (!window.firebasePhoneAuth) return null;
    const { auth, RecaptchaVerifier } = window.firebasePhoneAuth;

    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      recaptchaWidgetIdRef.current = await recaptchaVerifierRef.current.render();
    } else if (typeof window.grecaptcha !== 'undefined' && recaptchaWidgetIdRef.current !== null) {
      window.grecaptcha.reset(recaptchaWidgetIdRef.current);
    }

    return recaptchaVerifierRef.current;
  };

  const sendOtpToMobile = async (isResend = false) => {
    if (!window.firebasePhoneAuth) {
      setOtpStatusMessage('Unable to send OTP right now. Please refresh and try again.', 'error');
      return false;
    }

    const { signInWithPhoneNumber } = window.firebasePhoneAuth;

    setVerifyLoading(true);
    setOtpStatusMessage(isResend ? 'Resending OTP...' : 'Sending OTP...', 'info');
    onOtpAction?.('send', { isResend });

    try {
      const appVerifier = await getOrInitRecaptcha();
      confirmationResultRef.current = await signInWithPhoneNumber(window.firebasePhoneAuth.auth, `+91${mobile}`, appVerifier);
      otpVerifiedRef.current = false;
      setOtpStatusMessage('OTP sent. Enter the 6-digit code.', 'success');
      onOtpAction?.('sent_success');
      return true;
    } catch (err) {
      setOtpStatusMessage('Failed to send OTP. Please try again.', 'error');
      onOtpAction?.('send_failed', { error: err?.message });
      return false;
    } finally {
      setVerifyLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otpVerifiedRef.current || otpVerifyInFlightRef.current) return false;

    const otp = otpDigits.join('');
    if (otp.length < 6) {
      setOtpError(true);
      clearOtpStatus();
      return false;
    }

    if (!confirmationResultRef.current) {
      setOtpStatusMessage('OTP is not ready yet. Please wait or resend.', 'error');
      return false;
    }

    setOtpError(false);
    clearOtpStatus();
    otpVerifyInFlightRef.current = true;
    setVerifyLoading(true);

    try {
      await confirmationResultRef.current.confirm(otp);
      otpVerifiedRef.current = true;
      setOtpStatusMessage('Mobile number verified successfully.', 'success');
      onOtpAction?.('verified_success');
      stopOtpTimer();
      await onVerified?.();
      return true;
    } catch (err) {
      setOtpError(true);
      onOtpAction?.('attempt', { success: false, error: err?.message });
      return false;
    } finally {
      otpVerifyInFlightRef.current = false;
      setVerifyLoading(false);
    }
  };

  const initializeOtpFlow = async () => {
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError(false);
    clearOtpStatus();
    startOtpTimer();
    await sendOtpToMobile(false);
    focusFirstOtp();
  };

  const resendOtp = async () => {
    if (resendSeconds > 0) return;
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError(false);
    clearOtpStatus();
    startOtpTimer();
    await sendOtpToMobile(true);
    focusFirstOtp();
  };

  const handleOtpInput = (idx, value) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[idx] = clean;
    setOtpDigits(next);
    setOtpError(false);
    clearOtpStatus();

    if (clean && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (next.join('').length === 6) setTimeout(() => verifyOtp(), 0);
  };

  const handleOtpKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const p = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
    if (!p) return;

    const next = ['', '', '', '', '', ''];
    p.split('').forEach((ch, i) => {
      next[i] = ch;
    });

    setOtpDigits(next);
    otpRefs.current[Math.min(p.length, 5)]?.focus();
    if (p.length >= 6) setTimeout(() => verifyOtp(), 0);
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [{ initializeApp }, { getAnalytics }, { getAuth, RecaptchaVerifier, signInWithPhoneNumber }] = await Promise.all([
          import('https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js'),
          import('https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js'),
          import('https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js')
        ]);

        const app = initializeApp(FIREBASE_CONFIG);
        getAnalytics(app);
        const auth = getAuth(app);

        window.firebasePhoneAuth = { auth, RecaptchaVerifier, signInWithPhoneNumber };
        if (mounted) setFirebaseReady(true);
      } catch {
        if (mounted) setFirebaseReady(false);
      }
    })();

    return () => {
      mounted = false;
      stopOtpTimer();
    };
  }, []);

  return {
    otpDigits,
    otpError,
    otpStatus,
    resendSeconds,
    verifyLoading,
    firebaseReady,
    setOtpRef,
    handleOtpInput,
    handleOtpKeyDown,
    handleOtpPaste,
    resendOtp,
    verifyOtp,
    initializeOtpFlow,
    stopOtpTimer
  };
}
