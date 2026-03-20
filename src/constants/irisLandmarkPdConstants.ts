/**
 * Mirrors `mf_backend/app/services/iris_landmark_service.py` (lines ~20–33)
 * so admins can see which anthropometric priors the API uses.
 */
export const IRIS_LANDMARK_PD_CONSTANTS = {
  KNOWN_FACE_WIDTH_MM: 145.0,
  CALIB_DISTANCE_MM: 600.0,
  IRIS_DIAMETER_MM: 11.77,
  IPD_TO_FACE_WIDTH_PRIOR: 62.5 / 145.0,
  FACE_PD_BLEND: 0.22,
  PRIOR_BLEND_MM: 0.06,
  PD_IRIS_FACE_DISAGREE_MM: 4.5,
  HINT_MAX_DELTA_MM: 6.0,
  HINT_BLEND: 0.22,
  L_IRIS_IDX: [468, 469, 470, 471, 472] as const,
  R_IRIS_IDX: [473, 474, 475, 476, 477] as const,
} as const;

export const IRIS_LANDMARK_PD_CONSTANTS_SOURCE = 'iris_landmark_service.py';
