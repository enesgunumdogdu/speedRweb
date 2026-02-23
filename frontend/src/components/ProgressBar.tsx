interface ProgressBarProps {
  label: string;
  percent: number;
  indeterminate?: boolean;
}

export default function ProgressBar({ label, percent, indeterminate }: ProgressBarProps) {
  const showPercent = !indeterminate && percent > 0;

  return (
    <div className="upload-progress mb-2">
      <div className="upload-progress-header">
        <span className="upload-progress-label">{label}</span>
        {showPercent && (
          <span className="upload-progress-percent">{percent}%</span>
        )}
      </div>
      <div className="upload-progress-track">
        {indeterminate ? (
          <div className="upload-progress-bar indeterminate" />
        ) : (
          <div
            className="upload-progress-bar"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
    </div>
  );
}
