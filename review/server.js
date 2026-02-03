const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");

const app = express();
const PORT = 3001;
const SECRET_KEY = "secret-key-change";

/* ===== MIDDLEWARE ===== */

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const upload = multer({ dest: "uploads" });

/* ===== DATA (TEMP STORAGE) ===== */

let users = [
  {
    id: 1,
    email: "admin@example.com",
    password: bcrypt.hashSync("admin123", 10),
    name: "Admin",
    role: "admin",
  },
  {
    id: 2,
    email: "user@example.com",
    password: bcrypt.hashSync("user123", 10),
    name: "User",
    role: "user",
  },
];

let businesses = [
  {
    id: 1,
    name: "Italian Corner",
    category: "restaurant",
    location: "New Delhi",
    description: "Italian food",
  },
  {
    id: 2,
    name: "Tech Repair Hub",
    category: "service",
    location: "Noida",
    description: "Electronics repair",
  },
   {
    id: 3,
    name: "Fashion Boutique",
    category: "shop",
    location: "Pune",
    description: "Clothing and accessories",
  },
];

let reviews = [];
let nextUserId = 3;
let nextReviewId = 1;

/* ===== AUTH HELPERS ===== */

function verifyToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = header.split(" ")[1];

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = decoded;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
}

/* ===== RATING CALC ===== */

function calculateAverage(businessId) {
  const approved = reviews.filter(
    r => r.businessId === businessId && r.status === "approved"
  );

  if (approved.length === 0) return 0;

  let total = 0;
  approved.forEach(r => {
    total += r.ratings.quality + r.ratings.service + r.ratings.value;
  });

  return (total / (approved.length * 3)).toFixed(1);
}

/* ===== AUTH ROUTES ===== */

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (users.find(u => u.email === email)) {
    return res.json({ message: "exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    id: nextUserId++,
    name,
    email,
    password: hashedPassword,
    role: "user",
  };

  users.push(newUser);

  const token = jwt.sign(
    { id: newUser.id, role: newUser.role },
    SECRET_KEY
  );

  res.json({
    token,
    user: {
      id: newUser.id,
      name,
      email,
      role: newUser.role,
    },
  });
});

app.post("/api/auth/login", async (req, res) => {
  const user = users.find(u => u.email === req.body.email);
  if (!user) return res.json({ message: "fail" });

  const match = await bcrypt.compare(req.body.password, user.password);
  if (!match) return res.json({ message: "fail" });

  const token = jwt.sign(
    { id: user.id, role: user.role },
    SECRET_KEY
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

/* ===== BUSINESS ROUTES ===== */

app.get("/api/businesses", (req, res) => {
  let result = businesses;

  if (req.query.category) {
    result = result.filter(b => b.category === req.query.category);
  }

  if (req.query.location) {
    result = result.filter(b =>
      b.location.toLowerCase().includes(req.query.location.toLowerCase())
    );
  }

  if (req.query.search) {
    result = result.filter(b =>
      b.name.toLowerCase().includes(req.query.search.toLowerCase())
    );
  }

  res.json(
    result.map(b => ({
      ...b,
      averageRating: Number(calculateAverage(b.id)),
    }))
  );
});

app.get("/api/businesses/:id", (req, res) => {
  const business = businesses.find(b => b.id == req.params.id);

  res.json({
    ...business,
    averageRating: Number(calculateAverage(business.id)),
  });
});

app.get("/api/businesses/:id/reviews", (req, res) => {
  const list = reviews.filter(
    r => r.businessId == req.params.id && r.status === "approved"
  );
  res.json(list);
});

/* ===== REVIEW ROUTES ===== */

app.post(
  "/api/businesses/:id/reviews",
  verifyToken,
  upload.array("photos", 5),
  (req, res) => {
    const imagePaths = req.files
      ? req.files.map(f => "/uploads/" + f.filename)
      : [];

    const newReview = {
      id: nextReviewId++,
      businessId: Number(req.params.id),
      userId: req.user.id,
      comment: req.body.comment,
      ratings: {
        quality: Number(req.body.quality),
        service: Number(req.body.service),
        value: Number(req.body.value),
      },
      photos: imagePaths,
      status: "pending",
    };

    reviews.push(newReview);
    res.json(newReview);
  }
);

/* ===== ADMIN ROUTES ===== */

app.get("/api/admin/reviews", verifyToken, requireAdmin, (req, res) => {
  res.json(reviews.filter(r => r.status === "pending"));
});

app.post("/api/admin/reviews/:id", verifyToken, requireAdmin, (req, res) => {
  const review = reviews.find(r => r.id == req.params.id);
  review.status = req.body.status;
  res.json({ message: "updated" });
});

/* ===== START SERVER ===== */

app.listen(PORT, () => {
  console.log("Server running on " + PORT);
});
