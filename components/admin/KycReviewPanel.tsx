import React, { useMemo, useState } from 'react';
import { OrganizerKycProfile, KycStatus } from '../../types';

interface KycReviewPanelProps {
  profiles: OrganizerKycProfile[];
  isLoading: boolean;
  onRefresh: () => void;
  onUpdateStatus: (organizerId: string, status: KycStatus, notes?: string) => Promise<void> | void;
}

const statusLabel: Record<KycStatus, string> = {
  not_started: 'Not started',
  draft: 'Draft',
  pending_review: 'Pending review',
  verified: 'Verified',
  limited: 'Limited',
  rejected: 'Rejected',
};

const badgeClass = (status: KycStatus) => {
  switch (status) {
    case 'verified':
      return 'bg-emerald-100 text-emerald-700';
    case 'pending_review':
      return 'bg-amber-100 text-amber-700';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    case 'limited':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const KycReviewPanel: React.FC<KycReviewPanelProps> = ({
  profiles,
  isLoading,
  onRefresh,
  onUpdateStatus,
}) => {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<string | null>(null);

  const pendingProfiles = useMemo(
    () =>
      [...profiles].sort((a, b) => {
        const aDate = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bDate = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return bDate - aDate;
      }),
    [profiles]
  );

  const handleStatusChange = async (profile: OrganizerKycProfile, status: KycStatus) => {
    setUpdating(profile.organizerId);
    try {
      await onUpdateStatus(profile.organizerId, status, notes[profile.organizerId]);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-500">Organizer KYC</p>
          <h2 className="text-2xl font-bold text-slate-900">Review submissions</h2>
          <p className="text-sm text-slate-600">
            Approve, reject, or limit organizers after checking documents and contact details.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 hover:border-purple-300 hover:bg-purple-100 disabled:opacity-50"
          disabled={isLoading}
        >
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-lg font-semibold text-slate-900">
            Submissions ({pendingProfiles.length})
          </h3>
          {isLoading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>
        <div className="divide-y divide-slate-100">
          {pendingProfiles.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              No organizer KYC submissions yet.
            </div>
          ) : (
            pendingProfiles.map((profile) => {
              const payoutSummary =
                profile.payoutDetails.method === 'bank'
                  ? `${profile.payoutDetails.bankName ?? ''} • ${profile.payoutDetails.accountNumber ?? ''}`
                  : `${profile.payoutDetails.walletProvider ?? ''} • ${profile.payoutDetails.walletNumber ?? ''}`;

              const isImage = (val: string) =>
                /^data:image\//.test(val) ||
                /\.(png|jpe?g|gif|webp)$/i.test(val.split('?')[0] || '');
              const isPdf = (val: string) =>
                /^data:application\/pdf/.test(val) || /\.pdf$/i.test(val.split('?')[0] || '');

              const renderDoc = (label: string, value?: string) => (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {label}
                  </p>
                  {value ? (
                    <div className="mt-1 space-y-2 text-xs text-slate-700">
                      <div className="flex items-center gap-2">
                        <a
                          href={value}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md bg-purple-50 px-2 py-1 font-semibold text-purple-700 hover:bg-purple-100"
                        >
                          View
                        </a>
                        {value.startsWith('data:') && (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[0.65rem] text-slate-600">
                            Embedded
                          </span>
                        )}
                        <span className="truncate text-[0.7rem] text-slate-500" title={value}>
                          {value.slice(0, 60)}
                          {value.length > 60 ? '…' : ''}
                        </span>
                      </div>
                      {isImage(value) && (
                        <img
                          src={value}
                          alt={label}
                          className="max-h-40 w-full rounded-md border border-slate-100 object-contain"
                        />
                      )}
                      {isPdf(value) && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[0.7rem] text-slate-700">
                          PDF preview not shown; use View to open.
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Not provided</p>
                  )}
                </div>
              );

              return (
                <div
                  key={profile.organizerId}
                  className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start lg:gap-6"
                >
                  <div className="flex-1 space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-slate-900">
                        {profile.contacts.legalName || 'Unnamed organizer'}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(
                          profile.status
                        )}`}
                      >
                        {statusLabel[profile.status]}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {profile.contacts.email} | {profile.contacts.phone}
                    </p>
                    <p className="text-xs text-slate-500">
                      Submitted {profile.submittedAt ? new Date(profile.submittedAt).toLocaleString() : '-'}
                    </p>
                    {profile.reviewerNotes && (
                      <p className="text-xs text-slate-600">
                        Last reviewer note: <span className="font-semibold">{profile.reviewerNotes}</span>
                      </p>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Contacts
                        </p>
                        <p className="text-sm text-slate-800">{profile.contacts.physicalAddress || '—'}</p>
                        <p className="text-xs text-slate-500">
                          Nationality/Registration: {profile.contacts.nationalityOrRegistrationCountry || '—'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Payout
                        </p>
                        <p className="text-sm text-slate-800">
                          {profile.payoutDetails.method === 'bank' ? 'Bank' : 'Mobile Money'}
                        </p>
                        <p className="text-xs text-slate-600">{payoutSummary || '—'}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Documents
                      </p>
                      {profile.organizerType === 'individual' ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-slate-200 bg-white p-3">
                            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              ID
                            </p>
                            <p className="text-xs text-slate-700">
                              {profile.individualDocs?.idType?.toUpperCase() || '—'} {profile.individualDocs?.idNumber || ''}
                            </p>
                          </div>
                          {renderDoc('ID front', profile.individualDocs?.idFront)}
                          {renderDoc('ID back', profile.individualDocs?.idBack)}
                          {renderDoc('Selfie with ID', profile.individualDocs?.selfieWithId)}
                          {renderDoc('Proof of address', profile.individualDocs?.proofOfAddress)}
                        </div>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {renderDoc('PACRA certificate', profile.companyDocs?.pacraCertificate)}
                          {renderDoc('Incorporation / name change', profile.companyDocs?.incorporationCertificate)}
                          {renderDoc('TPIN certificate', profile.companyDocs?.tpinCertificate)}
                          {renderDoc('Authorised representative ID', profile.companyDocs?.authorisedRepId)}
                          {renderDoc('Authorisation letter / board resolution', profile.companyDocs?.authorisationLetter)}
                          {renderDoc('Proof of business address', profile.companyDocs?.proofOfAddress)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-full max-w-md space-y-2">
                    <textarea
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      placeholder="Add reviewer notes (optional)"
                      value={notes[profile.organizerId] ?? ''}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [profile.organizerId]: e.target.value }))
                      }
                      rows={3}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={updating === profile.organizerId}
                        onClick={() => void handleStatusChange(profile, 'verified')}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={updating === profile.organizerId}
                        onClick={() => void handleStatusChange(profile, 'rejected')}
                        className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={updating === profile.organizerId}
                        onClick={() => void handleStatusChange(profile, 'limited')}
                        className="rounded-md bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-200 disabled:opacity-50"
                      >
                        Limit
                      </button>
                      {profile.status !== 'pending_review' && (
                        <button
                          type="button"
                          disabled={updating === profile.organizerId}
                          onClick={() => void handleStatusChange(profile, 'pending_review')}
                          className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                        >
                          Move to review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default KycReviewPanel;
