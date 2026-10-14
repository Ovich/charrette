import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BoardPage } from "./BoardPage.tsx";
import "./styles.css";

// `?repo=<key>[&repo=…][&run=<id>][&theme=light|dark]`: the repositories the board shows, the
// run whose channel opens first (D39)
const query = new URLSearchParams(window.location.search);
const repos = query.getAll("repo").filter(Boolean);
const asked = Number(query.get("run"));
const run = Number.isInteger(asked) && asked > 0 ? asked : null;
// aiview's frame passes its theme; absent, the system's
const theme = query.get("theme");
if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BoardPage repos={repos} run={run} />
  </StrictMode>,
);
