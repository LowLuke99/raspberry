import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  Check,
  RefreshCw,
  Shuffle,
  Save,
  Trash2,
  Download,
  Ghost,
  User,
  Mail,
  MapPin,
  CreditCard,
  Fingerprint,
  Globe as GlobeIcon,
  Cpu,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";

/* ═══════════════════════════════════════════════════════════════
   Personas — fake identity generator.

   Everything is generated locally with crypto.getRandomValues.
   Phone numbers use the 555 reserved range. Credit-card BINs are
   documented test BINs (4111...) — Luhn-valid but not real cards.
   No network requests. No PII ever leaves this machine.
   ═══════════════════════════════════════════════════════════════ */

interface Persona {
  id: string;
  gender: "male" | "female" | "neutral";
  firstName: string;
  lastName: string;
  handle: string;
  dob: string;            // ISO date
  age: number;
  bio: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  ip: string;
  mac: string;
  userAgent: string;
  os: string;
  card: { number: string; brand: string; exp: string; cvv: string };
  uuid: string;
  avatarSeed: number;    // deterministic hue for gradient
}

const STORAGE_KEY = "raspberry.personas.saved";

/* ── data pools ──────────────────────────────────────────────── */

const FIRST_M = ["James","Ethan","Noah","Liam","Oliver","Mason","Elijah","Lucas","Aiden","Jack","Owen","Leo","Milo","Felix","Silas","Theo","Casper","August","Ronan","Elias","Ezra","Kai","Miles","Jasper","Nolan","Wesley","Bennett","Hugo","Rowan","Callum"];
const FIRST_F = ["Ava","Sophia","Isla","Emma","Mia","Chloe","Nora","Zoe","Aria","Elena","Lily","Ivy","Hazel","Freya","Iris","Luna","Ruby","Maya","Wren","Sadie","Willow","Cora","June","Vera","Nova","Sable","Elsie","Amara","Lena","Thea"];
const FIRST_N = ["River","Sage","Rowan","Blake","Emerson","Reese","Kai","Skyler","Quinn","Ari","Ellis","Frankie","Wren","Sam","Toby","Charlie","Alex","Bailey","Cameron","Dakota"];
const LAST = ["Bennett","Clarke","Doyle","Ellis","Foster","Gray","Hale","Iverson","Jansen","Kade","Larsen","Meade","Novak","Oswald","Prescott","Quinn","Reeve","Sinclair","Thorne","Underwood","Vale","Whitaker","Xavier","York","Ziegler","Ashford","Blackwood","Corvin","Dresden","Everest","Fenwick","Grimes","Halloran","Ives","Jarrow","Kestrel","Lanning","Merritt","Nightingale","Orwell","Parrish","Radcliffe","Sterling","Talbot","Vanguard","Whitfield"];

const CITIES: { city: string; state: string; zip: string }[] = [
  { city: "Austin", state: "TX", zip: "78701" },
  { city: "Portland", state: "OR", zip: "97201" },
  { city: "Boulder", state: "CO", zip: "80301" },
  { city: "Asheville", state: "NC", zip: "28801" },
  { city: "Burlington", state: "VT", zip: "05401" },
  { city: "Madison", state: "WI", zip: "53703" },
  { city: "Bend", state: "OR", zip: "97701" },
  { city: "Bozeman", state: "MT", zip: "59715" },
  { city: "Santa Fe", state: "NM", zip: "87501" },
  { city: "Chattanooga", state: "TN", zip: "37402" },
  { city: "Providence", state: "RI", zip: "02903" },
  { city: "Ann Arbor", state: "MI", zip: "48104" },
  { city: "Missoula", state: "MT", zip: "59801" },
  { city: "Ithaca", state: "NY", zip: "14850" },
  { city: "Boise", state: "ID", zip: "83702" },
  { city: "Duluth", state: "MN", zip: "55802" },
  { city: "Flagstaff", state: "AZ", zip: "86001" },
  { city: "Eugene", state: "OR", zip: "97401" },
  { city: "Missoula", state: "MT", zip: "59801" },
  { city: "Wilmington", state: "NC", zip: "28401" },
];

