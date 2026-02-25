const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const GuestSession = require("../models/GuestSession");
const { authenticateToken } = require("../middleware/auth");
const logger = require("../utils/logger");
const { generateRefreshToken } = require("../utils/refreshTokenHelpers");
const { v4: uuidv4 } = require("uuid");
const { cleanupSingleGuestSession } = require("../utils/cleanupScheduler");

const router = express.Router();
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "7d";

/**
 * Create a new guest session
 * POST /auth/guest
 */
router.post("/", async (req, res) => {
  const startTime = Date.now();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get("user-agent");
  const { previousSessionId } = req.body;

  try {
    // If previous session ID provided, cleanup old session data
    if (previousSessionId) {
      try {
        const oldSession = await GuestSession.findById(previousSessionId);
        if (oldSession) {
          logger.info(
            "Cleaning up previous guest session before creating new one",
            {
              sessionId: previousSessionId,
            },
          );
          // Run cleanup asynchronously to not delay response significantly
          cleanupSingleGuestSession(oldSession).catch((err) => {
            logger.error("Failed to cleanup previous session", { error: err });
          });
        }
      } catch (cleanupError) {
        // Log but don't fail new session creation
        logger.error("Error checking previous session", {
          error: cleanupError,
        });
      }
    }

    // Generate unique guest identifier
    const guestId = uuidv4().slice(0, 8);
    const guestEmail = `guest${guestId}@sushantpardhi.in`;
    const guestName = `Guest ${guestId}`;
    const tempPassword = uuidv4(); // Random password, won't be used for login

    // Create temporary guest user
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const guestUser = new User({
      name: guestName,
      email: guestEmail,
      password: hashedPassword,
      role: "guest",
      isTemporaryGuest: true,
      storageLimit: GuestSession.GUEST_STORAGE_LIMIT,
    });

    await guestUser.save();

    // Create guest session
    const guestSession = await GuestSession.createSession(guestUser._id);

    // Link session to user
    guestUser.guestSessionId = guestSession._id;
    await guestUser.save();

    // Generate JWT access token
    const token = jwt.sign(
      {
        id: guestUser._id,
        email: guestUser.email,
        name: guestUser.name,
        role: guestUser.role,
        isTemporaryGuest: true,
        guestSessionId: guestSession._id,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION },
    );

    logger.logAuth("guest-session-create", guestUser._id, {
      ip,
      userAgent,
      sessionId: guestSession._id,
      expiresAt: guestSession.expiresAt,
    });

    logger.logPerformance("guest-session-create", Date.now() - startTime, {
      userId: guestUser._id,
    });

    res.status(201).json({
      message: "Guest session created successfully",
      token,
      user: {
        id: guestUser._id,
        name: guestUser.name,
        email: guestUser.email,
        role: guestUser.role,
        isTemporaryGuest: true,
        storageLimit: guestUser.storageLimit,
        storageUsed: guestUser.storageUsed,
      },
      session: {
        sessionId: guestSession._id,
        expiresAt: guestSession.expiresAt,
        remainingMs: guestSession.expiresAt.getTime() - Date.now(),
        extensionCount: guestSession.extensionCount,
        maxExtensions: GuestSession.GUEST_MAX_EXTENSIONS,
        canExtend: true,
      },
    });
  } catch (error) {
    logger.logError(error, {
      operation: "guest-session-create",
      ip,
    });
    res.status(500).json({ error: "Failed to create guest session" });
  }
});

/**
 * Resume an existing guest session
 * POST /auth/guest/resume
 */
router.post("/resume", async (req, res) => {
  const startTime = Date.now();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get("user-agent");

  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    // Find the session
    const session = await GuestSession.findById(sessionId);

    if (!session) {
      // Session doesn't exist, remove from localStorage
      return res.status(404).json({
        error: "Session not found",
        code: "GUEST_SESSION_NOT_FOUND",
      });
    }

    // Check if session is still valid (active and not expired)
    const isValid =
      session.status === "active" && session.expiresAt > new Date();
    if (!isValid) {
      return res.status(410).json({
        error: "Session has expired",
        code: "GUEST_SESSION_EXPIRED",
      });
    }

    // Find the guest user associated with this session
    const guestUser = await User.findOne({ guestSessionId: sessionId });

    if (!guestUser) {
      return res.status(404).json({
        error: "Guest user not found",
        code: "GUEST_USER_NOT_FOUND",
      });
    }

    // Generate new JWT access token
    const token = jwt.sign(
      {
        id: guestUser._id,
        email: guestUser.email,
        name: guestUser.name,
        role: guestUser.role,
        isTemporaryGuest: true,
        guestSessionId: session._id,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION },
    );

    logger.logAuth("guest-session-resume", guestUser._id, {
      ip,
      userAgent,
      sessionId: session._id,
      expiresAt: session.expiresAt,
    });

    logger.logPerformance("guest-session-resume", Date.now() - startTime, {
      userId: guestUser._id,
    });

    res.json({
      message: "Guest session resumed successfully",
      token,
      user: {
        id: guestUser._id,
        name: guestUser.name,
        email: guestUser.email,
        role: guestUser.role,
        isTemporaryGuest: true,
        storageLimit: guestUser.storageLimit,
        storageUsed: guestUser.storageUsed,
      },
      session: {
        sessionId: session._id,
        expiresAt: session.expiresAt,
        remainingMs: session.expiresAt.getTime() - Date.now(),
        extensionCount: session.extensionCount,
        maxExtensions: GuestSession.GUEST_MAX_EXTENSIONS,
        canExtend: session.extensionCount < GuestSession.GUEST_MAX_EXTENSIONS,
      },
    });
  } catch (error) {
    logger.logError(error, {
      operation: "guest-session-resume",
      ip,
    });
    res.status(500).json({ error: "Failed to resume guest session" });
  }
});

