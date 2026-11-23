import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { registerOrganization } from "../api/authApi";
import { InterlinkLogo } from "../components/Sidebar";
import jwlogo from "../assets/jwLogo.jpeg";

export default function RegisterOrg() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        orgName: "",
        companyName: "",
        name: "",
        email: "",
        mob_no: "",
        password: "",
        confirmPassword: ""
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        if (!form.orgName.trim() || !form.name.trim() || !form.email.trim() || !form.password) {
            toast.error("Please fill in all required fields.");
            return;
        }

        if (form.password.length < 6) {
            toast.error("Password must be at least 6 characters long.");
            return;
        }

        if (form.password !== form.confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                orgName: form.orgName.trim(),
                companyName: form.companyName.trim() || `${form.orgName.trim()} Main`,
                name: form.name.trim(),
                email: form.email.trim(),
                mob_no: form.mob_no.trim() || null,
                password: form.password
            };

            const response = await registerOrganization(payload);

            if (response.data.success) {
                toast.success(response.data.message || "Registration successful!");

                // If token returned, log them in automatically
                if (response.data.token && response.data.user) {
                    localStorage.setItem("user", JSON.stringify(response.data.user));
                    localStorage.setItem("token", response.data.token);
                    sessionStorage.setItem("loginTime", new Date().toLocaleTimeString());
                    window.dispatchEvent(new Event("auth-change"));
                    navigate("/user/home");
                } else {
                    navigate("/");
                }
            } else {
                toast.error(response.data.message || "Registration failed.");
            }
        } catch (error) {
            console.error("Registration error:", error);
            toast.error(
                error.response?.data?.message ||
                (error.code === "ERR_NETWORK" ? "Cannot connect to server. Check backend." : error.message) ||
                "Registration failed."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-screen flex flex-col md:flex-row bg-gradient-to-br from-[#06152d] via-slate-950 to-[#0b1b36] font-sans antialiased text-slate-200 overflow-y-auto relative py-6 md:py-0">
            {/* Ambient Glows */}
            <div className="absolute top-[35%] left-[25%] -translate-x-1/2 -translate-y-1/2 w-[40%] h-[60%] bg-blue-600/15 rounded-full blur-[130px] pointer-events-none z-0" />
            <div className="absolute top-[20%] left-[75%] -translate-x-1/2 -translate-y-1/2 w-[40%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none z-0" />

            {/* Left Column: Enterprise Showcase */}
            <div className="hidden md:flex md:w-5/12 h-full min-h-screen relative overflow-hidden select-none bg-transparent flex-col justify-center items-center p-8 z-10">
                <div className="w-full max-w-md flex flex-col items-center justify-center z-10">
                    <div className="w-full bg-slate-900/60 backdrop-blur-2xl border border-slate-800/80 rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl" />

                        <div className="flex items-center justify-between border-b border-slate-800/70 pb-4 mb-5">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
                                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
                                <span className="text-xs font-semibold text-slate-400 ml-2">Interlink Enterprise</span>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                Multi-Tenant Ready
                            </span>
                        </div>

                        <div className="py-6 flex flex-col items-center justify-center text-center">
                            <div className="relative mb-4">
                                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                                <InterlinkLogo size="xl" showText={false} light={true} />
                            </div>
                            <h2 className="text-base font-bold text-white tracking-wide mt-1">One Organization, Multiple Companies</h2>
                            <p className="text-xs text-slate-400 mt-1 max-w-xs">
                                Register your parent organization once. Manage subsidiaries, divisions, projects, and users seamlessly under one roof.
                            </p>
                        </div>

                        <div className="space-y-2.5 pt-3 border-t border-slate-800/70 text-xs text-slate-300">
                            <div className="flex items-center gap-2">
                                <i className="fa-solid fa-check text-emerald-400 text-xs"></i>
                                <span>Multi-company workspace management</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <i className="fa-solid fa-check text-emerald-400 text-xs"></i>
                                <span>Team & task collaboration suite</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <i className="fa-solid fa-check text-emerald-400 text-xs"></i>
                                <span>Role-based access & audit logs</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Registration Form */}
            <div className="w-full md:w-7/12 flex flex-col justify-center items-center px-4 sm:px-8 py-8 z-10 my-auto">
                <div className="w-full max-w-lg">
                    {/* Header */}
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="md:hidden mb-3">
                            <InterlinkLogo size="lg" light={true} />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            Register Organization
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1">
                            Create your organization and primary company workspace
                        </p>
                    </div>

                    {/* Form Card */}
                    <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
                        <form onSubmit={handleRegister} className="space-y-4">
                            {/* Section: Organization & Company Info */}
                            <div>
                                <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-2.5">
                                    1. Organization & Company Setup
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                            Organization Name <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="orgName"
                                            value={form.orgName}
                                            onChange={handleChange}
                                            required
                                            placeholder="e.g. Acme Group"
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                            Primary Company Name
                                        </label>
                                        <input
                                            type="text"
                                            name="companyName"
                                            value={form.companyName}
                                            onChange={handleChange}
                                            placeholder="e.g. Acme Tech (optional)"
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Admin User Info */}
                            <div className="pt-2 border-t border-slate-800/80">
                                <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-2.5">
                                    2. Primary Administrator Account
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                            Your Full Name <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={form.name}
                                            onChange={handleChange}
                                            required
                                            placeholder="John Doe"
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                            Phone / Mobile
                                        </label>
                                        <input
                                            type="tel"
                                            name="mob_no"
                                            value={form.mob_no}
                                            onChange={handleChange}
                                            placeholder="+1 555-0199"
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="mt-3.5">
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Work Email Address <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        required
                                        placeholder="admin@acmegroup.com"
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Section: Password */}
                            <div className="pt-2 border-t border-slate-800/80">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                            Password <span className="text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                name="password"
                                                value={form.password}
                                                onChange={handleChange}
                                                required
                                                placeholder="Min. 6 characters"
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all pr-10"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                            Confirm Password <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            name="confirmPassword"
                                            value={form.confirmPassword}
                                            onChange={handleChange}
                                            required
                                            placeholder="Repeat password"
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showPassword}
                                            onChange={() => setShowPassword(!showPassword)}
                                            className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-900"
                                        />
                                        <span>Show password</span>
                                    </label>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-4 py-3 rounded-xl text-white text-xs sm:text-sm font-semibold tracking-wider transition-all duration-300 bg-blue-600 hover:bg-blue-500 shadow-[0_4px_15px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-75 disabled:cursor-not-allowed flex justify-center items-center gap-2 cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Registering Organization...
                                    </>
                                ) : (
                                    <>
                                        <span>Create Organization & Workspace</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                        </svg>
                                    </>
                                )}
                            </button>

                            {/* Link back to login */}
                            <div className="text-center pt-2 text-xs text-slate-400">
                                Already have an organization account?{" "}
                                <Link to="/" className="text-blue-400 hover:text-blue-300 font-bold hover:underline transition-colors">
                                    Sign In here
                                </Link>
                            </div>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-2 border-t border-slate-900/60 pt-3 text-[10px] text-slate-500 w-full">
                        <div className="flex items-center gap-1.5">
                            <span>Powered by</span>
                            <img src={jwlogo} alt="Jeenweb" className="h-7 w-auto rounded-sm" />
                        </div>
                        <div className="text-center sm:text-right">
                            <div>Helpline: <a href="tel:9824466017" className="font-semibold text-slate-400">9824466017</a></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
