import { useVoxtral } from "./VoxtralContext";
import { THEME } from "../constants";
import {
  AppGridBackground,
  ErrorMessageBox,
  useMountedTransition,
} from "./SharedUI";

export const LoadingPage = () => {
  const { loadingProgress, loadingMessage, error } = useVoxtral();
  const mounted = useMountedTransition();
  const progressClamped = Math.min(100, Math.max(0, loadingProgress));
  const isError = !!error;

  return (
    <AppGridBackground className="min-h-screen flex items-center justify-center p-8">
      <div
        className={`max-w-md w-full backdrop-blur-sm rounded-sm border shadow-xl transition-all duration-700 transform ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        style={{
          backgroundColor: `${THEME.beigeLight}F2`,
          borderColor: THEME.beigeDark,
        }}
      >
        <div
          className={`h-1 w-full transition-colors duration-300 ${isError ? "bg-[var(--mistral-red)]" : "bg-[var(--mistral-orange)]"}`}
        />

        <div className="p-8 space-y-8">
          <div className="flex justify-center">
            {isError ? (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center border"
                style={{
                  backgroundColor: `${THEME.errorRed}1A`,
                  borderColor: `${THEME.errorRed}33`,
                }}
              >
                <svg
                  className="w-10 h-10"
                  style={{ color: THEME.errorRed }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
              </div>
            ) : (
              <div className="relative">
                <div
                  className="w-20 h-20 border-4 rounded-full animate-spin"
                  style={{
                    borderColor: THEME.beigeDark,
                    borderTopColor: THEME.mistralOrange,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: THEME.mistralOrange }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="text-center space-y-2">
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ color: THEME.textBlack }}
            >
              {isError ? "Initialization Failed" : "Loading Model"}
            </h2>
            <p className="text-sm text-gray-500 font-mono uppercase tracking-widest">
              {isError ? "Voxtral-Mini-4B-Realtime" : loadingMessage}
            </p>
          </div>

          {!isError && (
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-mono font-bold text-gray-500">
                <span>PROGRESS</span>
                <span>{Math.round(progressClamped)}%</span>
              </div>

              <div
                className="w-full rounded-full h-4 overflow-hidden border"
                style={{
                  backgroundColor: `${THEME.beigeDark}80`,
                  borderColor: THEME.beigeDark,
                }}
              >
                <div
                  className="h-full progress-stripe transition-all duration-500 ease-out"
                  style={{
                    width: `${progressClamped}%`,
                    backgroundColor: THEME.mistralOrange,
                  }}
                />
              </div>

              <div
                className="bg-white border p-3 rounded-sm"
                style={{ borderColor: THEME.beigeDark }}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <p className="font-mono text-xs text-gray-600 truncate">
                    {`> ${loadingMessage}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isError && (
            <div className="space-y-4">
              <ErrorMessageBox
                className="border p-4 rounded text-left"
                message={error}
              />
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 text-white font-bold transition-colors shadow-lg hover:bg-black cursor-pointer"
                style={{ backgroundColor: THEME.textBlack }}
              >
                RELOAD APPLICATION
              </button>
            </div>
          )}
        </div>
      </div>
    </AppGridBackground>
  );
};
