/**
 * Onboarding ~20 s: tres tooltips. Solo primera visita.
 */
import { useEffect, useState } from "react";
import { loadImmersionPrefs, patchImmersionPrefs } from "../../lib/ui/immersionPrefs";

const STEPS = [
  { id: "drag", text: "Arrastra el globo o el mapa para explorar la Tierra." },
  { id: "pick", text: "Toca un satélite o ábrelo desde el catálogo." },
  { id: "obs", text: "Configura tu observador para azimut, elevación y pasos." },
] as const;

interface Props {
  onDone?: () => void;
}

export default function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (loadImmersionPrefs().onboardingDone) return;
    setShow(true);
  }, []);

  if (!show) return null;

  const finish = () => {
    patchImmersionPrefs({ onboardingDone: true });
    setShow(false);
    onDone?.();
  };

  const next = () => {
    if (step >= STEPS.length - 1) finish();
    else setStep((s) => s + 1);
  };

  const s = STEPS[step];

  return (
    <div className="st-onboarding" role="dialog" aria-label="Introducción">
      <div className="st-onboarding-card hud-panel">
        <div className="st-onboarding-step">
          {step + 1} / {STEPS.length}
        </div>
        <p className="st-onboarding-text">{s.text}</p>
        <div className="st-onboarding-actions">
          <button type="button" className="st-ghost" onClick={finish}>
            Saltar
          </button>
          <button type="button" className="st-primary" onClick={next}>
            {step >= STEPS.length - 1 ? "Comenzar" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
