import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Shield, User, Lock, ArrowRight } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const formData = new URLSearchParams();
            formData.append('username', email); // OAuth2PasswordRequestForm needs 'username'
            formData.append('password', password);

            const res = await api.post('/auth/login', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const { access_token, role } = res.data;
            if (role !== 'admin') {
                throw new Error('权限不足：需要管理员权限');
            }

            localStorage.setItem('admin_token', access_token);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || err.message || '登录失败，请检查您的凭证');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setError('');
        setIsLoading(true);
        try {
            const res = await api.post('/auth/google', {
                token: credentialResponse.credential
            });
            const { access_token, role } = res.data;
            if (role !== 'admin') {
                throw new Error('权限不足：需要管理员权限');
            }
            localStorage.setItem('admin_token', access_token);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || err.message || 'Google 登录失败');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">

            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-3xl" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-100/50 rounded-full blur-3xl" />

            <div className="w-full max-w-md p-8 relative z-10">
                {/* Logo & Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl overflow-hidden shadow-lg shadow-purple-600/20 mb-6 mx-auto bg-white border border-gray-100">
                        <img src="/favicon.png" className="w-full h-full object-cover" alt="Logo" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">OpenBible <span className="text-gray-400 font-normal">Admin</span></h2>
                    <p className="mt-3 text-gray-500 font-medium tracking-wide text-sm uppercase">管理员安全系统</p>
                </div>

                {/* Form Card */}
                <div className="bg-white/80 backdrop-blur-xl shadow-xl shadow-gray-200/50 rounded-2xl p-8 border border-white/50">
                    {error && (
                        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3">
                            <Shield className="text-red-500 shrink-0 mt-0.5" size={18} />
                            <p className="text-sm font-medium text-red-600">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">管理员账号</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={email}
                                    placeholder="请输入用户名或邮箱"
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50/50 transition-colors"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">安全密码</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    placeholder="请输入密码"
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50/50 transition-colors"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed group gap-2"
                        >
                            {isLoading ? '验证身份中...' : (
                                <>
                                    安全登录
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-slate-50 text-gray-500">或使用其它方式</span>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-center">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => setError('Google 登录失败，请重试')}
                                useOneTap
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-gray-400 mt-8 font-medium">
                    &copy; {new Date().getFullYear()} OpenBible Platform. All rights reserved.
                </p>
            </div>
        </div>
    );
};

export default Login;
