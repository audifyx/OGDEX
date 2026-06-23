import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout";
import Screener from "./pages/Screener";
import TokenDetail from "./pages/TokenDetail";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Screener />} />
          <Route path="/token/:mint" element={<TokenDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
