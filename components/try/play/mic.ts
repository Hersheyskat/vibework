/** Port of prototype attachMic — en-IN SpeechRecognition with OS dictation tip. */

type SpeechRecCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: { isFinal: boolean; 0: { transcript: string } };
  };
};

function speechCtor(): SpeechRecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecCtor;
    webkitSpeechRecognition?: SpeechRecCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function dictateTip(): string {
  const ua = `${navigator.userAgent || ""} ${navigator.platform || ""}`;
  if (/Android|iPhone|iPad/i.test(ua)) {
    return "Tip: tap the mic on your phone's keyboard to dictate.";
  }
  if (/Win/i.test(ua)) {
    return "Tip: press the Windows key + H to dictate into this box.";
  }
  if (/Mac/i.test(ua)) {
    return "Tip: press the Fn (Globe) key twice to dictate into this box.";
  }
  return "Tip: use your device's built-in dictation to speak into this box.";
}

export function attachMic(
  btn: HTMLButtonElement,
  ta: HTMLTextAreaElement,
  tell: (msg: string) => void,
  onChange: (value: string) => void,
): () => void {
  const SR = speechCtor();
  let rec: SpeechRecognitionLike | null = null;

  const onClick = () => {
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      return;
    }
    if (!SR) {
      tell(dictateTip());
      ta.focus();
      return;
    }
    let instance: SpeechRecognitionLike;
    try {
      instance = new SR();
    } catch {
      tell(dictateTip());
      ta.focus();
      return;
    }
    instance.lang = "en-IN";
    instance.interimResults = true;
    instance.continuous = true;
    const base = ta.value ? ta.value.replace(/\s*$/, " ") : "";
    let fin = "";
    instance.onresult = (e) => {
      let tmp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) fin += r[0].transcript;
        else tmp += r[0].transcript;
      }
      onChange(base + fin + tmp);
    };
    instance.onerror = (e) => {
      tell(
        (e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "The microphone is blocked inside this page. "
          : "Dictation stopped. ") + dictateTip(),
      );
      ta.focus();
    };
    instance.onend = () => {
      rec = null;
      btn.classList.remove("on");
      btn.textContent = "🎤";
      btn.setAttribute("aria-label", "Dictate");
    };
    try {
      instance.start();
      rec = instance;
      btn.classList.add("on");
      btn.textContent = "■";
      btn.setAttribute("aria-label", "Stop dictating");
    } catch {
      tell(dictateTip());
      ta.focus();
    }
  };

  btn.addEventListener("click", onClick);
  return () => {
    btn.removeEventListener("click", onClick);
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  };
}

export function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("read failed"));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error("image failed"));
      im.onload = () => {
        const k = Math.min(1, 1400 / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * k);
        c.height = Math.round(im.height * k);
        const ctx = c.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas"));
          return;
        }
        ctx.drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      im.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}
