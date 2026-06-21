import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Star,
  Sparkles,
  Loader2,
  Check,
  X,
  ExternalLink,
  Globe,
  Bot,
  Hammer,
  Mail,
  Copy,
  Send,
  MessageCircle,
  Facebook,
  RefreshCw,
} from "lucide-react";
import { supabase, edgeFunctionErrorMessage } from "@/lib/supabase";
import { waLink } from "@/lib/contact";
import type { Brief, Lead, Site } from "@/lib/types";
import { SITE_STATUS_LABELS } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function getReviews(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const r = (raw as Record<string, unknown>).reviews;
  if (!Array.isArray(r)) return [];
  return r
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        return String(o.text ?? o.review ?? o.comment ?? "");
      }
      return "";
    })
    .filter((t) => t.trim().length > 0)
    .slice(0, 6);
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

export default function LeadDetail() {
  const { id } = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [qaBusy, setQaBusy] = useState<null | "approve" | "reject">(null);
  const [qaError, setQaError] = useState<string | null>(null);
  const [buildQueuing, setBuildQueuing] = useState(false);
  const [buildQueueError, setBuildQueueError] = useState<string | null>(null);

  // Outreach
  const [outreachMsg, setOutreachMsg] = useState<{
    id: string; channel: string; subject: string | null; body: string; status: string;
  } | null>(null);
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendEmailError, setSendEmailError] = useState<string | null>(null);
  const [sendEmailDone, setSendEmailDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [editedBody, setEditedBody] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Análisis IA
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{
    score: number;
    summary: string;
    strengths: string[];
    improvements: { area: string; issue: string; fix: string }[];
  } | null>(null);

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-site", {
        body: { lead_id: id },
      });
      if (error) throw error;
      if (data?.analysis) setAnalysis(data.analysis);
      // Recargar el lead para reflejar site_analyzed_at y la versión persistida del análisis.
      await loadAll();
    } catch (e) {
      setAnalysisError(await edgeFunctionErrorMessage(e, "Error al analizar la web."));
    } finally {
      setAnalyzing(false);
    }
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [
      { data: leadData, error: leadErr },
      { data: briefData },
      { data: siteData },
      { data: outreachData },
    ] = await Promise.all([
      supabase.from("leads").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("briefs")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sites")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("outreach_messages")
        .select("id,channel,subject,body,status")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (leadErr) setError(leadErr.message);
    else setLead(leadData as Lead | null);
    setBrief((briefData as Brief | null) ?? null);
    const loadedSite = (siteData as Site | null) ?? null;
    setSite(loadedSite);
    // Hidratar el análisis de la web ACTUAL del negocio (leads.site_analysis) para mostrarlo
    // sin tener que re-analizar. Es la nota de prospección, no la de la web que construimos.
    setAnalysis((leadData as Lead | null)?.site_analysis ?? null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setOutreachMsg((outreachData as any) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-marcar "visto" al abrir el lead (como un email). Fire-and-forget; si la columna
  // seen_at no existe aún (migración 0008 sin aplicar) o falla, no rompe nada.
  useEffect(() => {
    if (lead && "seen_at" in lead && !lead.seen_at) {
      void supabase
        .from("leads")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", lead.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, lead?.seen_at]);

  // Favorito: toggle optimista desde el detalle (coherente con el Dashboard).
  async function toggleFavorite() {
    if (!lead) return;
    const next = !lead.is_favorite;
    setLead({ ...lead, is_favorite: next });
    const { error } = await supabase
      .from("leads")
      .update({ is_favorite: next })
      .eq("id", lead.id);
    if (error) {
      setLead({ ...lead, is_favorite: !next });
      alert("No se pudo actualizar el favorito: " + error.message);
    }
  }

  async function generateBrief() {
    setGenerating(true);
    setGenError(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-lead", {
        body: { lead_id: id },
      });
      if (error) throw error;
      const result = data as { brief?: Brief };
      if (result?.brief) setBrief(result.brief);
      // Recargar el lead para reflejar el nuevo estado (analyzed).
      const { data: leadData } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      setLead(leadData as Lead | null);
    } catch (e) {
      setGenError(await edgeFunctionErrorMessage(e, "No se pudo generar el brief."));
    } finally {
      setGenerating(false);
    }
  }

  async function generateOutreach() {
    setGeneratingOutreach(true);
    setOutreachError(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-outreach", {
        body: { lead_id: id },
      });
      if (error) throw error;
      if (data?.message) {
        setOutreachMsg(data.message);
        setEditedBody(data.message.body);
        setEditingBody(false);
      }
    } catch (e) {
      setOutreachError(await edgeFunctionErrorMessage(e, "Error al generar el mensaje."));
    } finally {
      setGeneratingOutreach(false);
    }
  }

  async function sendEmail() {
    if (!outreachMsg) return;
    setSendingEmail(true);
    setSendEmailError(null);
    setSendEmailDone(false);
    try {
      // Guardar el cuerpo editado si cambió
      if (editedBody && editedBody !== outreachMsg.body) {
        await supabase.from("outreach_messages").update({ body: editedBody }).eq("id", outreachMsg.id);
      }
      const { error } = await supabase.functions.invoke("send-email", {
        body: { message_id: outreachMsg.id },
      });
      if (error) throw error;
      setSendEmailDone(true);
      setOutreachMsg({ ...outreachMsg, status: "sent" });
      // Actualizar estado del lead a 'contacted'
      const { data: leadData } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
      setLead(leadData as Lead | null);
    } catch (e) {
      setSendEmailError(await edgeFunctionErrorMessage(e, "Error al enviar el email."));
    } finally {
      setSendingEmail(false);
    }
  }

  async function saveEmail() {
    if (!lead || !emailInput.trim()) return;
    setSavingEmail(true);
    await supabase.from("leads").update({ email: emailInput.trim() }).eq("id", lead.id);
    setLead({ ...lead, email: emailInput.trim() });
    setEditingEmail(false);
    setSavingEmail(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  /** Aprueba el brief y encola el build en Lovable (lead → 'build_queued'). */
  async function queueBuild() {
    if (!lead || !brief) return;
    if (!window.confirm(
      "¿Encolar la construcción de la web en Lovable? Esto gastará créditos. Asegúrate de que el brief es correcto."
    )) return;
    setBuildQueuing(true);
    setBuildQueueError(null);
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: "build_queued", updated_at: new Date().toISOString() })
        .eq("id", lead.id);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      setBuildQueueError(e instanceof Error ? e.message : "Error al encolar el build.");
    } finally {
      setBuildQueuing(false);
    }
  }

  async function runQaAction(action: "approve" | "reject") {
    if (!site || !lead) return;
    if (
      action === "reject" &&
      !window.confirm(
        "¿Rechazar esta web? El lead pasará a «Rechazado» y no se contactará.",
      )
    )
      return;
    setQaBusy(action);
    setQaError(null);
    const nowIso = new Date().toISOString();
    try {
      if (action === "approve") {
        const { error: e1 } = await supabase
          .from("sites")
          .update({ status: "approved", approved_at: nowIso })
          .eq("id", site.id);
        if (e1) throw e1;
        const { error: e2 } = await supabase
          .from("leads")
          .update({ status: "approved", updated_at: nowIso })
          .eq("id", lead.id);
        if (e2) throw e2;
      } else {
        const { error: e1 } = await supabase
          .from("sites")
          .update({ status: "rejected" })
          .eq("id", site.id);
        if (e1) throw e1;
        const { error: e2 } = await supabase
          .from("leads")
          .update({ status: "rejected", updated_at: nowIso })
          .eq("id", lead.id);
        if (e2) throw e2;
      }
      await loadAll();
    } catch (e) {
      setQaError(
        e instanceof Error ? e.message : "No se pudo completar la acción.",
      );
    } finally {
      setQaBusy(null);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Cargando…</p>;
  }

  if (error || !lead) {
    return (
      <div className="space-y-4">
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <p className="text-destructive">{error ?? "Lead no encontrado."}</p>
      </div>
    );
  }

  const reviews = getReviews(lead.raw_json);

  // Web real del negocio. Mismo criterio que el backend (_shared/website.ts): rechaza
  // redes/mapas. Prioridad: website_url (descubierta por el Orquestador) > raw_json del scrape.
  function isRealWeb(v: unknown): v is string {
    if (typeof v !== "string" || !/^https?:\/\//i.test(v.trim())) return false;
    return !/google\.|maps\.|facebook\.|fb\.me|instagram\.|twitter\.|x\.com|linkedin\.|wa\.me|whatsapp|youtube\.|youtu\.be|tiktok\.|t\.me|pinterest\./i.test(v);
  }
  function getWebsiteUrl(raw: unknown): string | null {
    const wu = lead?.website_url;
    if (isRealWeb(wu)) return wu.trim();
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    for (const key of ["website", "websiteUrl", "url", "web", "site", "domain"]) {
      const v = o[key];
      if (isRealWeb(v)) return v.trim();
    }
    return null;
  }
  const websiteUrl = getWebsiteUrl(lead.raw_json);

  return (
    <div className="space-y-6">
      <Link to="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
        <ArrowLeft className="h-4 w-4" /> Volver al pipeline
      </Link>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
          <p className="text-muted-foreground">{lead.category ?? "—"}</p>
        </div>
        <div className="flex items-center gap-3">
          {"is_favorite" in lead && (
            <button
              onClick={toggleFavorite}
              title={lead.is_favorite ? "Quitar de favoritos" : "Marcar favorito"}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-amber-500"
            >
              <Star
                className={`h-5 w-5 ${lead.is_favorite ? "fill-amber-400 text-amber-400" : ""}`}
              />
            </button>
          )}
          <StatusBadge status={lead.status} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del negocio</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {/* Emails extra encontrados en la web del negocio */}
          {(() => {
            const raw = lead.raw_json as Record<string, unknown> | null;
            const extras = Array.isArray(raw?.extra_emails) ? (raw.extra_emails as string[]) : [];
            if (extras.length <= 1) return null;
            return (
              <div className="col-span-full">
                <div className="text-xs text-muted-foreground">Otros emails encontrados</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {extras.map((e) => (
                    <button
                      key={e}
                      onClick={async () => {
                        await supabase.from("leads").update({ email: e }).eq("id", lead.id);
                        setLead({ ...lead, email: e });
                      }}
                      className="text-xs rounded border px-2 py-1 hover:bg-muted"
                      title="Usar este email"
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Haz clic en uno para usarlo como email principal.</p>
              </div>
            );
          })()}
          <Field label="Teléfono" value={lead.phone} />
          <div>
            <div className="text-xs text-muted-foreground">WhatsApp</div>
            {(() => {
              const wa = waLink(lead);
              return wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-sm text-green-600 hover:underline"
                  title={lead.whatsapp ? "WhatsApp" : "Móvil con WhatsApp probable"}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {wa.replace("https://wa.me/", "")}
                </a>
              ) : (
                <div className="text-sm">—</div>
              );
            })()}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Facebook</div>
            {lead.facebook ? (
              <a
                href={lead.facebook}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline break-all"
              >
                <Facebook className="h-3.5 w-3.5 shrink-0" />
                Ver página
              </a>
            ) : (
              <div className="text-sm">—</div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Email</div>
            {editingEmail ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEmail()}
                  placeholder="correo@negocio.com"
                  className="rounded-md border px-2 py-1 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <button onClick={saveEmail} disabled={savingEmail} className="text-xs text-green-600 font-medium hover:underline">
                  {savingEmail ? "Guardando…" : "Guardar"}
                </button>
                <button onClick={() => setEditingEmail(false)} className="text-xs text-muted-foreground hover:underline">Cancelar</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm">{lead.email || "—"}</span>
                <button
                  onClick={() => { setEmailInput(lead.email ?? ""); setEditingEmail(true); }}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  {lead.email ? "Editar" : "Añadir email"}
                </button>
              </div>
            )}
          </div>
          <Field label="Dirección" value={lead.address} />
          <Field label="Ciudad" value={lead.city} />
          <Field label="País" value={lead.country} />
          <Field
            label="Valoración"
            value={
              lead.rating != null
                ? `${lead.rating} (${lead.review_count ?? 0} reseñas)`
                : "—"
            }
          />
          <div>
            <div className="text-xs text-muted-foreground">Tiene web</div>
            <div className="text-sm">
              {websiteUrl ? (
                <a href={websiteUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">
                  {websiteUrl}
                </a>
              ) : lead.has_website ? "Sí (sin URL)" : "No"}
            </div>
          </div>
          <Field label="Origen" value={lead.source} />
        </CardContent>
      </Card>

      {/* Web actual del negocio — análisis IA de prospección (la de raw_json, no la que construimos) */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-lg">Web actual del negocio</CardTitle>
            <CardDescription>
              Claude puntúa la web que el negocio YA tiene. Nota baja = web floja = buen candidato.
            </CardDescription>
          </div>
          {websiteUrl && (
            <Button onClick={runAnalysis} disabled={analyzing} variant="outline" size="sm">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              {analyzing ? "Analizando…" : analysis ? "Re-analizar" : "Analizar web actual"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!websiteUrl ? (
            <p className="text-sm text-muted-foreground">
              No se detecta web propia de este negocio — es de los mejores candidatos a contactar.
            </p>
          ) : (
            <>
              {analysisError && <p className="text-sm text-destructive">{analysisError}</p>}

              {!analysis && !analysisError && (
                <p className="text-sm text-muted-foreground">
                  {lead.site_analyzed_at
                    ? "Sin nota guardada para esta web."
                    : "Aún sin analizar. Se hace solo en el barrido diario, o pulsa «Analizar web actual»."}
                </p>
              )}

              {analysis && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold">
                      {analysis.score}<span className="text-lg text-muted-foreground">/10</span>
                    </span>
                    <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                  </div>
                  {lead.site_analyzed_at && (
                    <p className="text-xs text-muted-foreground">
                      Analizado el {new Date(lead.site_analyzed_at).toLocaleString("es-ES")}
                    </p>
                  )}

                  {analysis.strengths?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Puntos fuertes</p>
                      <ul className="space-y-1">
                        {analysis.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.improvements?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mejoras sugeridas</p>
                      {analysis.improvements.map((imp, i) => (
                        <div key={i} className="rounded-md border p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{imp.area}</Badge>
                            <p className="text-sm font-medium">{imp.issue}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">→ {imp.fix}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Brief */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-lg">Brief (análisis)</CardTitle>
            <CardDescription>
              Generado por Claude a partir de los datos y reseñas reales.
            </CardDescription>
          </div>
          <Button onClick={generateBrief} disabled={generating} size="sm">
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating
              ? "Generando…"
              : brief
                ? "Regenerar brief"
                : "Generar brief"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {genError && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {genError}
            </p>
          )}

          {!brief && !genError && (
            <p className="text-sm text-muted-foreground">
              Aún no hay brief. Pulsa «Generar brief» para analizarlo con Claude.
            </p>
          )}

          {brief && (
            <div className="space-y-5">
              {brief.hero_copy && (
                <p className="text-lg font-medium">“{brief.hero_copy}”</p>
              )}
              {brief.business_summary && (
                <BriefBlock label="Resumen">
                  <p className="text-sm">{brief.business_summary}</p>
                </BriefBlock>
              )}
              {brief.tone && (
                <BriefBlock label="Tono">
                  <p className="text-sm">{brief.tone}</p>
                </BriefBlock>
              )}
              {arr(brief.value_props).length > 0 && (
                <BriefBlock label="Propuestas de valor">
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {arr(brief.value_props).map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </BriefBlock>
              )}
              {arr(brief.highlights_from_reviews).length > 0 && (
                <BriefBlock label="Lo que destacan los clientes">
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {arr(brief.highlights_from_reviews).map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </BriefBlock>
              )}
              {arr(brief.recommended_sections).length > 0 && (
                <BriefBlock label="Secciones recomendadas">
                  <div className="flex flex-wrap gap-1.5">
                    {arr(brief.recommended_sections).map((v, i) => (
                      <Badge key={i} variant="secondary">
                        {v}
                      </Badge>
                    ))}
                  </div>
                </BriefBlock>
              )}
              {Array.isArray(brief.services) && brief.services.length > 0 && (
                <BriefBlock label="Servicios">
                  <ul className="space-y-1.5 text-sm">
                    {brief.services.map((srv, i) => (
                      <li key={i}>
                        <span className="font-medium">{srv?.name}</span>
                        {srv?.desc ? (
                          <span className="text-muted-foreground"> — {srv.desc}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </BriefBlock>
              )}
              {brief.suggested_palette && (
                <BriefBlock label="Paleta sugerida">
                  <div className="flex gap-3">
                    {(["primary", "accent", "bg"] as const).map((k) => {
                      const hex = brief.suggested_palette?.[k];
                      if (!hex) return null;
                      return (
                        <div key={k} className="flex items-center gap-2 text-xs">
                          <span
                            className="h-6 w-6 rounded border"
                            style={{ backgroundColor: hex }}
                          />
                          <span className="text-muted-foreground">
                            {k}: {hex}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </BriefBlock>
              )}
              <p className="text-xs text-muted-foreground">
                Modelo: {brief.model_used ?? "—"} ·{" "}
                {new Date(brief.created_at).toLocaleString("es-ES")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gate de validación: aparece cuando hay brief y aún no se ha encolado el build */}
      {brief && lead.status === "analyzed" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-amber-900">Brief listo — ¿Construir la web?</p>
              <p className="text-sm text-amber-700">
                Revisa el brief de arriba. Si te convence, encola la construcción en Lovable.
                <strong> Esto gasta créditos</strong> — solo hazlo si quieres enviarle una web a este negocio.
              </p>
              {buildQueueError && (
                <p className="mt-2 text-sm text-destructive">{buildQueueError}</p>
              )}
            </div>
            <Button
              onClick={queueBuild}
              disabled={buildQueuing}
              className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {buildQueuing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Hammer className="h-4 w-4" />
              )}
              {buildQueuing ? "Encolando…" : "Construir web en Lovable"}
            </Button>
          </CardContent>
        </Card>
      )}

      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reseñas (muestra)</CardTitle>
            <CardDescription>
              Extraídas del scraper. Se usarán como prueba social en la web.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviews.map((r, i) => (
              <p key={i} className="border-l-2 pl-3 text-sm text-muted-foreground">
                {r}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Web · QA</CardTitle>
          <CardDescription>
            Revisa la web construida en Lovable y decide: aprobar (queda lista para
            contactar) o rechazar. Si quieres cambios, edítala en Lovable y vuelve a revisar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qaError && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {qaError}
            </p>
          )}

          {!site && lead.status === "build_queued" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                <p className="text-sm font-medium text-amber-900">Construyendo en Lovable…</p>
              </div>
              <p className="text-sm text-amber-700">
                El orquestador construye la web cuando se ejecuta. Lánzalo en el servidor
                con el comando de abajo; tarda varios minutos. Pulsa «Actualizar» para
                comprobar si ya está lista.
              </p>
              <p className="text-xs font-mono text-amber-600 bg-amber-100 rounded px-2 py-1 inline-block">
                npm start -- --lead {lead.id}
              </p>
              <div>
                <Button variant="outline" size="sm" onClick={() => loadAll()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualizar
                </Button>
              </div>
            </div>
          )}

          {!site && lead.status !== "build_queued" && (
            <p className="text-sm text-muted-foreground">
              La web aún no se ha construido. La crea el orquestador y aparecerá aquí
              cuando el lead llegue a «Web lista».
            </p>
          )}

          {site &&
            !site.live_url &&
            (site.status === "queued" || site.status === "building") && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Construyéndose en Lovable… ({SITE_STATUS_LABELS[site.status]})
              </div>
            )}

          {site && site.status === "failed" && (
            <div className="space-y-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <p>
                La construcción falló{site.notes ? `: ${site.notes}` : ""}. El lead vuelve a
                «Brief listo»: pulsa «Construir web en Lovable» arriba para reintentar
                {site.lovable_project_id
                  ? ", o ábrela en Lovable para arreglarla a mano."
                  : "."}
              </p>
              {site.lovable_project_id && (
                <a
                  href={`https://lovable.dev/projects/${site.lovable_project_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ExternalLink className="h-4 w-4" /> Editar en Lovable
                </a>
              )}
            </div>
          )}

          {site && site.live_url && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Estado de la web:</span>
                  <Badge
                    variant={
                      site.status === "approved"
                        ? "default"
                        : site.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {SITE_STATUS_LABELS[site.status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {site.lovable_project_id && (
                    <a
                      href={`https://lovable.dev/projects/${site.lovable_project_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <ExternalLink className="h-4 w-4" /> Editar en Lovable
                    </a>
                  )}
                  <a
                    href={site.live_url}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <ExternalLink className="h-4 w-4" /> Abrir en pestaña nueva
                  </a>
                </div>
              </div>

              {/* URL copiable y clicable */}
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <a
                  href={site.live_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate text-xs font-mono text-blue-600 hover:underline"
                >
                  {site.live_url}
                </a>
              </div>

              <div className="overflow-hidden rounded-md border">
                <iframe
                  src={site.live_url}
                  title={`Preview de ${lead.name}`}
                  className="h-[600px] w-full bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Si el preview sale en blanco la web bloquea el embebido — usa «Abrir en pestaña nueva».
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  onClick={() => runQaAction("approve")}
                  disabled={qaBusy !== null || site.status === "approved"}
                  size="sm"
                >
                  {qaBusy === "approve" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {site.status === "approved" ? "Aprobada" : "Aprobar"}
                </Button>
                <Button
                  onClick={() => runQaAction("reject")}
                  disabled={qaBusy !== null}
                  variant="destructive"
                  size="sm"
                >
                  {qaBusy === "reject" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  Rechazar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ¿No te convence? Edítala en Lovable (botón «Editar en Lovable» arriba) y
                vuelve a revisar; cuando esté lista, apruébala.
              </p>

              {site.status === "approved" && (
                <p className="text-sm text-muted-foreground">
                  Web aprobada
                  {site.approved_at
                    ? ` · ${new Date(site.approved_at).toLocaleString("es-ES")}`
                    : ""}
                  . Baja para generar y enviar el mensaje de contacto.
                </p>
              )}

            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel de Outreach — solo visible cuando el lead está approved o contactado */}
      {(lead.status === "approved" || lead.status === "contacted") && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-lg">Mensaje de contacto</CardTitle>
              <CardDescription>
                {lead.status === "contacted"
                  ? "Email enviado. El lead está en estado «Contactado»."
                  : "La web está aprobada. Genera el mensaje y envíalo."}
              </CardDescription>
            </div>
            <Button
              onClick={generateOutreach}
              disabled={generatingOutreach}
              size="sm"
              variant="outline"
            >
              {generatingOutreach ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {generatingOutreach ? "Generando…" : outreachMsg ? "Regenerar mensaje" : "Generar mensaje"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {outreachError && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{outreachError}</p>
            )}

            {!outreachMsg && !outreachError && (
              <p className="text-sm text-muted-foreground">
                Pulsa «Generar mensaje» para que Claude redacte el email o la nota de LinkedIn.
              </p>
            )}

            {outreachMsg && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Canal</span>
                  <span className="text-sm font-medium capitalize">{outreachMsg.channel}</span>
                  {outreachMsg.status === "sent" && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
                      <Check className="h-3.5 w-3.5" /> Enviado
                    </span>
                  )}
                </div>

                {outreachMsg.subject && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Asunto</p>
                    <p className="text-sm font-medium">{outreachMsg.subject}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cuerpo</p>
                    <button
                      onClick={() => { setEditingBody(!editingBody); setEditedBody(outreachMsg.body); }}
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      {editingBody ? "Cancelar" : "Editar"}
                    </button>
                  </div>
                  {editingBody ? (
                    <textarea
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      className="w-full rounded-md border bg-muted/40 p-3 text-sm font-sans min-h-[200px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm font-sans">
                      {editedBody || outreachMsg.body}
                    </pre>
                  )}
                </div>

                {outreachMsg.channel === "email" ? (
                  <div className="flex flex-col gap-2">
                    {sendEmailError && (
                      <p className="text-sm text-destructive">{sendEmailError}</p>
                    )}
                    {!lead.email && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                        <p className="text-sm text-amber-800 font-medium">Sin email — contacta manualmente:</p>
                        <div className="flex flex-wrap gap-2">
                          {lead.phone && (
                            <a
                              href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white font-medium hover:bg-green-700"
                            >
                              💬 WhatsApp {lead.phone}
                            </a>
                          )}
                          {websiteUrl && (
                            <a
                              href={`${websiteUrl.replace(/\/$/, "")}/contacto`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                            >
                              🌐 Ir a su web (buscar email)
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-amber-700">Copia el mensaje de arriba y envíalo por el canal que encuentres.</p>
                      </div>
                    )}
                    {lead.email && (sendEmailDone ? (
                      <p className="flex items-center gap-1 text-sm text-green-600">
                        <Check className="h-4 w-4" /> Email enviado correctamente.
                      </p>
                    ) : (
                      <Button
                        onClick={sendEmail}
                        disabled={sendingEmail || outreachMsg.status === "sent"}
                        size="sm"
                        className="w-fit"
                      >
                        {sendingEmail ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        {outreachMsg.status === "sent" ? "Ya enviado" : sendingEmail ? "Enviando…" : "Enviar email"}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      LinkedIn: copia la nota, ve al perfil del contacto y pégala en la solicitud de conexión.
                    </p>
                    <Button
                      onClick={() => copyToClipboard(outreachMsg.body)}
                      size="sm"
                      variant="outline"
                      className="w-fit"
                    >
                      {copied ? (
                        <><Check className="h-4 w-4 text-green-500" /> ¡Copiado!</>
                      ) : (
                        <><Copy className="h-4 w-4" /> Copiar nota de LinkedIn</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BriefBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function arr(v: string[] | null): string[] {
  return Array.isArray(v) ? v : [];
}
