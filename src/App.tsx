import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { LangContext } from "./i18n";
import { LANGS, type Lang } from "./types";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Sport from "./pages/Sport";
import Exercises from "./pages/Exercises";
import ExerciseDetail from "./pages/ExerciseDetail";
import Contact from "./pages/Contact";

function LangShell() {
  const { lang } = useParams();
  if (!LANGS.includes(lang as Lang)) return <Navigate to="/fa" replace />;
  return (
    <LangContext.Provider value={lang as Lang}>
      <Layout />
    </LangContext.Provider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/fa" replace />} />
      <Route path="/:lang" element={<LangShell />}>
        <Route index element={<Home />} />
        <Route path="basketball" element={<Sport kind="basketball" />} />
        <Route path="elite" element={<Sport kind="bodybuilding" />} />
        <Route path="bodybuilding" element={<Navigate to="../elite" replace />} />
        <Route path="exercises" element={<Exercises />} />
        <Route path="exercises/:slug" element={<ExerciseDetail />} />
        <Route path="contact" element={<Contact />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Route>
    </Routes>
  );
}
