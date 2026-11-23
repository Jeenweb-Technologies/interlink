import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { PermissionProvider } from "./context/PermissionContext";
import { TaskTimerProvider } from "./context/TaskTimerContext";
import TaskFloatingTimer from "./components/tasks/TaskFloatingTimer";

import App from "./App";
import "./index.css";

ReactDOM.createRoot(
    document.getElementById("root")
).render(

    <BrowserRouter>
        <PermissionProvider>
            <TaskTimerProvider>
                <App />
                <TaskFloatingTimer />
                <Toaster position="top-right" />
            </TaskTimerProvider>
        </PermissionProvider>
    </BrowserRouter>
);