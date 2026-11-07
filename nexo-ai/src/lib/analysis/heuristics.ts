import type { AnalysisContext, AnalysisMessage, CandidateFinding, FindingType } from "./types";

/**
 * Motor heurístico (sin IA). Detecta patrones lingüísticos frecuentes en
 * conversaciones operativas en español rioplatense. Es deliberadamente
 * conservador: confianza baja y todo pasa por la bandeja de validación.
 */

interface Rule {
  type: FindingType;
  re: RegExp;
  confidence: number;
  label: string;
}

const RULES: Rule[] = [
  {
    type: "completion_signal",
    label: "confirmación de cumplimiento",
    confidence: 0.4,
    re: /(^\s*(listo|hecho|ya est[aá]|resuelto|terminado|solucionado|entregado|ok,? listo)\b)|✅|\bya (lo |la |los |las )?(hice|hicimos|ped[ií]|pedimos|compr[eé]|mand[eé]|arregl[eé]|arreglaron|limpi[eé]|resolv[ií]|entregu[eé]|llam[eé]|cambi[eé]|repuse|cargu[eé])\b/i,
  },
  {
    type: "decision",
    label: "decisión",
    confidence: 0.5,
    re: /\b(decidimos|se decidi[oó]|queda (definido|decidido|aprobado)|a partir de (hoy|ma[ñn]ana|ahora|el lunes|el martes|el mi[eé]rcoles|el jueves|el viernes|la semana)|desde (hoy|ahora|ma[ñn]ana) (se|no|vamos|todos)|se aprueba|dejamos de|nuevo (horario|procedimiento|proveedor))\b/i,
  },
  {
    type: "incident",
    label: "incidencia",
    confidence: 0.5,
    re: /\b(se rompi[oó]|no funciona|no anda|dej[oó] de (funcionar|andar)|est[aá] rot[oa]|no lleg[oó]|lleg[oó] mal|vencid[oa]s?|queja|reclamo|se cort[oó]|corte de (luz|gas|agua)|p[eé]rdida de|derrame|accidente|plaga|cucarachas?|ratas?|sin stock|nos quedamos sin|faltaron|falt[oó] (personal|gente|mercader[ií]a))\b/i,
  },
  {
    type: "commitment",
    label: "compromiso",
    confidence: 0.45,
    re: /\b(yo me encargo|me encargo yo|me encargo|lo hago yo|lo resuelvo|queda en m[ií]|d[eé]jalo en m[ií]|ma[ñn]ana lo|ahora lo|en un rato lo|despu[eé]s lo|te lo (mando|paso|llevo)|voy a (pedir|comprar|llamar|revisar|arreglar|mandar|pasar|limpiar|hablar))\b/i,
  },
  {
    type: "task",
    label: "orden o tarea",
    confidence: 0.5,
    re: /\b(hay que|tenemos que|tienen que|ten[eé]s que|tiene que|necesito que|necesitamos que|acord[aá]te|no te olvides|no se olviden|encarg[aá]te|falta (hacer|pedir|comprar|limpiar|cargar)|(por favor|porfa),? (pedir|pidan|ped[ií]|compr[aá]|compren|revis[aá]|revisen|limpi[aá]|limpien|llam[aá]|llamen|mand[aá]|manden|cambi[aá]|cambien|arregl[aá]|carg[aá]|controlen|control[aá]))\b/i,
  },
  {
    type: "request",
    label: "solicitud",
    confidence: 0.4,
    re: /(\b(pod[eé]s|podr[ií]as|podr[ií]an|pueden|me pas[aá]s|me mand[aá]s|me confirm[aá]s|me avis[aá]s)\b[^?]{2,}\?)/i,
  },
];