const STREETS = ["Maple","Cedar","Elm","Birch","Pine","Aspen","Willow","Sycamore","Poplar","Chestnut","Sunset","Ridge","Meadow","Lakeview","Hillcrest","Orchard","River","Highland","Brookside","Pinehurst","Fairfield","Sherwood","Autumn","Kingston","Windsor","Ashwood","Copper","Hemlock","Juniper","Larch"];
const STREET_TYPE = ["St","Ave","Rd","Ln","Ct","Dr","Way","Pl","Blvd","Trl"];

const EMAIL_DOMAINS = ["gmail.com","outlook.com","proton.me","fastmail.com","tutanota.com","hey.com","icloud.com","hushmail.com","posteo.net","mailbox.org"];

const HANDLE_ADJ = ["silent","quiet","hidden","neon","pixel","ember","void","cyber","zero","glass","obsidian","phantom","noble","daring","calm","electric","spectral","frost","lunar","ashen","gilded","onyx","velvet","stormy"];
const HANDLE_NOUN = ["fox","raven","wolf","otter","hawk","hare","phoenix","hydra","koi","lynx","moth","panther","raptor","stag","tiger","viper","whale","yeti","gecko","heron"];

const BIOS = [
  "long walks past the router, coffee before commits, questions everything",
  "collects mechanical keyboards and old maps",
  "photographs abandoned buildings, writes about none of it",
  "reformed lurker, occasional forum ghost, sometimes helpful",
  "asks better questions than they answer",
  "makes noises with modular synths on weekends",
  "reads man pages for fun, still can't spell tomorrow",
  "believes rain smells better in cities",
  "runs cold, ships warm, listens to jazz",
  "keeps a plant alive, calls that a personality",
];

const UA_POOL = [
  "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/131.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
];
const OS_POOL = ["Windows 11","macOS 14 Sonoma","Ubuntu 24.04","Arch Linux","Fedora 41","Debian 12","iOS 18","Android 15"];

/* ── rng helpers ─────────────────────────────────────────────── */

function randInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % max;
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(arr.length)]!;
}
function pad(n: number, w: number): string {
  return String(n).padStart(w, "0");
}

/* ── Luhn-valid card generation using documented test BINs ────
   4111 is Visa's canonical test BIN — will never authorize.
   ─────────────────────────────────────────────────────────── */

function luhnCheck(digits: number[]): number {
  let sum = 0;
  const flipStart = digits.length % 2 === 0 ? 0 : 1;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i]!;
    if (i % 2 === flipStart) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check;
}

function fakeCard(): Persona["card"] {
  const prefix = [4, 1, 1, 1];              // Visa test BIN (never real)
  const body: number[] = [...prefix];
  while (body.length < 15) body.push(randInt(10));
  body.push(luhnCheck(body));
  const number = body.reduce<string>((s, d, i) => s + d + (i % 4 === 3 && i !== 15 ? " " : ""), "");
  const now = new Date();
  const expMonth = 1 + randInt(12);
  const expYear = (now.getFullYear() + 2 + randInt(4)) % 100;
  const exp = `${pad(expMonth, 2)}/${pad(expYear, 2)}`;
  const cvv = `${pad(randInt(1000), 3)}`;
  return { number, brand: "Visa (test)", exp, cvv };
}

/* ── individual field builders ───────────────────────────────── */

