const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");
const multer = require("multer");
const { GridFSBucket } = require("mongodb");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(cors());

let gfsBucket;

// MongoDB Initialization
const initializeMongoDB = async () => {
    try {
        // Correctly reference the environment variable for the connection string
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error("❌ MONGODB_URI environment variable not set.");
            throw new Error("MONGODB_URI environment variable is required.");
        }
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        const conn = mongoose.connection;
        gfsBucket = new GridFSBucket(conn.db, { bucketName: "uploads" });
        console.log("✅ MongoDB/GridFS initialized successfully");
        return true;
    } catch (err) {
        console.error("❌ MongoDB/GridFS Initialization Error:", err.message);
        return false;
    }
};

// Multer Storage Configuration
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("Only JPEG, PNG, and PDF files are allowed"));
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});

// All your Mongoose Schemas
const CourseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    instructorRegNo: { type: String, required: true },
    students: [{ type: String }],
    progress: { type: Number, default: 0 },
    assignments: [{
        title: String,
        dueDate: Date,
        completed: { type: Boolean, default: false }
    }]
});
const Course = mongoose.model("Course", CourseSchema);

const DeadlineSchema = new mongoose.Schema({
    title: { type: String, required: true },
    date: { type: Date, required: true },
    courseCode: { type: String, required: true },
    studentRegNo: { type: String, required: true }
});
const Deadline = mongoose.model("Deadline", DeadlineSchema);

const CalendarEventSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    event: { type: String, required: true },
    studentRegNo: { type: String, required: true }
});
const CalendarEvent = mongoose.model("CalendarEvent", CalendarEventSchema);

const NotificationSchema = new mongoose.Schema({
    message: { type: String, required: true },
    date: { type: Date, default: Date.now },
    studentRegNo: { type: String, required: true },
    read: { type: Boolean, default: false },
    type: { type: String, enum: ["paper_update", "deadline_reminder", "profile_update", "general"], default: "general" }
});
const Notification = mongoose.model("Notification", NotificationSchema);

const FinanceSchema = new mongoose.Schema({
    studentRegNo: { type: String, required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["Paid", "Pending"], default: "Pending" }
});
const Finance = mongoose.model("Finance", FinanceSchema);

const ResearchScholarSchema = new mongoose.Schema({
    regNo: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: String,
    scholarDesignation: String,
    supervisor: String,
    externalContactMailId: String,
    internalDesignDepartmentExpert1: String,
    internalDesignDepartmentExpert2: String,
    expert1MailId: String,
    expert2MailId: String
}, { collection: "researchscholars" });
const ResearchScholar = mongoose.model("ResearchScholar", ResearchScholarSchema);

const UserSchema = new mongoose.Schema({
    regNo: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: String,
    department: String,
    password: { type: String, required: true },
    role: { type: String, enum: ["student", "teacher"], required: true },
    "Scholar No": String,
    "Scholar E-mail id": String,
    "Research Dept": String,
    "Supervisor Ph": { No: String },
    "Supervisor Mail Id": String,
    "External Expert Contact No": String,
    "External Expert Mail Id": String,
    "Internal-Expert-1 Ph No": String,
    "Internal-Expert-1 Mail Id": String,
    "Internal-Expert-2 Ph No": String,
    "Internal-Expert-2 Mail Id": String,
    researchPapers: [{
        filename: String,
        fileId: mongoose.Schema.Types.ObjectId,
        uploadedAt: Date,
        status: { type: String, enum: ["Pending", "Accepted", "Needs Modification"], default: "Pending" },
        teacherComment: { type: String, default: "" }
    }],
    profilePic: {
        filename: String,
        fileId: mongoose.Schema.Types.ObjectId
    },
    courses: [{
        name: String,
        code: String,
        instructor: String,
        progress: Number,
        assignments: [String]
    }]
});
const User = mongoose.model("User", UserSchema);

// Middleware to authenticate JWT token
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: "Access token required" });
    try {
        const decoded = jwt.verify(token, "your_jwt_secret");
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: "Invalid token" });
    }
};

// All Application Routes
app.get("/health", (req, res) => res.status(200).json({ success: true, message: "Server is running" }));