const URGENT = /\b(urgente|ya mismo|cuanto antes|lo antes posible|ahora mismo|inmediato)\b|!!!/i;
const HIGH = /\b(importante|hoy sin falta|antes del servicio|antes de abrir)\b|!!/i;

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Resuelve expresiones de plazo relativas a la fecha del mensaje. */
export function resolveDue(body: string, sentAt: string): { hint: string | null; date: string | null } {
  const day = sentAt.slice(0, 10);
  const t = stripAccents(body);
  let m: RegExpExecArray | null;
  if (/\bpasado manana\b/.test(t)) return { hint: "pasado mañana", date: addDays(day, 2) };
  if (/\bmanana\b/.test(t)) return { hint: "mañana", date: addDays(day, 1) };
  if (/\bhoy\b|\besta (noche|tarde)\b|\bantes del servicio\b/.test(t)) return { hint: "hoy", date: day };
  if ((m = /\b(?:el |para el |antes del? )(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.exec(t))) {
    const target = WEEKDAYS.map(stripAccents).indexOf(m[1]);
    const current = new Date(`${day}T00:00:00Z`).getUTCDay();
    const diff = ((target - current + 7) % 7) || 7;
    return { hint: m[0].trim(), date: addDays(day, diff) };
  }
  if ((m = /\b(?:el|para el|antes del?)\s+(\d{1,2})\/(\d{1,2})\b/.exec(t))) {
    const [y] = day.split("-").map(Number);
    const dd = Number(m[1]), mm = Number(m[2]);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      let iso = `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      if (iso < day) iso = `${y + 1}${iso.slice(4)}`;
      return { hint: m[0].trim(), date: iso };
    }
  }
  if (/\besta semana\b/.test(t)) return { hint: "esta semana", date: null };
  return { hint: null, date: null };
}

function findAssignee(body: string, author: string | null, type: FindingType, participants: string[]): string | null {
  if (type === "commitment") return author;
  const mention = /@([\p{L}][\p{L}\s]{1,30})/u.exec(body);
  const vocative = /^([\p{Lu}][\p{L}]{1,20})\s*,/u.exec(body.trim());
  const candidate = (mention?.[1] ?? vocative?.[1])?.trim();
  if (!candidate) return null;
  const c = stripAccents(candidate);
  const match = participants.find((p) => {
    const first = stripAccents(p).split(/\s+/)[0];
    return first && (c.startsWith(first) || stripAccents(p).startsWith(c));
  });
  return match ?? candidate;
}

function findBranch(body: string, branches: AnalysisContext["branches"]): string | null {
  const t = stripAccents(body);
  return branches.find((b) => new RegExp(`\\b${stripAccents(b.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t))?.name ?? null;
}

function makeTitle(body: string): string {
  const firstLine = body.split("\n")[0].trim();
  const sentence = firstLine.split(/(?<=[.!?])\s/)[0];
  const t = sentence.length > 110 ? `${sentence.slice(0, 107).trimEnd()}…` : sentence;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function analyzeHeuristic(messages: AnalysisMessage[], ctx: AnalysisContext): CandidateFinding[] {
  const out: CandidateFinding[] = [];
  for (const m of messages) {
    const body = m.body.trim();
    if (body.length < 6) continue;
    const rule = RULES.find((r) => r.re.test(body));
    if (!rule) continue;
    const match = rule.re.exec(body)?.[0]?.trim() ?? "";
    const due = rule.type === "completion_signal" || rule.type === "decision" ? { hint: null, date: null } : resolveDue(body, m.sent_at);
    const priority = URGENT.test(body) ? "urgent" : HIGH.test(body) || rule.type === "incident" ? "high" : "medium";
    out.push({
      type: rule.type,
      title: makeTitle(body),
      description: null,
      assignee_label: findAssignee(body, m.author_label, rule.type, ctx.participants),
      due_hint: due.hint,
      due_date: due.date,
      branch_name: findBranch(body, ctx.branches),
      priority,
      confidence: rule.confidence,
      rationale: `Detección heurística de ${rule.label}: coincide con «${match}». Requiere validación humana.`,
      evidence: [{ message_id: m.id, quote: body.slice(0, 300) }],
    });
  }
  return out;
}
