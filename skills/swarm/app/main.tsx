import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { RunPage } from "./RunPage.tsx";
import "./styles.css";

// `?run=<id>`: the one run aiview frames; without it, the whole board (`swarm serve --open`)
const query = new URLSearchParams(window.location.search);
const run = Number(query.get("run"));
// aiview's frame passes its theme; absent, the system's
const theme = query.get("theme");
if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;

createRoot(document.getElementById("root")!).render(<StrictMode>{Number.isInteger(run) && run > 0 ? <RunPage run={run} /> : <App />}</StrictMode>);