function fakeName(gender: Persona["gender"]): { first: string; last: string } {
  const pool = gender === "male" ? FIRST_M : gender === "female" ? FIRST_F : FIRST_N;
  return { first: pick(pool), last: pick(LAST) };
}
function fakeHandle(first: string): string {
  return `${pick(HANDLE_ADJ)}_${pick(HANDLE_NOUN)}${randInt(90) + 10}${first[0]!.toLowerCase()}`;
}
function fakeDob(): { iso: string; age: number } {
  const age = 21 + randInt(50);
  const now = new Date();
  const year = now.getFullYear() - age;
  const month = 1 + randInt(12);
  const day = 1 + randInt(28);
  return { iso: `${year}-${pad(month, 2)}-${pad(day, 2)}`, age };
}
function fakeEmail(first: string, last: string): string {
  const styles = [
    `${first}.${last}`,
    `${first[0]}${last}`,
    `${first}${last}${randInt(90) + 10}`,
    `${last}.${first}`,
    `${first}_${last}`,
  ];
  return `${pick(styles).toLowerCase()}@${pick(EMAIL_DOMAINS)}`;
}
function fakePhone(): string {
  // 555-01xx is reserved by NANPA for fictional use.
  const area = 200 + randInt(700);
  const suffix = randInt(100);
  return `+1 (${area}) 555-01${pad(suffix, 2)}`;
}
function fakeAddress(): { street: string; city: string; state: string; zip: string } {
  const c = pick(CITIES);
  const num = 100 + randInt(9900);
  const street = `${num} ${pick(STREETS)} ${pick(STREET_TYPE)}`;
  return { street, city: c.city, state: c.state, zip: c.zip };
}
function fakeIp(): string {
  // TEST-NET-3 (203.0.113.0/24) is documented as safe-to-print.
  return `203.0.113.${1 + randInt(254)}`;
}
function fakeMac(): string {
  // Locally-administered bit set so it's clearly not a real vendor MAC.
  const bytes = [0x02, randInt(256), randInt(256), randInt(256), randInt(256), randInt(256)];
  return bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
}
function fakeBio(): string {
  return pick(BIOS);
}

/* ── build one full persona ──────────────────────────────────── */

function generatePersona(gender?: Persona["gender"]): Persona {
  const g = gender ?? (["male", "female", "neutral"] as const)[randInt(3)]!;
  const { first, last } = fakeName(g);
  const dob = fakeDob();
  const addr = fakeAddress();
  return {
    id: crypto.randomUUID(),
    gender: g,
    firstName: first,
    lastName: last,
    handle: fakeHandle(first),
    dob: dob.iso,
    age: dob.age,
    bio: fakeBio(),
    email: fakeEmail(first, last),
    phone: fakePhone(),
    street: addr.street,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    country: "USA",
    ip: fakeIp(),
    mac: fakeMac(),
    userAgent: pick(UA_POOL),
    os: pick(OS_POOL),
    card: fakeCard(),
    uuid: crypto.randomUUID(),
    avatarSeed: randInt(360),
  };
}

/* ═══════════════════════════════════════════════════════════════
   UI
   ═══════════════════════════════════════════════════════════════ */

