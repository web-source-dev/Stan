'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { Field, Textarea, Button, Avatar, Alert } from '@/components/ui';
import { IconImage, IconPlus, IconX } from '@/components/icons';
import { useMediaLibrary } from '@/components/media/MediaLibrary';
import { SOCIAL_PLATFORMS, type CreatorProfile } from '@/lib/types';

interface ProfileForm {
  displayName: string;
  category: string;
  bio: string;
  avatarUrl: string;
  avatarPublicId: string;
  socialLinks: { platform: string; url: string }[];
}

function fromProfile(p: CreatorProfile): ProfileForm {
  return {
    displayName: p.displayName ?? '',
    category: p.category ?? '',
    bio: p.bio ?? '',
    avatarUrl: p.avatarUrl ?? '',
    avatarPublicId: '',
    socialLinks: p.socialLinks?.length ? p.socialLinks.map((l) => ({ ...l })) : [],
  };
}

/** Ensure a social URL has a protocol so the backend's url() validation passes. */
function normalizeUrl(url: string): string {
  const v = url.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function ProfileEditModal({
  open,
  onClose,
  profile,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  profile: CreatorProfile;
  onSaved: (p: CreatorProfile) => void;
}) {
  const { authedRequest } = useAuth();
  const [form, setForm] = useState<ProfileForm>(() => fromProfile(profile));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Re-seed the form whenever the modal is (re)opened for the current profile.
  useEffect(() => {
    if (open) {
      setForm(fromProfile(profile));
      setError('');
    }
  }, [open, profile]);

  const { open: openMediaLibrary } = useMediaLibrary();

  function pickAvatar() {
    setError('');
    openMediaLibrary({
      accept: 'image',
      kind: 'avatar',
      title: 'Select a profile photo',
      onSelect: (m) => setForm((f) => ({ ...f, avatarUrl: m.url, avatarPublicId: m.publicId })),
    });
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const res = await authedRequest<{ profile: CreatorProfile }>('/api/creator/profile', {
        method: 'PATCH',
        body: {
          displayName: form.displayName.trim(),
          category: form.category.trim(),
          bio: form.bio,
          avatarUrl: form.avatarUrl || '',
          ...(form.avatarPublicId ? { avatarPublicId: form.avatarPublicId } : {}),
          socialLinks: form.socialLinks
            .filter((l) => l.url.trim())
            .map((l) => ({ platform: l.platform, url: normalizeUrl(l.url) })),
        },
      });
      onSaved(res.profile);
      onClose();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Could not save profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit profile"
      subtitle="Your name, photo, bio and links shown at the top of your store."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} loading={busy}>
            Save changes
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}

        <div className="flex items-center gap-3">
          <Avatar src={form.avatarUrl} name={form.displayName} size={56} />
          <button
            type="button"
            onClick={pickAvatar}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-white px-3 py-1.5 text-sm font-medium shadow-xs hover:bg-surface-muted"
          >
            <IconImage size={15} /> Choose photo
          </button>
        </div>

        <Field
          label="Display name"
          value={form.displayName}
          maxLength={80}
          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
        />
        <Field
          label="Category"
          placeholder="e.g. Fitness coach"
          value={form.category}
          maxLength={60}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        />
        <Textarea
          label="Bio"
          rows={3}
          maxLength={500}
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
        />
        <Field
          label="Avatar image URL"
          placeholder="https://…"
          value={form.avatarUrl}
          onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value, avatarPublicId: '' }))}
          hint="Or paste a link if you'd rather not upload."
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-neutral-800">Social links</span>
          <div className="space-y-2">
            {form.socialLinks.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={l.platform}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      socialLinks: f.socialLinks.map((x, j) => (j === idx ? { ...x, platform: e.target.value } : x)),
                    }))
                  }
                  className="h-9 rounded-lg border border-line-strong bg-white px-2 text-sm capitalize"
                >
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input
                  value={l.url}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      socialLinks: f.socialLinks.map((x, j) => (j === idx ? { ...x, url: e.target.value } : x)),
                    }))
                  }
                  placeholder="https://…"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-white px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, socialLinks: f.socialLinks.filter((_, j) => j !== idx) }))}
                  className="rounded-lg p-1.5 text-neutral-400 hover:text-danger-600"
                  aria-label="Remove link"
                >
                  <IconX size={15} />
                </button>
              </div>
            ))}
            {form.socialLinks.length < 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForm((f) => ({ ...f, socialLinks: [...f.socialLinks, { platform: 'instagram', url: '' }] }))}
              >
                <IconPlus size={14} /> Add link
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
