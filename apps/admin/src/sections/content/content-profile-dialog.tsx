import type { ContentStage, ContentProfileDetail, ContentExampleQuestion } from 'src/api/admin';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LinearProgress from '@mui/material/LinearProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { extractError } from 'src/utils/axios';

import {
  getContentProfile,
  saveContentProfile,
  approveContentProfile,
  generateContentProfile,
} from 'src/api/admin';

import { Label } from 'src/components/label';

import { STAGES, STATE_LABEL } from './constants';
import { ConfirmActionDialog } from '../consultations/confirm-action-dialog';

// ----------------------------------------------------------------------

/** Keywords are edited as comma-separated text, so they are kept that way here. */
type Form = {
  summary: string;
  oneLiner: string;
  keywordsEn: string;
  keywordsHi: string;
  exampleQuestions: ContentExampleQuestion[];
  suitableFor: ContentStage[];
};

const toForm = (detail: ContentProfileDetail): Form => ({
  summary: detail.profile?.summary ?? '',
  oneLiner: detail.profile?.oneLiner ?? '',
  keywordsEn: detail.profile?.keywordsEn.join(', ') ?? '',
  keywordsHi: detail.profile?.keywordsHi.join(', ') ?? '',
  exampleQuestions: detail.profile?.exampleQuestions ?? [],
  suitableFor: detail.profile?.suitableFor ?? [],
});

const splitKeywords = (value: string) =>
  value
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean);

const toSeconds = (stamp: string) => {
  const [minutes, seconds] = stamp.split(':').map(Number);
  return minutes * 60 + seconds;
};

/** The video at the moment the draft says the question is answered. */
function videoAt(url: string, stamp: string): string {
  try {
    const link = new URL(url);
    link.searchParams.set('t', `${toSeconds(stamp)}s`);
    return link.toString();
  } catch {
    return url;
  }
}

type Props = {
  contentId: string | null;
  onClose: () => void;
  onChanged: () => void;
};

