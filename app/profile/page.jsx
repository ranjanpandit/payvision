"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/payvision/Shell";

const initialForm = {
  firstName: "",
  lastName: "",
  dob: "",
  mobile: "",
  email: "",
  state: "",
  city: "",
  pinCode: "",
  address: "",
  landmark: "",
  aadhaar: "",
  pan: "",
  profilePhotoUrl: "",
};

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-800">{label}</label>
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

export default function ChangeProfilePage() {
  const [form, setForm] = useState(initialForm);
  const [snapshot, setSnapshot] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/v1/profile", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) return;
        const next = { ...initialForm, ...(data?.profile || {}) };
        setForm(next);
        setSnapshot(next);
      } catch {
      }
    }

    loadProfile();
  }, []);

  const preview = useMemo(() => {
    return form.profilePhotoUrl || "https://via.placeholder.com/84x84.png?text=Profile";
  }, [form.profilePhotoUrl]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onFileChange(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, profilePhotoUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/v1/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Failed to update profile");
        return;
      }
      setSnapshot(form);
      setMessage("Profile updated successfully.");
    } catch {
      setMessage("Profile update failed.");
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    setForm(snapshot);
    setMessage("Form reset to last saved values.");
  }

  return (
    <Shell title="Change Profile" breadcrumb="Home > Dashboard > Change Profile">
      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="First Name" value={form.firstName} onChange={(v) => updateField("firstName", v)} placeholder="Enter first name" />
          <Field label="Last Name" value={form.lastName} onChange={(v) => updateField("lastName", v)} placeholder="Enter last name" />

          <Field label="Date of Birth" type="date" value={form.dob} onChange={(v) => updateField("dob", v)} />
          <Field label="Mobile Number" value={form.mobile} onChange={(v) => updateField("mobile", v)} placeholder="99xxxx999" />

          <Field label="Email ID" value={form.email} onChange={(v) => updateField("email", v)} placeholder="name@domain.com" />
          <Field label="State" value={form.state} onChange={(v) => updateField("state", v)} placeholder="State" />

          <Field label="City" value={form.city} onChange={(v) => updateField("city", v)} placeholder="City" />
          <Field label="Pin Code" value={form.pinCode} onChange={(v) => updateField("pinCode", v)} placeholder="Pin Code" />

          <Field label="Address" value={form.address} onChange={(v) => updateField("address", v)} placeholder="Address" />
          <Field label="Landmark" value={form.landmark} onChange={(v) => updateField("landmark", v)} placeholder="Landmark" />

          <Field label="Aadhaar Number" value={form.aadhaar} onChange={(v) => updateField("aadhaar", v)} placeholder="XXXXXXXXXXXX" />
          <Field label="PAN Card Number" value={form.pan} onChange={(v) => updateField("pan", v)} placeholder="ABCDE1234F" />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-800">Profile Photo</label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <img src={preview} alt="Profile Preview" className="h-20 w-20 rounded-full border border-slate-300 object-cover" />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFileChange(e.target.files?.[0])}
              className="text-sm"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-5 py-2 text-white font-medium disabled:opacity-60"
          >
            {saving ? "Updating..." : "Update Profile"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl bg-slate-500 px-5 py-2 text-white font-medium"
          >
            Reset
          </button>
        </div>

        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </form>
    </Shell>
  );
}
