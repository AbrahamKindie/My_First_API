
import express from "express";
import authRoutes from "./routs/authRoutes.js";
import usersRoutes from "./routs/userRoutes.js";


const app = express();

app.use(express.json());
app.use("/auth", authRoutes);
app.use("/users", usersRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});