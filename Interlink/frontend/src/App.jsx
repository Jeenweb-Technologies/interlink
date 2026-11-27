import AppRoutes from "./routes";
import Footer from "./components/Footer";
import ReminderNotificationManager from "./components/reminders/ReminderNotificationManager";
import { useLocation } from "react-router-dom";

function App() {
    const location = useLocation();
    const standaloneFooterPaths = ["/device-registration", "/pending-approval", "/org-pending"];
    const showStandaloneFooter = standaloneFooterPaths.includes(location.pathname);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 relative">
            <ReminderNotificationManager />
            <div className="flex-1 flex flex-col">
                <AppRoutes />
            </div>
            {showStandaloneFooter && <Footer />}
        </div>
    );
}

export default App;
