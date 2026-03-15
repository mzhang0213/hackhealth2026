-- ── Replace with your actual Supabase Auth user.id ────────────────────────────
DO $$
  DECLARE uid uuid := '956a5ce6-a95c-4ce9-b040-3856cbbd46cc';
BEGIN

  -- ── users ─────────────────────────────────────────────────────────────────────
INSERT INTO public.users (user_id, supabase_id, name, sport, injury_description, injury_date, doctor_diagnosis, pt_name)
VALUES (123123,uid, 'Alex Morgan', 'Basketball', 'ACL tear, left knee', '2025-12-01',
        'Grade III ACL rupture with partial meniscus involvement', 'Dr. Sarah Kim, PT')
    ON CONFLICT (supabase_id) DO NOTHING;

-- ── injury_logs ───────────────────────────────────────────────────────────────
INSERT INTO public.injury_logs (muscle, pain_level, color, border_color, supabase_user_id, slug, side, status, how_it_happened, date_of_injury, doctor_diagnosis, initial_symptoms)
VALUES
    ('knee', 9, '#ff0000', '#cc0000', uid, 'left_knee', 'left', 'pain', 'Landed awkwardly on a jump shot, heard a pop', '2025-12-01', 'Grade III ACL rupture', 'Severe swelling, instability, unable to bear weight'),
    ('quad', 6, '#ff6b00', '#cc5500', uid, 'left_quad', 'left', 'moderate', 'Secondary muscle compensation from ACL injury', '2025-12-15', 'Quad strain', 'Tightness and soreness'),
    ('hamstring', 3, '#ffa500', '#cc8400', uid, 'left_hamstring', 'left', 'recovering', 'Tightness from altered gait post-injury', '2026-01-10', NULL, 'Mild tightness');

-- ── exercises (current week: Mar 15–21 2026) ─────────────────────────────────
INSERT INTO exercises (user_id, name, sets, reps, duration, cat, accent_color, is_rehab, scheduled_date, completed)
VALUES
    -- Sunday Mar 15
    (uid, 'Quad Sets',               3, 15, NULL,  'strength', '#00d4ff', TRUE,  '2026-03-15', TRUE),
    (uid, 'Straight Leg Raises',     3, 10, NULL,  'strength', '#00d4ff', TRUE,  '2026-03-15', TRUE),
    (uid, 'Heel Slides',             3, 15, NULL,  'mobility', '#00e676', TRUE,  '2026-03-15', FALSE),
    -- Monday Mar 16
    (uid, 'Calf Raises',             3, 20, NULL,  'strength', '#00d4ff', TRUE,  '2026-03-16', FALSE),
    (uid, 'Seated Knee Flexion',     3, 15, NULL,  'mobility', '#00e676', TRUE,  '2026-03-16', FALSE),
    (uid, 'Hip Abduction',           3, 15, NULL,  'strength', '#ffb300', TRUE,  '2026-03-16', FALSE),
    -- Tuesday Mar 17 (rest day — just stretch)
    (uid, 'Hamstring Stretch',       1,  1, '60s', 'stretch',  '#ff6b6b', TRUE,  '2026-03-17', FALSE),
    (uid, 'IT Band Foam Roll',       1,  1, '90s', 'stretch',  '#ff6b6b', FALSE, '2026-03-17', FALSE),
    -- Wednesday Mar 18
    (uid, 'Mini Squats (0–45°)',     3, 12, NULL,  'strength', '#00d4ff', TRUE,  '2026-03-18', FALSE),
    (uid, 'Terminal Knee Extension', 3, 15, NULL,  'mobility', '#00e676', TRUE,  '2026-03-18', FALSE),
    (uid, 'Step-Ups (4 inch)',       3, 10, NULL,  'strength', '#00d4ff', TRUE,  '2026-03-18', FALSE),
    -- Thursday Mar 19
    (uid, 'Stationary Bike',         1,  1, '20m', 'mobility', '#00e676', TRUE,  '2026-03-19', FALSE),
    (uid, 'Quad Stretch',            1,  1, '60s', 'stretch',  '#ff6b6b', TRUE,  '2026-03-19', FALSE),
    -- Friday Mar 20
    (uid, 'Wall Sits',               3, 1,  '30s', 'strength', '#00d4ff', TRUE,  '2026-03-20', FALSE),
    (uid, 'Balance Board',           3, 1,  '30s', 'mobility', '#ffb300', TRUE,  '2026-03-20', FALSE),
    (uid, 'Clamshells',              3, 20, NULL,  'strength', '#ffb300', TRUE,  '2026-03-20', FALSE),
    -- Saturday Mar 21
    (uid, 'Pool Walking',            1,  1, '30m', 'mobility', '#00e676', FALSE, '2026-03-21', FALSE),
    (uid, 'Calf Stretch',            1,  1, '60s', 'stretch',  '#ff6b6b', TRUE,  '2026-03-21', FALSE);

