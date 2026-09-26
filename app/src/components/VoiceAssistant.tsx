// Asistente de voz de Nico en la portada (ElevenLabs Conversational AI, agente "Webs — ventas").
// El widget solo funciona desde nico-soto.es (allowlist del agente) y solo consume créditos si alguien llama.
import { createElement, useEffect } from "react";

export const WEBS_AGENT_ID = "agent_1601m3e9qecjem5awt0b32a3xfng";
const WIDGET_SRC = "https://unpkg.com/@elevenlabs/convai-widget-embed";

export function openAssistant() {
  document
    .querySelector("elevenlabs-convai")
    ?.dispatchEvent(new CustomEvent("elevenlabs-agent:expand", { detail: { action: "expand" } }));
}

export default function VoiceAssistant() {
  useEffect(() => {
    if (document.querySelector(`script[src="${WIDGET_SRC}"]`)) return;
    const s = document.createElement("script");
    s.src = WIDGET_SRC;
    s.async = true;
    document.body.appendChild(s);
  }, []);
  return createElement("elevenlabs-convai", { "agent-id": WEBS_AGENT_ID });
}
