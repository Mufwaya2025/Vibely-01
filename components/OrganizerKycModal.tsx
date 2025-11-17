import React, { useEffect, useRef, useState, useId } from "react";
import { createPortal } from "react-dom";
import {
  OrganizerKycProfile,
  OrganizerKycRequestPayload,
  OrganizerPayoutMethod,
  OrganizerType,
  User,
} from "../types";

interface OrganizerKycModalProps {
  user: User;
  profile: OrganizerKycProfile;
  onClose: () => void;
  onSubmit: (payload: OrganizerKycRequestPayload) => Promise<void> | void;
  onRequestOtp: (email?: string) => Promise<void> | void;
  onVerifyOtp: (code: string) => Promise<void> | void;
  isSubmitting?: boolean;
  isRequestingOtp?: boolean;
  isVerifyingOtp?: boolean;
}

type FieldErrors = Record<string, string>;

const defaultPayload = (profile: OrganizerKycProfile): OrganizerKycRequestPayload => ({
  organizerType: profile.organizerType ?? "individual",
  contacts: { ...profile.contacts },
  payoutDetails: { ...profile.payoutDetails, method: profile.payoutDetails.method ?? "bank" },
  individualDocs: profile.individualDocs ? { ...profile.individualDocs } : undefined,
  companyDocs: profile.companyDocs ? { ...profile.companyDocs } : undefined,
  eventDocumentation: { ...profile.eventDocumentation },
});

const isDataUrl = (val?: string) => Boolean(val && val.startsWith("data:"));

