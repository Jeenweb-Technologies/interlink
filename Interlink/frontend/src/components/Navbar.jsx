import React from "react";
import Sidebar from "./Sidebar";

// In Interlink, navigation has been upgraded from a top navbar to a modern side bar (Sidebar).
// DashboardLayout wraps all authenticated routes and renders <Sidebar />, <TopBar />, and <Footer />.
// This component is retained for backward compatibility with existing imports.
export default function Navbar() {
    return null;
}

export { Sidebar };
