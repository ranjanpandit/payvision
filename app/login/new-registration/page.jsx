"use client";

import Link from "next/link";
import { useState } from "react";

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
    if (v && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v.toUpperCase())) {
      return "Invalid PAN. Format: ABCDE1234F (5 letters, 4 digits, 1 letter).";
    }
  }

  if (name === "pincode") {
    if (v && !/^\d{6}$/.test(v)) return "Pincode must be exactly 6 digits.";
  }

  if (name === "companyName") {
    if (!v) return "Company name is required.";
    if (v.length < 2) return "Minimum 2 characters.";
  }

  if (name === "gstNumber") {
    if (v && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/.test(v.toUpperCase())) {
      return "Invalid GST. Format: 22AAAAA0000A1Z5 (15 characters).";
    }
  }

  if (name === "companyWebsite" || name === "callbackUrl") {
    if (v && !/^https?:\/\/.+\..+/.test(v)) {
      return "Enter a valid URL starting with http:// or https://";
    }
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
        className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
          error ? "border-red-400 bg-red-50 focus:ring-red-400" : "border-slate-300"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
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
        className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
          error ? "border-red-400 bg-red-50" : "border-slate-300"
        }`}
      >
        <option value="">- Select -</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
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
        className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
          error ? "border-red-400 bg-red-50" : "border-slate-300"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SuccessCard({ merchantId, onRegisterAnother }) {
  const [copied, setCopied] = useState(false);

  function copy(text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-emerald-800">Registration Submitted Successfully</h2>
        <p className="text-sm text-emerald-700">Your merchant account is pending approval.</p>
      </div>

      <div className="rounded-xl border border-emerald-300 bg-white p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Merchant ID</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-mono font-bold text-slate-900">{merchantId}</span>
          <button
            onClick={() => copy(merchantId)}
            className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
        Your application is under review. Credentials will be shared after approval.
      </div>

      <button
        onClick={onRegisterAnother}
        className="rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 px-5 py-2 text-sm text-white font-medium"
      >
        Register Another Merchant
      </button>
    </div>
  );
}

export default function NewMerchantRegistrationPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(null);

  function updateField(name, raw) {
    let value = raw;
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
      const res = await fetch("/api/v1/merchants/self-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setApiError(data?.message || "Merchant registration failed. Please try again.");
        return;
      }

      setSuccess({ merchantId: String(data?.merchant?.merchantId || "") });
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
      <main className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto w-full max-w-4xl space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">New Merchant Registration</h1>
            <Link href="/login" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Back to Login</Link>
          </div>
          <SuccessCard merchantId={success.merchantId} onRegisterAnother={onReset} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">New Merchant Registration</h1>
          <Link href="/login" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Back to Login</Link>
        </div>

        <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 space-y-5">
          <div className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Personal Info</div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="First Name" required placeholder="e.g. Ranjan" {...fieldProps("firstName")} />
            <Field label="Last Name" required placeholder="e.g. Pandit" {...fieldProps("lastName")} />
            <Field label="Email ID" required type="email" placeholder="e.g. ranjan@company.com" {...fieldProps("email")} />
            <Field label="Phone Number" required placeholder="10-digit mobile number" maxLength={10} hint="Indian mobile number starting with 6-9" {...fieldProps("phone")} />
            <Field label="Aadhaar Number" placeholder="12-digit Aadhaar" maxLength={12} hint="12-digit government ID" {...fieldProps("aadhaar")} />
            <Field label="PAN Number" placeholder="e.g. ABCDE1234F" maxLength={10} hint="Format: 5 letters + 4 digits + 1 letter" {...fieldProps("pan")} />
            <Field label="Pincode" placeholder="6-digit pincode" maxLength={6} hint="6-digit area PIN code" {...fieldProps("pincode")} />
            <Field label="City" placeholder="e.g. Mumbai" {...fieldProps("city")} />
            <SelectField label="State" options={stateOptions} {...fieldProps("state")} />
            <TextareaField label="Personal Address" placeholder="House/Flat No., Street, Area" {...fieldProps("personalAddress")} />
          </div>

          <div className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Company Info</div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Company Name" required placeholder="Registered company name" {...fieldProps("companyName")} />
            <Field label="GST Number" placeholder="e.g. 22AAAAA0000A1Z5" maxLength={15} hint="15-character GST identification number" {...fieldProps("gstNumber")} />
            <SelectField label="Company Type" options={companyTypeOptions} {...fieldProps("companyType")} />
            <Field label="Company Website" placeholder="https://www.yourcompany.com" hint="Must start with http:// or https://" {...fieldProps("companyWebsite")} />
            <Field label="Callback URL" placeholder="https://your-domain.com/payment/callback" hint="Webhook URL for payment status updates" {...fieldProps("callbackUrl")} />
            <TextareaField label="Office Address" placeholder="Office No., Building, Street, City" {...fieldProps("officeAddress")} />
          </div>

          {apiError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{apiError}</div>}

          <div className="pt-1 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 px-6 py-2.5 text-white font-semibold text-sm disabled:opacity-60 hover:opacity-90 transition-opacity"
            >
              {saving ? "Submitting..." : "Submit Registration"}
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
      </div>
    </main>
  );
}
