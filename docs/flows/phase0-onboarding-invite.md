# Flow: sign up → space → import → invite guardian

**Goal.** A new student has a private space with their data and a guardian with read/approve access, in under 5 minutes.

**Happy path.** Landing → "Empezar gratis" → email → magic link → 3 steps (name, time zone auto-detected, space name) → Home → "Importar datos" → choose files → preview table → "Importar ahora" → celebration → Home shows counts and "Lo siguiente" → "Invitar" → role (Familia/Mentor) + email + optional message, with "Lo que verá" preview → email → guardian opens link → signs in with that email → "Aceptar" → guardian Home ("Estás viendo el espacio de … como familia").

**Alternatives.** Invite opened while signed in with another email → explains which email to use. Expired/revoked invite → calm message, Kumo resting. Unrecognised files → inline error with what to use. Magic link expired → request a new one (same screen).

**States.** Empty (no data: import card is primary) · loading (button labels "Enviando…/Importando…") · error (inline, says how to fix) · success (Kumo celebrating). Guardian hitting owner-only URLs is redirected to Home.
