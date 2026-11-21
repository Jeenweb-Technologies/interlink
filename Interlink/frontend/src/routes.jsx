import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import DeviceRegistration from "./pages/DeviceRegistration";
import PendingApproval from "./pages/PendingApproval";

import UserHome from "./pages/user/UserHome";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserGroupMaster from "./pages/admin/user/UserGroupMaster";
import CreateUser from "./pages/admin/user/CreateUser";
import CreateUserType from "./pages/admin/user/CreateUserType";
import ActivityReport from "./pages/admin/ActivityReport";
import Profile from "./pages/Profile";
import TasksPage from "./pages/tasks/TasksPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { DashboardLayout } from "./components/Sidebar";

export default function AppRoutes() {
    return (
        <Routes>
            <Route
                path="/"
                element={<Login />}
            />

            <Route
                path="/device-registration"
                element={<DeviceRegistration />}
            />

            <Route
                path="/pending-approval"
                element={<PendingApproval />}
            />

            {/* Authenticated routes wrapped with ProtectedRoute and DashboardLayout */}
            <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                    <Route
                        path="/user/home"
                        element={<UserHome />}
                    />
                    <Route
                        path="/tasks"
                        element={<TasksPage />}
                    />
                    <Route
                        path="/profile"
                        element={<Profile />}
                    />

                    <Route element={<ProtectedRoute allowedRole="admin" requiredMasters={["user_master", "device_approval"]} requiredAction="read" />}>
                        <Route
                            path="/admin/dashboard"
                            element={<AdminDashboard />}
                        />
                    </Route>

                    <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="activity_report" requiredAction="read" />}>
                        <Route
                            path="/admin/report"
                            element={<ActivityReport />}
                        />
                    </Route>

                    <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="user_master" requiredAction="write" />}>
                        <Route
                            path="/admin/users/create"
                            element={<CreateUser />}
                        />
                    </Route>

                    <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="user_type" requiredAction="read" />}>
                        <Route
                            path="/admin/user-types"
                            element={<UserGroupMaster />}
                        />
                    </Route>

                    <Route element={<ProtectedRoute allowedRole="admin" requiredMaster="user_type" requiredAction="write" />}>
                        <Route
                            path="/admin/user-types/create"
                            element={<CreateUserType />}
                        />
                    </Route>
                </Route>
            </Route>
        </Routes>
    );
}
