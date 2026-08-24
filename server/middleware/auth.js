const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const authenticateToken = (req, res, next) => {
  if (!JWT_SECRET) {
    return res.status(500).json({ error: "Server auth configuration error" });
  }

  // Try to get token from cookies first
  let token = req.cookies?.accessToken;

  // Fallback to authorization header
  if (!token) {
    const authHeader = req.headers["authorization"] || "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken };
