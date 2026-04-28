"use client";

import { useMemo, useState } from "react";
import Shell from "@/components/payvision/Shell";

const initialForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  aadhaar: "",
  pan: "",
  pincode: "",
  city: "",
  state: "",
  personalAddress: "",
  companyName: "",
  gstNumber: "",
  companyType: "",
  companyWebsite: "",
  officeAddress: "",
  callbackUrl: "",
};

const stateOptions = [
  "Andhra Pradesh",
  "Delhi",
  "Gujarat",
  "Karnataka",
  "Maharashtra",
  "Rajasthan",
  "Tamil Nadu",
  "Uttar Pradesh",
  "West Bengal",
];

const companyTypeOptions = ["Proprietorship", "Partnership", "Private Limited", "LLP", "Public Limited"];

function Field({ label, value, onChange, placeholder = "", type = "text", required = false }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-800">{label}{required ? " *" : ""}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, required = false }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-800">{label}{required ? " *" : ""}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
      >
        <option value="">-Please Select-</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder = "", required = false }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-800">{label}{required ? " *" : ""}</label>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
      />
    </div>
  );
}

export default function NewMerchantRegistrationPage() {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [createdMerchantId, setCreatedMerchantId] = useState("");
  const [clientCredentials, setClientCredentials] = useState(null);

  const missingRequired = useMemo(() => {
    return !form.firstName || !form.lastName || !form.email || !form.phone || !form.companyName;
  }, [form]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onReset() {
    setForm(initialForm);
    setMessage("Form reset.");
    setCreatedMerchantId("");
    setClientCredentials(null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (missingRequired) {
      setMessage("Please fill all required fields.");
      return;
    }

    setSaving(true);
    setMessage("");
    setCreatedMerchantId("");
    setClientCredentials(null);

    try {
      const res = await fetch("/api/v1/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.message || "Merchant registration failed.");
        return;
      }

      const merchantId = String(data?.merchant?.merchantId || "");
      setCreatedMerchantId(merchantId);
      setClientCredentials(data?.clientCredentials || null);
      setMessage("Merchant registered successfully.");
      setForm(initialForm);
    } catch {
      setMessage("Merchant registration failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell title="New Merchant Registration" breadcrumb="Home > Dashboard > Registration">
      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 space-y-4">
        <div className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Personal Info</div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="First Name" required value={form.firstName} onChange={(v) => updateField("firstName", v)} placeholder="First Name" />
          <Field label="Last Name" required value={form.lastName} onChange={(v) => updateField("lastName", v)} placeholder="Last Name" />
          <Field label="Email ID" required value={form.email} onChange={(v) => updateField("email", v)} placeholder="Email" type="email" />
          <Field label="Phone Number" required value={form.phone} onChange={(v) => updateField("phone", v)} placeholder="Phone Number" />
          <Field label="Aadhaar Number" value={form.aadhaar} onChange={(v) => updateField("aadhaar", v)} placeholder="Aadhaar Number" />
          <Field label="PAN Number" value={form.pan} onChange={(v) => updateField("pan", v)} placeholder="PAN Number" />
          <Field label="Pincode" value={form.pincode} onChange={(v) => updateField("pincode", v)} placeholder="Pincode" />
          <Field label="City" value={form.city} onChange={(v) => updateField("city", v)} placeholder="City" />
          <SelectField label="State" value={form.state} onChange={(v) => updateField("state", v)} options={stateOptions} />
          <TextareaField label="Personal Address" value={form.personalAddress} onChange={(v) => updateField("personalAddress", v)} placeholder="Personal Address" />
        </div>

        <div className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Company Info</div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Company Name" required value={form.companyName} onChange={(v) => updateField("companyName", v)} placeholder="Company Name" />
          <Field label="GST Number" value={form.gstNumber} onChange={(v) => updateField("gstNumber", v)} placeholder="GST Number" />
          <SelectField label="Company Type" value={form.companyType} onChange={(v) => updateField("companyType", v)} options={companyTypeOptions} />
          <Field label="Company Website" value={form.companyWebsite} onChange={(v) => updateField("companyWebsite", v)} placeholder="Company Website" />
          <Field label="Callback URL" value={form.callbackUrl} onChange={(v) => updateField("callbackUrl", v)} placeholder="https://your-domain.com/callback" />
        </div>
        <TextareaField label="Office Address" value={form.officeAddress} onChange={(v) => updateField("officeAddress", v)} placeholder="Office Address" />

        <div className="pt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-5 py-2 text-white font-medium disabled:opacity-60"
          >
            {saving ? "Registering..." : "Register"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl bg-slate-500 px-5 py-2 text-white font-medium"
          >
            Reset
          </button>
        </div>

        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
        {createdMerchantId ? (
          <p className="text-sm font-semibold text-emerald-700">Generated Merchant ID: {createdMerchantId}</p>
        ) : null}
        {clientCredentials ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <p className="font-semibold">Client Login Credentials</p>
            <p>Email: {clientCredentials.email}</p>
            <p>Password: {clientCredentials.password}</p>
          </div>
        ) : null}
      </form>
    </Shell>
  );
}
