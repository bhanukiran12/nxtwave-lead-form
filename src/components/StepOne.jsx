import ProgressStepper from './ProgressStepper';

function StepOne({
  nameValue,
  setNameValue,
  mobileValue,
  setMobileValue,
  mode,
  setMode,
  nameHasError,
  mobileHasError,
  step1Valid,
  onContinue,
  sanitiseName,
  sanitiseMobile
}) {
  return (
    <div className="step active">
      <div className="step-content">
        <div className="form-title">Book a free demo in 60 seconds</div>
        <ProgressStepper step={1} />

        <div className="fields-group">
          <div className="field">
            <label htmlFor="inp-name">Full name <span className="req">*</span></label>
            <input
              id="inp-name"
              type="text"
              placeholder="Enter your full name"
              autoComplete="name"
              value={nameValue}
              onChange={(e) => setNameValue(sanitiseName(e.target.value))}
            />
            <div className={`error-msg ${nameHasError ? 'visible' : ''}`}>
              Please enter your full name (min. 3 letters, letters only)
            </div>
          </div>

          <div className="field">
            <label htmlFor="inp-mobile">Mobile number <span className="req">*</span></label>
            <input
              id="inp-mobile"
              type="tel"
              maxLength={10}
              placeholder="Enter your 10-digit mobile number"
              autoComplete="tel-national"
              value={mobileValue}
              onChange={(e) => setMobileValue(sanitiseMobile(e.target.value))}
            />
            <div className={`error-msg ${mobileHasError ? 'visible' : ''}`}>
              Please enter a valid 10-digit mobile number
            </div>
          </div>

          <div className="field">
            <label>Preferred mode of study <span className="req">*</span></label>
            <div className="mode-toggle">
              <button
                type="button"
                className={`mode-btn ${mode === 'Online' ? 'selected' : ''}`}
                onClick={() => setMode('Online')}
              >
                Online
              </button>
              <button
                type="button"
                className={`mode-btn ${mode === 'In Classroom' ? 'selected' : ''}`}
                onClick={() => setMode('In Classroom')}
              >
                Training Center
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="step-footer">
        <div className="terms">
          By proceeding further, I agree to the{' '}
          <a href="https://www.ccbp.in/terms-and-conditions" target="_blank" rel="noreferrer">Terms &amp; Conditions</a>{' '}
          and{' '}
          <a href="https://www.ccbp.in/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a>{' '}
          of NxtWave.
        </div>
        <button className="btn-primary" type="button" disabled={!step1Valid} onClick={onContinue}>
          Pick a Demo Slot
        </button>
      </div>
    </div>
  );
}

export default StepOne;