-- ── checkins (last 7 days) ────────────────────────────────────────────────────
INSERT INTO checkins (user_id, pain_level, symptoms, created_at)
VALUES
    (uid, 6, ARRAY['swelling', 'stiffness'],            NOW() - INTERVAL '6 days'),
    (uid, 5, ARRAY['stiffness'],                        NOW() - INTERVAL '5 days'),
    (uid, 5, ARRAY['stiffness', 'aching'],              NOW() - INTERVAL '4 days'),
    (uid, 4, ARRAY['mild stiffness'],                   NOW() - INTERVAL '3 days'),
    (uid, 4, ARRAY[]::text[],                                   NOW() - INTERVAL '2 days'),
    (uid, 3, ARRAY['mild aching after exercise'],       NOW() - INTERVAL '1 day'),
    (uid, 3, ARRAY[]::text[],                                   NOW());

-- ── recovery_metrics (weekly, 8 weeks of progress) ───────────────────────────
INSERT INTO recovery_metrics (user_id, week_label, pain_score, mobility_score, strength_score, recorded_at)
VALUES
    (uid, 'W01', 82, 18, 12, NOW() - INTERVAL '7 weeks'),
    (uid, 'W02', 75, 24, 18, NOW() - INTERVAL '6 weeks'),
    (uid, 'W03', 68, 33, 26, NOW() - INTERVAL '5 weeks'),
    (uid, 'W04', 60, 42, 35, NOW() - INTERVAL '4 weeks'),
    (uid, 'W05', 52, 51, 44, NOW() - INTERVAL '3 weeks'),
    (uid, 'W06', 44, 60, 54, NOW() - INTERVAL '2 weeks'),
    (uid, 'W07', 36, 70, 63, NOW() - INTERVAL '1 week'),
    (uid, 'W08', 30, 78, 71, NOW());

-- ── mobility_scans (a few past ROM sessions) ──────────────────────────────────
INSERT INTO public.mobility_scans (supabase_user_id, muscle, joint_key, max_rom, average_rom, previous_rom, peak_delta, ml_classification, ml_status, ai_message, scanned_at)
VALUES
    (uid, 'Left Knee', 'L_knee', 68,  55, 0,   68,  0, 'RESTRICTED', 'Initial assessment. ROM severely limited. Begin passive ROM exercises.', NOW() - INTERVAL '6 weeks'),
    (uid, 'Left Knee', 'L_knee', 84,  70, 68,  16,  1, 'IMPROVING',  'Good progress. Continue current protocol, add terminal knee extensions.',  NOW() - INTERVAL '4 weeks'),
    (uid, 'Left Knee', 'L_knee', 101, 88, 84,  17,  1, 'IMPROVING',  'Approaching functional ROM. Begin light closed-chain exercises.',           NOW() - INTERVAL '2 weeks'),
    (uid, 'Left Knee', 'L_knee', 118, 104, 101, 17, 1, 'IMPROVING',  'Strong progress. Target full ROM (135°). Progress to step-ups.',           NOW() - INTERVAL '3 days');

END $$;
