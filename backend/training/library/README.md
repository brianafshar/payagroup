# Standard exercise library

`exercises.json` + `images/` are installed into every coach's library (`training/library.py`,
`python manage.py install_exercise_library`). Coaches can replace the photo or add their own video.

Photos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db), released into the public
domain under the Unlicense (resized). Persian names, categories, measures and running sessions are ours.
Rebuild the images/JSON only by editing both together; `image` is the file name in `images/`.

Illustrations: flat, drawn exercise poses from [RepDB](https://repdb.co) («Exercise data by RepDB
(repdb.co)», free tier). The terms forbid redistributing the dataset, so the files are not in the repo:
`install_exercise_library` downloads each one (`illustration` in `exercises.json` is the RepDB id) into
`media/library/illustrations/` and prefers it over the photo. Set `EXERCISE_ILLUSTRATIONS=false` to skip.

## v2 (663 exercises)
Each entry also has `key` (stable id), `steps`, `tips` (stored as `cues`), `muscles_primary` /
`muscles_secondary`, corrective `issues`, `alternatives` (`band` / `home` keys) and, on band
exercises, `replaces`. `illustration_poses` is `["start", "peak"]` (two frames, saved as
`{slug}-start.webp` / `{slug}-peak.webp`), `["main"]` or `[]`; `illustration_match` is `exact`, `approx`
(a look-alike movement) or `none`; `badge: "band"` means the picture shows the cable/dumbbell version.
Band exercises (metric «شدت کش») are installed with unit `band`: sets carry a level, 1 yellow … 5 black.
`illustration_note_dev` is an internal note and is not imported.

Re-running `python manage.py install_exercise_library` after an update adds new exercises, fills empty
details of existing ones, replaces a library picture that was corrected, and returns to the photo when an
illustration was dropped. A coach's own picture, video and text are never changed. Labels for muscles,
issues and band levels: `packages/core/src/exercises.ts`.
