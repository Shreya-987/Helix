import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { NominationCreate, SubmissionType, SupervisorInfo } from "../types/nomination";
import { createNomination, lookupSupervisor } from "../services/api";

interface FormState {
  nominee_name: string;
  nominee_email: string;
  submission_type: SubmissionType;
  notes: string;
  nominee_global_id: string;
}

const INITIAL_STATE: FormState = {
  nominee_name: "",
  nominee_email: "",
  submission_type: SubmissionType.SELF_NOMINATION,
  notes: "",
  nominee_global_id: "",
};

const NominationForm: React.FC = () => {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [supervisor, setSupervisor] = useState<SupervisorInfo | null>(null);
  const [supervisorLoading, setSupervisorLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Auto-fetch supervisor when nominee_global_id changes and type is SUPERVISOR_APPROVED
  useEffect(() => {
    if (
      form.submission_type === SubmissionType.SUPERVISOR_APPROVED &&
      form.nominee_global_id.trim().length > 0
    ) {
      setSupervisorLoading(true);
      setSupervisor(null);
      lookupSupervisor(form.nominee_global_id.trim()).then((info) => {
        setSupervisor(info);
        setSupervisorLoading(false);
      });
    } else {
      setSupervisor(null);
    }
  }, [form.submission_type, form.nominee_global_id]);

  const handleChange =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      // Clear field-level error on change
      setErrors((prev) => ({ ...prev, [field]: undefined }));
      // Reset supervisor state when switching away from SUPERVISOR_APPROVED
      if (field === "submission_type" && value !== SubmissionType.SUPERVISOR_APPROVED) {
        setSupervisor(null);
      }
    };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.nominee_name.trim()) {
      newErrors.nominee_name = "Nominee name is required.";
    }
    if (!form.nominee_email.trim()) {
      newErrors.nominee_email = "Nominee email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.nominee_email)) {
      newErrors.nominee_email = "Enter a valid email address.";
    }
    if (
      form.submission_type === SubmissionType.SUPERVISOR_APPROVED &&
      !form.nominee_global_id.trim()
    ) {
      newErrors.nominee_global_id = "Employee Global ID is required for supervisor-approved nominations.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);

    const payload: NominationCreate = {
      nominee_name: form.nominee_name,
      nominee_email: form.nominee_email,
      submission_type: form.submission_type,
      notes: form.notes || undefined,
    };

    try {
      await createNomination(
        payload,
        form.submission_type === SubmissionType.SUPERVISOR_APPROVED
          ? form.nominee_global_id
          : undefined
      );
      setSuccess(true);
      setForm(INITIAL_STATE);
      setSupervisor(null);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ?? "An unexpected error occurred. Please try again.";
      setError(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 600, mx: "auto", mt: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
        Submit Nomination
      </Typography>

      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSuccess(false)}
        >
          Your nomination has been submitted successfully!
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Nominee Name"
          fullWidth
          required
          margin="normal"
          value={form.nominee_name}
          onChange={handleChange("nominee_name")}
          error={!!errors.nominee_name}
          helperText={errors.nominee_name}
          slotProps={{ htmlInput: { "data-testid": "nominee-name" } }}
        />

        <TextField
          label="Nominee Email"
          fullWidth
          required
          type="email"
          margin="normal"
          value={form.nominee_email}
          onChange={handleChange("nominee_email")}
          error={!!errors.nominee_email}
          helperText={errors.nominee_email}
          slotProps={{ htmlInput: { "data-testid": "nominee-email" } }}
        />

        {/* Submission Type selector — SUBTASK-7 */}
        <FormControl component="fieldset" margin="normal" fullWidth>
          <FormLabel component="legend" required>
            Submission Type
          </FormLabel>
          <RadioGroup
            value={form.submission_type}
            onChange={handleChange("submission_type")}
            data-testid="submission-type-group"
          >
            <FormControlLabel
              value={SubmissionType.SELF_NOMINATION}
              control={<Radio />}
              label="Self-Nomination"
            />
            <FormControlLabel
              value={SubmissionType.MANAGER_NOMINATION}
              control={<Radio />}
              label="Manager-Nomination"
            />
            <FormControlLabel
              value={SubmissionType.SUPERVISOR_APPROVED}
              control={<Radio />}
              label="Nomination Approved by Supervisor"
              data-testid="supervisor-approved-option"
            />
          </RadioGroup>
        </FormControl>

        {/* Supervisor section — only shown when SUPERVISOR_APPROVED is selected */}
        {form.submission_type === SubmissionType.SUPERVISOR_APPROVED && (
          <Box sx={{ pl: 2, borderLeft: "3px solid", borderColor: "primary.main", mb: 1 }}>
            <TextField
              label="Your Employee Global ID (Workday)"
              fullWidth
              required
              margin="normal"
              value={form.nominee_global_id}
              onChange={handleChange("nominee_global_id")}
              error={!!errors.nominee_global_id}
              helperText={
                errors.nominee_global_id ??
                "Used to look up your supervisor from Workday."
              }
              slotProps={{ htmlInput: { "data-testid": "nominee-global-id" } }}
            />

            {supervisorLoading && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">
                  Looking up supervisor…
                </Typography>
              </Box>
            )}

            {!supervisorLoading && supervisor && (
              <Alert severity="info" sx={{ mt: 1 }} data-testid="supervisor-info-banner">
                <strong>Supervisor:</strong> {supervisor.name}
                {supervisor.email ? ` (${supervisor.email})` : ""}
              </Alert>
            )}

            {!supervisorLoading &&
              !supervisor &&
              form.nominee_global_id.trim().length > 0 && (
                <Alert severity="warning" sx={{ mt: 1 }} data-testid="supervisor-not-found">
                  Supervisor not found in Workday for this ID. Please verify and try again.
                </Alert>
              )}
          </Box>
        )}

        <TextField
          label="Notes (optional)"
          fullWidth
          multiline
          rows={3}
          margin="normal"
          value={form.notes}
          onChange={handleChange("notes")}
          slotProps={{ htmlInput: { "data-testid": "notes" } }}
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          sx={{ mt: 2 }}
          disabled={submitting}
          data-testid="submit-button"
        >
          {submitting ? <CircularProgress size={24} color="inherit" /> : "Submit Nomination"}
        </Button>
      </Box>

      <Snackbar
        open={success}
        autoHideDuration={6000}
        onClose={() => setSuccess(false)}
        message="Nomination submitted successfully!"
      />
    </Paper>
  );
};

export default NominationForm;
