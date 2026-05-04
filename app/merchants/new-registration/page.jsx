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
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli",
  "Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep",
  "Puducherry",
];

const companyTypeOptions = [
  "Proprietorship", "Partnership", "Private Limited", "LLP", "Public Limited",
];

// ── Validators ──────────────────────────────────────────────────────────────

function validateField(name, value) {
  const v = String(value).trim();

  if (name === "firstName" || name === "lastName") {
    if (!v) return "This field is required.";
    if (!/^[a-zA-Z\s\-']+$/.test(v)) return "Only letters, spaces and hyphens allowed.";
    if (v.length < 2) return "Minimum 2 characters.";
  }

  if (name === "city") {
    if (v && !/^[a-zA-Z\s\-']+$/.test(v)) return "Only letters allowed.";
  }

  if (name === "email") {
    if (!v) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Enter a valid email address.";
  }

  if (name === "phone") {
    if (!v) return "Phone number is required.";
    if (!/^[6-9]\d{9}$/.test(v)) return "Enter a valid 10-digit Indian mobile number.";
  }

  if (name === "aadhaar") {
    if (v && !/^\d{12}$/.test(v)) return "Aadhaar must be exactly 12 digits.";
  }

  if (name === "pan") {
    if (v && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v.toUpperCase()))
      return "Invalid PAN. Format: ABCDE1234F (5 letters, 4 digits, 1 letter).";
  }

  if (name === "pincode") {
    if (v && !/^\d{6}$/.test(v)) return "Pincode must be exactly 6 digits.";
  }

  if (name === "companyName") {
    if (!v) return "Company name is required.";
    if (v.length < 2) return "Minimum 2 characters.";
  }

  if (name === "gstNumber") {
    if (v && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/.test(v.toUpperCase()))
      return "Invalid GST. Format: 22AAAAA0000A1Z5 (15 characters).";
  }

  if (name === "companyWebsite") {
    if (v && !/^https?:\/\/.+\..+/.test(v))
      return "Enter a valid URL starting with http:// or https://";
  }

  if (name === "callbackUrl") {
    if (v && !/^https?:\/\/.+\..+/.test(v))
      return "Enter a valid URL starting with http:// or https://";
  }

  return "";
}

function validateAll(form) {
  const errors = {};
  Object.keys(form).forEach((key) => {
    const err = validateField(key, form[key]);
    if (err) errors[key] = err;
  });
  return errors;
}

// ── Field Components ─────────────────────────────────────────────────────────

function Field({ label, name, value, onChange, onBlur, error, placeholder = "", type = "text", required = false, maxLength, hint }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-800">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(name, e.target.value)}
        onBlur={() => onBlur && onBlur(name)}
        className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 transition-colors ${
          error ? "border-red-400 bg-red-50 focus:ring-red-400" : "border-slate-300"
        }`}
      />
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

function SelectField({ label, name, value, onChange, onBlur, error, options, required = false }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-800">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        onBlur={() => onBlur && onBlur(name)}
        className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 transition-colors ${
          error ? "border-red-400 bg-red-50" : "border-slate-300"
        }`}
      >
        <option value="">— Select —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

function TextareaField({ label, name, value, onChange, onBlur, error, placeholder = "", required = false }) {
  return (
    <div className="md:col-span-2">
      <label className="text-sm font-semibold text-slate-800">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={2}
        onChange={(e) => onChange(name, e.target.value)}
        onBlur={() => onBlur && onBlur(name)}
        className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 transition-colors ${
          error ? "border-red-400 bg-red-50" : "border-slate-300"
        }`}
      />
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

// ── Success Card ─────────────────────────────────────────────────────────────

function SuccessCard({ merchantId, credentials, onRegisterAnother }) {
  const [copied, setCopied] = useState("");

  function copy(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white text-2xl font-bold">✓</div>
        <div>
          <h2 className="text-lg font-bold text-emerald-800">Merchant Registered Successfully!</h2>
          <p className="text-sm text-emerald-700">The merchant account has been created and is ready to use.</p>
        </div>
      </div>

      {/* Merchant ID */}
      <div className="rounded-xl border border-emerald-300 bg-white p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Merchant ID</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-mono font-bold text-slate-900">{merchantId}</span>
          <button
            onClick={() => copy(merchantId, "mid")}
            className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition-colors"
          >
            {copied === "mid" ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Login Credentials */}
      {credentials && (
        <div className="rounded-xl border border-blue-200 bg-white p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Client Login Credentials</p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠ Save these credentials now. The password cannot be recovered later.
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-sm font-semibold text-slate-800">{credentials.email}</p>
              </div>
              <button
                onClick={() => copy(credentials.email, "email")}
                className="rounded-lg bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition-colors"
              >
                {copied === "email" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div>
                <p className="text-xs text-slate-500">Password</p>
                <p className="text-sm font-mono font-semibold text-slate-800">{credentials.password}</p>
              </div>
              <button
                onClick={() => copy(credentials.password, "pass")}
                className="rounded-lg bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition-colors"
              >
                {copied === "pass" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onRegisterAnother}
        className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-5 py-2 text-sm text-white font-medium"
      >
        + Register Another Merchant
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NewMerchantRegistrationPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(null); // { merchantId, credentials }

  function updateField(name, raw) {
    let value = raw;

    // Auto-format specific fields
    if (name === "pan" || name === "gstNumber") value = raw.toUpperCase();
    if (name === "phone" || name === "aadhaar" || name === "pincode") value = raw.replace(/\D/g, "");

    setForm((prev) => ({ ...prev, [name]: value }));

    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  }

  function handleBlur(name) {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, form[name]) }));
  }

  function onReset() {
    setForm(initialForm);
    setErrors({});
    setTouched({});
    setApiError("");
    setSuccess(null);
  }

  async function onSubmit(e) {
    e.preventDefault();

    // Mark all fields touched and validate all
    const allTouched = Object.keys(initialForm).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(allTouched);

    const allErrors = validateAll(form);
    setErrors(allErrors);

    if (Object.values(allErrors).some(Boolean)) {
      setApiError("Please fix the errors above before submitting.");
      return;
    }

    setSaving(true);
    setApiError("");

    try {
      const res = await fetch("/api/v1/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setApiError(data?.message || "Merchant registration failed. Please try again.");
        return;
      }

      setSuccess({
        merchantId: String(data?.merchant?.merchantId || ""),
        credentials: data?.clientCredentials || null,
      });
      setForm(initialForm);
      setErrors({});
      setTouched({});
    } catch {
      setApiError("Network error. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const fieldProps = (name) => ({
    name,
    value: form[name],
    onChange: updateField,
    onBlur: handleBlur,
    error: touched[name] ? errors[name] : "",
  });

  if (success) {
    return (
      <Shell title="New Merchant Registration" breadcrumb="Home > Dashboard > Registration">
        <SuccessCard
          merchantId={success.merchantId}
          credentials={success.credentials}
          onRegisterAnother={onReset}
        />
      </Shell>
    );
  }

  return (
    <Shell title="New Merchant Registration" breadcrumb="Home > Dashboard > Registration">
      <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 space-y-5">

        {/* Personal Info */}
        <div className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Personal Info</div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="First Name" required placeholder="e.g. Ranjan" {...fieldProps("firstName")} />
          <Field label="Last Name" required placeholder="e.g. Pandit" {...fieldProps("lastName")} />
          <Field label="Email ID" required type="email" placeholder="e.g. ranjan@company.com" {...fieldProps("email")} />
          <Field
            label="Phone Number" required placeholder="10-digit mobile number"
            maxLength={10} hint="Indian mobile number starting with 6–9"
            {...fieldProps("phone")}
          />
          <Field
            label="Aadhaar Number" placeholder="12-digit Aadhaar"
            maxLength={12} hint="12-digit government ID"
            {...fieldProps("aadhaar")}
          />
          <Field
            label="PAN Number" placeholder="e.g. ABCDE1234F"
            maxLength={10} hint="Format: 5 letters + 4 digits + 1 letter"
            {...fieldProps("pan")}
          />
          <Field
            label="Pincode" placeholder="6-digit pincode"
            maxLength={6} hint="6-digit area PIN code"
            {...fieldProps("pincode")}
          />
          <Field label="City" placeholder="e.g. Mumbai" {...fieldProps("city")} />
          <SelectField label="State" options={stateOptions} {...fieldProps("state")} />
          <TextareaField label="Personal Address" placeholder="House/Flat No., Street, Area" {...fieldProps("personalAddress")} />
        </div>

        {/* Company Info */}
        <div className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Company Info</div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Company Name" required placeholder="Registered company name" {...fieldProps("companyName")} />
          <Field
            label="GST Number" placeholder="e.g. 22AAAAA0000A1Z5"
            maxLength={15} hint="15-character GST identification number"
            {...fieldProps("gstNumber")}
          />
          <SelectField label="Company Type" options={companyTypeOptions} {...fieldProps("companyType")} />
          <Field
            label="Company Website" placeholder="https://www.yourcompany.com"
            hint="Must start with http:// or https://"
            {...fieldProps("companyWebsite")}
          />
          <Field
            label="Callback URL" placeholder="https://your-domain.com/payment/callback"
            hint="Webhook URL for payment status updates"
            {...fieldProps("callbackUrl")}
          />
          <TextareaField label="Office Address" placeholder="Office No., Building, Street, City" {...fieldProps("officeAddress")} />
        </div>

        {/* Submit */}
        {apiError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <span className="mt-0.5">⚠</span>
            <span>{apiError}</span>
          </div>
        )}

        <div className="pt-1 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-6 py-2.5 text-white font-semibold text-sm disabled:opacity-60 hover:opacity-90 transition-opacity"
          >
            {saving ? "Registering..." : "Register Merchant"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Reset
          </button>
        </div>
      </form>
    </Shell>
  );
}
