export type ToastKind = "success" | "error" | "info";

export type ToastPayload = {
  kind: ToastKind;
  message: string;
  ms?: number;
};

export const TOAST_EVENT = "sinpelos:toast";

export function toast(message: string, kind: ToastKind = "info", ms = 3200) {
  if (typeof window === "undefined") return;
  const detail: ToastPayload = { kind, message, ms };
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
}

toast.success = (message: string, ms?: number) => toast(message, "success", ms);
toast.error = (message: string, ms?: number) => toast(message, "error", ms);
toast.info = (message: string, ms?: number) => toast(message, "info", ms);

