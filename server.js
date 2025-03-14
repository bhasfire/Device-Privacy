import express from "express";
import cors from "cors";
import privacyRoutes from "./routes/privacyRoutes.js";

const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(express.json());

// (async () => {
//     const isAdmin = (await import("is-admin")).default;

//     isAdmin().then(admin => {
//         if (!admin) {
//             console.log("⚠️ Please run this script as Administrator.");
//             process.exit(1);
//         }
//     });
// })();


app.use("/api/privacy", privacyRoutes);

// Start Server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
