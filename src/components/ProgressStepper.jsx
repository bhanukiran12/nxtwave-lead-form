function ProgressStepper({ step }) {
  const cls = (n) => {
    if (n < step) return 'completed';
    if (n === step) return 'active';
    return 'inactive';
  };

  const renderNode = (n) => {
    const status = cls(n);
    if (status === 'completed') return <div className={`progress-step ${status}`}>✓</div>;
    return (
      <div className={`progress-step ${status}`}>
        <span>{n}</span>
      </div>
    );
  };

  return (
    <div className="progress-bar">
      {renderNode(1)}
      <div className={`progress-line ${step > 1 ? 'completed' : ''}`} />
      {renderNode(2)}
      <div className={`progress-line ${step > 2 ? 'completed' : ''}`} />
      {renderNode(3)}
    </div>
  );
}

export default ProgressStepper;
