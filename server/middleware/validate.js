/**
 * validate.js — Request Validation Middleware
 * ────────────────────────────────────────────
 * Reusable validation chains using express-validator.
 */

import { body, validationResult } from 'express-validator';

/**
 * Shared error handler — runs after validation chains.
 * Returns 400 with structured field errors if validation failed.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      fields: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
        value: e.value,
      })),
    });
  }

  next();
}

/**
 * POST /api/nudge — validate a manual nudge request.
 * Body: { targetUid, title, body, action?, deeplink? }
 */
export const validateNudgeRequest = [
  body('targetUid')
    .trim()
    .notEmpty()
    .withMessage('targetUid is required')
    .isString()
    .withMessage('targetUid must be a string')
    .isLength({ min: 1, max: 128 })
    .withMessage('targetUid must be 1–128 characters'),

  body('title')
    .trim()
    .notEmpty()
    .withMessage('title is required')
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('title must be 1–200 characters')
    .escape(),

  body('body')
    .trim()
    .notEmpty()
    .withMessage('body is required')
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('body must be 1–500 characters')
    .escape(),

  body('action')
    .optional()
    .trim()
    .isIn(['navigate', 'info', 'group'])
    .withMessage('action must be "navigate", "info", or "group"'),

  body('deeplink')
    .optional()
    .trim()
    .isString()
    .isLength({ max: 500 })
    .withMessage('deeplink must be ≤500 characters'),

  handleValidationErrors,
];

/**
 * POST /api/group/join — validate group join request.
 * Body: { groupId, displayName? }
 */
export const validateGroupJoin = [
  body('groupId')
    .trim()
    .notEmpty()
    .withMessage('groupId is required')
    .isString()
    .isLength({ min: 1, max: 128 })
    .withMessage('groupId must be 1–128 characters'),

  body('displayName')
    .optional()
    .trim()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('displayName must be 1–100 characters')
    .escape(),

  handleValidationErrors,
];

/**
 * POST /api/group/location — validate seat/exit status update.
 * Body: { groupId, nearExit }
 */
export const validateSeatUpdate = [
  body('groupId')
    .trim()
    .notEmpty()
    .withMessage('groupId is required')
    .isString()
    .isLength({ min: 1, max: 128 })
    .withMessage('groupId must be 1–128 characters'),

  body('nearExit')
    .notEmpty()
    .withMessage('nearExit is required')
    .isBoolean()
    .withMessage('nearExit must be a boolean'),

  handleValidationErrors,
];

export default { validateNudgeRequest, validateGroupJoin, validateSeatUpdate };
