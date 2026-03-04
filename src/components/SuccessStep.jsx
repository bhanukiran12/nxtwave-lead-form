function SuccessStep({ isClassroom, demo }) {
  const successTitle = isClassroom ? 'Your booking is successful!' : 'Your demo booking is successful!';
  const successSubtitle = isClassroom
    ? 'Our representatives will be in touch with you in a few minutes.'
    : 'You will receive the link to attend the demo 30 minutes before the slot time';

  return (
    <div className="step active">
      <div className="success-inner">
        <div className="success-icon">✓</div>
        <div className="success-title">{successTitle}</div>
        <div className="success-subtitle">{successSubtitle}</div>
        {!isClassroom && demo && (
          <div className="success-slot">
            <p>Slot is booked for you at:</p>
            <strong>{demo}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

export default SuccessStep;
