import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://yelhohviubmdrcitrqay.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGhvaHZpdWJtZHJjaXRycWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MDQ3MTYsImV4cCI6MjA5NDk4MDcxNn0.pVHXrC01esIUtIIWirGCuj2r-hogMBjlsspfizszmb8";

const sb = {
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON },
      body: JSON.stringify({ email, password })
    });
    return r.json();
  },
  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${token}` }
    });
  },
  async loadData(token) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=*&key=eq.familyfire_v1`, {
      headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${token}` }
    });
    const rows = await r.json();
    return rows?.[0]?.value ?? null;
  },
  async saveData(token, data) {
    await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify({ key: "familyfire_v1", value: data })
    });
  }
};

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:"#08111f", surface:"#0f1d2e", surface2:"#162338", surface3:"#1c2d45",
  border:"#1e3352", accent:"#00c896", accent2:"#3b7dd8", warn:"#f4a03a",
  danger:"#e05252", green:"#27c472", text:"#dce8f5", muted:"#5a7a99",
  irene:"#a78bfa", monetario:"#06b6d4",
};

const fmt = (n) => new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n??0);
const fmtK = (n) => `€${((n??0)/1000).toFixed(0)}k`;
const today = () => new Date().toISOString().slice(0,10);

function getValore(x) {
  if (x.tipo==="BFP"||x.tipo==="Libretto") return x.nav;
  if (x.tipo==="Obbligazione") return (x.nominale||x.qty||0) * (x.nav/100);
  return (x.qty||0) * (x.nav||0);
}

// ─── INITIAL STATE ────────────────────────────────────────────────────────────
const INITIAL_SETTINGS = {
  nomeA:"Francesco", nomeB:"Erika", nomeC:"Irene", etaA:43, etaB:43,
  annoFire:2041, spesaAnnuaFire:35000, swr:3.5,
  rendConservativo:5.0, rendBase:6.5, rendOttimistico:8.0, risparmioAnnuo:50000,
  mutuoRata:536.35, mutuoTaeg:1.409, sogliaMinCC:5000, sogliaInvestCC:8000,
  irpef1:23, irpef2:33, irpef3:43, soglia1:28000, soglia2:50000,
  capitalGain:26, bolloTitoli:0.2, bolloCC:0.2, deducibilitaFP:5300,
  prestazioneFPcap:50, targetIrene:25000,
};

const CATEGORIE_DEFAULT = [
  "Alimentari","Abbigliamento","Assicurazioni","Casa","Cane","Irene",
  "Lavoro","Mediche","Mutuo","Pulizie","Ristoranti/Svago","Tasse",
  "Trasporti","Utenze","Viaggi","Stipendio","Cedole","Rimborsi","Prestito Auto","Altro"
];

const INITIAL_TRANSACTIONS = [
  {id:1,data:"2025-01-15",importo:6520.64,tipo:"entrata",cat:"Stipendio",utente:"Francesco",note:"Stipendio gennaio"},
  {id:2,data:"2025-01-15",importo:7687.31,tipo:"entrata",cat:"Stipendio",utente:"Erika",note:"Stipendio gennaio"},
  {id:3,data:"2025-01-20",importo:589.02,tipo:"uscita",cat:"Alimentari",utente:"Comune",note:"Spesa supermercato"},
  {id:4,data:"2025-01-27",importo:1076.69,tipo:"uscita",cat:"Mutuo",utente:"Comune",note:"Rata mutuo"},
  {id:5,data:"2025-02-15",importo:6520.64,tipo:"entrata",cat:"Stipendio",utente:"Francesco",note:"Stipendio febbraio"},
  {id:6,data:"2025-02-15",importo:7687.31,tipo:"entrata",cat:"Stipendio",utente:"Erika",note:"Stipendio febbraio"},
  {id:7,data:"2025-03-10",importo:2148.90,tipo:"uscita",cat:"Viaggi",utente:"Erika",note:"Vacanza Pasqua"},
  {id:8,data:"2025-04-15",importo:6520.64,tipo:"entrata",cat:"Stipendio",utente:"Francesco",note:""},
  {id:9,data:"2025-04-15",importo:7687.31,tipo:"entrata",cat:"Stipendio",utente:"Erika",note:""},
  {id:10,data:"2025-05-01",importo:1297.97,tipo:"uscita",cat:"Assicurazioni",utente:"Erika",note:"Polizza infortuni"},
];

const INITIAL_FORECASTS = [
  {id:1,data:"2026-05-20",importo:6000,tipo:"entrata",cat:"Rimborsi",utente:"Erika",desc:"BOT MG26 scadenza → reinvestire in SWDA",stato:"previsto"},
  {id:2,data:"2026-07-14",importo:4000,tipo:"entrata",cat:"Rimborsi",utente:"Erika",desc:"BOT LG26 scadenza → reinvestire in SWDA",stato:"previsto"},
  {id:3,data:"2026-08-01",importo:900,tipo:"uscita",cat:"Assicurazioni",utente:"Erika",desc:"Rinnovo polizza infortuni",stato:"previsto"},
  {id:4,data:"2026-08-01",importo:400,tipo:"uscita",cat:"Assicurazioni",utente:"Francesco",desc:"Rinnovo polizza infortuni",stato:"previsto"},
  {id:5,data:"2026-09-14",importo:10000,tipo:"entrata",cat:"Rimborsi",utente:"Erika",desc:"BOT ST26 scadenza → reinvestire in SWDA",stato:"previsto"},
  {id:6,data:"2026-12-15",importo:6000,tipo:"entrata",cat:"Stipendio",utente:"Erika",desc:"Tredicesima stimata → 100% ETF 85/15",stato:"previsto"},
  {id:7,data:"2026-12-15",importo:2200,tipo:"entrata",cat:"Stipendio",utente:"Francesco",desc:"Tredicesima stimata → 100% ETF 85/15",stato:"previsto"},
  {id:8,data:"2027-06-01",importo:15000,tipo:"entrata",cat:"Rimborsi",utente:"Erika",desc:"BTP GN27 scadenza → ETF 85/15",stato:"previsto"},
  {id:9,data:"2027-06-01",importo:10000,tipo:"entrata",cat:"Rimborsi",utente:"Francesco",desc:"BTP GN27 scadenza → ETF 85/15",stato:"previsto"},
  {id:10,data:"2029-10-01",importo:24248,tipo:"entrata",cat:"Rimborsi",utente:"Erika",desc:"BFP 3x2 scadenza → ETF 85/15, NON rinnovare",stato:"previsto"},
  {id:11,data:"2029-10-01",importo:18475,tipo:"entrata",cat:"Rimborsi",utente:"Francesco",desc:"BFP 3x2 scadenza → ETF 85/15, NON rinnovare",stato:"previsto"},
];

const INITIAL_PORTFOLIO_E = [
  {id:1,nome:"iShares Core MSCI World (SWDA)",isin:"IE00B4L5Y983",tipo:"ETF",qty:571,carico:93.30,nav:99.50},
  {id:2,nome:"iShares Core S&P 500",isin:"IE00B5BMR087",tipo:"ETF",qty:20,carico:520.88,nav:548.00},
  {id:3,nome:"Xtrackers MSCI EM (EIMI)",isin:"IE00BTJRMP35",tipo:"ETF",qty:32,carico:74.85,nav:78.20},
  {id:4,nome:"Xtrackers MSCI Europe",isin:"LU0274209237",tipo:"ETF",qty:12,carico:111.42,nav:116.80},
  {id:5,nome:"iShares Physical Gold ETC",isin:"IE00B4ND3602",tipo:"ETC",qty:14,carico:85.40,nav:91.20},
  {id:6,nome:"OAT France 2072 0,5%",isin:"FR0014001NN8",tipo:"Obbligazione",nominale:50700,carico:33.67,nav:34.10},
  {id:7,nome:"BTP GN27 Val Su Cum",isin:"IT0005547390",tipo:"Obbligazione",nominale:15000,carico:100.00,nav:101.20},
  {id:8,nome:"BTP MZ35 3,35%",isin:"IT0005358806",tipo:"Obbligazione",nominale:6000,carico:98.53,nav:97.80},
  {id:9,nome:"BOT LG26",isin:"IT0005660029",tipo:"Obbligazione",nominale:4000,carico:98.12,nav:99.40},
  {id:10,nome:"BTP AG39 5%",isin:"IT0004286966",tipo:"Obbligazione",nominale:10000,carico:106.78,nav:108.50},
  {id:11,nome:"BTP MZ30 Val Su Cum",isin:"IT0005583478",tipo:"Obbligazione",nominale:10000,carico:100.00,nav:101.80},
  {id:12,nome:"BOT ST26",isin:"IT0005669269",tipo:"Obbligazione",nominale:10000,carico:98.09,nav:99.60},
  {id:13,nome:"BFP 3x2",isin:"",tipo:"BFP",nav:21697.71,carico:21000},
  {id:14,nome:"BFP 3x4",isin:"",tipo:"BFP",nav:21697.71,carico:21000},
  {id:15,nome:"BFP 4x4",isin:"",tipo:"BFP",nav:13461.87,carico:13000},
];

const INITIAL_PORTFOLIO_F = [
  {id:1,nome:"iShares Core MSCI World (SWDA)",isin:"IE00B4L5Y983",tipo:"ETF",qty:209,carico:95.16,nav:99.50},
  {id:2,nome:"OAT France 2072 0,5%",isin:"FR0014001NN8",tipo:"Obbligazione",nominale:60000,carico:34.49,nav:34.10},
  {id:3,nome:"BTP GN27 Val Su Cum",isin:"IT0005547390",tipo:"Obbligazione",nominale:10000,carico:100.00,nav:101.20},
  {id:4,nome:"BTP Green AP35 4%",isin:"IT0005508590",tipo:"Obbligazione",nominale:25000,carico:98.18,nav:99.20},
  {id:5,nome:"BTP AG39 5%",isin:"IT0004286966",tipo:"Obbligazione",nominale:20000,carico:106.05,nav:108.50},
  {id:6,nome:"BTP FB37 4%",isin:"IT0003934657",tipo:"Obbligazione",nominale:10000,carico:95.16,nav:96.80},
  {id:7,nome:"BFP 3x2",isin:"",tipo:"BFP",nav:16531.59,carico:16000},
  {id:8,nome:"BFP 3x4",isin:"",tipo:"BFP",nav:21697.71,carico:21000},
  {id:9,nome:"BFP 4x4",isin:"",tipo:"BFP",nav:13461.87,carico:13000},
];

const INITIAL_PORTFOLIO_I = [
  {id:1,nome:"Libretto Postale",isin:"",tipo:"Libretto",nav:688.82,carico:688.82}
];

const INITIAL_LIQUIDITY = {
  erika:[
    {id:1,nome:"C/C Fineco",importo:12127.34},
    {id:2,nome:"C/C Intesa SP",importo:3968.87},
    {id:3,nome:"C/C Poste",importo:689.05},
    {id:4,nome:"Conto deposito",importo:6000.00},
  ],
  francesco:[
    {id:1,nome:"C/C Fineco",importo:35.59},
    {id:2,nome:"C/C Intesa SP",importo:10974.53},
    {id:3,nome:"C/C Poste",importo:1782.29},
  ],
  irene:[{id:1,nome:"Libretto Postale",importo:688.82}],
};

const INITIAL_MONETARY = { erika:[], francesco:[] };

const INITIAL_PENSION = {
  a:{
    inpsAnticipata:{data:"2049-08-01",importoLordo:2398},
    inpsVecchiaia:{data:"2052-07-01",importoLordo:2918},
    tfr:{posizione:8500,dataLiquidazione:"2041-01-01",rivalutazioneAnnua:1.8},
    fp:{fondo:"Fon.Te.",versamentoCumulato:0,comparto:"Dinamico",rendimentoStorico:5.2,contributoAnnuo:0,anniPartecipazione:0},
  },
  b:{
    inpsAnticipata:{data:"",importoLordo:0},
    inpsVecchiaia:{data:"",importoLordo:0},
    tfr:{posizione:22000,dataLiquidazione:"2041-01-01",rivalutazioneAnnua:1.8},
    fp:{fondo:"Perseo Sirio",versamentoCumulato:0,comparto:"Dinamico",rendimentoStorico:5.5,contributoAnnuo:0,anniPartecipazione:0},
  },
};

const INITIAL_BUDGETS = {
  "Alimentari":8000,"Abbigliamento":2000,"Assicurazioni":3500,"Casa":4500,
  "Cane":300,"Irene":3500,"Lavoro":4000,"Mediche":1500,"Mutuo":13000,
  "Pulizie":2200,"Ristoranti/Svago":5500,"Tasse":1200,"Trasporti":2000,
  "Utenze":2400,"Viaggi":9000,"Prestito Auto":3000,
};

const LOAN_PAYMENTS = Array.from({length:54},(_,i)=>{
  const d = new Date(2026,5+i,1);
  return {id:i+1,mese:d.toLocaleDateString("it-IT",{month:"short",year:"numeric"}),importo:250,pagata:false,dataPagamento:null};
});

const DECISIONI_DEFAULT = [
  {id:1,titolo:"Sistema a Soglia C/C",testo:"Non si investe con PAC fisso mensile ma tramite un sistema a soglia: sotto €5.000 sul C/C non si investe, tra €5.000 e €8.000 si lascia accumulare, sopra €8.000 si investe l'eccedenza sopra €5.000 in ETF SWDA+EIMI (85/15)."},
  {id:2,titolo:"Asset Allocation Target 85/15",testo:"L'obiettivo di lungo periodo è 85% ETF azionari globali (SWDA 85% + EIMI 15%) e 15% liquidità/monetario. Le obbligazioni e i BFP vengono progressivamente disinvestiti a scadenza e reinvestiti in ETF."},
  {id:3,titolo:"SWR 3,5% e Target FIRE €1.000.000",testo:"Si adotta un Safe Withdrawal Rate del 3,5% (più conservativo del classico 4%). Con spesa annua target di €35.000, il patrimonio necessario è €1.000.000. Anno target: 2041."},
  {id:4,titolo:"ETF Monetario XEON come Fondo Emergenza",testo:"Il Xtrackers EUR Overnight Rate Swap (XEON, LU0290358497) NON è conteggiato come equity. Obiettivo: €15-18k Erika, €8-10k Francesco."},
  {id:5,titolo:"Scadenze: NON Rinnovare BFP e BOT",testo:"Tutti i BFP e BOT a scadenza vanno reinvestiti in ETF SWDA/EIMI secondo allocazione 85/15."},
  {id:6,titolo:"Fondi Pensione: Apertura Prioritaria 2026",testo:"Aprire Fon.Te. (Francesco) e Perseo Sirio (Erika) nel 2026. Versare il massimo deducibile (€5.300/anno per LdB 2026)."},
  {id:7,titolo:"Mutuo: Nessuna Estinzione Anticipata",testo:"Il mutuo ha TAEG 1,41% — costo del denaro inferiore al rendimento atteso del portafoglio (6,5%). Mantenere le rate regolari fino alla scadenza naturale (settembre 2041)."},
  {id:8,titolo:"Portafoglio Irene: Fondo Università",testo:"Target €25.000 per percorsi all'estero. Obiettivo 2033."},
];

const INITIAL_APP_STATE = {
  settings:INITIAL_SETTINGS,
  transactions:INITIAL_TRANSACTIONS,
  forecasts:INITIAL_FORECASTS,
  portfolioE:INITIAL_PORTFOLIO_E,
  portfolioF:INITIAL_PORTFOLIO_F,
  portfolioI:INITIAL_PORTFOLIO_I,
  liquidityE:INITIAL_LIQUIDITY.erika,
  liquidityF:INITIAL_LIQUIDITY.francesco,
  liquidityI:INITIAL_LIQUIDITY.irene,
  monetaryE:INITIAL_MONETARY.erika,
  monetaryF:INITIAL_MONETARY.francesco,
  pension:INITIAL_PENSION,
  budgets:INITIAL_BUDGETS,
  loanPayments:LOAN_PAYMENTS,
  categories:CATEGORIE_DEFAULT,
  decisioni:DECISIONI_DEFAULT,
};

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(()=>{
    const fn = ()=>setMobile(window.innerWidth<768);
    window.addEventListener("resize",fn);
    return ()=>window.removeEventListener("resize",fn);
  },[]);
  return mobile;
}

function Card({children,style={},warn,accent,color}) {
  const bc = color?color+"44":warn?C.danger+"44":accent?C.accent+"33":C.border;
  return <div style={{background:C.surface,border:`1px solid ${bc}`,borderRadius:12,padding:16,...style}}>{children}</div>;
}

function KPI({label,value,sub,color}) {
  return (
    <Card>
      <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color:color||C.text,lineHeight:1.1,fontFamily:"Georgia,serif"}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:C.muted,marginTop:3}}>{sub}</div>}
    </Card>
  );
}

function SH({title,icon,children}) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {icon&&<span>{icon}</span>}
        <h3 style={{margin:0,fontSize:14,fontWeight:600,color:C.text}}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Pill({label,color}) {
  return <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:color+"22",color,fontWeight:500}}>{label}</span>;
}

function Btn({children,onClick,small,variant="default",style={}}) {
  const bg = variant==="primary"?C.accent:variant==="danger"?C.danger:variant==="ghost"?"transparent":C.surface3;
  const col = variant==="primary"?"#000":variant==="danger"?"#fff":C.text;
  return (
    <button onClick={onClick} style={{
      background:bg,color:col,
      border:`1px solid ${variant==="default"?C.border:variant==="ghost"?C.border:"transparent"}`,
      borderRadius:7,padding:small?"4px 10px":"7px 14px",fontSize:small?11:12,
      fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",...style
    }}>{children}</button>
  );
}

function Inp({label,value,onChange,type="text",small,placeholder}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      {label&&<label style={{fontSize:11,color:C.muted}}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:7,
          padding:small?"5px 9px":"7px 11px",color:C.text,fontSize:small?12:13,outline:"none",width:"100%"}}/>
    </div>
  );
}

function Sel({label,value,onChange,options}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      {label&&<label style={{fontSize:11,color:C.muted}}>{label}</label>}
      <select value={value} onChange={onChange} style={{
        background:C.surface3,border:`1px solid ${C.border}`,borderRadius:7,
        padding:"7px 11px",color:C.text,fontSize:13,outline:"none"}}>
        {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
      </select>
    </div>
  );
}

function Modal({title,onClose,children,wide}) {
  return (
    <div style={{position:"fixed",inset:0,background:"#000c",zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:24,width:"100%",maxWidth:wide?640:440,maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h3 style={{margin:0,fontSize:15,color:C.text}}>{title}</h3>
          <Btn small onClick={onClose}>✕</Btn>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({msg,onConfirm,onCancel}) {
  return (
    <Modal title="Conferma" onClose={onCancel}>
      <p style={{color:C.text,marginBottom:20}}>{msg}</p>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn onClick={onCancel}>Annulla</Btn>
        <Btn variant="danger" onClick={onConfirm}>Elimina</Btn>
      </div>
    </Modal>
  );
}

function ProgressBar({pct,color,height=8}) {
  return (
    <div style={{background:C.border,borderRadius:99,height,overflow:"hidden"}}>
      <div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.5s"}}/>
    </div>
  );
}

function Table({cols,rows,emptyMsg="Nessun dato"}) {
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead>
          <tr>{cols.map(c=><th key={c.key} style={{padding:"7px 10px",textAlign:c.right?"right":"left",color:C.muted,fontWeight:500,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length===0
            ?<tr><td colSpan={cols.length} style={{padding:20,textAlign:"center",color:C.muted}}>{emptyMsg}</td></tr>
            :rows.map((r,i)=>(
              <tr key={r.id??i} style={{borderBottom:`1px solid ${C.border}18`}}>
                {cols.map(c=><td key={c.key} style={{padding:"8px 10px",color:c.color?c.color(r):C.text,textAlign:c.right?"right":"left",fontFamily:c.mono?"monospace":undefined}}>{c.render?c.render(r):r[c.key]}</td>)}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}

function calcolaProiezione(pat,risp,anni,tasso) {
  let p=pat;
  return Array.from({length:anni+1},(_,i)=>{if(i>0)p=p*(1+tasso/100)+risp;return Math.round(p);});
}

function tassazioneFP(anni) {
  if(anni<=15)return 15;
  return Math.max(9,15-(anni-15)*0.3);
}

function SyncBadge({status}) {
  if(status==="idle")return null;
  const cfg={saving:{col:C.warn,ico:"↑",txt:"Salvataggio…"},saved:{col:C.green,ico:"✓",txt:"Salvato"},error:{col:C.danger,ico:"⚠",txt:"Errore sync"}};
  const {col,ico,txt}=cfg[status]||cfg.saving;
  return <span style={{fontSize:11,color:col,display:"flex",alignItems:"center",gap:4}}><span>{ico}</span><span>{txt}</span></span>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  async function doLogin(e) {
    e.preventDefault();
    setLoading(true);setErr("");
    const res=await sb.signIn(email,pass);
    if(res.access_token){onLogin(res.access_token,res.user);}
    else{setErr(res.error_description||res.msg||"Credenziali non valide");}
    setLoading(false);
  }

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,borderRadius:16,background:`linear-gradient(135deg,${C.accent},${C.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 16px"}}>🔥</div>
          <div style={{fontSize:28,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>FamilyFIRE</div>
          <div style={{fontSize:13,color:C.muted,marginTop:6}}>Piano FIRE 2041 · Francesco & Erika</div>
        </div>
        <Card style={{padding:28}}>
          <form onSubmit={doLogin} style={{display:"flex",flexDirection:"column",gap:16}}>
            <Inp label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tua@email.com"/>
            <Inp label="Password" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"/>
            {err&&<div style={{background:C.danger+"18",border:`1px solid ${C.danger}44`,borderRadius:8,padding:"10px 14px",fontSize:12,color:"#fca5a5"}}>{err}</div>}
            <button type="submit" disabled={loading} style={{background:loading?C.surface3:C.accent,color:loading?C.muted:"#000",border:"none",borderRadius:8,padding:"12px",fontSize:14,fontWeight:700,cursor:loading?"wait":"pointer"}}>
              {loading?"Accesso in corso…":"Accedi →"}
            </button>
          </form>
        </Card>
        <div style={{marginTop:12,fontSize:10,color:C.muted,textAlign:"center"}}>Solo per uso privato · Dati su Supabase</div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({settings:s,transactions,portfolioE,portfolioF,liquidityE,liquidityF,monetaryE,monetaryF}) {
  const target=s.spesaAnnuaFire/(s.swr/100);
  const anni=s.annoFire-2026;
  const valE=portfolioE.reduce((a,x)=>a+getValore(x),0);
  const valF=portfolioF.reduce((a,x)=>a+getValore(x),0);
  const liqE=liquidityE.reduce((a,x)=>a+x.importo,0);
  const liqF=liquidityF.reduce((a,x)=>a+x.importo,0);
  const monE=monetaryE.reduce((a,x)=>a+getValore(x),0);
  const monF=monetaryF.reduce((a,x)=>a+getValore(x),0);
  const pat=valE+valF+liqE+liqF+monE+monF;
  const pct=Math.min((pat/target)*100,100);

  const etfVal=[...portfolioE,...portfolioF].filter(x=>x.tipo==="ETF"||x.tipo==="ETC").reduce((a,x)=>a+getValore(x),0);
  const bondVal=[...portfolioE,...portfolioF].filter(x=>x.tipo==="Obbligazione").reduce((a,x)=>a+getValore(x),0);
  const bfpVal=[...portfolioE,...portfolioF].filter(x=>x.tipo==="BFP").reduce((a,x)=>a+getValore(x),0);
  const liqTot=liqE+liqF+monE+monF;
  const totFin=etfVal+bondVal+bfpVal+liqTot||1;
  const etfPct=etfVal/totFin*100;

  const entrate=transactions.filter(t=>t.tipo==="entrata").reduce((s,t)=>s+t.importo,0);
  const uscite=transactions.filter(t=>t.tipo==="uscita").reduce((s,t)=>s+t.importo,0);
  const sr=entrate>0?((entrate-uscite)/entrate*100):0;

  const proiezione=useMemo(()=>{
    const aa=Array.from({length:16},(_,i)=>2026+i);
    const Cp=calcolaProiezione(pat,s.risparmioAnnuo,15,s.rendConservativo);
    const Bp=calcolaProiezione(pat,s.risparmioAnnuo,15,s.rendBase);
    const Op=calcolaProiezione(pat,s.risparmioAnnuo,15,s.rendOttimistico);
    return aa.map((a,i)=>({anno:a,conservativo:Cp[i],base:Bp[i],ottimistico:Op[i],target}));
  },[pat,s]);

  const alloc=[
    {name:"ETF/ETC",value:Math.round(etfVal),pct:etfPct,target:57.5,color:C.green},
    {name:"Obbligazioni",value:Math.round(bondVal),pct:bondVal/totFin*100,target:27.5,color:C.accent2},
    {name:"BFP",value:Math.round(bfpVal),pct:bfpVal/totFin*100,target:0,color:C.warn},
    {name:"Liquidità/Mon.",value:Math.round(liqTot),pct:liqTot/totFin*100,target:15,color:C.monetario},
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card accent>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
          <span style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>🎯 FIRE Progress — Target {s.annoFire} · SWR {s.swr}%</span>
          <span style={{fontSize:24,fontWeight:700,color:C.accent,fontFamily:"Georgia,serif"}}>{pct.toFixed(1)}%</span>
        </div>
        <ProgressBar pct={pct} color={`linear-gradient(90deg,${C.accent},${C.accent2})`} height={12}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,color:C.muted}}>
          <span>{fmt(pat)} attuale</span>
          <span>Target {fmt(target)} · {anni} anni</span>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        <KPI label="Patrimonio Fin." value={fmt(pat)} sub="Portafogli + liquidità" color={C.accent}/>
        <KPI label="Savings Rate" value={`${sr.toFixed(1)}%`} sub={`Risparmio: ${fmt(entrate-uscite)}`} color={sr>=35?C.green:C.warn}/>
        <KPI label="ETF Azionario" value={`${etfPct.toFixed(1)}%`} sub={`Target 57,5% · delta ${(etfPct-57.5).toFixed(1)}pp`} color={etfPct<40?C.danger:C.warn}/>
        <KPI label="Target FIRE" value={fmt(target)} sub={`€${s.spesaAnnuaFire.toLocaleString()}/anno · SWR ${s.swr}%`}/>
      </div>

      <Card>
        <SH title="Proiezione FIRE 2026–2041" icon="📈"/>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={proiezione}>
            <XAxis dataKey="anno" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={fmtK} tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} width={40}/>
            <Tooltip formatter={v=>fmt(v)} contentStyle={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
            <Line type="monotone" dataKey="conservativo" stroke={C.warn} strokeWidth={1.5} dot={false} name={`Cons. ${s.rendConservativo}%`}/>
            <Line type="monotone" dataKey="base" stroke={C.accent} strokeWidth={2.5} dot={false} name={`Base ${s.rendBase}%`}/>
            <Line type="monotone" dataKey="ottimistico" stroke={C.green} strokeWidth={1.5} dot={false} name={`Ott. ${s.rendOttimistico}%`}/>
            <Line type="monotone" dataKey="target" stroke={C.danger} strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="Target FIRE"/>
            <Legend wrapperStyle={{fontSize:10,color:C.muted}}/>
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <SH title="Asset Allocation vs Target" icon="🥧"/>
        {alloc.map(a=>{
          const diff=a.pct-a.target;
          return (
            <div key={a.name} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontSize:12,color:C.text}}>{a.name} — {fmt(a.value)}</span>
                <span style={{fontSize:11,fontFamily:"monospace",color:diff<-10?C.danger:Math.abs(diff)<5?C.green:C.warn}}>
                  {a.pct.toFixed(1)}% {a.target>0&&`(${diff>0?"+":""}${diff.toFixed(1)}pp)`}
                </span>
              </div>
              <ProgressBar pct={a.pct} color={a.color}/>
              <div style={{fontSize:10,color:C.muted,marginTop:2}}>target {a.target}%</div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ─── TRANSAZIONI ─────────────────────────────────────────────────────────────
function Transazioni({transactions,setTransactions,categories,settings:s}) {
  const [showModal,setShowModal]=useState(false);
  const [confirmDel,setConfirmDel]=useState(null);
  const [fu,setFu]=useState("tutti");
  const [ft,setFt]=useState("tutti");
  const [fm,setFm]=useState("");
  const [form,setForm]=useState({data:today(),importo:"",tipo:"uscita",cat:categories[0],utente:"Comune",note:""});

  const filtered=[...transactions].filter(t=>{
    if(fu!=="tutti"&&t.utente!==fu)return false;
    if(ft!=="tutti"&&t.tipo!==ft)return false;
    if(fm&&!t.data.startsWith(fm))return false;
    return true;
  }).sort((a,b)=>b.data.localeCompare(a.data));

  const totE=filtered.filter(t=>t.tipo==="entrata").reduce((s,t)=>s+t.importo,0);
  const totU=filtered.filter(t=>t.tipo==="uscita").reduce((s,t)=>s+t.importo,0);

  function salva() {
    if(!form.importo||!form.data)return;
    setTransactions(p=>[...p,{...form,id:Date.now(),importo:parseFloat(form.importo)}]);
    setShowModal(false);
    setForm({data:today(),importo:"",tipo:"uscita",cat:categories[0],utente:"Comune",note:""});
  }

  const uCol=(u)=>u===s.nomeA?C.accent2:u===s.nomeB?C.irene:C.muted;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <h2 style={{margin:0,fontSize:16,color:C.text}}>💸 Transazioni</h2>
        <Btn variant="primary" onClick={()=>setShowModal(true)}>+ Nuova</Btn>
      </div>
      <Card>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
          <Sel label="Utente" value={fu} onChange={e=>setFu(e.target.value)} options={[{value:"tutti",label:"Tutti"},{value:s.nomeA,label:s.nomeA},{value:s.nomeB,label:s.nomeB},{value:"Comune",label:"Comune"}]}/>
          <Sel label="Tipo" value={ft} onChange={e=>setFt(e.target.value)} options={[{value:"tutti",label:"Tutti"},{value:"entrata",label:"Entrate"},{value:"uscita",label:"Uscite"}]}/>
          <Inp label="Mese" type="month" value={fm} onChange={e=>setFm(e.target.value)}/>
          <div style={{display:"flex",gap:10,marginLeft:"auto",alignItems:"center"}}>
            <span style={{fontSize:12,color:C.green}}>▲ {fmt(totE)}</span>
            <span style={{fontSize:12,color:C.danger}}>▼ {fmt(totU)}</span>
            <span style={{fontSize:13,fontWeight:700,color:(totE-totU)>=0?C.green:C.danger}}>= {fmt(totE-totU)}</span>
          </div>
        </div>
      </Card>
      <Card>
        <Table
          cols={[
            {key:"data",label:"Data"},
            {key:"utente",label:"Chi",render:r=><Pill label={r.utente} color={uCol(r.utente)}/>},
            {key:"cat",label:"Categoria"},
            {key:"tipo",label:"",render:r=><Pill label={r.tipo} color={r.tipo==="entrata"?C.green:C.danger}/>},
            {key:"importo",label:"Importo",right:true,mono:true,render:r=><span style={{color:r.tipo==="entrata"?C.green:C.danger}}>{r.tipo==="entrata"?"+":"-"}{fmt(r.importo)}</span>},
            {key:"del",label:"",render:r=><Btn small variant="danger" onClick={()=>setConfirmDel(r.id)}>✕</Btn>},
          ]}
          rows={filtered} emptyMsg="Nessuna transazione"
        />
      </Card>
      {confirmDel&&<ConfirmModal msg="Eliminare questa transazione?" onConfirm={()=>{setTransactions(p=>p.filter(t=>t.id!==confirmDel));setConfirmDel(null);}} onCancel={()=>setConfirmDel(null)}/>}
      {showModal&&(
        <Modal title="Nuova Transazione" onClose={()=>setShowModal(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Inp label="Data" type="date" value={form.data} onChange={e=>setForm(p=>({...p,data:e.target.value}))}/>
            <Sel label="Tipo" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))} options={[{value:"uscita",label:"Uscita"},{value:"entrata",label:"Entrata"}]}/>
            <Inp label="Importo €" type="number" value={form.importo} onChange={e=>setForm(p=>({...p,importo:e.target.value}))}/>
            <Sel label="Categoria" value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))} options={categories}/>
            <Sel label="Utente" value={form.utente} onChange={e=>setForm(p=>({...p,utente:e.target.value}))} options={[s.nomeA,s.nomeB,"Comune"]}/>
            <Inp label="Note" value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))}/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
              <Btn onClick={()=>setShowModal(false)}>Annulla</Btn>
              <Btn variant="primary" onClick={salva}>Salva</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── BUDGET ──────────────────────────────────────────────────────────────────
function Budget({transactions,budgets,setBudgets,categories}) {
  const anno=new Date().getFullYear();
  const speseCat=useMemo(()=>{
    const m={};
    transactions.filter(t=>t.tipo==="uscita"&&t.data.startsWith(String(anno))).forEach(t=>{m[t.cat]=(m[t.cat]||0)+t.importo;});
    return m;
  },[transactions,anno]);
  const totBudget=Object.values(budgets).reduce((s,v)=>s+v,0);
  const totSpeso=Object.values(speseCat).reduce((s,v)=>s+v,0);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <h2 style={{margin:0,fontSize:16,color:C.text}}>📊 Budget {anno}</h2>
        <div style={{display:"flex",gap:12,fontSize:12}}>
          <span style={{color:C.muted}}>Budget: <b style={{color:C.text}}>{fmt(totBudget)}</b></span>
          <span style={{color:C.muted}}>Speso: <b style={{color:totSpeso>totBudget?C.danger:C.text}}>{fmt(totSpeso)}</b></span>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
        {categories.filter(c=>!["Stipendio","Cedole","Rimborsi"].includes(c)).map(cat=>{
          const budget=budgets[cat]||0;const speso=speseCat[cat]||0;
          const pct=budget>0?Math.min(speso/budget*100,100):0;
          const over=speso>budget&&budget>0;const w80=pct>=80&&!over;
          return (
            <Card key={cat} style={{borderColor:over?C.danger+"66":w80?C.warn+"55":C.border}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:12,fontWeight:600,color:C.text}}>{cat}</span>
                {over&&<Pill label="SFORATO" color={C.danger}/>}
                {w80&&<Pill label=">80%" color={C.warn}/>}
              </div>
              <ProgressBar pct={pct} color={over?C.danger:w80?C.warn:C.accent} height={6}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,margin:"5px 0"}}>
                <span>{fmt(speso)}</span><span>{fmt(budget)}</span>
              </div>
              <input type="number" placeholder="Budget €" value={budget||""} onChange={e=>setBudgets(p=>({...p,[cat]:parseFloat(e.target.value)||0}))}
                style={{marginTop:8,background:C.surface3,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 8px",color:C.text,fontSize:11,width:"100%",outline:"none"}}/>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── CALENDARIO ──────────────────────────────────────────────────────────────
function Calendario({forecasts,setForecasts,setTransactions,categories,settings:s}) {
  const [showModal,setShowModal]=useState(false);
  const [confirmDel,setConfirmDel]=useState(null);
  const [form,setForm]=useState({data:"",importo:"",tipo:"uscita",cat:categories[0],utente:"Comune",desc:"",stato:"previsto"});

  function converti(f) {
    setTransactions(p=>[...p,{id:Date.now(),data:f.data,importo:f.importo,tipo:f.tipo,cat:f.cat,utente:f.utente,note:f.desc}]);
    setForecasts(p=>p.map(x=>x.id===f.id?{...x,stato:"pagato"}:x));
  }

  function salva() {
    if(!form.importo||!form.data)return;
    setForecasts(p=>[...p,{...form,id:Date.now(),importo:parseFloat(form.importo)}]);
    setShowModal(false);
  }

  const sorted=[...forecasts].sort((a,b)=>a.data.localeCompare(b.data));
  const uCol=(u)=>u===s.nomeA?C.accent2:u===s.nomeB?C.irene:C.muted;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <h2 style={{margin:0,fontSize:16,color:C.text}}>📅 Calendario Finanziario</h2>
        <Btn variant="primary" onClick={()=>setShowModal(true)}>+ Evento</Btn>
      </div>
      <Card>
        <Table
          cols={[
            {key:"data",label:"Data"},
            {key:"desc",label:"Descrizione"},
            {key:"utente",label:"Chi",render:r=><Pill label={r.utente} color={uCol(r.utente)}/>},
            {key:"tipo",label:"",render:r=><Pill label={r.tipo} color={r.tipo==="entrata"?C.green:C.danger}/>},
            {key:"importo",label:"Importo",right:true,mono:true,render:r=>fmt(r.importo)},
            {key:"stato",label:"Stato",render:r=><Pill label={r.stato} color={r.stato==="pagato"?C.green:r.stato==="confermato"?C.accent:C.muted}/>},
            {key:"az",label:"",render:r=>r.stato!=="pagato"&&(
              <div style={{display:"flex",gap:4}}>
                <Btn small variant="primary" onClick={()=>converti(r)}>→</Btn>
                <Btn small variant="danger" onClick={()=>setConfirmDel(r.id)}>✕</Btn>
              </div>
            )},
          ]}
          rows={sorted} emptyMsg="Nessun evento"
        />
      </Card>
      {confirmDel&&<ConfirmModal msg="Eliminare evento?" onConfirm={()=>{setForecasts(p=>p.filter(x=>x.id!==confirmDel));setConfirmDel(null);}} onCancel={()=>setConfirmDel(null)}/>}
      {showModal&&(
        <Modal title="Nuovo Evento Previsionale" onClose={()=>setShowModal(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Inp label="Data prevista" type="date" value={form.data} onChange={e=>setForm(p=>({...p,data:e.target.value}))}/>
            <Sel label="Tipo" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))} options={[{value:"uscita",label:"Uscita"},{value:"entrata",label:"Entrata"}]}/>
            <Inp label="Importo stimato €" type="number" value={form.importo} onChange={e=>setForm(p=>({...p,importo:e.target.value}))}/>
            <Sel label="Categoria" value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))} options={categories}/>
            <Sel label="Utente" value={form.utente} onChange={e=>setForm(p=>({...p,utente:e.target.value}))} options={[s.nomeA,s.nomeB,"Comune"]}/>
            <Inp label="Descrizione" value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))}/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
              <Btn onClick={()=>setShowModal(false)}>Annulla</Btn>
              <Btn variant="primary" onClick={salva}>Salva</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PORTAFOGLIO ─────────────────────────────────────────────────────────────
function PortafoglioUtente({label,color,items,setItems,liquidity,setLiquidity,monetary,setMonetary,targetUniv}) {
  const [filtro,setFiltro]=useState("tutti");
  const [showAdd,setShowAdd]=useState(false);
  const [showNavId,setShowNavId]=useState(null);
  const [confirmDel,setConfirmDel]=useState(null);
  const [navVal,setNavVal]=useState("");
  const [form,setForm]=useState({nome:"",isin:"",tipo:"ETF",qty:"",nominale:"",carico:"",nav:""});

  const tipi=["tutti","ETF","ETC","Obbligazione","BFP","Libretto","Monetario"];
  const filtered=filtro==="tutti"?items:items.filter(x=>x.tipo===filtro);
  const totPorta=items.reduce((s,x)=>s+getValore(x),0);
  const totLiq=liquidity.reduce((s,x)=>s+x.importo,0);
  const totMon=monetary?monetary.reduce((s,x)=>s+getValore(x),0):0;
  const totale=totPorta+totLiq+totMon;
  const etfVal=items.filter(x=>x.tipo==="ETF"||x.tipo==="ETC").reduce((s,x)=>s+getValore(x),0);

  function salva() {
    if(!form.nome)return;
    const isQty=!["BFP","Libretto"].includes(form.tipo);
    const isObb=form.tipo==="Obbligazione";
    setItems(p=>[...p,{...form,id:Date.now(),
      qty:isQty&&!isObb?parseFloat(form.qty)||0:undefined,
      nominale:isObb?parseFloat(form.nominale)||0:undefined,
      carico:parseFloat(form.carico)||0,
      nav:parseFloat(form.nav)||0,
    }]);
    setShowAdd(false);
    setForm({nome:"",isin:"",tipo:"ETF",qty:"",nominale:"",carico:"",nav:""});
  }

  function aggiornaNav(id) {
    setItems(p=>p.map(x=>x.id===id?{...x,nav:parseFloat(navVal)||x.nav}:x));
    setShowNavId(null);setNavVal("");
  }

  const tipoColor=(t)=>t==="ETF"||t==="ETC"?C.green:t==="Obbligazione"?C.accent2:t==="BFP"||t==="Libretto"?C.warn:t==="Monetario"?C.monetario:C.muted;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        <KPI label="Totale" value={fmt(totale)} sub={`Strumenti ${fmt(totPorta)} + Liq. ${fmt(totLiq)}`} color={color}/>
        <KPI label="ETF Azionari" value={fmt(etfVal)} sub={totPorta>0?`${(etfVal/totPorta*100).toFixed(1)}% portafoglio`:""} color={C.green}/>
        {targetUniv&&<KPI label="🎓 Fondo Università" value={fmt(totale)} sub={`Target ${fmt(targetUniv)} · ${((totale/targetUniv)*100).toFixed(0)}%`} color={C.irene}/>}
        {!targetUniv&&<KPI label="Monetario" value={fmt(totMon)} sub="Fondo emergenza" color={C.monetario}/>}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {tipi.map(t=><Btn key={t} small onClick={()=>setFiltro(t)} style={{background:filtro===t?C.accent2:C.surface3,color:filtro===t?"#fff":C.muted}}>{t}</Btn>)}
        </div>
        <Btn variant="primary" small onClick={()=>setShowAdd(true)}>+ Strumento</Btn>
      </div>

      <Card>
        <Table
          cols={[
            {key:"nome",label:"Strumento"},
            {key:"tipo",label:"Tipo",render:r=><Pill label={r.tipo} color={tipoColor(r.tipo)}/>},
            {key:"nav",label:"NAV",right:true,mono:true,render:r=>r.tipo==="BFP"||r.tipo==="Libretto"?fmt(r.nav):`€${(r.nav||0).toFixed(2)}`},
            {key:"valore",label:"Valore",right:true,mono:true,color:()=>C.accent,render:r=>fmt(getValore(r))},
            {key:"pl",label:"P&L",right:true,render:r=>{
              const isAbs=r.tipo==="BFP"||r.tipo==="Libretto";
              const pl=isAbs?r.nav-r.carico:(r.nav-r.carico)/r.carico*100;
              return <span style={{color:pl>=0?C.green:C.danger}}>{pl>=0?"+":""}{isAbs?fmt(pl):pl.toFixed(1)+"%"}</span>;
            }},
            {key:"az",label:"",render:r=>(
              <div style={{display:"flex",gap:3}}>
                <Btn small onClick={()=>{setShowNavId(r.id);setNavVal(r.nav);}}>NAV</Btn>
                <Btn small variant="danger" onClick={()=>setConfirmDel(r.id)}>✕</Btn>
              </div>
            )},
          ]}
          rows={filtered}
        />
      </Card>

      <Card>
        <SH title="Liquidità" icon="🏦"/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
          {liquidity.map((l,i)=>(
            <div key={l.id} style={{background:C.surface2,borderRadius:8,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:C.muted,flex:1}}>{l.nome}</span>
              <input type="number" value={l.importo} onChange={e=>setLiquidity(p=>p.map((x,j)=>j===i?{...x,importo:parseFloat(e.target.value)||0}:x))}
                style={{width:80,background:C.surface3,border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 7px",color:C.text,fontSize:12,textAlign:"right",outline:"none"}}/>
            </div>
          ))}
          <Btn small variant="ghost" onClick={()=>setLiquidity(p=>[...p,{id:Date.now(),nome:"Nuovo conto",importo:0}])}>+ Conto</Btn>
        </div>
      </Card>

      {monetary&&<Card>
        <SH title="ETF Monetari (es. XEON)" icon="🔵"/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8,marginBottom:8}}>
          {monetary.map((m,i)=>(
            <div key={m.id} style={{background:C.surface2,borderRadius:8,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:12,color:C.text}}>{m.nome}</div>
                <div style={{fontSize:10,color:C.muted}}>{m.qty} × €{m.nav?.toFixed(2)}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                <span style={{fontSize:13,fontWeight:700,color:C.monetario}}>{fmt(getValore(m))}</span>
                <input type="number" placeholder="NAV" value={m.nav||""} onChange={e=>setMonetary(p=>p.map((x,j)=>j===i?{...x,nav:parseFloat(e.target.value)||0}:x))}
                  style={{width:65,background:C.surface3,border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 6px",color:C.text,fontSize:11,textAlign:"right",outline:"none"}}/>
              </div>
            </div>
          ))}
        </div>
        <Btn small variant="ghost" onClick={()=>setMonetary(p=>[...p,{id:Date.now(),nome:"XEON",isin:"LU0290358497",tipo:"Monetario",qty:0,carico:0,nav:0}])}>+ ETF Monetario</Btn>
      </Card>}

      {confirmDel&&<ConfirmModal msg="Eliminare strumento?" onConfirm={()=>{setItems(p=>p.filter(x=>x.id!==confirmDel));setConfirmDel(null);}} onCancel={()=>setConfirmDel(null)}/>}
      {showNavId&&<Modal title="Aggiorna NAV" onClose={()=>setShowNavId(null)}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Inp label="Nuovo NAV" type="number" value={navVal} onChange={e=>setNavVal(e.target.value)}/>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>setShowNavId(null)}>Annulla</Btn>
            <Btn variant="primary" onClick={()=>aggiornaNav(showNavId)}>Aggiorna</Btn>
          </div>
        </div>
      </Modal>}
      {showAdd&&<Modal title="Aggiungi Strumento" onClose={()=>setShowAdd(false)}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Inp label="Nome" value={form.nome} onChange={e=>setForm(p=>({...p,nome:e.target.value}))}/>
          <Inp label="ISIN (opzionale)" value={form.isin} onChange={e=>setForm(p=>({...p,isin:e.target.value}))}/>
          <Sel label="Tipo" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))} options={["ETF","ETC","Obbligazione","BFP","Libretto","Monetario"]}/>
          {form.tipo==="Obbligazione"&&<Inp label="Nominale (€)" type="number" value={form.nominale} onChange={e=>setForm(p=>({...p,nominale:e.target.value}))}/>}
          {!["BFP","Libretto"].includes(form.tipo)&&form.tipo!=="Obbligazione"&&<Inp label="Quantità" type="number" value={form.qty} onChange={e=>setForm(p=>({...p,qty:e.target.value}))}/>}
          <Inp label={["BFP","Libretto"].includes(form.tipo)?"Versato (€)":"Prezzo carico (€)"} type="number" value={form.carico} onChange={e=>setForm(p=>({...p,carico:e.target.value}))}/>
          <Inp label={["BFP","Libretto"].includes(form.tipo)?"Valore attuale (€)":form.tipo==="Obbligazione"?"Prezzo attuale (%)":"NAV (€)"} type="number" value={form.nav} onChange={e=>setForm(p=>({...p,nav:e.target.value}))}/>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
            <Btn onClick={()=>setShowAdd(false)}>Annulla</Btn>
            <Btn variant="primary" onClick={salva}>Salva</Btn>
          </div>
        </div>
      </Modal>}
    </div>
  );
}

