
import express from "express";
import authRoutes from "./routs/authRoutes.js";
import usersRoutes from "./routs/userRoutes.js";
import categoryRoutes from "./routs/categoryRoutes.js";
import productRoutes from "./routs/productRoutes.js";
import orderRoutes from "./routs/orderRoutes.js";


const app = express();

//API Routs
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/categories", categoryRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});