"use client";

import { useCallback, useEffect, useState } from "react";
import { useApi } from "@/hooks/use-restaurant";
import { decodeBase64Url } from "@/lib/push";
import type { StaffRole } from "@/types/domain";

/**
 * Estado dos avisos neste aparelho:
 * `unsupported` (navegador sem Web Push; no iPhone, só com o site na tela de início),
 * `unavailable` (o servidor não tem as chaves), `denied` (a pessoa bloqueou), `off`, `on`.
 */
export type PushState = "loading" | "unsupported" | "unavailable" | "denied" | "off" | "on" | "busy";

const supported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Liga e desliga os avisos da equipe neste aparelho (só no navegador). */
export const usePush = (role: StaffRole) => {
  const apiRequest = useApi();
  const [state, setState] = useState<PushState>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!supported()) return active && setState("unsupported");
      const config = await apiRequest<{ publicKey: string | null }>(`/api/staff/push?role=${role}`);
      if (!active) return;
      if (!config.ok || !config.data.publicKey) return setState("unavailable");
      setPublicKey(config.data.publicKey);
      if (Notification.permission === "denied") return setState("denied");
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (active) setState(subscription ? "on" : "off");
    })();
    return () => {
      active = false;
    };
  }, [apiRequest, role]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setState("busy");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeBase64Url(publicKey),
      });
      const saved = await apiRequest(`/api/staff/push?role=${role}`, {
        method: "POST",
        body: { subscription: subscription.toJSON() },
      });
      if (!saved.ok) {
        await subscription.unsubscribe();
        setMessage(saved.message);
        return setState("off");
      }
      setState("on");
    } catch {
      setMessage("Não deu para ligar os avisos neste aparelho.");
      setState("off");
    }
  }, [apiRequest, publicKey, role]);

  const disable = useCallback(async () => {
    setState("busy");
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await apiRequest(`/api/staff/push?role=${role}`, { method: "DELETE", body: { endpoint: subscription.endpoint } });
      await subscription.unsubscribe();
    }
    setState("off");
  }, [apiRequest, role]);

  return { state, message, enable, disable };
};
