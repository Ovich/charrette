/** The pill beside the merge lock that opens the across-runs view (board D10); pressed while it is shown.
 *  A run tab or All hides the view again: BoardView decides, the pill only asks. */
export function AnalyticsButton({ pressed, onPress }: { pressed: boolean; onPress: () => void }) {
  return (
    <button className="abtn" data-component="AnalyticsButton" aria-pressed={pressed} title="Analytics across runs" onClick={onPress}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M2 14V9M6 14V4M10 14V7M14 14V2" />
      </svg>
      {/* "All runs", not "Analytics": the phase row's Analytics is this run's alone */}
      All runs
    </button>
  );
}
