import ProgressStepper from './ProgressStepper';
import { buildDemoSlotOptions } from '../utils/demoSlots';

const STATES = [
  'Andaman & Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal'
];

function StepTwo({ store, setStore, yearsList, isClassroom, step2Valid, onContinue, onBack }) {
  const demoSlotOptions = buildDemoSlotOptions();

  return (
    <div className="step active">
      <div className="step-content">
        <div className="form-title">Book a free demo in 60 seconds</div>
        <ProgressStepper step={2} />

        <button className="btn-back" type="button" onClick={onBack}>Back</button>

        <div className="fields-group">
          {!isClassroom && (
            <div className="field">
              <label htmlFor="inp-demo">Demo slot <span className="req">*</span></label>
              <div className="select-wrapper">
                <select id="inp-demo" value={store.demo} onChange={(e) => setStore((prev) => ({ ...prev, demo: e.target.value }))}>
                  <option value="">Select</option>
                  {demoSlotOptions.map((slot) => (
                    <option key={slot.value} value={slot.value}>{slot.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="inp-gradyear">Year of graduation <span className="req">*</span></label>
            <div className="select-wrapper">
              <select
                id="inp-gradyear"
                value={store.gradYear}
                onChange={(e) => setStore((prev) => ({ ...prev, gradYear: e.target.value }))}
              >
                <option value="">Select</option>
                {yearsList.map((y) => (
                  <option value={y} key={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="inp-state">Native state <span className="req">*</span></label>
            <div className="select-wrapper">
              <select
                id="inp-state"
                value={store.state}
                onChange={(e) => setStore((prev) => ({ ...prev, state: e.target.value }))}
              >
                <option value="">Select</option>
                {STATES.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="step-footer">
        <button className="btn-primary" type="button" disabled={!step2Valid} onClick={onContinue}>
          Verify Mobile Number
        </button>
      </div>
    </div>
  );
}

export default StepTwo;
