import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RunPage } from "./RunPage.tsx";
import "./styles.css";

// `?run=<id>`: the one run aiview frames; the page has no other view (plan D6)
const query = new URLSearchParams(window.location.search);
const run = Number(query.get("run"));
// aiview's frame passes its theme; absent, the system's
const theme = query.get("theme");
if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;

createRoot(document.getElementById("root")!).render(<StrictMode>{Number.isInteger(run) && run > 0 ? <RunPage run={run} /> : <div className="content">A run is opened from its aiview document (`swarm open`).</div>}</StrictMode>);