/**
 * Get current guest session status
 * GET /auth/guest/status
 */
router.get("/status", authenticateToken, async (req, res) => {
  try {
    // Check if user is a temporary guest
    if (!req.user.isTemporaryGuest) {
      return res.status(400).json({
        error: "Not a guest session",
        isTemporaryGuest: false,
      });
    }

    const sessionId = req.user.guestSessionId;
    if (!sessionId) {
      return res.status(400).json({
        error: "No guest session found",
      });
    }

    const status = await GuestSession.getSessionStatus(sessionId);

    if (!status) {
      return res.status(404).json({
        error: "Guest session not found",
      });
    }

    res.json(status);
  } catch (error) {
    logger.logError(error, {
      operation: "guest-session-status",
      userId: req.user?.id,
    });
    res.status(500).json({ error: "Failed to get session status" });
  }
});

/**
 * Extend guest session
 * POST /auth/guest/extend
 */
router.post("/extend", authenticateToken, async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  try {
    // Check if user is a temporary guest
    if (!req.user.isTemporaryGuest) {
      return res.status(400).json({
        error: "Not a guest session",
      });
    }

    const sessionId = req.user.guestSessionId;
    if (!sessionId) {
      return res.status(400).json({
        error: "No guest session found",
      });
    }

    const session = await GuestSession.extendSession(sessionId);

    if (!session) {
      return res.status(400).json({
        error:
          "Unable to extend session. Maximum extensions reached or session expired.",
      });
    }

    const status = await GuestSession.getSessionStatus(sessionId);

    logger.logAuth("guest-session-extend", req.user.id, {
      ip,
      sessionId,
      newExpiresAt: session.expiresAt,
      extensionCount: session.extensionCount,
    });

    res.json({
      message: "Session extended successfully",
      ...status,
    });
  } catch (error) {
    logger.logError(error, {
      operation: "guest-session-extend",
      userId: req.user?.id,
    });
    res.status(500).json({ error: "Failed to extend session" });
  }
});

/**
 * Convert guest to full account
 * POST /auth/guest/convert
 */
router.post(
  "/convert",
  authenticateToken,
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    const startTime = Date.now();
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("user-agent");

    try {
      // Check if user is a temporary guest
      if (!req.user.isTemporaryGuest) {
        return res.status(400).json({
          error: "Not a guest session. Only guests can convert to accounts.",
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password } = req.body;

      // Check if email already exists (not the guest's temp email)
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.user.id },
      });

      if (existingUser) {
        return res.status(409).json({
          error: "An account with this email address already exists",
          errorType: "USER_EXISTS",
        });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update the guest user to a full account
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update user fields
      user.name = name;
      user.email = email;
      user.password = hashedPassword;
      user.isTemporaryGuest = false;
      user.role = "user"; // Upgrade to user role
      user.storageLimit = 5 * 1024 * 1024 * 1024; // 5GB for users

      await user.save();

      // Mark session as converted
      const sessionId = req.user.guestSessionId;
      if (sessionId) {
        await GuestSession.convertSession(sessionId);
      }

      // Generate new JWT access token with updated info
      const token = jwt.sign(
        {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isTemporaryGuest: false,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION },
      );

      // Generate new refresh token
      const refreshToken = generateRefreshToken(user);

      // Set refresh token as HTTP-only cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      logger.logAuth("guest-convert", user._id, {
        ip,
        userAgent,
        oldEmail: req.user.email,
        newEmail: email,
        sessionId,
      });

      logger.logPerformance("guest-convert", Date.now() - startTime, {
        userId: user._id,
      });

      res.json({
        message:
          "Account created successfully! Your files have been preserved.",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isTemporaryGuest: false,
          storageLimit: user.storageLimit,
          storageUsed: user.storageUsed,
        },
      });
    } catch (error) {
      logger.logError(error, {
        operation: "guest-convert",
        userId: req.user?.id,
        ip,
      });
      res.status(500).json({ error: "Failed to create account" });
    }
  },
);

module.exports = router;