export function ContentProfileDialog({ contentId, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<ContentProfileDetail | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'generate' | 'close' | null>(null);

  useEffect(() => {
    setDetail(null);
    setForm(null);
    setError('');
    setConfirm(null);

    if (!contentId) return undefined;

    const controller = new AbortController();

    (async () => {
      setBusy('Loading…');
      try {
        const result = await getContentProfile(contentId, controller.signal);
        setDetail(result);
        setForm(toForm(result));
      } catch (err) {
        if (!controller.signal.aborted) setError(extractError(err, 'Could not load the content'));
      } finally {
        if (!controller.signal.aborted) setBusy('');
      }
    })();

    return () => controller.abort();
  }, [contentId]);

  const dirty = !!detail && !!form && JSON.stringify(form) !== JSON.stringify(toForm(detail));
  const content = detail?.content;
  const profile = detail?.profile;
  const revision = profile?.revision ?? 0;

  const run = async (label: string, action: () => Promise<ContentProfileDetail>) => {
    setBusy(label);
    setError('');
    try {
      const result = await action();
      setDetail(result);
      setForm(toForm(result));
      onChanged();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  };

  const patch = (change: Partial<Form>) =>
    setForm((prev) => (prev ? { ...prev, ...change } : prev));

  const patchQuestion = (index: number, change: Partial<ContentExampleQuestion>) =>
    setForm((prev) =>
      prev
        ? {
            ...prev,
            exampleQuestions: prev.exampleQuestions.map((question, i) =>
              i === index ? { ...question, ...change } : question
            ),
          }
        : prev
    );

  const handleGenerate = () => {
    if (!content) return;
    setConfirm(null);
    run('Generating… a video can take up to three minutes.', () =>
      generateContentProfile(content.contentId, revision)
    );
  };

  const handleSave = () => {
    if (!content || !form) return;
    run('Saving…', () =>
      saveContentProfile(content.contentId, revision, content.sourceHash, {
        ...form,
        summary: form.summary.trim(),
        oneLiner: form.oneLiner.trim(),
        keywordsEn: splitKeywords(form.keywordsEn),
        keywordsHi: splitKeywords(form.keywordsHi),
        exampleQuestions: form.exampleQuestions
          .map(({ text, language, timestamp }) => ({
            text: text.trim(),
            language,
            timestamp: timestamp || null,
          }))
          .filter((question) => question.text),
      })
    );
  };

  const handleApprove = () => {
    if (!content) return;
    run('Approving…', () => approveContentProfile(content.contentId, revision, content.sourceHash));
  };

  // A request in flight keeps the dialog open, so its result is never lost.
  const handleClose = () => {
    if (busy && detail) return;
    if (dirty) setConfirm('close');
    else onClose();
  };

  const state = detail ? STATE_LABEL[detail.state] : null;

  return (
    <Dialog open={!!contentId} onClose={handleClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Box sx={{ flexGrow: 1 }}>{content?.title ?? 'Content'}</Box>
        {state && <Label color={state.color}>{state.text}</Label>}
      </DialogTitle>

      <DialogContent dividers>
        {!!busy && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress sx={{ mb: 1 }} />
            <Typography variant="body2">{busy}</Typography>
          </Box>
        )}
        {!!error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {detail?.state === 'NEEDS_REVIEW' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            The content changed after this summary was written. Check it, then save and approve, or
            generate a new one.
          </Alert>
        )}
        {detail?.state === 'NEEDS_MANUAL' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No summary could be generated. Please write it by hand.
          </Alert>
        )}
        {!!profile && !!content?.videoUrls.length && !profile.videoChecked && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Video not checked: this summary was not drafted from the video. Watch it before
            approving.
          </Alert>
        )}

        {content && form && (
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '2fr 3fr' } }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Content</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Weeks {content.validWeekStart}–{content.validWeekEnd}
              </Typography>
              {content.videoUrls.map((url) => (
                <Link key={url} href={url} target="_blank" rel="noopener noreferrer">
                  Watch video: {url}
                </Link>
              ))}
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', maxHeight: 520, overflowY: 'auto' }}
              >
                {content.text || 'No text.'}
              </Typography>
            </Stack>

            <Stack spacing={2}>
              <Typography variant="subtitle1">Summary used by the chatbot</Typography>
              <TextField
                label="Summary"
                multiline
                minRows={5}
                value={form.summary}
                disabled={!!busy}
                onChange={(event) => patch({ summary: event.target.value })}
              />
              <TextField
                label="One line"
                value={form.oneLiner}
                disabled={!!busy}
                onChange={(event) => patch({ oneLiner: event.target.value })}
              />

              <Box>
                <Typography variant="subtitle2">Suitable for</Typography>
                {STAGES.map((stage) => (
                  <FormControlLabel
                    key={stage.value}
                    label={stage.label}
                    control={
                      <Checkbox
                        checked={form.suitableFor.includes(stage.value)}
                        disabled={!!busy}
                        onChange={(event) =>
                          patch({
                            suitableFor: event.target.checked
                              ? [...form.suitableFor, stage.value]
                              : form.suitableFor.filter((value) => value !== stage.value),
                          })
                        }
                      />
                    }
                  />
                ))}
              </Box>

              <TextField
                label="English keywords (comma separated)"
                value={form.keywordsEn}
                disabled={!!busy}
                onChange={(event) => patch({ keywordsEn: event.target.value })}
              />
              <TextField
                label="Hindi and Hinglish keywords (comma separated)"
                value={form.keywordsHi}
                disabled={!!busy}
                onChange={(event) => patch({ keywordsHi: event.target.value })}
              />

              <Typography variant="subtitle2">
                Example questions: remove any this content does not answer
              </Typography>
              {form.exampleQuestions.map((question, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={question.text}
                    disabled={!!busy}
                    slotProps={{ htmlInput: { 'aria-label': `Question ${index + 1}` } }}
                    onChange={(event) => patchQuestion(index, { text: event.target.value })}
                  />
                  <TextField
                    select
                    size="small"
                    value={question.language}
                    disabled={!!busy}
                    sx={{ minWidth: 110 }}
                    slotProps={{ htmlInput: { 'aria-label': `Question ${index + 1} language` } }}
                    onChange={(event) =>
                      patchQuestion(index, {
                        language: event.target.value as ContentExampleQuestion['language'],
                      })
                    }
                  >
                    <MenuItem value="en">English</MenuItem>
                    <MenuItem value="hi">Hindi</MenuItem>
                    <MenuItem value="hinglish">Hinglish</MenuItem>
                  </TextField>
                  {question.timestamp && content.videoUrls.length === 1 && (
                    <Link
                      href={videoAt(content.videoUrls[0], question.timestamp)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {question.timestamp}
                    </Link>
                  )}
                  <Button
                    size="small"
                    color="error"
                    disabled={!!busy}
                    onClick={() =>
                      patch({
                        exampleQuestions: form.exampleQuestions.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remove
                  </Button>
                </Box>
              ))}
              <Box>
                <Button
                  size="small"
                  disabled={!!busy || form.exampleQuestions.length >= 12}
                  onClick={() =>
                    patch({
                      exampleQuestions: [
                        ...form.exampleQuestions,
                        { text: '', language: 'en', timestamp: null },
                      ],
                    })
                  }
                >
                  Add question
                </Button>
              </Box>
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={!!busy && !!detail}>
          Close
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          disabled={!!busy || !content}
          onClick={() => (profile || dirty ? setConfirm('generate') : handleGenerate())}
        >
          {profile ? 'Generate again' : 'Generate'}
        </Button>
        <Button
          variant="outlined"
          // An outdated summary can be saved as it is: that is how it is re-confirmed.
          disabled={!!busy || !content || (!dirty && detail?.state !== 'NEEDS_REVIEW')}
          onClick={handleSave}
        >
          Save draft
        </Button>
        <Button
          variant="contained"
          disabled={!!busy || dirty || detail?.state !== 'DRAFT'}
          onClick={handleApprove}
        >
          Approve
        </Button>
      </DialogActions>

      <ConfirmActionDialog
        open={!!confirm}
        title={confirm === 'close' ? 'Discard your changes?' : 'Replace this summary?'}
        description={
          confirm === 'close'
            ? 'Your unsaved changes will be lost.'
            : 'The current summary and any edits will be replaced by a new draft, and it will need approval again.'
        }
        confirmLabel={confirm === 'close' ? 'Discard' : 'Generate again'}
        confirmColor="error"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === 'close') {
            setConfirm(null);
            onClose();
          } else {
            handleGenerate();
          }
        }}
      />
    </Dialog>
  );
}