app.post("/auth/login", async (req, res) => {
    const { regNo, password, role } = req.body;
    try {
        if (!regNo || !password || !role) return res.status(400).json({ success: false, message: "regNo, password, and role are required" });
        const user = await User.findOne({ regNo, role });
        if (!user || user.password !== password) return res.status(400).json({ success: false, message: "Invalid credentials" });
        const token = jwt.sign({ regNo: user.regNo, role: user.role }, "your_jwt_secret", { expiresIn: "1h" });
        res.json({
            success: true,
            message: "Login successful",
            user: {
                name: user.name,
                email: user.email,
                department: user.department,
                regNo: user.regNo,
                role: user.role,
                profilePic: user.profilePic ? user.profilePic.filename : null,
                "Scholar E-mail id": user["Scholar E-mail id"],
                "Research Dept": user["Research Dept"],
                "Supervisor Mail Id": user["Supervisor Mail Id"],
                "External Expert Mail Id": user["External Expert Mail Id"],
                "Internal-Expert-1 Mail Id": user["Internal-Expert-1 Mail Id"],
                "Internal-Expert-2 Mail Id": user["Internal-Expert-2 Mail Id"],
                courses: user.courses || []
            },
            token
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get("/student/:regNo", authenticate, async (req, res) => {
    try {
        const { regNo } = req.params;
        if (req.user.regNo !== regNo || req.user.role !== "student") return res.status(403).json({ success: false, message: "Unauthorized" });
        const student = await User.findOne({ regNo, role: "student" });
        if (!student) return res.status(404).json({ success: false, message: "Student not found" });
        res.json({ success: true, student });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get("/student/:regNo/research-scholars", authenticate, async (req, res) => {
    try {
        const { regNo } = req.params;
        console.log(`Fetching research scholars for regNo: ${regNo}, user: ${JSON.stringify(req.user)}`);
        if (req.user.regNo !== regNo || req.user.role !== "student") return res.status(403).json({ success: false, message: "Unauthorized" });
        const scholar = await ResearchScholar.findOne({ regNo }).lean();
        const user = await User.findOne({ regNo, role: "student" }).lean();
        if (!scholar || !user) {
            console.log(`⚠️ No scholar or user data found for regNo: ${regNo}`);
            return res.status(404).json({ success: false, message: "No research scholar found for this regNo" });
        }
        const enrichedScholar = {
            regNo: scholar.regNo,
            name: scholar.name,
            email: scholar.email || user["Scholar E-mail id"] || "N/A",
            scholarDesignation: scholar.scholarDesignation || "PhD Scholar",
            supervisor: user["Supervisor Mail Id"] ? `Dr. ${user.name.split(" ")[0]} (Email: ${user["Supervisor Mail Id"]}, Phone: ${user["Supervisor Ph"]?.No || "N/A"})` : "N/A",
            externalContactMailId: user["External Expert Mail Id"] || "N/A",
            externalContactPhone: user["External Expert Contact No"] || "N/A",
            internalDesignDepartmentExpert1: user["Internal-Expert-1 Mail Id"] ? `${user.name.split(" ")[0]}'s Expert 1 (Email: ${user["Internal-Expert-1 Mail Id"]}, Phone: ${user["Internal-Expert-1 Ph No"] || "N/A"})` : "N/A",
            internalDesignDepartmentExpert2: user["Internal-Expert-2 Mail Id"] ? `${user.name.split(" ")[0]}'s Expert 2 (Email: ${user["Internal-Expert-2 Mail Id"]}, Phone: ${user["Internal-Expert-2 Ph No"] || "N/A"})` : "N/A",
            expert1MailId: user["Internal-Expert-1 Mail Id"] || "N/A",
            expert2MailId: user["Internal-Expert-2 Mail Id"] || "N/A"
        };
        console.log("✅ Fetched and enriched scholar data:", enrichedScholar);
        res.json({ success: true, scholars: [enrichedScholar] });
    } catch (err) {
        console.error("❌ Error fetching research scholars:", err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/uploadResearch", authenticate, upload.single("file"), async (req, res) => {
    try {
        if (!req.file || !req.body.regNo || req.user.regNo !== req.body.regNo || req.user.role !== "student") {
            return res.status(400).json({ success: false, message: "Invalid request" });
        }
        const user = await User.findOne({ regNo: req.body.regNo, role: "student" });
        if (!user) return res.status(404).json({ success: false, message: "Student not found" });

        const filename = `${Date.now()}-${req.file.originalname}`;
        const uploadStream = gfsBucket.openUploadStream(filename, { contentType: req.file.mimetype });
        uploadStream.end(req.file.buffer);

        uploadStream.on("finish", async () => {
            user.researchPapers.push({ filename, fileId: uploadStream.id, uploadedAt: new Date() });
            await user.save();
            await Notification.create({ message: `New research paper uploaded: "${filename}"`, studentRegNo: req.body.regNo, type: "paper_update" });
            res.status(200).json({ success: true, message: "Research paper uploaded", filename });
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/uploadProfilePic", authenticate, upload.single("profilePic"), async (req, res) => {
    try {
        if (!req.file || !req.body.regNo || req.user.regNo !== req.body.regNo) {
            return res.status(400).json({ success: false, message: "Invalid request" });
        }
        const user = await User.findOne({ regNo: req.body.regNo });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (user.profilePic?.fileId) {
            try {
                await gfsBucket.delete(user.profilePic.fileId);
            } catch (deleteError) {
                console.warn("⚠️ Could not delete old profile pic:", deleteError.message);
            }
        }

        const filename = `${Date.now()}-${req.file.originalname}`;
        const uploadStream = gfsBucket.openUploadStream(filename, { contentType: req.file.mimetype });
        uploadStream.end(req.file.buffer);

        uploadStream.on("finish", async () => {
            user.profilePic = { filename, fileId: uploadStream.id };
            await user.save();
            if (user.role === "student") {
                await Notification.create({ message: "Profile picture updated", studentRegNo: req.body.regNo, type: "profile_update" });
            }
            res.status(200).json({ success: true, message: "Profile picture uploaded", filename });
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get("/download/:filename", async (req, res) => {
    try {
        const files = await gfsBucket.find({ filename: req.params.filename }).toArray();
        if (!files.length) return res.status(404).json({ success: false, message: "File not found" });
        const downloadStream = gfsBucket.openDownloadStreamByName(files[0].filename);
        res.set("Content-Type", files[0].contentType);
        res.set("Content-Disposition", `attachment; filename="${files[0].filename}"`);
        downloadStream.pipe(res);
    } catch (err) {
        res.status(500).json({ success: false, message: "Download failed" });
    }
});

const handler = async (req, res) => {
    if (!mongoose.connection.readyState) {
        try {
            await initializeMongoDB();
        } catch (err) {
            return res.status(500).json({ success: false, message: "Server initialization failed" });
        }
    }
    app(req, res);
};

module.exports = handler;