function Portafoglio({portfolioE,setPortfolioE,portfolioF,setPortfolioF,portfolioI,setPortfolioI,liquidityE,setLiquidityE,liquidityF,setLiquidityF,liquidityI,setLiquidityI,monetaryE,setMonetaryE,monetaryF,setMonetaryF,settings:s}) {
  const [sub,setSub]=useState(0);
  const tabs=[s.nomeA,s.nomeB,s.nomeC];
  const colors=[C.accent2,C.irene,C.irene];
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <h2 style={{margin:0,fontSize:16,color:C.text}}>💼 Portafoglio</h2>
        <div style={{display:"flex",gap:6}}>
          {tabs.map((t,i)=><Btn key={t} onClick={()=>setSub(i)} style={{background:sub===i?colors[i]:C.surface3,color:sub===i?"#fff":C.muted,fontWeight:sub===i?700:400}}>{t}</Btn>)}
        </div>
      </div>
      {sub===0&&<PortafoglioUtente label={s.nomeA} color={C.accent2} items={portfolioF} setItems={setPortfolioF} liquidity={liquidityF} setLiquidity={setLiquidityF} monetary={monetaryF} setMonetary={setMonetaryF}/>}
      {sub===1&&<PortafoglioUtente label={s.nomeB} color={C.irene} items={portfolioE} setItems={setPortfolioE} liquidity={liquidityE} setLiquidity={setLiquidityE} monetary={monetaryE} setMonetary={setMonetaryE}/>}
      {sub===2&&<PortafoglioUtente label={s.nomeC} color={C.irene} items={portfolioI} setItems={setPortfolioI} liquidity={liquidityI} setLiquidity={setLiquidityI} targetUniv={s.targetIrene}/>}
    </div>
  );
}

