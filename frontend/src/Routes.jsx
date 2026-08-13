// src/Routes.jsx
import { Routes, Route } from "react-router-dom";
import PageA from "./PageA.jsx"; // pageA.jsxの読み込み
import PageB from "./PageB.jsx"; // pageB.jsxの読み込み
import PageC from "./PageC.jsx"; // pageC.jsxの読み込み
import PageD from "./PageD.jsx"; // pageD.jsxの読み込み

export const AppRoutes = () => {
   return (
       <Routes>
           <Route path="/" element={<PageA />} />
           <Route path="/PageA" element={<PageA />} />
           <Route path="/PageB" element={<PageB />} />
           <Route path="/pageB" element={<PageB />} />
<Route path="/PageC" element={<PageC />} />
            <Route path="/pageC" element={<PageC />} />
            <Route path="/PageD" element={<PageD />} />
            <Route path="/pageD" element={<PageD />} />
       </Routes>
   )
}