const Input = ({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
}) => {
  const inputId = useId();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-slate-700" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder ?? label}
        className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 ${
          error ? "border-red-300" : "border-slate-200"
        }`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {isDataUrl(value) && <p className="text-xs text-emerald-700">Uploaded file saved</p>}
    </div>
  );
};

const TextArea = ({
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
  placeholder?: string;
}) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-slate-700" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        rows={3}
        className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 ${
          error ? "border-red-300" : "border-slate-200"
        }`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

const UploadControl: React.FC<{
  onSelect: (dataUrl: string) => void;
  label?: string;
  accept?: string;
}> = ({ onSelect, label = "Upload file", accept }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onSelect(result);
      }
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  return (
    <label className="inline-flex items-center gap-2 text-xs font-semibold text-purple-700 hover:text-purple-800 cursor-pointer">
      <input type="file" className="hidden" onChange={handleChange} accept={accept} />
      <span className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1">{label}</span>
    </label>
  );
};
const OrganizerKycModal: React.FC<OrganizerKycModalProps> = ({
  profile,
  onClose,
  onSubmit,
  onRequestOtp,
  onVerifyOtp,
  isSubmitting = false,
  isRequestingOtp = false,
  isVerifyingOtp = false,
}) => {
  const initialFormRef = useRef<OrganizerKycRequestPayload>(defaultPayload(profile));
  const [form, setForm] = useState<OrganizerKycRequestPayload>(initialFormRef.current);
  const [otpCode, setOtpCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [cameraTarget, setCameraTarget] = useState<'selfie' | 'idFront' | 'idBack' | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const kycStatus = profile.status;
  const emailVerified = true; // OTP disabled for now
  const emailVerificationLabel = 'Email verification not required (OTP disabled)';

  useEffect(() => {
    if (!cameraTarget) {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        setMediaStream(null);
      }
      setCameraError(null);
      return;
    }

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setMediaStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error('Camera error', err);
        setCameraError(
          err instanceof Error
            ? err.message
            : 'Unable to access camera. Please allow camera permissions.'
        );
      }
    };
    void start();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        setMediaStream(null);
      }
    };
  }, [cameraTarget]);

  const setField = (path: string, value: string) => {
    setForm((prev) => {
      const clone: any = { ...prev };
      const segments = path.split('.');
      let cursor = clone;
      for (let i = 0; i < segments.length - 1; i++) {
        const key = segments[i];
        cursor[key] = cursor[key] ?? {};
        cursor = cursor[key];
      }
      cursor[segments[segments.length - 1]] = value;
      return clone;
    });
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!form.contacts?.legalName?.trim()) next['contacts.legalName'] = 'Legal name is required.';
    if (!form.contacts?.email?.trim()) next['contacts.email'] = 'Email is required.';
    if (!form.contacts?.phone?.trim()) next['contacts.phone'] = 'Phone is required.';
    if (!form.contacts?.physicalAddress?.trim())
      next['contacts.physicalAddress'] = 'Address is required.';
    if (form.payoutDetails.method === 'bank') {
      if (!form.payoutDetails.accountName?.trim())
        next['payoutDetails.accountName'] = 'Account name is required.';
      if (!form.payoutDetails.accountNumber?.trim())
        next['payoutDetails.accountNumber'] = 'Account number is required.';
      if (!form.payoutDetails.bankName?.trim())
        next['payoutDetails.bankName'] = 'Bank name is required.';
    } else {
      if (!form.payoutDetails.walletProvider?.trim())
        next['payoutDetails.walletProvider'] = 'Wallet provider is required.';
      if (!form.payoutDetails.walletNumber?.trim())
        next['payoutDetails.walletNumber'] = 'Wallet number is required.';
      if (!form.payoutDetails.walletHolder?.trim())
        next['payoutDetails.walletHolder'] = 'Wallet holder name is required.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    void onSubmit(form);
  };

  const payoutMethod: OrganizerPayoutMethod = form.payoutDetails.method ?? 'bank';
  const organizerType: OrganizerType = form.organizerType ?? 'individual';

  const capturePhoto = () => {
    if (!videoRef.current || !cameraTarget) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setForm((prev) => ({
      ...prev,
      individualDocs: {
        ...(prev.individualDocs ?? {}),
        ...(cameraTarget === 'selfie'
          ? { selfieWithId: dataUrl }
          : cameraTarget === 'idBack'
          ? { idBack: dataUrl }
          : { idFront: dataUrl }),
      },
    }));
    setCameraTarget(null);
  };
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b px-6 py-4">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-purple-400">
              Organizer KYC
            </p>
            <h2 className="text-xl font-bold text-slate-900">Submit your organizer details</h2>
            <p className="text-sm text-slate-600">
              We verify organizers via email OTP and document references. Bank statements and attendee
              NRC uploads are not required.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 8.586 4.707 3.293 3.293 4.707 8.586 10l-5.293 5.293 1.414 1.414L10 11.414l5.293 5.293 1.414-1.414L11.414 10l5.293-5.293-1.414-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </header>

        <form className="flex-1 space-y-6 overflow-y-auto px-6 py-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Organizer type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['individual', 'company'] as OrganizerType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      organizerType === type
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, organizerType: type }))}
                  >
                    {type === 'individual' ? 'Individual / Sole Trader' : 'Company / Organisation'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Payout method</label>
              <div className="grid grid-cols-2 gap-2">
                {(['bank', 'mobile_money'] as OrganizerPayoutMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      payoutMethod === method
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        payoutDetails: { ...prev.payoutDetails, method },
                      }))
                    }
                  >
                    {method === 'bank' ? 'Bank' : 'Mobile Money'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section className="space-y-4 rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Profile & Contacts</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Full legal name / Entity name"
                value={form.contacts.legalName}
                onChange={(val) => setField('contacts.legalName', val)}
                error={errors['contacts.legalName']}
              />
              <Input
                label="Trading / Brand name"
                value={form.contacts.tradingName ?? ''}
                onChange={(val) => setField('contacts.tradingName', val)}
                error={errors['contacts.tradingName']}
              />
              <Input
                label="Email"
                value={form.contacts.email}
                onChange={(val) => setField('contacts.email', val)}
                error={errors['contacts.email']}
              />
              <Input
                label="Mobile (Momo-enabled if used for payouts)"
                value={form.contacts.phone}
                onChange={(val) => setField('contacts.phone', val)}
                error={errors['contacts.phone']}
              />
              <Input
                label="Nationality / Country of registration"
                value={form.contacts.nationalityOrRegistrationCountry}
                onChange={(val) => setField('contacts.nationalityOrRegistrationCountry', val)}
              />
              <Input
                label="Physical address"
                value={form.contacts.physicalAddress}
                onChange={(val) => setField('contacts.physicalAddress', val)}
                error={errors['contacts.physicalAddress']}
              />
              <Input
                label="Event category"
                value={form.contacts.eventCategory}
                onChange={(val) => setField('contacts.eventCategory', val)}
              />
              <Input
                label="Expected attendance range"
                value={form.contacts.attendanceRange}
                onChange={(val) => setField('contacts.attendanceRange', val)}
              />
              <Input
                label="Expected ticket price range"
                value={form.contacts.ticketPriceRange}
                onChange={(val) => setField('contacts.ticketPriceRange', val)}
              />
              <Input
                label="Expected total revenue range"
                value={form.contacts.revenueRange}
                onChange={(val) => setField('contacts.revenueRange', val)}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Payout details</h3>
            {payoutMethod === 'bank' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Bank name"
                  value={form.payoutDetails.bankName ?? ''}
                  onChange={(val) => setField('payoutDetails.bankName', val)}
                  error={errors['payoutDetails.bankName']}
                />
                <Input
                  label="Branch"
                  value={form.payoutDetails.branch ?? ''}
                  onChange={(val) => setField('payoutDetails.branch', val)}
                />
                <Input
                  label="Account name"
                  value={form.payoutDetails.accountName ?? ''}
                  onChange={(val) => setField('payoutDetails.accountName', val)}
                  error={errors['payoutDetails.accountName']}
                />
                <Input
                  label="Account number"
                  value={form.payoutDetails.accountNumber ?? ''}
                  onChange={(val) => setField('payoutDetails.accountNumber', val)}
                  error={errors['payoutDetails.accountNumber']}
                />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Wallet provider (MTN / Airtel / Zamtel)"
                  value={form.payoutDetails.walletProvider ?? ''}
                  onChange={(val) => setField('payoutDetails.walletProvider', val)}
                  error={errors['payoutDetails.walletProvider']}
                />
                <Input
                  label="Wallet number"
                  value={form.payoutDetails.walletNumber ?? ''}
                  onChange={(val) => setField('payoutDetails.walletNumber', val)}
                  error={errors['payoutDetails.walletNumber']}
                />
                <Input
                  label="Name on wallet"
                  value={form.payoutDetails.walletHolder ?? ''}
                  onChange={(val) => setField('payoutDetails.walletHolder', val)}
                  error={errors['payoutDetails.walletHolder']}
                />
              </div>
            )}
          </section>
          <section className="space-y-4 rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Identity & documents</h3>
            {organizerType === 'individual' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-700">ID type</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    value={form.individualDocs?.idType ?? 'nrc'}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        individualDocs: {
                          ...(prev.individualDocs ?? {}),
                          idType: e.target.value as any,
                        },
                      }))
                    }
                  >
                    <option value="nrc">NRC</option>
                    <option value="passport">Passport</option>
                  </select>
                </div>
                <Input
                  label="ID number"
                  value={form.individualDocs?.idNumber ?? ''}
                  onChange={(val) =>
                    setForm((prev) => ({
                      ...prev,
                      individualDocs: { ...(prev.individualDocs ?? {}), idNumber: val },
                    }))
                  }
                />
                <div className="flex flex-col gap-1">
                  <Input
                    label="ID front (URL or note)"
                    value={form.individualDocs?.idFront ?? ''}
                    onChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        individualDocs: { ...(prev.individualDocs ?? {}), idFront: val },
                      }))
                    }
                    placeholder="Link to scan/photo"
                  />
                  <UploadControl
                    label="Upload ID front"
                    onSelect={(dataUrl) =>
                      setForm((prev) => ({
                        ...prev,
                        individualDocs: { ...(prev.individualDocs ?? {}), idFront: dataUrl },
                      }))
                    }
                    accept="image/*,.pdf"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCameraTarget('idFront')}
                      className="mt-1 inline-flex w-fit items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Use camera
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Input
                    label="ID back (URL or note)"
                    value={form.individualDocs?.idBack ?? ''}
                    onChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        individualDocs: { ...(prev.individualDocs ?? {}), idBack: val },
                      }))
                    }
                  />
                  <UploadControl
                    label="Upload ID back"
                    onSelect={(dataUrl) =>
                      setForm((prev) => ({
                        ...prev,
                        individualDocs: { ...(prev.individualDocs ?? {}), idBack: dataUrl },
                      }))
                    }
                    accept="image/*,.pdf"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCameraTarget('idBack')}
                      className="mt-1 inline-flex w-fit items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Use camera
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Input
                    label="Proof of address (URL or note)"
                    value={form.individualDocs?.proofOfAddress ?? ''}
                    onChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        individualDocs: { ...(prev.individualDocs ?? {}), proofOfAddress: val },
                      }))
                    }
                    placeholder="Utility bill / lease / employer letter"
                  />
                  <UploadControl
                    label="Upload proof of address"
                    onSelect={(dataUrl) =>
                      setForm((prev) => ({
                        ...prev,
                        individualDocs: { ...(prev.individualDocs ?? {}), proofOfAddress: dataUrl },
                      }))
                    }
                    accept="image/*,.pdf"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Input
                    label="Selfie with ID (optional)"
                    value={form.individualDocs?.selfieWithId ?? ''}
                    onChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        individualDocs: { ...(prev.individualDocs ?? {}), selfieWithId: val },
                      }))
                    }
                  />
                  <UploadControl
                    label="Upload selfie"
                    onSelect={(dataUrl) =>
                      setForm((prev) => ({
                        ...prev,
                        individualDocs: { ...(prev.individualDocs ?? {}), selfieWithId: dataUrl },
                      }))
                    }
                    accept="image/*"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCameraTarget('selfie')}
                      className="mt-1 inline-flex w-fit items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Use camera
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Input
                    label="PACRA certificate (URL or note)"
                    value={form.companyDocs?.pacraCertificate ?? ''}
                    onChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        companyDocs: { ...(prev.companyDocs ?? {}), pacraCertificate: val },
                      }))
                    }
                  />
                  <UploadControl
                    label="Upload PACRA"
                    onSelect={(dataUrl) =>
                      setForm((prev) => ({
                        ...prev,
                        companyDocs: { ...(prev.companyDocs ?? {}), pacraCertificate: dataUrl },
                      }))
                    }
                    accept="image/*,.pdf"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Input
                    label="Incorporation / name change certificate"
                    value={form.companyDocs?.incorporationCertificate ?? ''}
                    onChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        companyDocs: { ...(prev.companyDocs ?? {}), incorporationCertificate: val },
                      }))
                    }
                  />
                  <UploadControl
                    label="Upload certificate"
                    onSelect={(dataUrl) =>
                      setForm((prev) => ({
                        ...prev,
                        companyDocs: { ...(prev.companyDocs ?? {}), incorporationCertificate: dataUrl },
                      }))
                    }
                    accept="image/*,.pdf"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Input
                    label="TPIN certificate (optional)"
                    value={form.companyDocs?.tpinCertificate ?? ''}
                    onChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        companyDocs: { ...(prev.companyDocs ?? {}), tpinCertificate: val },
                      }))
                    }
                  />
                  <UploadControl
                    label="Upload TPIN"
                    onSelect={(dataUrl) =>
                      setForm((prev) => ({
                        ...prev,
                        companyDocs: { ...(prev.companyDocs ?? {}), tpinCertificate: dataUrl },
                      }))
                    }
                    accept="image/*,.pdf"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Input
                    label="Authorised representative ID"
                    value={form.companyDocs?.authorisedRepId ?? ''}
                    onChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        companyDocs: { ...(prev.companyDocs ?? {}), authorisedRepId: val },
                      }))
                    }
                  />
                  <UploadControl
                    label="Upload representative ID"
                    onSelect={(dataUrl) =>
                      setForm((prev) => ({
                        ...prev,
                        companyDocs: { ...(prev.companyDocs ?? {}), authorisedRepId: dataUrl },
                      }))
                    }
                    accept="image/*,.pdf"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Input
                    label="Authorisation letter / board resolution"
                    value={form.companyDocs?.authorisationLetter ?? ''}
                    onChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        companyDocs: { ...(prev.companyDocs ?? {}), authorisationLetter: val },
                      }))
                    }
                  />
                  <UploadControl
                    label="Upload authorisation"
                    onSelect={(dataUrl) =>
                      setForm((prev) => ({
                        ...prev,
                        companyDocs: { ...(prev.companyDocs ?? {}), authorisationLetter: dataUrl },
                      }))
                    }
                    accept="image/*,.pdf"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Input
                    label="Proof of business address"
                    value={form.companyDocs?.proofOfAddress ?? ''}
                    onChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        companyDocs: { ...(prev.companyDocs ?? {}), proofOfAddress: val },
                      }))
                    }
                  />
                  <UploadControl
                    label="Upload proof of address"
                    onSelect={(dataUrl) =>
                      setForm((prev) => ({
                        ...prev,
                        companyDocs: { ...(prev.companyDocs ?? {}), proofOfAddress: dataUrl },
                      }))
                    }
                    accept="image/*,.pdf"
                  />
                </div>
              </div>
            )}
          </section>
        </form>

        <footer className="flex flex-col gap-3 border-t bg-slate-50 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">
              {emailVerificationLabel}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
            >
              {isSubmitting ? 'Saving...' : 'Submit for review'}
            </button>
          </div>
        </footer>
      </div>
      {cameraTarget && (
        <CameraOverlay
          videoRef={videoRef}
          error={cameraError}
          onCapture={capturePhoto}
          onClose={() => setCameraTarget(null)}
          target={cameraTarget}
        />
      )}
    </div>
  );
};

export default OrganizerKycModal;

const CameraOverlay: React.FC<{
  videoRef: React.RefObject<HTMLVideoElement>;
  onCapture: () => void;
  onClose: () => void;
  error?: string | null;
  target?: 'selfie' | 'idFront' | 'idBack' | null;
}> = ({ videoRef, onCapture, onClose, error, target }) => {
  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-lg font-semibold text-slate-900">
            Capture {target === 'idFront' ? 'ID front' : target === 'idBack' ? 'ID back' : 'selfie with ID'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 8.586 4.707 3.293 3.293 4.707 8.586 10l-5.293 5.293 1.414 1.414L10 11.414l5.293 5.293 1.414-1.414L11.414 10l5.293-5.293-1.414-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div className="space-y-3 p-4">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
              <video ref={videoRef} className="h-80 w-full bg-black object-cover" playsInline />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onCapture}
              disabled={Boolean(error)}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
            >
              Capture
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