// ─── SCADENZE ─────────────────────────────────────────────────────────────────
function Scadenze({forecasts,loanPayments}) {
  const now=today();
  const p30=new Date();p30.setDate(p30.getDate()+30);
  const p30s=p30.toISOString().slice(0,10);
  const urgCol={SCADUTO:C.danger,IMMINENTE:C.warn,PIANIFICATO:C.muted};
  const eventi=[
    ...forecasts.filter(f=>f.stato!=="pagato").map(f=>({
      data:f.data,evento:f.desc,importo:f.importo,utente:f.utente,tipo:f.tipo,
      urgenza:f.data<=now?"SCADUTO":f.data<=p30s?"IMMINENTE":"PIANIFICATO",
    })),
    ...loanPayments.filter(r=>!r.pagata).slice(0,3).map(r=>({
      data:"mensile",evento:`Rata #${r.id} Prestito Auto`,importo:250,utente:"Francesco",tipo:"uscita",urgenza:"IMMINENTE"
    })),
  ].sort((a,b)=>a.data.localeCompare(b.data));

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <h2 style={{margin:0,fontSize:16,color:C.text}}>⚡ Scadenze & Azioni</h2>
      {eventi.length===0&&<Card><div style={{color:C.muted,textAlign:"center",padding:20}}>Nessuna scadenza</div></Card>}
      {eventi.map((e,i)=>(
        <div key={i} style={{background:C.surface,border:`1px solid ${urgCol[e.urgenza]}44`,borderLeft:`3px solid ${urgCol[e.urgenza]}`,borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
              <Pill label={e.urgenza} color={urgCol[e.urgenza]}/>
              <span style={{fontSize:12,color:C.text,fontWeight:600}}>{e.evento}</span>
            </div>
            <div style={{fontSize:11,color:C.muted}}>{e.data} · {e.utente}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:16,fontWeight:700,color:e.tipo==="entrata"?C.green:C.warn,fontFamily:"Georgia,serif"}}>{fmt(e.importo)}</div>
            <div style={{fontSize:10,color:C.muted}}>{e.tipo}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PRESTITO AUTO ────────────────────────────────────────────────────────────
function PrestitoAuto({loanPayments,setLoanPayments}) {
  const [confirmId,setConfirmId]=useState(null);
  const pagate=loanPayments.filter(r=>r.pagata).length;
  const residuo=loanPayments.filter(r=>!r.pagata).reduce((s,r)=>s+r.importo,0);
  const pct=(pagate/loanPayments.length)*100;

  function togglePagata(id,toMark) {
    if(toMark){setConfirmId(id);}
    else setLoanPayments(p=>p.map(r=>r.id===id?{...r,pagata:false,dataPagamento:null}:r));
  }
  function conferma() {
    setLoanPayments(p=>p.map(r=>r.id===confirmId?{...r,pagata:true,dataPagamento:today()}:r));
    setConfirmId(null);
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <h2 style={{margin:0,fontSize:16,color:C.text}}>🚗 Prestito Auto</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        <KPI label="Rate Pagate" value={`${pagate}/54`} sub={fmt(pagate*250)+" versati"} color={C.green}/>
        <KPI label="Debito Residuo" value={fmt(residuo)} sub={`${54-pagate} rate rimanenti`} color={residuo>0?C.warn:C.green}/>
      </div>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
          <SH title="Piano Rate" icon="📋"/>
          <span style={{fontSize:12,color:C.muted}}>{pct.toFixed(0)}% completato</span>
        </div>
        <ProgressBar pct={pct} color={`linear-gradient(90deg,${C.accent},${C.green})`} height={8}/>
        <div style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:5,maxHeight:380,overflowY:"auto"}}>
          {loanPayments.map(r=>(
            <div key={r.id} onClick={()=>togglePagata(r.id,!r.pagata)} style={{background:r.pagata?C.green+"22":C.surface2,border:`1px solid ${r.pagata?C.green+"55":C.border}`,borderRadius:8,padding:"7px 8px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:10,color:C.muted}}>#{r.id}</div>
              <div style={{fontSize:11,color:r.pagata?C.green:C.text,fontWeight:600}}>{r.mese}</div>
              {r.pagata&&<div style={{fontSize:9,color:C.green}}>✓</div>}
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:C.muted,marginTop:10}}>Clicca una rata per marcarla come pagata</div>
      </Card>
      {confirmId&&<ConfirmModal msg={`Segnare la rata #${confirmId} come pagata?`} onConfirm={conferma} onCancel={()=>setConfirmId(null)}/>}
    </div>
  );
}

// ─── DECISIONI ────────────────────────────────────────────────────────────────
function Decisioni({decisioni,setDecisioni}) {
  const [editId,setEditId]=useState(null);
  const [form,setForm]=useState({titolo:"",testo:""});
  const [showAdd,setShowAdd]=useState(false);

  function salva() {
    if(!form.titolo)return;
    if(editId){setDecisioni(p=>p.map(d=>d.id===editId?{...d,...form}:d));setEditId(null);}
    else setDecisioni(p=>[...p,{...form,id:Date.now()}]);
    setShowAdd(false);setForm({titolo:"",testo:""});
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div>
          <h2 style={{margin:0,fontSize:16,color:C.text}}>📖 Decisioni del Piano</h2>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>Le scelte strategiche del piano FIRE</div>
        </div>
        <Btn variant="primary" onClick={()=>{setEditId(null);setForm({titolo:"",testo:""});setShowAdd(true);}}>+ Aggiungi</Btn>
      </div>
      {decisioni.map((d,i)=>(
        <Card key={d.id}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <span style={{background:C.accent+"22",color:C.accent,borderRadius:6,width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>{i+1}</span>
                <span style={{fontSize:14,fontWeight:600,color:C.text}}>{d.titolo}</span>
              </div>
              <p style={{margin:0,fontSize:13,color:C.muted,lineHeight:1.6}}>{d.testo}</p>
            </div>
            <Btn small onClick={()=>{setEditId(d.id);setForm({titolo:d.titolo,testo:d.testo});setShowAdd(true);}}>✏</Btn>
          </div>
        </Card>
      ))}
      {showAdd&&(
        <Modal title={editId?"Modifica decisione":"Nuova decisione"} onClose={()=>{setShowAdd(false);setEditId(null);}} wide>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Inp label="Titolo" value={form.titolo} onChange={e=>setForm(p=>({...p,titolo:e.target.value}))}/>
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              <label style={{fontSize:11,color:C.muted}}>Descrizione</label>
              <textarea value={form.testo} onChange={e=>setForm(p=>({...p,testo:e.target.value}))} rows={5}
                style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 11px",color:C.text,fontSize:13,outline:"none",resize:"vertical",fontFamily:"inherit"}}/>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
              <Btn onClick={()=>{setShowAdd(false);setEditId(null);}}>Annulla</Btn>
              <Btn variant="primary" onClick={salva}>Salva</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── IMPOSTAZIONI ─────────────────────────────────────────────────────────────
function Impostazioni({settings,setSettings,categories,setCategories}) {
  const [newCat,setNewCat]=useState("");
  const s=settings;
  const set=(k,v)=>setSettings(p=>({...p,[k]:v}));
  const F=({label,field,type="text"})=>(
    <Inp label={label} type={type} value={s[field]??""} onChange={e=>set(field,type==="number"?parseFloat(e.target.value)||0:e.target.value)}/>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <h2 style={{margin:0,fontSize:16,color:C.text}}>⚙️ Impostazioni</h2>
      <Card><SH title="Profilo Famiglia" icon="👨‍👩‍👧"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <F label="Nome A" field="nomeA"/><F label="Età A" field="etaA" type="number"/>
          <F label="Nome B" field="nomeB"/><F label="Età B" field="etaB" type="number"/>
          <F label="Nome C (figlia)" field="nomeC"/><F label="Target università €" field="targetIrene" type="number"/>
        </div>
      </Card>
      <Card><SH title="Parametri FIRE" icon="🎯"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <F label="Anno FIRE" field="annoFire" type="number"/><F label="Spesa annua €" field="spesaAnnuaFire" type="number"/>
          <F label="SWR %" field="swr" type="number"/><F label="Risparmio annuo €" field="risparmioAnnuo" type="number"/>
          <F label="Rend. cons. %" field="rendConservativo" type="number"/><F label="Rend. base %" field="rendBase" type="number"/>
          <F label="Rend. ott. %" field="rendOttimistico" type="number"/>
        </div>
      </Card>
      <Card><SH title="Soglie C/C" icon="🚦"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <F label="Soglia minima €" field="sogliaMinCC" type="number"/>
          <F label="Soglia investimento €" field="sogliaInvestCC" type="number"/>
        </div>
        <div style={{marginTop:12,background:C.surface2,borderRadius:8,padding:"10px 14px",fontSize:12}}>
          {[
            {z:"🔴",col:C.danger,desc:`C/C < €${s.sogliaMinCC?.toLocaleString()} → Non investire`},
            {z:"🟡",col:C.warn,desc:`€${s.sogliaMinCC?.toLocaleString()} – €${s.sogliaInvestCC?.toLocaleString()} → Accumulare`},
            {z:"🟢",col:C.green,desc:`C/C > €${s.sogliaInvestCC?.toLocaleString()} → Investire in SWDA+EIMI`},
          ].map(({z,col,desc})=>(
            <div key={z} style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}>
              <span style={{fontSize:11,color:col,fontWeight:700}}>{z}</span>
              <span style={{fontSize:11,color:C.muted}}>{desc}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card><SH title="Categorie" icon="🏷️"/>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
          {categories.map(c=>(
            <div key={c} style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:20,padding:"4px 12px",fontSize:12,color:C.text,display:"flex",alignItems:"center",gap:6}}>
              {c}<span onClick={()=>setCategories(p=>p.filter(x=>x!==c))} style={{cursor:"pointer",color:C.muted,fontSize:10}}>✕</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="Nuova categoria..."
            style={{flex:1,background:C.surface3,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 11px",color:C.text,fontSize:13,outline:"none"}}/>
          <Btn variant="primary" onClick={()=>{if(newCat.trim()){setCategories(p=>[...p,newCat.trim()]);setNewCat("");}}}>Aggiungi</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS=[
  {id:"dashboard",label:"Dashboard",icon:"🏠"},
  {id:"transazioni",label:"Transazioni",icon:"💸"},
  {id:"budget",label:"Budget",icon:"📊"},
  {id:"calendario",label:"Calendario",icon:"📅"},
  {id:"portafoglio",label:"Portafoglio",icon:"💼"},
  {id:"scadenze",label:"Scadenze",icon:"⚡"},
  {id:"prestito",label:"Prestito Auto",icon:"🚗"},
  {id:"decisioni",label:"Decisioni Piano",icon:"📖"},
  {id:"impostazioni",label:"Impostazioni",icon:"⚙️"},
];

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile=useIsMobile();
  const [session,setSession]=useState(null);
  const [tab,setTab]=useState("dashboard");
  const [sidebarOpen,setSidebarOpen]=useState(!isMobile);
  const [syncStatus,setSyncStatus]=useState("idle");
  const [loadingData,setLoadingData]=useState(false);
  const [appState,setAppStateRaw]=useState(INITIAL_APP_STATE);
  const saveTimerRef=useRef(null);

  const setAppState=useCallback((updater)=>{
    setAppStateRaw(prev=>{
      const next=typeof updater==="function"?updater(prev):updater;
      if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
      setSyncStatus("saving");
      saveTimerRef.current=setTimeout(async()=>{
        if(session?.token){
          try{
            await sb.saveData(session.token,next);
            setSyncStatus("saved");
            setTimeout(()=>setSyncStatus("idle"),2500);
          }catch(e){setSyncStatus("error");}
        }
      },1500);
      return next;
    });
  },[session]);

  const upState=(key)=>(val)=>setAppState(p=>({...p,[key]:typeof val==="function"?val(p[key]):val}));

  async function handleLogin(token,user) {
    setSession({token,user});
    setLoadingData(true);
    try{
      const data=await sb.loadData(token);
      if(data)setAppStateRaw(()=>({...INITIAL_APP_STATE,...data}));
    }catch(e){console.error("Load error",e);}
    setLoadingData(false);
  }

  async function handleLogout() {
    if(session?.token)await sb.signOut(session.token);
    setSession(null);setSyncStatus("idle");
  }

  if(!session)return <LoginScreen onLogin={handleLogin}/>;

  if(loadingData)return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}>
      <div style={{fontSize:48}}>🔥</div>
      <div style={{fontSize:14,color:C.muted}}>Caricamento dati…</div>
    </div>
  );

  const {settings,transactions,forecasts,portfolioE,portfolioF,portfolioI,liquidityE,liquidityF,liquidityI,monetaryE,monetaryF,pension,budgets,loanPayments,categories,decisioni}=appState;
  const SIDEBAR_W=sidebarOpen?210:56;
  function navTo(id){setTab(id);if(isMobile)setSidebarOpen(false);}

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <style>{`
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:${C.bg};}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
        input,select,textarea,button{font-family:inherit;}
      `}</style>

      {isMobile&&sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"#000a",zIndex:150}}/>}

      {/* Sidebar */}
      <div style={{
        position:"fixed",left:0,top:0,bottom:0,width:SIDEBAR_W,
        background:C.surface,borderRight:`1px solid ${C.border}`,
        display:"flex",flexDirection:"column",zIndex:200,
        transition:"width 0.2s ease",overflow:"hidden",
        transform:isMobile&&!sidebarOpen?"translateX(-100%)":"translateX(0)",
      }}>
        <div style={{padding:"14px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,justifyContent:sidebarOpen?"space-between":"center"}}>
          {sidebarOpen&&<div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${C.accent},${C.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🔥</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"Georgia,serif",whiteSpace:"nowrap"}}>FamilyFIRE</div>
              <div style={{fontSize:10,color:C.muted,whiteSpace:"nowrap"}}>Piano 2041</div>
            </div>
          </div>}
          <button onClick={()=>setSidebarOpen(p=>!p)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,width:28,height:28,cursor:"pointer",color:C.muted,fontSize:14,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {sidebarOpen?"←":"☰"}
          </button>
        </div>
        <nav style={{flex:1,padding:"8px 6px",overflowY:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>navTo(t.id)} title={t.label} style={{
              width:"100%",display:"flex",alignItems:"center",gap:10,
              padding:"9px 10px",borderRadius:8,border:"none",cursor:"pointer",marginBottom:2,
              background:tab===t.id?C.accent+"22":"transparent",
              color:tab===t.id?C.accent:C.muted,
              fontWeight:tab===t.id?600:400,fontSize:12,textAlign:"left",
              borderLeft:tab===t.id?`3px solid ${C.accent}`:"3px solid transparent",
              justifyContent:sidebarOpen?"flex-start":"center",
            }}>
              <span style={{fontSize:15,flexShrink:0}}>{t.icon}</span>
              {sidebarOpen&&<span style={{whiteSpace:"nowrap"}}>{t.label}</span>}
            </button>
          ))}
        </nav>
        {sidebarOpen&&<div style={{padding:"10px 14px",borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <SyncBadge status={syncStatus}/>
            <button onClick={handleLogout} style={{background:"transparent",border:"none",fontSize:11,color:C.danger,cursor:"pointer",padding:"2px 6px"}}>Esci</button>
          </div>
          <div style={{fontSize:9,color:C.muted,lineHeight:1.5}}>⚠ Solo scopo informativo.</div>
        </div>}
      </div>

      {/* Mobile topbar */}
      {isMobile&&<div style={{position:"fixed",top:0,left:0,right:0,height:50,background:C.surface,borderBottom:`1px solid ${C.border}`,zIndex:100,display:"flex",alignItems:"center",padding:"0 16px",gap:12}}>
        <button onClick={()=>setSidebarOpen(p=>!p)} style={{background:"transparent",border:"none",color:C.text,fontSize:20,cursor:"pointer"}}>☰</button>
        <span style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:"Georgia,serif"}}>🔥 FamilyFIRE</span>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          <SyncBadge status={syncStatus}/>
          <button onClick={handleLogout} style={{background:"transparent",border:"none",fontSize:11,color:C.danger,cursor:"pointer"}}>Esci</button>
        </div>
      </div>}

      {/* Main content */}
      <div style={{marginLeft:isMobile?0:SIDEBAR_W,padding:isMobile?"66px 14px 30px":"24px 28px 48px",minHeight:"100vh",transition:"margin-left 0.2s ease"}}>
        <div style={{maxWidth:1100}}>
          {tab==="dashboard"&&<Dashboard settings={settings} transactions={transactions} portfolioE={portfolioE} portfolioF={portfolioF} liquidityE={liquidityE} liquidityF={liquidityF} monetaryE={monetaryE} monetaryF={monetaryF}/>}
          {tab==="transazioni"&&<Transazioni transactions={transactions} setTransactions={upState("transactions")} categories={categories} settings={settings}/>}
          {tab==="budget"&&<Budget transactions={transactions} budgets={budgets} setBudgets={upState("budgets")} categories={categories}/>}
          {tab==="calendario"&&<Calendario forecasts={forecasts} setForecasts={upState("forecasts")} setTransactions={upState("transactions")} categories={categories} settings={settings}/>}
          {tab==="portafoglio"&&<Portafoglio portfolioE={portfolioE} setPortfolioE={upState("portfolioE")} portfolioF={portfolioF} setPortfolioF={upState("portfolioF")} portfolioI={portfolioI} setPortfolioI={upState("portfolioI")} liquidityE={liquidityE} setLiquidityE={upState("liquidityE")} liquidityF={liquidityF} setLiquidityF={upState("liquidityF")} liquidityI={liquidityI} setLiquidityI={upState("liquidityI")} monetaryE={monetaryE} setMonetaryE={upState("monetaryE")} monetaryF={monetaryF} setMonetaryF={upState("monetaryF")} settings={settings}/>}
          {tab==="scadenze"&&<Scadenze forecasts={forecasts} loanPayments={loanPayments}/>}
          {tab==="prestito"&&<PrestitoAuto loanPayments={loanPayments} setLoanPayments={upState("loanPayments")}/>}
          {tab==="decisioni"&&<Decisioni decisioni={decisioni} setDecisioni={upState("decisioni")}/>}
          {tab==="impostazioni"&&<Impostazioni settings={settings} setSettings={upState("settings")} categories={categories} setCategories={upState("categories")}/>}
        </div>
      </div>
    </div>
  );
}
