import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout";
import Screener from "./pages/Screener";
import TokenDetail from "./pages/TokenDetail";
import Submit from "./pages/Submit";
import Wallet from "./pages/Wallet";
import KolScanner from "./pages/KolScanner";
import KolProfile from "./pages/KolProfile";
import Admin from "./pages/Admin";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Screener />} />
          <Route path="/token/:mint" element={<TokenDetail />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/wallet/:address" element={<Wallet />} />
          <Route path="/kol" element={<KolScanner />} />
          <Route path="/kol/:address" element={<KolProfile />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
