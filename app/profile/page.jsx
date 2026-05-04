"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/payvision/Shell";

const initialForm = {
  firstName: "", lastName: "", dob: "", mobile: "",
  email: "", state: "", city: "", pinCode: "",
  address: "", landmark: "", aadhaar: "", pan: "", profilePhotoUrl: "",
};

const stateOptions = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh",
  "Dadra and Nagar Haveli","Daman and Diu","Delhi","Jammu and Kashmir",
  "Ladakh","Lakshadweep","Puducherry",
];

const AVATAR_COLORS = ["#3B82F6","#10B981","#6366F1","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6"];
function avatarColor(name) {
  let s = 0; for (let i=0;i<(name||"").length;i++) s+=name.charCodeAt(i);
  return AVATAR_COLORS[s % AVATAR_COLORS.length];
}

function validate(name, value) {
  const v = String(value||"").trim();
  if (name==="firstName"||name==="lastName") {
    if (!v) return "Required.";
    if (!/^[a-zA-Z\s\-']+$/.test(v)) return "Letters only.";
    if (v.length<2) return "Min 2 characters.";
  }
  if (name==="city" && v && !/^[a-zA-Z\s\-']+$/.test(v)) return "Letters only.";
  if (name==="email") {
    if (!v) return "Required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Invalid email.";
  }
  if (name==="mobile") {
    if (!v) return "Required.";
    if (!/^[6-9]\d{9}$/.test(v)) return "10-digit mobile starting with 6–9.";
  }
  if (name==="dob" && v) {
    const d=new Date(v),t=new Date();
    if(isNaN(d.getTime())) return "Invalid date.";
    if(d>t) return "Cannot be in the future.";
    if(t.getFullYear()-d.getFullYear()<13) return "Must be at least 13 years old.";
  }
  if (name==="aadhaar" && v && !/^\d{12}$/.test(v)) return "Must be 12 digits.";
  if (name==="pan" && v && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v.toUpperCase())) return "Format: ABCDE1234F";
  if (name==="pinCode" && v && !/^\d{6}$/.test(v)) return "Must be 6 digits.";
  return "";
}

function Avatar({ src, firstName, lastName, size=80 }) {
  const initials = `${(firstName||"")[0]||""}${(lastName||"")[0]||""}`.toUpperCase()||"U";
  const color = avatarColor((firstName||"")+(lastName||""));
  if (src&&(src.startsWith("data:")||src.startsWith("http"))) {
    return <img src={src} alt="Profile" style={{width:size,height:size}} className="rounded-full object-cover border-4 border-white shadow-md" />;
  }
  return (
    <div style={{width:size,height:size,backgroundColor:color,fontSize:size*0.38}} className="rounded-full flex items-center justify-center text-white font-bold border-4 border-white shadow-md select-none">
      {initials}
    </div>
  );
}

function Field({label,name,value,onChange,onBlur,error,type="text",placeholder="",maxLength,hint,required}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}{required&&<span className="text-red-500 ml-0.5">*</span>}</label>
      {hint&&<p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      <input type={type} value={value} placeholder={placeholder} maxLength={maxLength}
        onChange={e=>onChange(name,e.target.value)} onBlur={()=>onBlur(name)}
        className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-cyan-500 ${error?"border-red-400 bg-red-50":"border-slate-200 bg-slate-50 focus:bg-white"}`}
      />
      {error&&<p className="mt-1 flex items-start gap-1 text-xs text-red-600"><span>⚠</span>{error}</p>}
    </div>
  );
}

function SelectField({label,name,value,onChange,onBlur,error,options}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <select value={value} onChange={e=>onChange(name,e.target.value)} onBlur={()=>onBlur(name)}
        className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-cyan-500 ${error?"border-red-400 bg-red-50":"border-slate-200 bg-slate-50 focus:bg-white"}`}>
        <option value="">— Select State —</option>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
      {error&&<p className="mt-1 text-xs text-red-600">⚠ {error}</p>}
    </div>
  );
}

function SectionCard({icon,title,children}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const [form, setForm] = useState(initialForm);
  const [snapshot, setSnapshot] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [toast, setToast] = useState({type:"",msg:""});

  function showToast(type, msg) {
    setToast({type,msg});
    setTimeout(()=>setToast({type:"",msg:""}), 4000);
  }

  // Load profile — show form immediately, populate when data arrives
  useEffect(() => {
    let cancelled = false;
    async function load(retries=2) {
      try {
        const res = await fetch("/api/v1/profile", {cache:"no-store"});
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          if (res.status===401) { setFetchError("Session expired. Please refresh."); return; }
          if (retries>0) { setTimeout(()=>load(retries-1), 800); return; }
          setFetchError(data?.message||"Failed to load profile.");
          return;
        }
        const next = {...initialForm,...(data?.profile||{})};
        setForm(next);
        setSnapshot(next);
        setFetchError("");
      } catch {
        if (cancelled) return;
        if (retries>0) { setTimeout(()=>load(retries-1), 800); return; }
        setFetchError("Network error. Please refresh the page.");
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function updateField(name, raw) {
    let v = raw;
    if (name==="pan") v=raw.toUpperCase();
    if (name==="mobile"||name==="aadhaar"||name==="pinCode") v=raw.replace(/\D/g,"");
    setForm(p=>({...p,[name]:v}));
    if (touched[name]) setErrors(p=>({...p,[name]:validate(name,v)}));
  }

  function handleBlur(name) {
    setTouched(p=>({...p,[name]:true}));
    setErrors(p=>({...p,[name]:validate(name,form[name])}));
  }

  function onFileChange(file) {
    if (!file) return;
    if (file.size>2*1024*1024) { showToast("error","Image must be under 2 MB."); return; }
    const r=new FileReader();
    r.onload=()=>setForm(p=>({...p,profilePhotoUrl:String(r.result||"")}));
    r.readAsDataURL(file);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const allTouched = Object.keys(initialForm).reduce((a,k)=>({...a,[k]:true}),{});
    setTouched(allTouched);
    const allErrors = {};
    Object.keys(initialForm).forEach(k=>{const e=validate(k,form[k]); if(e) allErrors[k]=e;});
    setErrors(allErrors);
    if (Object.values(allErrors).some(Boolean)) { showToast("error","Please fix the errors above."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const data = await res.json();
      if (!res.ok) { showToast("error",data?.message||"Failed to update profile."); return; }
      setSnapshot(form);
      showToast("success","Profile updated successfully!");
    } catch { showToast("error","Network error. Please try again."); }
    finally { setSaving(false); }
  }

  function onReset() {
    setForm(snapshot); setErrors({}); setTouched({});
    showToast("success","Reset to last saved values.");
  }

  const fp = name => ({name,value:form[name],onChange:updateField,onBlur:handleBlur,error:touched[name]?errors[name]||"":""});
  const fullName = [form.firstName,form.lastName].filter(Boolean).join(" ")||"Your Name";

  return (
    <Shell title="My Profile" breadcrumb="Home > Dashboard > Profile">
      <form onSubmit={onSubmit} noValidate className="space-y-5">

        {/* Hero card */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 p-px shadow-sm">
          <div className="rounded-2xl bg-white px-5 py-5 flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="relative flex-shrink-0 flex flex-col items-center gap-2">
              <Avatar src={form.profilePhotoUrl} firstName={form.firstName} lastName={form.lastName} size={84}/>
              <label className="cursor-pointer rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors">
                Change Photo
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>onFileChange(e.target.files?.[0])}/>
              </label>
              {form.profilePhotoUrl&&<button type="button" onClick={()=>setForm(p=>({...p,profilePhotoUrl:""}))} className="text-xs text-red-500 hover:underline">Remove</button>}
              <p className="text-xs text-slate-400">Max 2 MB · JPG/PNG</p>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-bold text-slate-900">{fullName}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{form.email||"—"}</p>
              {form.mobile&&<p className="text-sm text-slate-500">{form.mobile}</p>}
              <div className="mt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                {form.city&&<span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs text-slate-600">📍 {form.city}{form.state?`, ${form.state}`:""}</span>}
                {form.dob&&<span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs text-slate-600">🎂 {new Date(form.dob).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast.msg&&(
          <div className={`rounded-xl border px-4 py-3 flex items-center gap-2 text-sm font-medium ${toast.type==="success"?"bg-emerald-50 border-emerald-300 text-emerald-800":"bg-red-50 border-red-300 text-red-700"}`}>
            {toast.type==="success"?"✓":"⚠"} {toast.msg}
          </div>
        )}
        {fetchError&&(
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            ⚠ {fetchError}
            <button type="button" onClick={()=>window.location.reload()} className="underline font-semibold ml-2">Refresh</button>
          </div>
        )}

        {/* Personal */}
        <SectionCard icon="👤" title="Personal Information">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="First Name" required placeholder="e.g. Ranjan" {...fp("firstName")}/>
            <Field label="Last Name" required placeholder="e.g. Pandit" {...fp("lastName")}/>
            <Field label="Email Address" required type="email" placeholder="name@domain.com" {...fp("email")}/>
            <Field label="Mobile Number" required placeholder="10-digit mobile" maxLength={10} hint="Must start with 6–9" {...fp("mobile")}/>
            <Field label="Date of Birth" type="date" hint="Must be at least 13 years old" {...fp("dob")}/>
          </div>
        </SectionCard>

        {/* KYC */}
        <SectionCard icon="🪪" title="KYC Documents">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Aadhaar Number" placeholder="12-digit Aadhaar" maxLength={12} hint="Government-issued 12-digit ID" {...fp("aadhaar")}/>
            <Field label="PAN Card Number" placeholder="e.g. ABCDE1234F" maxLength={10} hint="5 letters + 4 digits + 1 letter" {...fp("pan")}/>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">🔒 Your KYC details are encrypted and stored securely.</p>
        </SectionCard>

        {/* Address */}
        <SectionCard icon="📍" title="Address Details">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><Field label="Full Address" placeholder="House/Flat No., Street, Area" {...fp("address")}/></div>
            <Field label="Landmark" placeholder="Near temple, opposite school..." {...fp("landmark")}/>
            <Field label="City" placeholder="e.g. Mumbai" {...fp("city")}/>
            <SelectField label="State" options={stateOptions} {...fp("state")}/>
            <Field label="PIN Code" placeholder="6-digit PIN" maxLength={6} hint="6-digit postal code" {...fp("pinCode")}/>
          </div>
        </SectionCard>

        {/* Actions */}
        <div className="flex items-center gap-3 pb-2">
          <button type="submit" disabled={saving} className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-6 py-2.5 text-sm text-white font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity shadow-sm">
            {saving?"Saving...":"Save Changes"}
          </button>
          <button type="button" onClick={onReset} className="rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-sm text-slate-700 font-semibold hover:bg-slate-50 transition-colors">
            Reset
          </button>
        </div>
      </form>
    </Shell>
  );
}
