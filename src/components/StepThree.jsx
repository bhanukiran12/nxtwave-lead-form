import ProgressStepper from './ProgressStepper';

function StepThree({
  mobile,
  otpDigits,
  otpError,
  otpStatus,
  resendSeconds,
  verifyLoading,
  firebaseReady,
  onOtpRef,
  onOtpInput,
  onOtpKeyDown,
  onOtpPaste,
  onResend,
  onVerify,
  onBack
}) {
  return (
    <div className="step active">
      <div className="step-content">
        <div className="form-title">Book a free demo in 60 seconds</div>
        <ProgressStepper step={3} />

        <button className="btn-back" type="button" onClick={onBack}>Back</button>

        <div className="otp-info">
          We have sent a 6 digit OTP to your mobile number <strong>{mobile}</strong>
        </div>

        <div className="fields-group">
          <div className="field">
            <label>OTP <span className="req">*</span></label>
            <div className="otp-grid">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => onOtpRef(el, i)}
                  className={`otp-box ${otpError ? 'has-error' : ''}`}
                  type="tel"
                  maxLength={1}
                  inputMode="numeric"
                  value={digit}
                  onChange={(e) => onOtpInput(i, e.target.value)}
                  onKeyDown={(e) => onOtpKeyDown(e, i)}
                  onPaste={onOtpPaste}
                />
              ))}
            </div>
            <div className={`otp-error ${otpError ? 'visible' : ''}`}>Invalid OTP. Please enter a valid OTP</div>
          </div>

          <div className="resend-row">
            <button className={`resend-btn ${resendSeconds === 0 ? 'active' : ''}`} type="button" onClick={onResend}>
              {resendSeconds > 0 ? <>Resend OTP <span>{resendSeconds}s</span></> : 'Resend OTP'}
            </button>
          </div>

          <div className={`otp-status ${otpStatus.message ? `visible ${otpStatus.type}` : ''}`}>{otpStatus.message}</div>
          <div id="recaptcha-container" />
        </div>
      </div>

      <div className="step-footer">
        <button className="btn-primary" type="button" onClick={onVerify} disabled={verifyLoading || !firebaseReady}>
          {verifyLoading ? <span className="spinner" /> : 'Verify OTP'}
        </button>
      </div>
    </div>
  );
}

export default StepThree;
