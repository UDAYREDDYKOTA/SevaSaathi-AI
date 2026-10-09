require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const aiRoutes = require("./routes/aiRoutes");
const knowledgeGraphRoutes = require("./routes/knowledgeGraphRoutes");
const preventivePlannerRoutes = require("./routes/preventivePlannerRoutes");
const simulatorRoutes = require("./routes/simulatorRoutes");
const contextRiskRoutes = require("./routes/contextRiskRoutes");
const copilotRoutes = require("./routes/copilotRoutes");

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// SevaSaathi AI Routes (Stages 1–16)
app.use("/api/reports", aiRoutes);
// Stage 17: Civic Knowledge Graph Routes
app.use("/api/knowledge-graph", knowledgeGraphRoutes);
// Stage 18: Preventive Action Planner Routes
app.use("/api/preventive-planner", preventivePlannerRoutes);
// Stage 19: Municipal What-If Simulator Routes
app.use("/api/simulator", simulatorRoutes);
// Stage 20: Context-Aware Civic Risk Routes
app.use("/api/context-risk", contextRiskRoutes);
// Stage 21: Municipal AI Copilot Routes
app.use("/api/copilot", copilotRoutes);

mongoose.connect("mongodb+srv://varshitha34871_db_user:uday2127@cluster0.ikm2mxb.mongodb.net/?appName=Cluster0ss")
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.log(err));

app.get("/", (req, res) => {
    res.send("Backend Working");
});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});
