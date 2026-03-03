"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Camera, Loader2 } from "lucide-react";

export default function Home() {
    const { data: session, status } = useSession() ?? {};
    const router = useRouter();

    useEffect(() => {
        if (status === "authenticated") {
            router.replace("/dashboard");
        } else if (status === "unauthenticated") {
            router.replace("/login");
        }
    }, [status, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                    <Camera className="w-16 h-16 text-blue-500" />
                </div>
                <h1 className="text-3xl font-bold mb-4">
                    TYCHE PTZ Controller
                </h1>
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            </div>
        </div>
    );
}