export function PersonasPanel({ manifest }: { manifest: ModuleManifest }) {
  const [gender, setGender] = useState<Persona["gender"] | "any">("any");
  const [persona, setPersona] = useState<Persona>(() => generatePersona());
  const [saved, setSaved] = useState<Persona[]>(() => loadSaved());

  const regen = useCallback(() => {
    setPersona(generatePersona(gender === "any" ? undefined : gender));
  }, [gender]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);

  const save = () => {
    if (saved.some((p) => p.id === persona.id)) return;
    setSaved((s) => [persona, ...s].slice(0, 20));
  };
  const remove = (id: string) => setSaved((s) => s.filter((p) => p.id !== id));
  const restore = (p: Persona) => setPersona(p);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(persona, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `persona-${persona.handle}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="flex items-center gap-1 rounded-[9px] bg-surface p-0.5 shadow-[var(--hairline)]">
          {(["any", "female", "male", "neutral"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={cn(
                "rounded-[7px] px-2.5 py-1 text-[11px] transition-colors",
                gender === g ? "bg-surface-hi text-text" : "text-text-dim hover:text-text",
              )}
            >
              {g === "any" ? "Any" : g[0]!.toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FakeBanner />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={regen}
            className="focus-ring flex items-center gap-1.5 rounded-[9px] bg-[rgba(var(--raspberry-rgb),0.2)] px-3 py-1.5 text-[12px] text-raspberry transition-colors hover:bg-[rgba(var(--raspberry-rgb),0.28)]"
          >
            <Shuffle size={13} /> Regenerate
          </button>
          <button
            type="button"
            onClick={save}
            className="focus-ring flex items-center gap-1.5 rounded-[9px] bg-surface-hi px-3 py-1.5 text-[12px] text-text transition-colors hover:text-raspberry"
          >
            <Save size={13} /> Save
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="focus-ring flex items-center gap-1.5 rounded-[9px] bg-surface-hi px-3 py-1.5 text-[12px] text-text transition-colors hover:text-raspberry"
          >
            <Download size={13} /> Export JSON
          </button>
          <CopyButton text={JSON.stringify(persona, null, 2)} label="Copy JSON" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <IdentityCard persona={persona} />
          <div className="flex flex-col gap-4">
            <FieldSection icon={User} title="Identity">
              <Row k="Name" v={`${persona.firstName} ${persona.lastName}`} />
              <Row k="Handle" v={persona.handle} />
              <Row k="Gender" v={persona.gender} />
              <Row k="DOB" v={`${persona.dob}  (${persona.age})`} />
              <Row k="Bio" v={persona.bio} />
            </FieldSection>

            <FieldSection icon={Mail} title="Contact">
              <Row k="Email" v={persona.email} />
              <Row k="Phone" v={persona.phone} hint="555 range · reserved for fictional use" />
            </FieldSection>

            <FieldSection icon={MapPin} title="Address">
              <Row k="Street" v={persona.street} />
              <Row k="City" v={`${persona.city}, ${persona.state} ${persona.zip}`} />
              <Row k="Country" v={persona.country} />
            </FieldSection>

            <FieldSection icon={GlobeIcon} title="Digital">
              <Row k="IP" v={persona.ip} hint="TEST-NET-3 · documentation-safe" />
              <Row k="MAC" v={persona.mac} hint="locally-administered" />
              <Row k="UUID" v={persona.uuid} />
            </FieldSection>

            <FieldSection icon={Cpu} title="System">
              <Row k="OS" v={persona.os} />
              <Row k="User-Agent" v={persona.userAgent} truncate />
            </FieldSection>

            <FieldSection icon={CreditCard} title="Payment">
              <Row k="Number" v={persona.card.number} hint="Visa test BIN 4111 · never authorizes" />
              <Row k="Expires" v={persona.card.exp} />
              <Row k="CVV" v={persona.card.cvv} />
            </FieldSection>
          </div>
        </div>

        {saved.length > 0 && (
          <SavedList saved={saved} onRestore={restore} onRemove={remove} />
        )}
      </div>
    </PanelShell>
  );
}

/* ── header banner reminding this is all fake ────────────────── */

function FakeBanner() {
  return (
    <div className="flex items-start gap-3 rounded-[10px] bg-[rgba(255,193,7,0.06)] p-3 shadow-[var(--hairline)]">
      <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-300" />
      <div className="text-[12px] leading-relaxed text-text-dim">
        <span className="text-text">All data is synthetic.</span> Phone numbers use the 555-01xx range,
        cards use the 4111 test BIN, IPs are TEST-NET-3, MACs are locally-administered. Nothing here can
        contact a real person or authorize a real transaction. For testing, mockups, and privacy — not for fraud.
      </div>
    </div>
  );
}

/* ── the identity card with generated gradient avatar ────────── */

function IdentityCard({ persona }: { persona: Persona }) {
  const initials = `${persona.firstName[0] ?? ""}${persona.lastName[0] ?? ""}`;
  const hue = persona.avatarSeed;
  return (
    <GlassPanel interactive={false} className="flex h-fit flex-col items-center gap-3 p-5">
      <div
        aria-hidden
        className="grid h-32 w-32 place-items-center rounded-full text-[42px] font-semibold text-white shadow-inner"
        style={{
          background: `radial-gradient(circle at 30% 25%, hsl(${hue} 80% 60%), hsl(${(hue + 60) % 360} 60% 30%))`,
        }}
      >
        {initials}
      </div>
      <div className="flex flex-col items-center text-center">
        <span className="text-[15px] text-text">
          {persona.firstName} {persona.lastName}
        </span>
        <span className="mono text-[11.5px] text-text-dim">@{persona.handle}</span>
      </div>
      <div className="mt-1 flex flex-col items-center gap-0.5 text-[11.5px] text-text-dim">
        <span>{persona.city}, {persona.state}</span>
        <span className="mono">{persona.age} · {persona.gender}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 rounded-full bg-surface-hi px-2.5 py-1 text-[10.5px] text-text-dim">
        <Ghost size={11} /> synthetic identity
      </div>
    </GlassPanel>
  );
}

/* ── generic section + row ───────────────────────────────────── */

function FieldSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <GlassPanel interactive={false} className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.04)] px-4 py-2.5 text-[11px] uppercase tracking-wide text-text-dim">
        <Icon size={12} />
        {title}
      </div>
      <div>{children}</div>
    </GlassPanel>
  );
}

function Row({ k, v, hint, truncate }: { k: string; v: string; hint?: string; truncate?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.03)] px-4 py-2 last:border-b-0">
      <span className="w-20 shrink-0 text-[11px] uppercase tracking-wide text-text-dim">{k}</span>
      <span className={cn("mono flex-1 text-[12.5px] text-text", truncate && "truncate")} title={v}>
        {v}
      </span>
      {hint && (
        <span className="hidden shrink-0 text-[10.5px] text-text-dim/70 md:inline">{hint}</span>
      )}
      <CopyButton text={v} />
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={!text}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="focus-ring flex shrink-0 items-center gap-1.5 rounded-[8px] bg-surface-hi px-2.5 py-1 text-[11px] text-text-dim transition-colors hover:text-text disabled:opacity-40"
    >
      {copied ? <Check size={12} className="text-raspberry" /> : <Copy size={12} />}
      {copied ? "Copied" : label ?? ""}
    </button>
  );
}

/* ── saved personas rail ─────────────────────────────────────── */

function SavedList({
  saved,
  onRestore,
  onRemove,
}: {
  saved: Persona[];
  onRestore: (p: Persona) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <GlassPanel interactive={false} className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.04)] px-4 py-2.5">
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-text-dim">
          <Fingerprint size={12} /> Saved ({saved.length}/20)
        </span>
        <span className="text-[10.5px] text-text-dim/70">local to this browser</span>
      </div>
      <div className="flex flex-col divide-y divide-[rgba(255,255,255,0.03)]">
        {saved.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-2">
            <div
              className="h-7 w-7 shrink-0 rounded-full"
              style={{
                background: `radial-gradient(circle at 30% 25%, hsl(${p.avatarSeed} 80% 60%), hsl(${(p.avatarSeed + 60) % 360} 60% 30%))`,
              }}
            />
            <div className="flex-1 truncate">
              <div className="text-[12.5px] text-text">
                {p.firstName} {p.lastName}
              </div>
              <div className="mono text-[10.5px] text-text-dim">
                @{p.handle} · {p.city}, {p.state}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRestore(p)}
              className="focus-ring rounded-[8px] bg-surface-hi px-2.5 py-1 text-[11px] text-text-dim transition-colors hover:text-raspberry"
            >
              <RefreshCw size={12} className="inline" /> Load
            </button>
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              className="focus-ring rounded-[8px] bg-surface-hi px-2 py-1 text-[11px] text-text-dim transition-colors hover:text-red-300"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

/* ── persistence ─────────────────────────────────────────────── */

function loadSaved(): Persona[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Persona[]).slice(0, 20) : [];
  } catch {
    return [];
  }
}
