import { useVoxtral } from "./VoxtralContext";
import { THEME } from "../constants";
import {
  AppGridBackground,
  MicrophoneIcon,
  useMountedTransition,
} from "./SharedUI";

const FEATURES = [
  {
    step: "1",
    title: "Preparar la GPU",
    description:
      "Voxtral Mini 4B se carga una vez en el navegador con WebGPU para mostrar la transcripción mientras hablas.",
  },
  {
    step: "2",
    title: "Privado y local",
    description:
      "Tu audio se procesa localmente en el navegador. No se envía a Internet.",
  },
  {
    step: "3",
    title: "Conversación fluida",
    description:
      "Detecta las pausas, transcribe en WebGPU y continúa la conversación automáticamente.",
  },
] as const;

export const LandingPage = () => {
  const { loadModel } = useVoxtral();
  const mounted = useMountedTransition();

  return (
    <AppGridBackground
      className="min-h-screen flex items-center justify-center p-6 overflow-y-auto"
      style={{ color: THEME.textBlack }}
    >
      <div
        className={`relative max-w-4xl w-full backdrop-blur-sm p-10 md:p-12 rounded-sm border shadow-2xl transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        style={{
          backgroundColor: `${THEME.beigeLight}F2`,
          borderColor: THEME.beigeDark,
        }}
      >
        <div className="absolute top-6 right-6 group cursor-help z-10">
          <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-mono uppercase tracking-widest text-gray-500 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none">
            System Ready
          </span>
          <div className="relative flex h-3 w-3">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: THEME.mistralOrange }}
            />
            <span
              className="relative inline-flex rounded-sm h-3 w-3"
              style={{ backgroundColor: THEME.mistralOrange }}
            />
          </div>
        </div>

        <div className="space-y-12">
          <div className="text-center space-y-4 animate-enter">
            <div className="flex flex-col items-center justify-center space-y-5">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: `${THEME.mistralOrange}1A` }}
              >
                <MicrophoneIcon
                  className="w-10 h-10"
                  strokeWidth={1.5}
                  style={{ color: THEME.mistralOrange }}
                />
              </div>

              <h1
                className="text-6xl md:text-7xl font-semibold tracking-tighter"
                style={{ color: THEME.textBlack }}
              >
                Voxtral Realtime
              </h1>
            </div>

            <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto font-light leading-relaxed">
              Transcripción de voz local en vivo con WebGPU.
              <br />
              Powered by{" "}
              <a
                href="https://huggingface.co/onnx-community/Voxtral-Mini-4B-Realtime-2602-ONNX"
                className="font-medium underline decoration-2 underline-offset-4 transition-all hover:decoration-[3px]"
                style={{
                  color: THEME.mistralOrange,
                  textDecorationColor: THEME.mistralOrange,
                }}
                target="_blank"
                rel="noopener noreferrer"
              >
                Voxtral-Mini-4B
              </a>
            </p>
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-b py-10 animate-enter delay-100"
            style={{ borderColor: THEME.beigeDark }}
          >
            {FEATURES.map((feature) => (
              <div key={feature.step} className="space-y-3 group">
                <div
                  className="w-10 h-10 flex items-center justify-center text-white font-bold text-lg shadow-sm transition-transform duration-300 group-hover:-translate-y-1"
                  style={{ backgroundColor: THEME.mistralOrange }}
                >
                  {feature.step}
                </div>
                <h4
                  className="font-semibold text-xl"
                  style={{ color: THEME.textBlack }}
                >
                  {feature.title}
                </h4>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center animate-enter delay-200">
            <button
              onClick={loadModel}
              className="group relative px-8 py-5 text-white overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-0.5 rounded-xl border-none cursor-pointer outline-none"
              style={{ backgroundColor: THEME.mistralOrange }}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative font-bold text-xl tracking-wide flex items-center gap-3">
                INICIAR VOZ LOCAL
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                  />
                </svg>
              </span>
            </button>

            <p className="text-xs text-gray-400 mt-4">
              Requiere un navegador compatible con WebGPU.
            </p>
          </div>
        </div>
      </div>
    </AppGridBackground>
  );
};
